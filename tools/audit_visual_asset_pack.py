#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = 'VAW_VISUAL_ASSET_PACK_V1.json'
KNOWN_BLOCK_TYPES = {
    'Core', 'Hull', 'Frame', 'Thruster', 'VectorThruster', 'Balloon', 'Wing', 'ControlSurface', 'Gyro', 'Fuel'
}
NODE_ALIASES = ('visualRoot', 'flame', 'flameGlow', 'gimbalAssembly', 'controlFlapPivot')
RIG_ALIAS_TYPES = {
    'flame': {'Thruster', 'VectorThruster'},
    'flameGlow': {'Thruster', 'VectorThruster'},
    'gimbalAssembly': {'VectorThruster'},
    'controlFlapPivot': {'ControlSurface'},
}


def diagnostic(severity: str, code: str, path: str, message: str) -> dict:
    return {'severity': severity, 'code': code, 'path': path, 'message': message}


def cleanup_suggestion(asset: dict, block_types: list, path: str, current_value: object, suggested_value: object, reason: str, action: str) -> dict:
    return {
        'action': action,
        'assetId': asset.get('assetId'),
        'blockTypes': block_types,
        'path': path,
        'currentValue': current_value,
        'suggestedValue': suggested_value,
        'reason': reason,
    }


def is_safe_pack_path(value: object) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    raw = value.strip()
    if raw.startswith('/') or raw.startswith('./') or '\\' in raw or ':' in raw or '?' in raw or '#' in raw:
        return False
    path = PurePosixPath(raw)
    return not path.is_absolute() and all(part not in ('', '.', '..') for part in path.parts)


def resolve_pack_path(pack_root: Path, value: str) -> Path:
    path = PurePosixPath(value)
    target = (pack_root / Path(*path.parts)).resolve()
    root = pack_root.resolve()
    if target != root and root not in target.parents:
        raise ValueError(f'path escapes pack root: {value}')
    return target


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding='utf-8'))


def node_records(gltf: object) -> tuple[set[str], dict[str, int]]:
    if not isinstance(gltf, dict) or not isinstance(gltf.get('nodes'), list):
        return set(), {}
    nodes = gltf['nodes']
    child_indexes = set()
    for node in nodes:
        if isinstance(node, dict):
            child_indexes.update(index for index in node.get('children', []) if isinstance(index, int))
    roots = [index for index in range(len(nodes)) if index not in child_indexes] or list(range(len(nodes)))
    paths: set[str] = set()
    names: dict[str, int] = {}

    def visit(index: int, prefix: tuple[str, ...]) -> None:
        if index < 0 or index >= len(nodes) or not isinstance(nodes[index], dict):
            return
        name = str(nodes[index].get('name') or f'node_{index}').strip() or f'node_{index}'
        next_prefix = (*prefix, name)
        paths.add('/' + '/'.join(next_prefix))
        names[name] = names.get(name, 0) + 1
        for child in nodes[index].get('children', []) if isinstance(nodes[index].get('children'), list) else []:
            if isinstance(child, int):
                visit(child, next_prefix)

    for root in roots:
        visit(root, tuple())
    return paths, names


def binding_resolves(binding: str, paths: set[str], names: dict[str, int]) -> tuple[bool, str]:
    value = binding.strip()
    if value.startswith('/'):
        return (value in paths, 'missing path' if value not in paths else '')
    count = names.get(value, 0)
    if count == 1:
        return True, ''
    if count > 1:
        return False, 'ambiguous bare node name'
    return False, 'missing bare node name'


def audit_pack(pack_root: Path, manifest_name: str = DEFAULT_MANIFEST, suggest_cleanup: bool = False) -> dict:
    diagnostics: list[dict] = []
    asset_reports: list[dict] = []
    cleanup_actions: list[dict] = []
    pack_root = pack_root.resolve()
    manifest_path = pack_root / manifest_name
    if not manifest_path.is_file():
        diagnostics.append(diagnostic('error', 'visualAssetAudit.manifestMissing', manifest_name, 'Manifest file is missing.'))
        report = {'ok': False, 'packRoot': str(pack_root), 'diagnostics': diagnostics, 'assets': [], 'assetReports': asset_reports}
        if suggest_cleanup:
            report['suggestedManifestCleanup'] = {'mode': 'dry-run', 'actions': cleanup_actions}
        return report

    try:
        manifest = load_json(manifest_path)
    except Exception as error:  # noqa: BLE001 - CLI diagnostic
        diagnostics.append(diagnostic('error', 'visualAssetAudit.manifestInvalidJson', manifest_name, str(error)))
        report = {'ok': False, 'packRoot': str(pack_root), 'diagnostics': diagnostics, 'assets': [], 'assetReports': asset_reports}
        if suggest_cleanup:
            report['suggestedManifestCleanup'] = {'mode': 'dry-run', 'actions': cleanup_actions}
        return report

    if not isinstance(manifest, dict):
        diagnostics.append(diagnostic('error', 'visualAssetAudit.manifestInvalid', '', 'Manifest must be a JSON object.'))
        report = {'ok': False, 'packRoot': str(pack_root), 'diagnostics': diagnostics, 'assets': [], 'assetReports': asset_reports}
        if suggest_cleanup:
            report['suggestedManifestCleanup'] = {'mode': 'dry-run', 'actions': cleanup_actions}
        return report
    if manifest.get('format') != 'VAW_VISUAL_ASSET_PACK_V1':
        diagnostics.append(diagnostic('error', 'visualAssetAudit.formatInvalid', 'format', 'Manifest format must be VAW_VISUAL_ASSET_PACK_V1.'))

    assets = manifest.get('assets')
    if not isinstance(assets, list):
        diagnostics.append(diagnostic('error', 'visualAssetAudit.assetsInvalid', 'assets', 'Manifest assets must be an array.'))
        assets = []

    audited_assets: list[dict] = []
    for asset_index, asset in enumerate(assets):
        asset_path = f'assets[{asset_index}]'
        if not isinstance(asset, dict):
            diagnostics.append(diagnostic('error', 'visualAssetAudit.assetInvalid', asset_path, 'Asset entry must be an object.'))
            continue
        asset_diagnostics: list[dict] = []
        asset_cleanup_actions: list[dict] = []
        suggested_aliases: set[str] = set()

        def add_asset_diagnostic(severity: str, code: str, path: str, message: str) -> None:
            item = diagnostic(severity, code, path, message)
            diagnostics.append(item)
            asset_diagnostics.append(item)

        def add_cleanup(alias: str, current_value: object, suggested_value: object, reason: str, action: str) -> None:
            if alias in suggested_aliases:
                if action == 'set-null':
                    cleanup_actions[:] = [item for item in cleanup_actions if item.get('path') != f'{asset_path}.bindings.nodes.{alias}']
                    asset_cleanup_actions[:] = [item for item in asset_cleanup_actions if item.get('path') != f'{asset_path}.bindings.nodes.{alias}']
                else:
                    return
            else:
                suggested_aliases.add(alias)
            item = cleanup_suggestion(
                asset,
                block_types,
                f'{asset_path}.bindings.nodes.{alias}',
                current_value,
                suggested_value,
                reason,
                action,
            )
            cleanup_actions.append(item)
            asset_cleanup_actions.append(item)

        block_types = asset.get('bindings', {}).get('blockTypes') if isinstance(asset.get('bindings'), dict) else []
        if not isinstance(block_types, list) or not block_types:
            add_asset_diagnostic('error', 'visualAssetAudit.blockTypesMissing', f'{asset_path}.bindings.blockTypes', 'Asset must bind at least one block type.')
            block_types = []
        for block_type in block_types:
            if block_type not in KNOWN_BLOCK_TYPES:
                add_asset_diagnostic('error', 'visualAssetAudit.unknownBlockType', f'{asset_path}.bindings.blockTypes', f'Unknown block type: {block_type}')

        model = asset.get('model') if isinstance(asset.get('model'), dict) else {}
        model_path = model.get('path')
        gltf_paths: set[str] = set()
        gltf_names: dict[str, int] = {}
        model_exists = False
        if not is_safe_pack_path(model_path):
            add_asset_diagnostic('error', 'visualAssetAudit.modelPathInvalid', f'{asset_path}.model.path', 'Model path must be a safe pack-relative path.')
        else:
            try:
                model_file = resolve_pack_path(pack_root, model_path)
                model_exists = model_file.is_file()
                if not model_exists:
                    add_asset_diagnostic('error', 'visualAssetAudit.modelMissing', f'{asset_path}.model.path', f'Model file does not exist: {model_path}')
                else:
                    gltf_paths, gltf_names = node_records(load_json(model_file))
            except Exception as error:  # noqa: BLE001 - CLI diagnostic
                add_asset_diagnostic('error', 'visualAssetAudit.modelInvalidJson', f'{asset_path}.model.path', str(error))

        nodes = asset.get('bindings', {}).get('nodes') if isinstance(asset.get('bindings'), dict) else {}
        if not isinstance(nodes, dict):
            add_asset_diagnostic('error', 'visualAssetAudit.nodesInvalid', f'{asset_path}.bindings.nodes', 'Node bindings must be an object.')
            nodes = {}
        for alias in NODE_ALIASES:
            value = nodes.get(alias)
            if alias == 'visualRoot' and not (isinstance(value, str) and value.strip()):
                add_asset_diagnostic('error', 'visualAssetAudit.visualRootMissing', f'{asset_path}.bindings.nodes.visualRoot', 'visualRoot is required.')
            if isinstance(value, str) and value.strip() and model_exists:
                ok, reason = binding_resolves(value, gltf_paths, gltf_names)
                if not ok:
                    add_asset_diagnostic('error', 'visualAssetAudit.nodeBindingUnresolved', f'{asset_path}.bindings.nodes.{alias}', f'{value}: {reason}')
                    if alias != 'visualRoot' and suggest_cleanup:
                        add_cleanup(alias, value, None, f'Optional node binding is unresolved: {reason}.', 'review-or-set-null')
                if 'thuster' in value.lower():
                    add_asset_diagnostic('info', 'visualAssetAudit.suspiciousBindingSpelling', f'{asset_path}.bindings.nodes.{alias}', f'Binding "{value}" contains "thuster"; review whether this is an intentional model node name or a carried-over typo.')
                    if suggest_cleanup:
                        add_cleanup(alias, value, value, 'Binding spelling contains "thuster"; review whether this is intentional.', 'review-spelling')
            allowed_types = RIG_ALIAS_TYPES.get(alias)
            if value and allowed_types and any(block_type not in allowed_types for block_type in block_types):
                add_asset_diagnostic('warning', 'visualAssetAudit.unexpectedRigBindingForBlockType', f'{asset_path}.bindings.nodes.{alias}', f'{alias} is unusual for {", ".join(block_types) or "unbound asset"}.')
                if suggest_cleanup:
                    add_cleanup(alias, value, None, f'{alias} is unusual for {", ".join(block_types) or "unbound asset"}.', 'set-null')

        asset_summary = {
            'assetId': asset.get('assetId'),
            'blockTypes': block_types,
            'modelPath': model_path,
            'modelExists': model_exists,
        }
        audited_assets.append(asset_summary)
        asset_reports.append({
            **asset_summary,
            'diagnostics': asset_diagnostics,
            'cleanupSuggestions': asset_cleanup_actions if suggest_cleanup else [],
        })

    ok = not any(item['severity'] == 'error' for item in diagnostics)
    report = {'ok': ok, 'packRoot': str(pack_root), 'diagnostics': diagnostics, 'assets': audited_assets, 'assetReports': asset_reports}
    if suggest_cleanup:
        report['suggestedManifestCleanup'] = {'mode': 'dry-run', 'actions': cleanup_actions}
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description='Read-only audit for VAW Visual Asset Pack V1 folders.')
    parser.add_argument('pack_root', type=Path)
    parser.add_argument('--manifest', default=DEFAULT_MANIFEST)
    parser.add_argument('--allow-diagnostics', action='store_true', help='Exit 0 even when diagnostics contain errors.')
    parser.add_argument('--suggest-cleanup', action='store_true', help='Include dry-run manifest cleanup suggestions without editing files.')
    args = parser.parse_args()
    report = audit_pack(args.pack_root, args.manifest, suggest_cleanup=args.suggest_cleanup)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report['ok'] or args.allow_diagnostics else 1


if __name__ == '__main__':
    raise SystemExit(main())
