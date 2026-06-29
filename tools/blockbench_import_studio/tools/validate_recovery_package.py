#!/usr/bin/env python3
from __future__ import annotations
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    'index.html','minimal_viewer.html','app/main.js','app/styles.css',
    'src/file_bundle_resolver.js','src/project_files_report.js','src/animation_report.js','src/layout_manager.js','src/minimal_gltf_viewer.js','src/viewport_controls.js','src/fit_camera.js','src/texture_report.js','src/vaw_validator.js','src/visual_asset_pack_v1.js','src/package_exporter.js',
    'vendor/three.min.js','vendor/GLTFLoader.js',
    'assets/uv_checker_cube_gltf/uv_checker_cube.gltf','assets/uv_checker_cube_gltf/uv_checker_cube.bin','assets/uv_checker_cube_gltf/textures/uv_checker.png',
    'assets/axis_scale_offset_gltf/axis_scale_offset.gltf','assets/axis_scale_offset_gltf/axis_scale_offset.bin','assets/axis_scale_offset_gltf/textures/uv_checker.png',
    'docs/RECOVERY_AUDIT.md','docs/ROOT_CAUSE_ANALYSIS.md','docs/IMPLEMENTATION_REPORT.md','docs/USER_TESTING_GUIDE.md','docs/KNOWN_LIMITATIONS.md','docs/NEXT_FEATURE_BACKLOG.md','docs/WORKBENCH_AUDIT.md','docs/WORKBENCH_IMPLEMENTATION_REPORT.md','docs/PROJECT_FILES_PANEL_GUIDE.md','docs/LAYOUT_GUIDE.md','docs/NEXT_STEPS_AFTER_WORKBENCH.md','docs/WORKBENCH_CRITICAL_ANALYSIS.md','docs/WORKBENCH_HARDENING_PLAN.md','docs/WORKBENCH_HARDENING_IMPLEMENTATION_REPORT.md','docs/VISUAL_ASSET_PACK_V1.md','docs/M4A_STUDIO_RESTART_CRITICAL_REVIEW.md','docs/M4A_ENGINE_COMPATIBILITY_REPORT_2026-06-23.md','docs/M4A_CRITICAL_POLISH_AFTER_USER_SMOKE_2026-06-23.md','schemas/visual_asset_pack_v1.schema.json',
    'assets/sample_visual_asset_pack_v1/models/test_anim.gltf','assets/sample_visual_asset_pack_v1/VAW_VISUAL_ASSET_PACK_V1.json',
    'assets/real_blockbench_regression/test_anim.gltf','assets/real_blockbench_regression/test.gltf','assets/real_blockbench_regression/model_bone_as_amature.gltf',
    'assets/real_blockbench_thruster_pack/models/test_anim.gltf','assets/real_blockbench_thruster_pack/VAW_VISUAL_ASSET_PACK_V1.json',
]
missing = [p for p in REQUIRED if not (ROOT / p).is_file()]
if missing:
    raise SystemExit('missing required files: ' + ', '.join(missing))
index = (ROOT / 'index.html').read_text(encoding='utf-8')
minimal = (ROOT / 'minimal_viewer.html').read_text(encoding='utf-8')
main = (ROOT / 'app/main.js').read_text(encoding='utf-8')
viewer = (ROOT / 'src/minimal_gltf_viewer.js').read_text(encoding='utf-8')
for needle in ['MMB obrót', 'Shift+MMB pan', 'scroll zoom', 'LPM/PPM wolne']:
    if needle not in index and needle not in minimal:
        raise SystemExit(f'missing UI requirement: {needle}')
for forbidden in ['cancelAnimationFrame(state.animationFrame)', 'OrbitControls']:
    if forbidden in main or forbidden in viewer:
        raise SystemExit(f'forbidden old pattern found: {forbidden}')
uv = json.loads((ROOT / 'assets/uv_checker_cube_gltf/uv_checker_cube.gltf').read_text(encoding='utf-8'))
if not uv.get('buffers') or not uv.get('images') or not uv.get('materials'):
    raise SystemExit('uv checker gltf is not an external .gltf + .bin + texture sample')
for needle in ['Project Files', 'Reset layout', 'Export Debug Package', 'Export Visual Asset Pack V1', 'Animation preview', 'Format JSON', 'Apply manifest', 'VAW_VISUAL_ASSET_PACK_V1', 'vaw-block-type', 'vaw-node-visual-root']:
    if needle not in index:
        raise SystemExit(f'missing workbench UI requirement: {needle}')
for needle in ['buildDebugPackageEntries', 'buildVisualAssetPackEntries', 'downloadDebugPackageZip', 'ANIMATION_REPORT', 'WORKBENCH_SESSION_REPORT']:
    if needle not in main and needle not in (ROOT / 'src/package_exporter.js').read_text(encoding='utf-8'):
        raise SystemExit(f'missing debug export implementation: {needle}')
for needle in ['visual: SAMPLE_VISUAL_PACK_V1', 'v1: SAMPLE_VISUAL_PACK_V1', 'isViewerGeneratedBlobUrl']:
    if needle not in main:
        raise SystemExit(f'missing smoke/noise hardening: {needle}')
exporter = (ROOT / 'src/package_exporter.js').read_text(encoding='utf-8')
for needle in ['manifest.model.path', 'LOADED_SOURCE_FILES_REPORT', 'Engine-facing package files']:
    if needle not in exporter:
        raise SystemExit(f'missing engine-facing export layout guard: {needle}')
print(json.dumps({'recoveryPackage': 'ok', 'requiredFiles': len(REQUIRED), 'scripts': ['npm test', 'python ../serve.py --studio']}, indent=2))
