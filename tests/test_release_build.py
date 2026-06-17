from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_builder', ROOT / 'tools' / 'build_release.py')
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def embedded_source(single_text: str, relative: Path) -> str:
    begin = f'/* BEGIN {relative.as_posix()} */\n'
    end = f'\n/* END {relative.as_posix()} */'
    start = single_text.index(begin) + len(begin)
    finish = single_text.index(end, start)
    return single_text[start:finish]


assert '.agent-validation' in module.IGNORED_ARCHIVE_PARTS

module.ensure_source_manifest(ROOT)
manifest_path = ROOT / module.MANIFEST_NAME
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert manifest['releaseId'] == module.RELEASE_ID
assert manifest['appVersion'] == module.APP_VERSION
for relative in module.MANIFEST_INPUTS:
    assert manifest['files'][relative.as_posix()] == module.sha256(ROOT / relative)

with tempfile.TemporaryDirectory() as temporary:
    temporary = Path(temporary)
    single = temporary / module.SINGLE_NAME
    archive = temporary / module.ZIP_NAME
    second_single = temporary / ('second-' + module.SINGLE_NAME)
    second_archive = temporary / ('second-' + module.ZIP_NAME)

    single.write_text(module.build_single_html(ROOT), encoding='utf-8', newline='\n')
    module.write_zip(ROOT, archive, single)
    second_single.write_text(module.build_single_html(ROOT), encoding='utf-8', newline='\n')
    module.write_zip(ROOT, second_archive, second_single)

    text = single.read_text(encoding='utf-8')
    assert text.count('BEGIN EMBEDDED APPLICATION') == 1
    assert text.count('BEGIN EMBEDDED STYLES') == 1
    assert f'RELEASE_ID: {module.RELEASE_ID}' in text
    assert f'APP_VERSION: {module.APP_VERSION}' in text
    assert 'href="styles.css"' not in text

    # Every embedded module must be byte-for-byte equivalent after the builder's
    # documented trailing-whitespace normalization.
    for relative in module.APP_SOURCES:
        expected = (ROOT / relative).read_text(encoding='utf-8').rstrip()
        actual = embedded_source(text, relative)
        assert actual == expected, f'single-file source mismatch: {relative}'

    start = text.index('/* BEGIN EMBEDDED APPLICATION */')
    end = text.index('/* END EMBEDDED APPLICATION */')
    embedded = text[start + len('/* BEGIN EMBEDDED APPLICATION */'):end].strip()
    extracted = temporary / 'embedded_game.js'
    extracted.write_text(embedded, encoding='utf-8')
    subprocess.run(['node', '--check', str(extracted)], check=True)

    prefix = module.ARCHIVE_ROOT + '/'
    with zipfile.ZipFile(archive) as zipped:
        names = set(zipped.namelist())
        required = {
            prefix + 'index.html', prefix + 'styles.css', prefix + 'src/game.js',
            prefix + module.MANIFEST_NAME,
            prefix + 'README.md', prefix + 'CHANGELOG.md', prefix + 'CRITICAL_REVIEW.md',
            prefix + 'AI_PROJECT_MEMORY.md', prefix + 'ARCHITECTURE.md', prefix + 'FOUNDATION_REVIEW.md',
            prefix + 'ROADMAP_NEXT.md', prefix + 'TEST_REPORT.md', prefix + 'VALIDATION_REPORT.md',
            prefix + 'GAME_MODULARIZATION_REVIEW.md',
            prefix + 'PROJECT_VISION.md', prefix + 'FOUNDATION_READINESS_REVIEW.md',
            prefix + 'PROGRAMMABLE_MACHINE_RESEARCH.md',
            prefix + 'docs/history/phases/README.md',
            prefix + 'docs/history/phases/PHASE_1C2_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D1_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2A_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2B_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2C_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2D_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2E_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D2F_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D3A_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D3B_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D3B1_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D3C_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D3D_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D3E_REPORT.md',
            prefix + 'docs/history/phases/PHASE_1D4A_REPORT.md',
            prefix + 'docs/adr/0004-craft-model-is-authoritative.md',
            prefix + 'docs/adr/0005-atomic-editor-transactions-and-history.md',
            prefix + 'docs/adr/0009-passive-thrust-does-not-cap-pilot-authority.md',
            prefix + 'docs/adr/0010-release-artifacts-have-verifiable-source-parity.md',
            prefix + 'docs/adr/0016-mission-completion-is-state-based.md',
            prefix + 'docs/adr/0017-multi-pad-recovery-and-altitude-dependent-aerostatics.md',
            prefix + 'docs/adr/0018-desktop-input-and-aerostatic-settling.md',
            prefix + 'docs/adr/0026-game-shell-uses-explicit-composition.md',
            prefix + 'docs/adr/0027-hinge-only-constraint-contract.md',
            prefix + 'docs/adr/0028-programmable-machine-layers.md',
            prefix + 'tools/build_release.py', prefix + 'tools/verify_release.py',
            prefix + 'tests/source_inventory.py', prefix + 'tests/test_game_architecture.py',
            prefix + 'tests/test_game_services.js', prefix + 'tests/test_audit_regressions.py',
            prefix + 'tests/test_joint_capability_spike.js', prefix + 'tests/test_release_identity.py',
            prefix + 'tests/test_documentation_contract.py',
            prefix + 'tests/test_gate_b_compilers.js', prefix + 'tests/test_gate_b_gameplay.js',
            prefix + 'CODE_REVIEW_REPORT.md',
            prefix + 'examples/articulated_hinge_v11.json',
            prefix + 'src/foundation/diagnostics.js', prefix + 'src/foundation/transform_math.js',
            prefix + 'src/foundation/structural_graph_compiler.js',
            prefix + 'src/foundation/mechanical_authoring_resolver.js',
            prefix + 'src/foundation/rigid_island_compiler.js',
            prefix + 'src/foundation/mechanical_graph_compiler.js',
            prefix + 'docs/adr/0033-blueprint-v11-mechanical-link-schema.md',
            prefix + 'docs/adr/0034-persistent-mechanical-and-rigid-island-identities.md',
            prefix + 'docs/adr/0035-structural-cuts-rigid-bypass-and-assembly-connectivity.md',
            prefix + 'docs/adr/0036-coordinate-spaces-and-body-assembly-pose.md',
            prefix + 'docs/adr/0037-pure-topology-compilers-and-structured-diagnostics.md',
            prefix + 'docs/adr/0038-launch-loadout-payload-ownership-per-body.md',
            prefix + 'docs/adr/0039-body-frame-rebase-with-active-constraints.md',
            prefix + 'docs/adr/0040-minimal-workshop-hinge-authoring.md',
            prefix + 'src/foundation/kernel.js', prefix + 'src/foundation/config.js',
            prefix + 'src/foundation/catalog.js', prefix + 'src/foundation/orientation.js',
            prefix + 'src/foundation/blueprint.js', prefix + 'src/foundation/craft_model.js',
            prefix + 'src/foundation/craft_history.js', prefix + 'src/foundation/control_frame.js',
            prefix + 'src/foundation/craft_compiler.js', prefix + 'src/foundation/input_profile.js',
            prefix + 'src/foundation/ui_workspace.js', prefix + 'src/foundation/mission_evaluator.js', prefix + 'src/foundation/aerostatics.js', prefix + 'src/foundation/flight_control.js', prefix + 'src/foundation/state.js',
            prefix + 'src/foundation/bootstrap.js',
            prefix + 'src/game/scene_environment.js', prefix + 'src/game/career_service.js',
            prefix + 'src/game/workspace_controller.js', prefix + 'src/game/input_settings_controller.js',
            prefix + 'src/game/orientation_service.js', prefix + 'src/game/module_visual_factory.js',
            prefix + 'src/game/engineering_analysis.js', prefix + 'src/game/blueprint_controller.js',
            prefix + 'src/game/mission_controller.js',
            prefix + 'release/' + single.name,
            prefix + 'release/SHA256.txt',
        }
        missing = required - names
        assert not missing, f'missing release files: {sorted(missing)}'
        assert not any('/dist/' in name for name in names)
        old_phase_paths = {prefix + name for name in (
            'PHASE_1C2_REPORT.md',
            'PHASE_1D1_REPORT.md',
            'PHASE_1D2_REPORT.md',
            'PHASE_1D2A_REPORT.md',
            'PHASE_1D2B_REPORT.md',
            'PHASE_1D2C_REPORT.md',
            'PHASE_1D2D_REPORT.md',
            'PHASE_1D2E_REPORT.md',
            'PHASE_1D2F_REPORT.md',
            'PHASE_1D3A_REPORT.md',
            'PHASE_1D3B_REPORT.md',
            'PHASE_1D3B1_REPORT.md',
            'PHASE_1D3C_REPORT.md',
            'PHASE_1D3D_REPORT.md',
            'PHASE_1D3E_REPORT.md',
            'PHASE_1D4A_REPORT.md',
        )}
        assert not (old_phase_paths & names), f'old root phase-report paths remain in ZIP: {sorted(old_phase_paths & names)}'

        # Source ZIP content must match the actual worktree used to build the HTML.
        for relative in module.MANIFEST_INPUTS:
            archived = zipped.read(prefix + relative.as_posix())
            assert archived == (ROOT / relative).read_bytes(), f'ZIP source mismatch: {relative}'
        assert zipped.read(prefix + 'release/' + single.name) == single.read_bytes()
        packaged_hash = zipped.read(prefix + 'release/SHA256.txt').decode('utf-8')
        assert packaged_hash == f'{module.sha256(single)}  {single.name}\n'

    assert single.read_bytes() == second_single.read_bytes(), 'single-file build is not deterministic'
    # Different virtual filenames inside the archive intentionally change ZIP bytes,
    # so compare two archives built with the same single-file name.
    same_name_single = temporary / 'repeat' / module.SINGLE_NAME
    same_name_single.parent.mkdir()
    same_name_single.write_bytes(single.read_bytes())
    same_name_archive = temporary / 'repeat.zip'
    module.write_zip(ROOT, same_name_archive, same_name_single)
    assert archive.read_bytes() == same_name_archive.read_bytes(), 'source package build is not deterministic'

    hashes = temporary / 'SHA256.txt'
    hashes.write_text(
        f'{module.sha256(single)}  {single.name}\n{module.sha256(archive)}  {archive.name}\n',
        encoding='utf-8',
    )
    verified = subprocess.run(
        [
            sys.executable, str(ROOT / 'tools' / 'verify_release.py'),
            '--single', str(single), '--zip', str(archive), '--hashes', str(hashes),
        ],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    assert "'artifactSet': 'html+zip+sha256'" in verified.stdout
    assert "'zipIntegrity': 'ok'" in verified.stdout
    assert "'externalChecksums': 'ok'" in verified.stdout

print({
    'single_file_syntax': 'ok',
    'embedded_source_parity': 'ok',
    'zip_source_parity': 'ok',
    'packaged_single_file_parity': 'ok',
    'manifest_hashes': 'ok',
    'deterministic_builds': 'ok',
})
