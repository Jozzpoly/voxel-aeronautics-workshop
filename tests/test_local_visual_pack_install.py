#!/usr/bin/env python3
from __future__ import annotations

import base64
import functools
import http.client
import importlib.util
import json
import threading
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_serve_module():
    spec = importlib.util.spec_from_file_location('vaw_dev_serve', ROOT / 'tools' / 'serve.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def install_payload(block_type='Thruster', data=b'{"asset":{"version":"2.0"}}'):
    slug = 'thruster' if block_type == 'Thruster' else block_type.lower()
    return {
        'format': 'VAW_LOCAL_VISUAL_BLOCK_INSTALL_V1',
        'packId': 'local_working_visuals',
        'blockType': block_type,
        'asset': {
            'assetId': 'ignored_by_server',
            'kind': 'blockVisual',
            'model': {
                'path': 'ignored.gltf',
                'unitMeters': 1,
                'forwardAxis': '+X',
                'upAxis': '+Y',
                'transform': {
                    'position': {'x': 0.25, 'y': 0, 'z': 0},
                    'rotationDegrees': {'x': 0, 'y': 90, 'z': 0},
                    'scale': {'x': 1, 'y': 1, 'z': 1},
                },
            },
            'bindings': {
                'blockTypes': [block_type],
                'nodes': {'visualRoot': '/Root', 'flame': None, 'flameGlow': None, 'gimbalAssembly': None, 'controlFlapPivot': None},
                'clips': {'idle': None, 'thrust': None, 'damage': None},
            },
            'materialPolicy': {
                'pixelated': True,
                'alpha': 'blend',
                'doubleSided': 'force',
                'materialOverrides': [
                    {'materialName': 'NozzleMat', 'alpha': 'opaque'},
                    {'materialName': 'FlameMat', 'alpha': 'blend'},
                ],
            },
        },
        'files': [{
            'path': f'models/blocks/{slug}/model.gltf',
            'dataBase64': base64.b64encode(data).decode('ascii'),
        }],
    }


def terrain_payload():
    return {
        'format': 'VAW_TERRAIN_AUTHORING_V1',
        'presetId': 'local_working_terrain',
        'version': '0.1.0-local.0',
        'metadata': {
            'authority': 'renderer-only-terrain',
            'revision': 0,
        },
        'terrain': {
            'fog': {'color': 0x0B1220, 'density': 0.0038},
            'baseMaterial': 'basin',
            'materials': {
                'basin': {'color': 0x15283A, 'roughness': 1, 'texture': {'kind': 'checker', 'colorA': 0x15283A, 'colorB': 0x1B3349, 'repeat': 24}},
                'routePaint': {'color': 0x93C5FD, 'opacity': 0.34, 'texture': {'kind': 'stripe', 'colorA': 0x60A5FA, 'colorB': 0x1E3A8A, 'repeat': 12}},
            },
            'patches': [
                {'id': 'test-apron', 'material': 'basin', 'center': {'x': 12, 'z': -8}, 'size': {'x': 30, 'z': 22}, 'rotation': 0.2, 'opacity': 0.9, 'layer': 10},
            ],
            'strips': [
                {'id': 'test-road', 'fromPad': 'startPad', 'toPad': 'finishPad', 'width': 8, 'material': 'routePaint', 'opacity': 0.42, 'layer': 20},
            ],
        },
    }


def request_json(port: int, method: str, path: str, payload: dict | None = None, origin: str | None = 'http://127.0.0.1:8080'):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    body = json.dumps(payload).encode('utf-8') if payload is not None else None
    headers = {}
    if origin:
        headers['Origin'] = origin
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    connection.request(method, path, body=body, headers=headers)
    response = connection.getresponse()
    raw = response.read()
    cors = response.getheader('Access-Control-Allow-Origin')
    data = json.loads(raw.decode('utf-8')) if raw else None
    connection.close()
    return response.status, cors, data


def request_options(port: int, path: str):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    connection.request('OPTIONS', path, headers={
        'Origin': 'http://127.0.0.1:8080',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
    })
    response = connection.getresponse()
    raw = response.read()
    result = {
        'status': response.status,
        'origin': response.getheader('Access-Control-Allow-Origin'),
        'methods': response.getheader('Access-Control-Allow-Methods') or '',
        'headers': response.getheader('Access-Control-Allow-Headers') or '',
        'body': raw,
    }
    connection.close()
    return result


def assert_http_endpoint(serve, tmp_root: Path):
    class QuietHandler(serve.VawDevHandler):
        def log_message(self, format, *args):  # noqa: A002,N802 - http.server hook
            return

    handler = functools.partial(QuietHandler, directory=tmp_root)
    server = serve.ReusableTcpServer(('127.0.0.1', 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, cors, health = request_json(port, 'GET', serve.DEV_ENDPOINT_PATH)
        assert status == 200
        assert cors == 'http://127.0.0.1:8080'
        assert health['ok'] is True
        assert health['endpoint'] == 'install_visual_block'

        preflight = request_options(port, serve.DEV_ENDPOINT_PATH)
        assert preflight['status'] == 204
        assert preflight['origin'] == 'http://127.0.0.1:8080'
        assert 'POST' in preflight['methods']
        assert 'Content-Type' in preflight['headers']

        status, cors, result = request_json(port, 'POST', serve.DEV_ENDPOINT_PATH, install_payload(data=b'http'))
        assert status == 200
        assert cors == 'http://127.0.0.1:8080'
        assert result['ok'] is True
        assert result['revision'] >= 1

        status, cors, terrain = request_json(port, 'GET', serve.DEV_TERRAIN_ENDPOINT_PATH)
        assert status == 200
        assert cors == 'http://127.0.0.1:8080'
        assert terrain['format'] == 'VAW_TERRAIN_AUTHORING_V1'
        assert terrain['metadata']['authority'] == 'renderer-only-terrain'

        terrain_preflight = request_options(port, serve.DEV_TERRAIN_ENDPOINT_PATH)
        assert terrain_preflight['status'] == 204
        assert terrain_preflight['origin'] == 'http://127.0.0.1:8080'
        assert 'POST' in terrain_preflight['methods']
        assert 'Content-Type' in terrain_preflight['headers']

        status, cors, terrain_result = request_json(port, 'POST', serve.DEV_TERRAIN_ENDPOINT_PATH, terrain_payload())
        assert status == 200
        assert cors == 'http://127.0.0.1:8080'
        assert terrain_result['ok'] is True
        assert terrain_result['format'] == 'VAW_TERRAIN_AUTHORING_V1'
        assert terrain_result['materialCount'] == 2
        assert terrain_result['patchCount'] == 1
        assert terrain_result['stripCount'] == 1
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def main():
    serve = load_serve_module()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        serve.ROOT = tmp_root
        serve.VISUAL_PACKS_DIR = tmp_root / 'assets' / 'visual_packs'
        serve.WORKING_PACK_ROOT = serve.VISUAL_PACKS_DIR / serve.WORKING_PACK_ID
        serve.WORKING_MANIFEST_PATH = serve.WORKING_PACK_ROOT / 'VAW_VISUAL_ASSET_PACK_V1.json'
        serve.INSTALLED_PACKS_PATH = serve.VISUAL_PACKS_DIR / 'installed_visual_packs.json'
        serve.TERRAIN_PRESETS_DIR = tmp_root / 'assets' / 'terrain'
        serve.WORKING_TERRAIN_PRESET_ROOT = serve.TERRAIN_PRESETS_DIR / serve.WORKING_TERRAIN_PRESET_ID
        serve.WORKING_TERRAIN_PRESET_PATH = serve.WORKING_TERRAIN_PRESET_ROOT / 'VAW_TERRAIN_AUTHORING_V1.json'
        serve.INSTALLED_PACKS_PATH.parent.mkdir(parents=True, exist_ok=True)
        serve.INSTALLED_PACKS_PATH.write_text(json.dumps({
            'format': 'VAW_VISUAL_PACK_INDEX_V1',
            'version': '0.1.0',
            'packs': [{'source': 'dev:fixture', 'manifestUrl': 'fixture/VAW_VISUAL_ASSET_PACK_V1.json'}],
        }), encoding='utf-8')

        first = serve.install_visual_block(install_payload(data=b'first'))
        assert first['ok'] is True
        assert first['revision'] == 1
        assert (serve.WORKING_PACK_ROOT / 'models' / 'blocks' / 'thruster' / 'model.gltf').read_bytes() == b'first'
        manifest = json.loads(serve.WORKING_MANIFEST_PATH.read_text(encoding='utf-8'))
        assert manifest['metadata']['revision'] == 1
        assert manifest['assets'][0]['assetId'] == 'local_thruster_visual'
        assert manifest['assets'][0]['model']['path'] == 'models/blocks/thruster/model.gltf'
        assert manifest['assets'][0]['model']['transform']['position']['x'] == 0.25
        assert manifest['assets'][0]['materialPolicy']['alpha'] == 'blend'
        assert manifest['assets'][0]['materialPolicy']['materialOverrides'][0]['materialName'] == 'NozzleMat'

        wing_dir = serve.WORKING_PACK_ROOT / 'models' / 'blocks' / 'wing'
        wing_dir.mkdir(parents=True)
        (wing_dir / 'model.gltf').write_bytes(b'wing')
        manifest['assets'].append({
            'assetId': 'local_wing_visual',
            'kind': 'blockVisual',
            'model': {'path': 'models/blocks/wing/model.gltf', 'unitMeters': 1, 'forwardAxis': '+X', 'upAxis': '+Y'},
            'bindings': {
                'blockTypes': ['Wing'],
                'nodes': {'visualRoot': '/Root', 'flame': None, 'flameGlow': None, 'gimbalAssembly': None, 'controlFlapPivot': None},
                'clips': {'idle': None, 'thrust': None, 'damage': None},
            },
            'materialPolicy': {},
        })
        serve.write_json_file(serve.WORKING_MANIFEST_PATH, manifest)

        second = serve.install_visual_block(install_payload(data=b'second'))
        assert second['revision'] == 2
        assert (serve.WORKING_PACK_ROOT / 'models' / 'blocks' / 'thruster' / 'model.gltf').read_bytes() == b'second'
        assert (wing_dir / 'model.gltf').read_bytes() == b'wing', 'Updating Thruster must not touch another block folder.'
        manifest = json.loads(serve.WORKING_MANIFEST_PATH.read_text(encoding='utf-8'))
        assert {asset['bindings']['blockTypes'][0] for asset in manifest['assets']} == {'Thruster', 'Wing'}
        index = json.loads(serve.INSTALLED_PACKS_PATH.read_text(encoding='utf-8'))
        assert index['packs'][0]['source'] == 'local:local_working_visuals'
        assert index['packs'][0]['revision'] == 2
        assert index['packs'][1]['source'] == 'dev:fixture'

        terrain = serve.install_terrain_preset(terrain_payload())
        assert terrain['ok'] is True
        assert terrain['revision'] == 1
        assert terrain['materialCount'] == 2
        saved_terrain = json.loads(serve.WORKING_TERRAIN_PRESET_PATH.read_text(encoding='utf-8'))
        assert saved_terrain['metadata']['authority'] == 'renderer-only-terrain'
        assert saved_terrain['terrain']['patches'][0]['layer'] == 10
        assert saved_terrain['terrain']['strips'][0]['fromPad'] == 'startPad'

        bad_terrain = terrain_payload()
        bad_terrain['terrain']['patches'][0]['material'] = 'missingMaterial'
        try:
            serve.install_terrain_preset(bad_terrain)
            raise AssertionError('missing terrain material should be rejected')
        except ValueError as error:
            assert 'missing material' in str(error)

        bad_pad = terrain_payload()
        bad_pad['terrain']['strips'][0]['toPad'] = 'missingPad'
        try:
            serve.install_terrain_preset(bad_pad)
            raise AssertionError('missing terrain pad should be rejected')
        except ValueError as error:
            assert 'missing pad' in str(error)

        bad = install_payload()
        bad['files'][0]['path'] = 'models/blocks/thruster/../../escape.gltf'
        try:
            serve.install_visual_block(bad)
            raise AssertionError('path traversal should be rejected')
        except ValueError as error:
            assert 'unsafe path' in str(error) or 'inside models/blocks/thruster' in str(error)

        absolute = install_payload()
        absolute['files'][0]['path'] = 'C:/escape/model.gltf'
        try:
            serve.install_visual_block(absolute)
            raise AssertionError('absolute paths should be rejected')
        except ValueError as error:
            assert 'inside models/blocks/thruster' in str(error) or 'unsafe path' in str(error)

        assert_http_endpoint(serve, tmp_root)

    print({'localVisualPackInstall': 'ok'})


if __name__ == '__main__':
    main()
