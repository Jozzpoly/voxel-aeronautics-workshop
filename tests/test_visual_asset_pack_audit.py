from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'tools' / 'audit_visual_asset_pack.py'
KNOWN_BLOCK_TYPES = ['Core', 'Hull', 'Frame', 'Thruster', 'VectorThruster', 'Balloon', 'Wing', 'ControlSurface', 'Gyro', 'Fuel']


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def gltf(nodes: list[dict]) -> dict:
    return {'asset': {'version': '2.0'}, 'nodes': nodes}


def asset(block_type: str, nodes: dict, model_path: str = 'models/blocks/test/model.gltf') -> dict:
    return {
        'assetId': f'{block_type.lower()}_visual',
        'kind': 'blockVisual',
        'model': {'path': model_path, 'unitMeters': 1, 'forwardAxis': '+X', 'upAxis': '+Y'},
        'bindings': {
            'blockTypes': [block_type],
            'nodes': nodes,
            'clips': {'idle': None, 'thrust': None, 'damage': None},
        },
        'materialPolicy': {'alpha': 'auto'},
    }


def pack_manifest(assets: list[dict]) -> dict:
    return {
        'format': 'VAW_VISUAL_ASSET_PACK_V1',
        'packId': 'audit_test',
        'version': '0.1.0',
        'assets': assets,
    }


def run_audit(pack_root: Path, *, allow_diagnostics: bool = False, suggest_cleanup: bool = False) -> tuple[int, dict]:
    command = [sys.executable, str(AUDIT), str(pack_root)]
    if allow_diagnostics:
        command.append('--allow-diagnostics')
    if suggest_cleanup:
        command.append('--suggest-cleanup')
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    return result.returncode, json.loads(result.stdout)


def base_nodes(visual_root: str | None = '/Root') -> dict:
    return {
        'visualRoot': visual_root,
        'flame': None,
        'flameGlow': None,
        'gimbalAssembly': None,
        'controlFlapPivot': None,
    }


def codes(report: dict) -> set[str]:
    return {item['code'] for item in report['diagnostics']}


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pack = Path(tmp)
        model_path = pack / 'models' / 'blocks' / 'test' / 'model.gltf'
        write_json(model_path, gltf([
            {'name': 'Root', 'children': [1, 2]},
            {'name': 'body'},
            {'name': 'flame'},
        ]))
        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', pack_manifest([
            asset(block_type, base_nodes()) for block_type in KNOWN_BLOCK_TYPES
        ]))
        code, report = run_audit(pack)
        assert code == 0, report
        assert report['ok'] is True
        assert len(report['assets']) == len(KNOWN_BLOCK_TYPES)
        assert {item['blockTypes'][0] for item in report['assets']} == set(KNOWN_BLOCK_TYPES)
        assert all(item['modelExists'] for item in report['assets'])
        assert len(report['assetReports']) == len(KNOWN_BLOCK_TYPES)
        assert all(item['diagnostics'] == [] for item in report['assetReports'])

        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', pack_manifest([asset('Thruster', {
            'visualRoot': '/Root',
            'flame': 'flame',
            'flameGlow': None,
            'gimbalAssembly': None,
            'controlFlapPivot': None,
        })]))
        code, report = run_audit(pack)
        assert code == 0, report
        assert report['ok'] is True
        assert report['assets'][0]['modelExists'] is True

        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', pack_manifest([asset('Balloon', {
            'visualRoot': '/Root',
            'flame': 'thuster_fire',
            'flameGlow': None,
            'gimbalAssembly': 'thuster_nozzle',
            'controlFlapPivot': None,
        })]))
        code, report = run_audit(pack, allow_diagnostics=True, suggest_cleanup=True)
        assert code == 0
        report_codes = codes(report)
        assert 'visualAssetAudit.nodeBindingUnresolved' in report_codes
        assert 'visualAssetAudit.unexpectedRigBindingForBlockType' in report_codes
        assert 'visualAssetAudit.suspiciousBindingSpelling' in report_codes
        assert report['suggestedManifestCleanup']['mode'] == 'dry-run'
        set_null_paths = {
            item['path'] for item in report['suggestedManifestCleanup']['actions']
            if item['action'] == 'set-null' and item['suggestedValue'] is None
        }
        assert 'assets[0].bindings.nodes.flame' in set_null_paths
        assert 'assets[0].bindings.nodes.gimbalAssembly' in set_null_paths
        balloon_report = report['assetReports'][0]
        assert balloon_report['assetId'] == 'balloon_visual'
        assert len(balloon_report['cleanupSuggestions']) >= 2

        code, report = run_audit(pack)
        assert code == 1
        assert report['ok'] is False

        write_json(model_path, gltf([
            {'name': 'Root', 'children': [1, 2]},
            {'name': 'flame'},
            {'name': 'flame'},
        ]))
        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', pack_manifest([asset('Thruster', {
            'visualRoot': '/Root',
            'flame': 'flame',
            'flameGlow': None,
            'gimbalAssembly': None,
            'controlFlapPivot': None,
        })]))
        code, report = run_audit(pack, allow_diagnostics=True)
        assert code == 0
        assert any(
            item['code'] == 'visualAssetAudit.nodeBindingUnresolved' and 'ambiguous bare node name' in item['message']
            for item in report['diagnostics']
        ), report

        write_json(model_path, gltf([{'name': 'Root'}]))
        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', pack_manifest([asset('Hull', base_nodes(None))]))
        code, report = run_audit(pack, allow_diagnostics=True)
        assert code == 0
        assert 'visualAssetAudit.visualRootMissing' in codes(report)

        write_json(pack / 'VAW_VISUAL_ASSET_PACK_V1.json', pack_manifest([asset('Hull', base_nodes(), '../escape.gltf')]))
        code, report = run_audit(pack, allow_diagnostics=True)
        assert code == 0
        assert 'visualAssetAudit.modelPathInvalid' in codes(report)

    print({'visualAssetPackAudit': 'ok'})


if __name__ == '__main__':
    main()
