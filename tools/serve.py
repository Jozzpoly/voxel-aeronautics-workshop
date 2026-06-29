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
WORKING_PACK_ID = 'local_working_visuals'
WORKING_PACK_ROOT = VISUAL_PACKS_DIR / WORKING_PACK_ID
WORKING_MANIFEST_PATH = WORKING_PACK_ROOT / 'VAW_VISUAL_ASSET_PACK_V1.json'
INSTALLED_PACKS_PATH = VISUAL_PACKS_DIR / 'installed_visual_packs.json'
LOCAL_INSTALL_FORMAT = 'VAW_LOCAL_VISUAL_BLOCK_INSTALL_V1'
ALLOWED_BLOCK_TYPES = {
    'Core', 'Hull', 'Frame', 'Thruster', 'VectorThruster', 'Balloon', 'Wing', 'ControlSurface', 'Gyro', 'Fuel'
}
NODE_ALIASES = ('visualRoot', 'flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot')
CLIP_ALIASES = ('idle', 'thrust', 'damage')
MAX_POST_BYTES = 64 * 1024 * 1024
DEV_ENDPOINT_PATH = '/__vaw/install_visual_block'


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
        if route != DEV_ENDPOINT_PATH:
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
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - http.server hook
        route = urlparse(self.path).path
        if route != DEV_ENDPOINT_PATH:
            self.send_error(404, 'Unknown VAW development endpoint')
            return
        try:
            length = int(self.headers.get('Content-Length') or '0')
            if length <= 0 or length > MAX_POST_BYTES:
                raise ValueError('request body is empty or too large')
            payload = json.loads(self.rfile.read(length).decode('utf-8'))
            response = install_visual_block(payload)
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
        print('Press Ctrl+C to stop the server.')
        if not args.no_browser:
            threading.Timer(0.35, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')


if __name__ == '__main__':
    main()
