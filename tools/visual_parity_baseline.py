#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import io
import json
import re
import warnings
from pathlib import Path, PurePosixPath

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = 'VAW_VISUAL_ASSET_PACK_V1.json'
DEFAULT_BLOCKS = ('Balloon', 'Hull', 'Fuel', 'Thruster', 'VectorThruster')


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def safe_relative_model_path(value: str) -> PurePosixPath:
    path = PurePosixPath(str(value or ''))
    if path.is_absolute() or '..' in path.parts or not path.parts:
        raise ValueError(f'Unsafe model path: {value!r}')
    return path


def load_image_bytes(gltf: dict, gltf_path: Path, image: dict) -> bytes | None:
    uri = image.get('uri')
    if isinstance(uri, str) and uri.startswith('data:'):
        try:
            header, payload = uri.split(',', 1)
        except ValueError:
            return None
        if ';base64' not in header:
            return None
        return base64.b64decode(payload)
    if isinstance(uri, str) and uri:
        image_path = (gltf_path.parent / uri).resolve()
        try:
            image_path.relative_to(gltf_path.parent.resolve())
        except ValueError:
            return None
        if image_path.is_file():
            return image_path.read_bytes()
    return None


def image_luma(image_bytes: bytes) -> dict | None:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            rgba = image.convert('RGBA')
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', DeprecationWarning)
                pixels = list(rgba.getdata())
    except (UnidentifiedImageError, OSError, ValueError):
        return None
    visible = [pixel for pixel in pixels if pixel[3] > 0]
    if not visible:
        return None
    lumas = [(0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 for r, g, b, _ in visible]
    return {
        'visiblePixels': len(visible),
        'average': round(sum(lumas) / len(lumas), 4),
        'min': round(min(lumas), 4),
        'max': round(max(lumas), 4),
    }


def material_name_counts(materials: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for material in materials:
        name = str(material.get('name') or '').strip() or '(unnamed)'
        counts[name] = counts.get(name, 0) + 1
    return counts


def summarize_asset(pack_root: Path, asset: dict) -> dict:
    model_path = pack_root / safe_relative_model_path(asset.get('model', {}).get('path', ''))
    gltf = read_json(model_path)
    materials = gltf.get('materials') or []
    images = gltf.get('images') or []
    image_reports = []
    for index, image in enumerate(images):
        image_bytes = load_image_bytes(gltf, model_path, image)
        luma = image_luma(image_bytes) if image_bytes else None
        image_reports.append({
            'index': index,
            'name': image.get('name') or '',
            'hasUri': isinstance(image.get('uri'), str),
            'luma': luma,
        })
    material_counts = material_name_counts(materials)
    return {
        'assetId': asset.get('assetId'),
        'blockTypes': asset.get('bindings', {}).get('blockTypes') or [],
        'modelPath': str(PurePosixPath(asset.get('model', {}).get('path', ''))),
        'materialPolicy': asset.get('materialPolicy') or {},
        'materials': [
            {
                'index': index,
                'name': material.get('name') or '',
                'alphaMode': material.get('alphaMode') or 'OPAQUE',
                'hasBaseColorTexture': bool(material.get('pbrMetallicRoughness', {}).get('baseColorTexture')),
                'baseColorFactor': material.get('pbrMetallicRoughness', {}).get('baseColorFactor'),
                'doubleSided': bool(material.get('doubleSided')),
            }
            for index, material in enumerate(materials)
        ],
        'duplicateMaterialNames': sorted(name for name, count in material_counts.items() if count > 1),
        'images': image_reports,
        'averageTextureLuma': average_luma(image_reports),
    }


def average_luma(image_reports: list[dict]) -> float | None:
    values = [item['luma']['average'] for item in image_reports if item.get('luma')]
    if not values:
        return None
    return round(sum(values) / len(values), 4)


def source_flags() -> dict:
    game = (ROOT / 'src/game/scene_environment.js').read_text(encoding='utf-8')
    studio = (ROOT / 'tools/blockbench_import_studio/src/minimal_gltf_viewer.js').read_text(encoding='utf-8')
    return {
        'game': {
            'source': 'src/game/scene_environment.js',
            'setsOutputColorSpace': 'outputColorSpace' in game or 'outputEncoding' in game,
            'fogEnabled': 'scene.fog' in game,
            'shadowMapEnabled': 'shadowMap.enabled = true' in game,
            'lightLines': light_lines(game),
            'background': first_hex_after(game, 'scene.background'),
        },
        'studio': {
            'source': 'tools/blockbench_import_studio/src/minimal_gltf_viewer.js',
            'setsOutputColorSpace': 'outputColorSpace' in studio or 'outputEncoding' in studio,
            'fogEnabled': 'scene.fog' in studio,
            'shadowMapEnabled': 'shadowMap.enabled = true' in studio,
            'lightLines': light_lines(studio),
            'background': first_hex_after(studio, 'scene.background'),
        },
    }


def light_lines(source: str) -> list[str]:
    lines = []
    for line in source.splitlines():
        if 'AmbientLight' in line or 'HemisphereLight' in line or 'DirectionalLight' in line:
            lines.append(line.strip())
    return lines


def first_hex_after(source: str, marker: str) -> str | None:
    index = source.find(marker)
    if index < 0:
        return None
    match = re.search(r'0x[0-9a-fA-F]+', source[index:index + 160])
    return match.group(0) if match else None


def same_policy(left: dict | None, right: dict | None) -> bool:
    return (left or {}) == (right or {})


def classify(assets: list[dict], renderer: dict) -> dict:
    by_block = {
        block: asset
        for asset in assets
        for block in asset.get('blockTypes', [])
    }
    balloon = by_block.get('Balloon')
    comparators = [asset for asset in assets if asset is not balloon]
    comparator = comparators[0] if comparators else None
    luma_ratio = None
    if balloon and comparator and balloon.get('averageTextureLuma') is not None and comparator.get('averageTextureLuma'):
        luma_ratio = round(balloon['averageTextureLuma'] / comparator['averageTextureLuma'], 4)

    material_policy_match = bool(balloon and comparator and same_policy(balloon.get('materialPolicy'), comparator.get('materialPolicy')))
    asset_luma_outlier = luma_ratio is not None and luma_ratio < 0.8
    color_space_mismatch = renderer['studio']['setsOutputColorSpace'] and not renderer['game']['setsOutputColorSpace']
    environment_mismatch = (
        renderer['game']['fogEnabled'] != renderer['studio']['fogEnabled']
        or renderer['game']['shadowMapEnabled'] != renderer['studio']['shadowMapEnabled']
        or renderer['game']['lightLines'] != renderer['studio']['lightLines']
    )
    affected_blocks = sorted(by_block)
    block_luma = {
        block: asset.get('averageTextureLuma')
        for block, asset in sorted(by_block.items())
        if asset.get('averageTextureLuma') is not None
    }
    pack_lumas = [value for value in block_luma.values() if value is not None]
    pack_average_luma = round(sum(pack_lumas) / len(pack_lumas), 4) if pack_lumas else None
    balloon_to_pack_average = None
    if balloon and pack_average_luma:
        balloon_to_pack_average = round(balloon['averageTextureLuma'] / pack_average_luma, 4)

    primary_causes = []
    if color_space_mismatch:
        primary_causes.append('color-space/output mismatch')
    if environment_mismatch:
        primary_causes.append('lighting/fog/shadow/preview mismatch')
    if asset_luma_outlier:
        primary_causes.append('asset texture luminance outlier')
    if not primary_causes:
        primary_causes.append('unclassified; needs render capture')

    ruled_out = []
    if not asset_luma_outlier:
        ruled_out.append('obvious Balloon texture luminance outlier')
    if material_policy_match:
        ruled_out.append('Balloon-specific materialPolicy difference')
    if balloon and not balloon.get('duplicateMaterialNames'):
        ruled_out.append('Balloon duplicate material-name override ambiguity')

    return {
        'importedVisualDarkness': 'renderer-preview-mismatch' if primary_causes[0] != 'asset texture luminance outlier' else 'asset-data-risk',
        'balloonDarkness': 'renderer-preview-mismatch' if primary_causes[0] != 'asset texture luminance outlier' else 'asset-data-risk',
        'importedVisualsPreviewMismatch': color_space_mismatch or environment_mismatch,
        'affectedBlocksBySharedRendererSettings': affected_blocks if color_space_mismatch or environment_mismatch else [],
        'primaryCauses': primary_causes,
        'ruledOutForNow': ruled_out,
        'textureLumaByBlock': block_luma,
        'packAverageTextureLuma': pack_average_luma,
        'balloonToComparatorTextureLumaRatio': luma_ratio,
        'balloonToPackAverageTextureLumaRatio': balloon_to_pack_average,
        'visibilityNote': 'Shared renderer settings affect all imported visuals; high-luminance or large bright surfaces make the mismatch easier to see.',
        'requiresRenderCaptureForFinalWeighting': True,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Build a read-only Studio-vs-game visual parity baseline for Visual Asset Pack V1 assets.')
    parser.add_argument('pack_root', type=Path)
    parser.add_argument('--manifest', default=DEFAULT_MANIFEST)
    parser.add_argument('--blocks', default=','.join(DEFAULT_BLOCKS), help='Comma-separated block types to compare.')
    args = parser.parse_args()

    pack_root = args.pack_root.resolve()
    manifest_path = pack_root / args.manifest
    manifest = read_json(manifest_path)
    requested_blocks = [item.strip() for item in args.blocks.split(',') if item.strip()]
    assets = [
        summarize_asset(pack_root, asset)
        for asset in manifest.get('assets', [])
        if set(asset.get('bindings', {}).get('blockTypes') or []).intersection(requested_blocks)
    ]
    renderer = source_flags()
    report = {
        'visualParityBaseline': 'M4L',
        'packRoot': str(pack_root),
        'manifest': str(manifest_path),
        'blocks': requested_blocks,
        'assets': assets,
        'renderer': renderer,
        'classification': classify(assets, renderer),
    }
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
