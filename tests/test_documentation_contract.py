from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHASE_REPORT_NAMES = (
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
)
PHASE_REPORTS = {f'docs/history/phases/{name}' for name in PHASE_REPORT_NAMES}
required = {
    'AI_PROJECT_MEMORY.md', 'PROJECT_VISION.md', 'ARCHITECTURE.md', 'ROADMAP_NEXT.md',
    'FOUNDATION_READINESS_REVIEW.md', 'PROGRAMMABLE_MACHINE_RESEARCH.md',
    'CODE_REVIEW_REPORT.md', 'TEST_REPORT.md', 'VALIDATION_REPORT.md', 'DELIVERY_WORKFLOW.md',
    'PUSH_INSTRUCTIONS.md', 'examples/articulated_hinge_v11.json',
    'docs/history/phases/README.md',
    'docs/repository/REPOSITORY_STRUCTURE_AUDIT.md',
    'docs/repository/REPOSITORY_STRUCTURE_TARGET.md',
    'docs/repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md',
    *PHASE_REPORTS,
    *{f'docs/adr/{number:04d}-{name}.md' for number, name in [
        (33, 'blueprint-v11-mechanical-link-schema'),
        (34, 'persistent-mechanical-and-rigid-island-identities'),
        (35, 'structural-cuts-rigid-bypass-and-assembly-connectivity'),
        (36, 'coordinate-spaces-and-body-assembly-pose'),
        (37, 'pure-topology-compilers-and-structured-diagnostics'),
        (38, 'launch-loadout-payload-ownership-per-body'),
        (39, 'body-frame-rebase-with-active-constraints'),
        (40, 'minimal-workshop-hinge-authoring'),
    ]},
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f'Missing Phase 1D.4A documents: {missing}'
old_phase_paths = sorted(name for name in PHASE_REPORT_NAMES if (ROOT / name).exists())
assert not old_phase_paths, f'Phase reports must not remain in repository root: {old_phase_paths}'

texts = {path: (ROOT / path).read_text(encoding='utf-8') for path in required if path.endswith('.md')}
for path in ('AI_PROJECT_MEMORY.md', 'ARCHITECTURE.md', 'ROADMAP_NEXT.md', 'README.md', 'docs/history/phases/PHASE_1D4A_REPORT.md'):
    text = (ROOT / path).read_text(encoding='utf-8')
    assert 'Phase 1D.4A' in text, f'{path} does not identify the current phase.'

memory = texts['AI_PROJECT_MEMORY.md']
architecture = texts['ARCHITECTURE.md']
roadmap = texts['ROADMAP_NEXT.md']
review = texts['FOUNDATION_READINESS_REVIEW.md']
research = texts['PROGRAMMABLE_MACHINE_RESEARCH.md']
vision = texts['PROJECT_VISION.md']
delivery = texts['DELIVERY_WORKFLOW.md']
push = texts['PUSH_INSTRUCTIONS.md']
phase_index = texts['docs/history/phases/README.md']

for phrase in ('Sandbox przed checklistą', 'Dowolny pierwszy blok', 'Manualne sterowanie pozostaje pełnoprawne', 'Programowanie rośnie warstwami'):
    assert phrase in vision, f'Project vision is missing pillar: {phrase}'
for phrase in ('Rigid Islands & Mechanical Compilation', 'Assembly Spaces / Sublevels', 'Device & Port Schema', 'Deterministic Control Kernel'):
    assert phrase in review, f'Foundation review is missing gate: {phrase}'
for phrase in ('{blockId, portId}', 'ControlRuntime', 'Kable, bus i wireless', 'sublevel'):
    assert phrase in research, f'Programming research is missing concept: {phrase}'
for phrase in ('assemblyPosition', 'bodyLocalPosition', 'assemblyPose', 'mechanical-rigid-bypass'):
    assert phrase in architecture
for phrase in ('Gate C', 'Gate D', 'Gate E', 'dynamic rigid-body split'):
    assert phrase in roadmap or phrase in memory
for number in range(33, 41):
    path = next(path for path in required if path.startswith(f'docs/adr/{number:04d}-'))
    assert 'Status: Accepted' in texts[path]
for name in PHASE_REPORT_NAMES:
    assert f'`{name}`' in phase_index, f'Phase archive index misses {name}'
assert 'python tests/run_all.py' in delivery
assert 'tests/test_release_identity.py' in delivery
assert 'git push --force' in delivery
assert 'git push --force' in push
for publication_doc, publication_text in (('DELIVERY_WORKFLOW.md', delivery), ('PUSH_INSTRUCTIONS.md', push)):
    assert 'git apply --index' in publication_text, f'{publication_doc} must prefer indexed patch application'
    assert 'git diff --cached --name-status' in publication_text, f'{publication_doc} must expose the staged path set'
    assert 'git diff --cached --stat' in publication_text, f'{publication_doc} must expose the staged diff summary'
    assert all(line.strip() != 'git add -A -- .' for line in publication_text.splitlines()), f'{publication_doc} must not recommend repository-wide staging'

print({
    'requiredDocuments': len(required),
    'phaseReportsArchived': len(PHASE_REPORTS),
    'rootPhaseReports': 0,
    'currentPhase': '1D.4A',
    'nextGate': 'Gate C',
    'architectureContract': 'ok',
    'deliveryContract': 'ok',
})
