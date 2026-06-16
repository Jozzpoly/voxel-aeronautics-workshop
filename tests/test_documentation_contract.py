from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

required = {
    'AI_PROJECT_MEMORY.md',
    'PROJECT_VISION.md',
    'ARCHITECTURE.md',
    'ROADMAP_NEXT.md',
    'FOUNDATION_READINESS_REVIEW.md',
    'PROGRAMMABLE_MACHINE_RESEARCH.md',
    'PHASE_1D3C_REPORT.md',
    'TEST_REPORT.md',
    'VALIDATION_REPORT.md',
    'DELIVERY_WORKFLOW.md',
    'PUSH_INSTRUCTIONS.md',
    'docs/adr/0027-hinge-only-constraint-contract.md',
    'docs/adr/0028-programmable-machine-layers.md',
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f'Missing current foundation documents: {missing}'

memory = (ROOT / 'AI_PROJECT_MEMORY.md').read_text(encoding='utf-8')
architecture = (ROOT / 'ARCHITECTURE.md').read_text(encoding='utf-8')
roadmap = (ROOT / 'ROADMAP_NEXT.md').read_text(encoding='utf-8')
readme = (ROOT / 'README.md').read_text(encoding='utf-8')
vision = (ROOT / 'PROJECT_VISION.md').read_text(encoding='utf-8')
review = (ROOT / 'FOUNDATION_READINESS_REVIEW.md').read_text(encoding='utf-8')
research = (ROOT / 'PROGRAMMABLE_MACHINE_RESEARCH.md').read_text(encoding='utf-8')
delivery = (ROOT / 'DELIVERY_WORKFLOW.md').read_text(encoding='utf-8')
adr_hinge = (ROOT / 'docs/adr/0027-hinge-only-constraint-contract.md').read_text(encoding='utf-8')
adr_control = (ROOT / 'docs/adr/0028-programmable-machine-layers.md').read_text(encoding='utf-8')

for name, text in {
    'memory': memory,
    'architecture': architecture,
    'roadmap': roadmap,
    'readme': readme,
}.items():
    assert 'Phase 1D.3C' in text, f'{name} does not identify the current phase.'

for name, text in {
    'memory': memory,
    'architecture': architecture,
    'roadmap': roadmap,
    'review': review,
}.items():
    assert 'Phase 1D.3D' in text or '1D.3D' in text, f'{name} does not identify the next gate.'

for document in ('PROJECT_VISION.md', 'FOUNDATION_READINESS_REVIEW.md', 'PROGRAMMABLE_MACHINE_RESEARCH.md'):
    assert document in readme, f'README does not point to {document}.'
    assert document in memory, f'AI_PROJECT_MEMORY does not point to {document}.'

for phrase in (
    'Sandbox przed checklistą',
    'Dowolny pierwszy blok',
    'Manualne sterowanie pozostaje pełnoprawne',
    'Programowanie rośnie warstwami',
):
    assert phrase in vision, f'Project vision is missing pillar: {phrase}'

for phrase in (
    'Single-body flight ownership',
    'Rigid Islands & Mechanical Compilation',
    'Device & Port Schema',
    'Deterministic Control Kernel',
):
    assert phrase in review, f'Foundation review is missing required gate/finding: {phrase}'

for phrase in (
    '{blockId, portId}',
    'ControlRuntime',
    'Kable, bus i wireless',
    'sublevel',
):
    assert phrase in research, f'Programming research is missing concept: {phrase}'

assert 'Status: Accepted in Foundation Phase 1D.3C.' in adr_hinge
assert 'Status: Proposed after the Foundation 1D.3C whole-project review.' in adr_control
assert 'tests/test_release_identity.py' in delivery
assert 'python tests/run_all.py' in delivery
assert 'git push --force' in delivery

print({
    'requiredDocuments': len(required),
    'currentPhase': '1D.3C',
    'nextGate': '1D.3D',
    'projectVision': 'ok',
    'foundationReview': 'ok',
    'programmingResearch': 'ok',
    'deliveryContract': 'ok',
})
