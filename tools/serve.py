#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import functools
import http.server
import json
import shutil
import socketserver
import threading
import webbrowser
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
VISUAL_PACKS_DIR = ROOT / 'assets' / 'visual_packs'
TERRAIN_PRESETS_DIR = ROOT / 'assets' / 'terrain'
WORKING_PACK_ID = 'local_working_visuals'
WORKING_TERRAIN_PRESET_ID = 'local_working_terrain'
WORKING_PACK_ROOT = VISUAL_PACKS_DIR / WORKING_PACK_ID
WORKING_TERRAIN_PRESET_ROOT = TERRAIN_PRESETS_DIR / WORKING_TERRAIN_PRESET_ID
WORKING_MANIFEST_PATH = WORKING_PACK_ROOT / 'VAW_VISUAL_ASSET_PACK_V1.json'
WORKING_TERRAIN_PRESET_PATH = WORKING_TERRAIN_PRESET_ROOT / 'VAW_TERRAIN_AUTHORING_V1.json'
INSTALLED_PACKS_PATH = VISUAL_PACKS_DIR / 'installed_visual_packs.json'
LOCAL_INSTALL_FORMAT = 'VAW_LOCAL_VISUAL_BLOCK_INSTALL_V1'
LOCAL_TERRAIN_FORMAT = 'VAW_TERRAIN_AUTHORING_V1'
ALLOWED_BLOCK_TYPES = {
    'Core', 'Hull', 'Frame', 'Thruster', 'VectorThruster', 'Balloon', 'Wing', 'ControlSurface', 'Gyro', 'Fuel'
}
KNOWN_TERRAIN_PAD_IDS = {
    'startPad', 'finishPad', 'weatherSpirePad', 'northPad', 'ridgePad',
    'southPad', 'towerPad', 'eastDepot', 'skyhookPad', 'frontierPad'
}
TERRAIN_TEXTURE_KINDS = {'checker', 'stripe', 'noise'}
NODE_ALIASES = ('visualRoot', 'flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot')
CLIP_ALIASES = ('idle', 'thrust', 'damage')
MAX_POST_BYTES = 64 * 1024 * 1024
DEV_ENDPOINT_PATH = '/__vaw/install_visual_block'
DEV_TERRAIN_ENDPOINT_PATH = '/__vaw/install_terrain_preset'


def is_allowed_dev_origin(origin: str | None) -> bool:
    if not origin:
        return False
    try:
        parsed = urlparse(origin)
    except Exception:
        return False
    return parsed.scheme in {'http', 'https'} and parsed.hostname in {'127.0.0.1', 'localhost', '::1'}


def block_slug(block_type: str) -> str:
    out: list[str] = []
    for index, char in enumerate(block_type):
        if char.isupper() and index > 0:
            out.append('_')
        out.append(char.lower())
    return ''.join(out)


def safe_posix_path(value: str) -> PurePosixPath:
    raw = str(value or '').strip()
    if not raw:
        raise ValueError('path must be non-empty')
    if raw.startswith('/') or raw.startswith('./') or '\\' in raw:
        raise ValueError(f'unsafe path: {value}')
    if '?' in raw or '#' in raw or ':' in raw:
        raise ValueError(f'unsafe path: {value}')
    path = PurePosixPath(raw)
    if path.is_absolute() or any(part in ('', '.', '..') for part in path.parts):
        raise ValueError(f'unsafe path: {value}')
    return path


def resolve_under_working_pack(relative_path: str) -> Path:
    safe = safe_posix_path(relative_path)
    target = (WORKING_PACK_ROOT / Path(*safe.parts)).resolve()
    root = WORKING_PACK_ROOT.resolve()
    if target != root and root not in target.parents:
        raise ValueError(f'path escapes working visual pack: {relative_path}')
    return target


def default_working_manifest() -> dict:
    return {
        'format': 'VAW_VISUAL_ASSET_PACK_V1',
        'packId': WORKING_PACK_ID,
        'version': '0.1.0-local.0',
        'metadata': {
            'status': 'local-working-pack',
            'authority': 'visual-only',
            'revision': 0,
            'note': 'Developer working pack for fast renderer-only visual iteration. It is not gameplay authority.'
        },
        'assets': []
    }


def default_working_terrain_preset() -> dict:
    return {
        'format': LOCAL_TERRAIN_FORMAT,
        'presetId': WORKING_TERRAIN_PRESET_ID,
        'version': '0.1.0-local.0',
        'metadata': {
            'status': 'local-working-preset',
            'authority': 'renderer-only-terrain',
            'revision': 0,
            'note': 'Studio-editable terrain appearance preset. It is not gameplay authority.'
        },
        'terrain': {
            'fog': {'color': 0x0b1220, 'density': 0.0038},
            'baseMaterial': 'basin',
            'materials': {
                'basin': {'color': 0x15283a, 'roughness': 1, 'texture': {'kind': 'checker', 'colorA': 0x15283a, 'colorB': 0x1b3349, 'repeat': 34}},
                'routePaint': {'color': 0x93c5fd, 'roughness': 0.8, 'opacity': 0.34, 'texture': {'kind': 'stripe', 'colorA': 0x60a5fa, 'colorB': 0x1e3a8a, 'repeat': 12}}
            },
            'patches': [],
            'strips': []
        }
    }


def read_json_file(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return json.loads(json.dumps(fallback))
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else json.loads(json.dumps(fallback))
    except (OSError, json.JSONDecodeError):
        return json.loads(json.dumps(fallback))


def write_json_file(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def next_revision(manifest: dict) -> int:
    current = manifest.get('metadata', {}).get('revision', manifest.get('revision', 0))
    try:
        return int(current) + 1
    except (TypeError, ValueError):
        return 1


def normalize_binding_nodes(nodes: object) -> dict:
    source = nodes if isinstance(nodes, dict) else {}
    normalized: dict[str, str | None] = {}
    for alias in NODE_ALIASES:
        value = source.get(alias)
        normalized[alias] = str(value).strip() if isinstance(value, str) and value.strip() else None
    if not normalized.get('visualRoot'):
        raise ValueError('bindings.nodes.visualRoot is required before installing a VAW block visual')
    return normalized


def normalize_binding_clips(clips: object) -> dict:
    source = clips if isinstance(clips, dict) else {}
    normalized: dict[str, str | None] = {}
    for alias in CLIP_ALIASES:
        value = source.get(alias)
        normalized[alias] = str(value).strip() if isinstance(value, str) and value.strip() else None
    return normalized


def normalize_transform(transform: object) -> dict:
    source = transform if isinstance(transform, dict) else {}

    def vector(name: str, fallback: tuple[float, float, float]) -> dict:
        value = source.get(name) if isinstance(source.get(name), dict) else {}
        out = {}
        for axis, default in zip(('x', 'y', 'z'), fallback):
            try:
                out[axis] = float(value.get(axis, default))
            except (TypeError, ValueError):
                out[axis] = default
        return out

    return {
        'position': vector('position', (0, 0, 0)),
        'rotationDegrees': vector('rotationDegrees', (0, 0, 0)),
        'scale': vector('scale', (1, 1, 1))
    }


def normalize_material_policy(policy: object) -> dict:
    source = policy if isinstance(policy, dict) else {}
    normalized = {
        'pixelated': bool(source.get('pixelated', True)),
        'alpha': str(source.get('alpha') or 'auto'),
        'doubleSided': source.get('doubleSided', 'from-gltf')
    }
    overrides = source.get('materialOverrides')
    if isinstance(overrides, list):
        normalized_overrides: list[dict] = []
        for item in overrides:
            if not isinstance(item, dict):
                continue
            material_name = str(item.get('materialName') or item.get('name') or '').strip()
            if not material_name:
                continue
            row = {'materialName': material_name}
            if item.get('alpha') is not None:
                row['alpha'] = str(item.get('alpha'))
            if item.get('doubleSided') is not None:
                row['doubleSided'] = item.get('doubleSided')
            normalized_overrides.append(row)
        if normalized_overrides:
            normalized['materialOverrides'] = normalized_overrides
    return normalized


def clamp_number(value: object, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = fallback
    return min(maximum, max(minimum, number))


def normalize_color(value: object, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = fallback
    return min(0xFFFFFF, max(0, number))


def normalize_terrain_texture(texture: object) -> dict:
    source = texture if isinstance(texture, dict) else {}
    kind = str(source.get('kind') or 'checker')
    if kind not in TERRAIN_TEXTURE_KINDS:
        raise ValueError(f'unsupported terrain texture kind: {kind}')
    return {
        'kind': kind,
        'colorA': normalize_color(source.get('colorA'), 0x15283a),
        'colorB': normalize_color(source.get('colorB'), 0x1b3349),
        'repeat': clamp_number(source.get('repeat'), 1, 128, 16)
    }


def normalize_terrain_material(material_id: str, material: object) -> dict:
    if not material_id or not material_id[0].isalpha() or not all(ch.isalnum() or ch in {'_', '-'} for ch in material_id):
        raise ValueError(f'invalid terrain material id: {material_id}')
    source = material if isinstance(material, dict) else {}
    normalized = {
        'color': normalize_color(source.get('color'), 0x15283a),
        'roughness': clamp_number(source.get('roughness'), 0, 1, 1),
        'texture': normalize_terrain_texture(source.get('texture'))
    }
    if source.get('opacity') is not None:
        normalized['opacity'] = clamp_number(source.get('opacity'), 0.05, 1, 1)
    return normalized


def normalize_working_terrain_preset(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError('payload must be a JSON object')
    if payload.get('format') != LOCAL_TERRAIN_FORMAT:
        raise ValueError(f'format must be {LOCAL_TERRAIN_FORMAT}')
    terrain = payload.get('terrain')
    if not isinstance(terrain, dict):
        raise ValueError('terrain must be an object')
    materials_source = terrain.get('materials')
    if not isinstance(materials_source, dict) or not materials_source:
        raise ValueError('terrain.materials must contain at least one material')
    materials = {str(key): normalize_terrain_material(str(key), value) for key, value in materials_source.items()}
    base_material = str(terrain.get('baseMaterial') or next(iter(materials)))
    if base_material not in materials:
        raise ValueError(f'baseMaterial references missing material: {base_material}')

    def normalize_patch(index: int, value: object) -> dict:
        source = value if isinstance(value, dict) else {}
        patch_id = str(source.get('id') or f'terrain-patch-{index + 1}').strip()
        material = str(source.get('material') or base_material).strip()
        if material not in materials:
            raise ValueError(f'patch {patch_id} references missing material: {material}')
        return {
            'id': patch_id,
            'material': material,
            'center': {
                'x': clamp_number((source.get('center') or {}).get('x') if isinstance(source.get('center'), dict) else None, -10000, 10000, 0),
                'z': clamp_number((source.get('center') or {}).get('z') if isinstance(source.get('center'), dict) else None, -10000, 10000, 0)
            },
            'size': {
                'x': clamp_number((source.get('size') or {}).get('x') if isinstance(source.get('size'), dict) else None, 0.1, 10000, 20),
                'z': clamp_number((source.get('size') or {}).get('z') if isinstance(source.get('size'), dict) else None, 0.1, 10000, 20)
            },
            'rotation': clamp_number(source.get('rotation'), -1000, 1000, 0),
            'layer': int(clamp_number(source.get('layer'), 0, 1000, 10)),
            **({'opacity': clamp_number(source.get('opacity'), 0.05, 1, 1)} if source.get('opacity') is not None else {})
        }

    def normalize_strip(index: int, value: object) -> dict:
        source = value if isinstance(value, dict) else {}
        strip_id = str(source.get('id') or f'terrain-strip-{index + 1}').strip()
        material = str(source.get('material') or base_material).strip()
        from_pad = str(source.get('fromPad') or '').strip()
        to_pad = str(source.get('toPad') or '').strip()
        if material not in materials:
            raise ValueError(f'strip {strip_id} references missing material: {material}')
        if from_pad not in KNOWN_TERRAIN_PAD_IDS or to_pad not in KNOWN_TERRAIN_PAD_IDS:
            raise ValueError(f'strip {strip_id} references missing pad')
        return {
            'id': strip_id,
            'fromPad': from_pad,
            'toPad': to_pad,
            'width': clamp_number(source.get('width'), 0.1, 10000, 8),
            'material': material,
            'opacity': clamp_number(source.get('opacity'), 0.05, 1, 0.4),
            'layer': int(clamp_number(source.get('layer'), 0, 1000, 20))
        }

    revision = next_revision(payload)
    return {
        'format': LOCAL_TERRAIN_FORMAT,
        'presetId': WORKING_TERRAIN_PRESET_ID,
        'version': f'0.1.0-local.{revision}',
        'metadata': {
            **(payload.get('metadata') if isinstance(payload.get('metadata'), dict) else {}),
            'status': 'local-working-preset',
            'authority': 'renderer-only-terrain',
            'revision': revision
        },
        'terrain': {
            'fog': {
                'color': normalize_color((terrain.get('fog') or {}).get('color') if isinstance(terrain.get('fog'), dict) else None, 0x0b1220),
                'density': clamp_number((terrain.get('fog') or {}).get('density') if isinstance(terrain.get('fog'), dict) else None, 0.0001, 0.05, 0.0038)
            },
            'baseMaterial': base_material,
            'materials': materials,
            'patches': [normalize_patch(index, item) for index, item in enumerate(terrain.get('patches') if isinstance(terrain.get('patches'), list) else [])],
            'strips': [normalize_strip(index, item) for index, item in enumerate(terrain.get('strips') if isinstance(terrain.get('strips'), list) else [])]
        }
    }


def install_terrain_preset(payload: dict) -> dict:
    preset = normalize_working_terrain_preset(payload)
    write_json_file(WORKING_TERRAIN_PRESET_PATH, preset)
    return {
        'ok': True,
        'format': LOCAL_TERRAIN_FORMAT,
        'presetId': preset['presetId'],
        'revision': preset['metadata']['revision'],
        'materialCount': len(preset['terrain']['materials']),
        'patchCount': len(preset['terrain']['patches']),
        'stripCount': len(preset['terrain']['strips'])
    }


def normalize_asset_for_install(asset: dict, block_type: str, model_path: str) -> dict:
    model = asset.get('model') if isinstance(asset.get('model'), dict) else {}
    bindings = asset.get('bindings') if isinstance(asset.get('bindings'), dict) else {}
    material_policy = asset.get('materialPolicy') if isinstance(asset.get('materialPolicy'), dict) else {}
    return {
        'assetId': f'local_{block_slug(block_type)}_visual',
        'kind': 'blockVisual',
        'model': {
            'path': model_path,
            'unitMeters': float(model.get('unitMeters', 1) or 1),
            'forwardAxis': model.get('forwardAxis') or '+X',
            'upAxis': model.get('upAxis') or '+Y',
            'transform': normalize_transform(model.get('transform'))
        },
        'bindings': {
            'blockTypes': [block_type],
            'nodes': normalize_binding_nodes(bindings.get('nodes')),
            'clips': normalize_binding_clips(bindings.get('clips'))
        },
        'materialPolicy': normalize_material_policy(material_policy)
    }


def update_installed_pack_index(revision: int) -> None:
    index = read_json_file(INSTALLED_PACKS_PATH, {'format': 'VAW_VISUAL_PACK_INDEX_V1', 'version': '0.1.0', 'packs': []})
    packs = index.get('packs') if isinstance(index.get('packs'), list) else []
    filtered = [
        pack for pack in packs
        if not (
            isinstance(pack, dict)
            and (
                pack.get('source') == f'local:{WORKING_PACK_ID}'
                or str(pack.get('manifestUrl', '')).startswith(f'{WORKING_PACK_ID}/')
            )
        )
    ]
    index['format'] = 'VAW_VISUAL_PACK_INDEX_V1'
    index['version'] = str(index.get('version') or '0.1.0')
    index['packs'] = [{
        'source': f'local:{WORKING_PACK_ID}',
        'manifestUrl': f'{WORKING_PACK_ID}/VAW_VISUAL_ASSET_PACK_V1.json',
        'revision': revision
    }, *filtered]
    write_json_file(INSTALLED_PACKS_PATH, index)


def install_visual_block(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError('payload must be a JSON object')
    if payload.get('format') != LOCAL_INSTALL_FORMAT:
        raise ValueError(f'format must be {LOCAL_INSTALL_FORMAT}')
    if payload.get('packId') != WORKING_PACK_ID:
        raise ValueError(f'packId must be {WORKING_PACK_ID}')
    block_type = str(payload.get('blockType') or '').strip()
    if block_type not in ALLOWED_BLOCK_TYPES:
        raise ValueError(f'unsupported blockType: {block_type}')
    files = payload.get('files')
    if not isinstance(files, list) or not files:
        raise ValueError('files must contain at least the block model')
    slug = block_slug(block_type)
    block_prefix = f'models/blocks/{slug}/'
    model_path = f'{block_prefix}model.gltf'

    decoded_files: list[tuple[Path, bytes]] = []
    seen_paths: set[str] = set()
    for entry in files:
        if not isinstance(entry, dict):
            raise ValueError('file entries must be objects')
        relative = str(entry.get('path') or '').replace('\\', '/')
        if not relative.startswith(block_prefix):
            raise ValueError(f'file path must stay inside {block_prefix}: {relative}')
        safe_posix_path(relative)
        if relative.lower() in seen_paths:
            raise ValueError(f'duplicate file path: {relative}')
        seen_paths.add(relative.lower())
        data_b64 = entry.get('dataBase64')
        if not isinstance(data_b64, str):
            raise ValueError(f'file {relative} must include dataBase64')
        try:
            data = base64.b64decode(data_b64, validate=True)
        except Exception as error:  # noqa: BLE001 - user-facing endpoint
            raise ValueError(f'file {relative} has invalid base64 data') from error
        decoded_files.append((resolve_under_working_pack(relative), data))

    if model_path.lower() not in seen_paths:
        raise ValueError(f'files must include {model_path}')

    source_asset = payload.get('asset')
    if not isinstance(source_asset, dict):
        raise ValueError('asset must be an object')
    replacement = normalize_asset_for_install(source_asset, block_type, model_path)

    manifest = read_json_file(WORKING_MANIFEST_PATH, default_working_manifest())
    assets = manifest.get('assets') if isinstance(manifest.get('assets'), list) else []
    remaining = [
        asset for asset in assets
        if block_type not in (((asset if isinstance(asset, dict) else {}).get('bindings') or {}).get('blockTypes') or [])
    ]
    revision = next_revision(manifest)

    block_dir = WORKING_PACK_ROOT / Path(*PurePosixPath(block_prefix).parts)
    if block_dir.exists():
        shutil.rmtree(block_dir)
    block_dir.mkdir(parents=True, exist_ok=True)
    for target, data in decoded_files:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    manifest['format'] = 'VAW_VISUAL_ASSET_PACK_V1'
    manifest['packId'] = WORKING_PACK_ID
    manifest['version'] = f'0.1.0-local.{revision}'
    manifest['metadata'] = {
        **(manifest.get('metadata') if isinstance(manifest.get('metadata'), dict) else {}),
        'status': 'local-working-pack',
        'authority': 'visual-only',
        'revision': revision,
        'lastUpdatedBlockType': block_type
    }
    manifest['assets'] = [*remaining, replacement]
    write_json_file(WORKING_MANIFEST_PATH, manifest)
    update_installed_pack_index(revision)

    return {
        'ok': True,
        'packId': WORKING_PACK_ID,
        'blockType': block_type,
        'assetId': replacement['assetId'],
        'modelPath': model_path,
        'revision': revision,
        'fileCount': len(decoded_files)
    }


class VawDevHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self) -> None:  # noqa: N802 - http.server hook
        route = urlparse(self.path).path
        if route not in {DEV_ENDPOINT_PATH, DEV_TERRAIN_ENDPOINT_PATH}:
            self.send_error(404, 'Unknown VAW development endpoint')
            return
        self.send_response(204)
        self.send_dev_cors_headers()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802 - http.server hook
        route = urlparse(self.path).path
        if route == DEV_ENDPOINT_PATH:
            self.respond_json(200, {
                'ok': True,
                'endpoint': 'install_visual_block',
                'format': LOCAL_INSTALL_FORMAT,
                'packId': WORKING_PACK_ID,
                'allowedBlockTypes': sorted(ALLOWED_BLOCK_TYPES)
            })
            return
        if route == DEV_TERRAIN_ENDPOINT_PATH:
            self.respond_json(200, read_json_file(WORKING_TERRAIN_PRESET_PATH, default_working_terrain_preset()))
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - http.server hook
        route = urlparse(self.path).path
        if route not in {DEV_ENDPOINT_PATH, DEV_TERRAIN_ENDPOINT_PATH}:
            self.send_error(404, 'Unknown VAW development endpoint')
            return
        try:
            length = int(self.headers.get('Content-Length') or '0')
            if length <= 0 or length > MAX_POST_BYTES:
                raise ValueError('request body is empty or too large')
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            response = install_terrain_preset(payload) if route == DEV_TERRAIN_ENDPOINT_PATH else install_visual_block(payload)
            self.respond_json(200, response)
        except Exception as error:  # noqa: BLE001 - endpoint reports validation errors as JSON
            self.respond_json(400, {'ok': False, 'error': str(error)})

    def respond_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_dev_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_dev_cors_headers(self) -> None:
        origin = self.headers.get('Origin')
        if is_allowed_dev_origin(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '600')


class ReusableTcpServer(socketserver.TCPServer):
    allow_reuse_address = True


def main() -> None:
    parser = argparse.ArgumentParser(description='Serve the workshop from a local development server.')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--studio', action='store_true', help='Open Blockbench Import Studio with the VAW install endpoint available.')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()

    handler = functools.partial(VawDevHandler, directory=ROOT)
    with ReusableTcpServer(('127.0.0.1', args.port), handler) as server:
        game_url = f'http://127.0.0.1:{args.port}/index.html'
        studio_url = f'http://127.0.0.1:{args.port}/tools/blockbench_import_studio/index.html'
        url = studio_url if args.studio else game_url
        print(f'Voxel Aeronautics Workshop: {game_url}')
        print(f'VAW Blockbench Import Studio: {studio_url}')
        print(f'VAW dev endpoint: GET/POST {DEV_ENDPOINT_PATH}')
        print(f'VAW terrain endpoint: GET/POST {DEV_TERRAIN_ENDPOINT_PATH}')
        print('Press Ctrl+C to stop the server.')
        if not args.no_browser:
            threading.Timer(0.35, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')


if __name__ == '__main__':
    main()
