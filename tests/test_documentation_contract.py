from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
required = {
    'AI_PROJECT_MEMORY.md', 'PROJECT_VISION.md', 'ARCHITECTURE.md', 'ROADMAP_NEXT.md',
    'FOUNDATION_READINESS_REVIEW.md', 'PROGRAMMABLE_MACHINE_RESEARCH.md', 'PHASE_1D4A_REPORT.md',
    'CODE_REVIEW_REPORT.md', 'TEST_REPORT.md', 'VALIDATION_REPORT.md', 'DELIVERY_WORKFLOW.md',
    'PUSH_INSTRUCTIONS.md', 'examples/articulated_hinge_v11.json',
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

texts = {path: (ROOT / path).read_text(encoding='utf-8') for path in required if path.endswith('.md')}
for path in ('AI_PROJECT_MEMORY.md', 'ARCHITECTURE.md', 'ROADMAP_NEXT.md', 'README.md', 'PHASE_1D4A_REPORT.md'):
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
assert 'python tests/run_all.py' in delivery
assert 'tests/test_release_identity.py' in delivery
assert 'git push --force' in delivery
assert 'git push --force' in push

print({'requiredDocuments': len(required), 'currentPhase': '1D.4A', 'nextGate': 'Gate C', 'architectureContract': 'ok', 'deliveryContract': 'ok'})
