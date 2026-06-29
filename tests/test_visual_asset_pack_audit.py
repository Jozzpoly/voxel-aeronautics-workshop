from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'tools' / 'audit_visual_asset_pack.py'


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def gltf(nodes: list[dict]) -> dict:
    return {'asset': {'version': '2.0'}, 'nodes': nodes}


def manifest(block_type: str, nodes: dict, model_path: str = 'models/blocks/test/model.gltf') -> dict:
    return {
        'format': 'VAW_VISUAL_ASSET_PACK_V1',
        'packId': 'audit_test',
        'version': '0.1.0',
        'assets': [{
            'assetId': f'{block_type.lower()}_visual',
            'kind': 'blockVisual',
            'model': {'path': model_path, 'unitMeters': 1, 'forwardAxis': '+X', 'upAxis': '+Y'},
            'bindings': {
                'blockTypes': [block_type],
                'nodes': nodes,
                'clips': {'idle': None, 'thrust': None, 'damage': None},
            },
            'materialPolicy': {'alpha': 'auto'},
        }],
    }


def run_audit(pack_root: Path, *, allow_diagnostics: bool = False) -> tuple[int, dict]:
    command = [sys.executable, str(AUDIT), str(pack_root)]
    if allow_diagnostics:
        command.append('--allow-diagnostics')
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    return result.returncode, json.loads(result.stdout)


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pack = Path(tmp)
        model_path = pack / 'models' / 'blocks' / 'test' / 'model.gltf'
        write_json(model_path, gltf([
            {'name': 'Root', 'children': [1, 2]},
            {'name': 'body'},
            {'name': 'flame'},
        ]))
        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', manifest('Thruster', {
            'visualRoot': '/Root',
            'flame': 'flame',
            'flameGlow': None,
            'gimbalAssembly': None,
            'controlFlapPivot': None,
        }))
        code, report = run_audit(pack)
        assert code == 0, report
        assert report['ok'] is True
        assert report['assets'][0]['modelExists'] is True

        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', manifest('Balloon', {
            'visualRoot': '/Root',
            'flame': 'missing_flame',
            'flameGlow': None,
            'gimbalAssembly': 'missing_nozzle',
            'controlFlapPivot': None,
        }))
        code, report = run_audit(pack, allow_diagnostics=True)
        assert code == 0
        codes = {item['code'] for item in report['diagnostics']}
        assert 'visualAssetAudit.nodeBindingUnresolved' in codes
        assert 'visualAssetAudit.unexpectedRigBindingForBlockType' in codes

        code, report = run_audit(pack)
        assert code == 1
        assert report['ok'] is False

    print({'visualAssetPackAudit': 'ok'})


if __name__ == '__main__':
    main()
