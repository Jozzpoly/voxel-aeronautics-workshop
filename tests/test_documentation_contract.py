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
HISTORICAL_REVIEWS = {
    'docs/history/reviews/FOUNDATION_REVIEW.md',
    'docs/history/reviews/CRITICAL_REVIEW.md',
    'docs/history/reviews/GAME_MODULARIZATION_REVIEW.md',
}
OLD_REVIEW_PATHS = {
    'FOUNDATION_REVIEW.md',
    'CRITICAL_REVIEW.md',
    'GAME_MODULARIZATION_REVIEW.md',
}

ACTIVE_DOCUMENTS = {
    'README.md',
    'docs/README.md',
    'AI_PROJECT_MEMORY.md',
    'PROJECT_VISION.md',
    'ARCHITECTURE.md',
    'ROADMAP_NEXT.md',
    'FOUNDATION_READINESS_REVIEW.md',
    'PROGRAMMABLE_MACHINE_RESEARCH.md',
    'AGENT_WORKFLOW.md',
    'DELIVERY_WORKFLOW.md',
    'PUSH_INSTRUCTIONS.md',
    'docs/WORKFLOW_REPAIR_HANDOFF.md',
}

required = {
    *ACTIVE_DOCUMENTS,
    'CODE_REVIEW_REPORT.md',
    'TEST_REPORT.md',
    'VALIDATION_REPORT.md',
    'examples/articulated_hinge_v11.json',
    'docs/history/phases/README.md',
    'docs/history/reviews/README.md',
    'docs/repository/REPOSITORY_STRUCTURE_AUDIT.md',
    'docs/repository/REPOSITORY_STRUCTURE_TARGET.md',
    'docs/repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md',
    'docs/repository/DOCUMENTATION_CONVERGENCE_STAGE2_REPORT.md',
    *PHASE_REPORTS,
    *HISTORICAL_REVIEWS,
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
assert not missing, f'Missing active or classified documents: {missing}'

old_phase_paths = sorted(name for name in PHASE_REPORT_NAMES if (ROOT / name).exists())
assert not old_phase_paths, f'Phase reports must not remain in repository root: {old_phase_paths}'

old_review_paths = sorted(path for path in OLD_REVIEW_PATHS if (ROOT / path).exists())
assert not old_review_paths, f'Superseded reviews must not remain in repository root: {old_review_paths}'

texts = {
    path: (ROOT / path).read_text(encoding='utf-8')
    for path in required
    if path.endswith('.md')
}

for path in (
    'AI_PROJECT_MEMORY.md',
    'ARCHITECTURE.md',
    'ROADMAP_NEXT.md',
    'README.md',
    'docs/history/phases/PHASE_1D4A_REPORT.md',
):
    assert 'Phase 1D.4A' in texts[path], f'{path} does not identify the current phase.'

vision = texts['PROJECT_VISION.md']
review = texts['FOUNDATION_READINESS_REVIEW.md']
research = texts['PROGRAMMABLE_MACHINE_RESEARCH.md']
architecture = texts['ARCHITECTURE.md']
roadmap = texts['ROADMAP_NEXT.md']
memory = texts['AI_PROJECT_MEMORY.md']
docs_index = texts['docs/README.md']
agent = texts['AGENT_WORKFLOW.md']
delivery = texts['DELIVERY_WORKFLOW.md']
push = texts['PUSH_INSTRUCTIONS.md']
handoff = texts['docs/WORKFLOW_REPAIR_HANDOFF.md']
phase_index = texts['docs/history/phases/README.md']
review_index = texts['docs/history/reviews/README.md']

for phrase in (
    'Sandbox przed checklistą',
    'Dowolny pierwszy blok',
    'Manualne sterowanie pozostaje pełnoprawne',
    'Programowanie rośnie warstwami',
):
    assert phrase in vision, f'Project vision is missing pillar: {phrase}'

for phrase in (
    'Rigid Islands & Mechanical Compilation',
    'Assembly Spaces / Sublevels',
    'Device & Port Schema',
    'Deterministic Control Kernel',
):
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

for path in HISTORICAL_REVIEWS:
    name = Path(path).name
    assert f'`{name}`' in review_index, f'Historical review index misses {name}'

for heading in (
    'Active product source of truth',
    'Active workflow contracts',
    'Accepted ADRs',
    'Current supporting evidence',
    'Recovery evidence',
    'Historical and superseded material',
):
    assert heading in docs_index, f'Documentation index misses category: {heading}'

assert 'docs/README.md' in texts['README.md']
assert 'direct Git > one final milestone ZIP > complete single file > patch' in docs_index
assert 'Mode R' in agent and 'Mode Z' in agent and 'Mode P' in agent
assert 'three genuinely different safe mechanisms' in agent
assert 'bezpośredni Git > jeden końcowy ZIP milestone' in delivery
assert 'git push origin' in delivery and 'git push --force' in delivery
assert 'git push origin' in push and 'Never force-push' in push
assert 'Stage 1.1 Cross-platform release reproducibility' in handoff
assert 'Gate C' in handoff

STALE_ACTIVE_PHRASES = (
    'NOT-PUBLISHED',
    'Stage 1 has not yet been published',
    'Stage 1 is unpublished',
    'use the complete Stage 1-R1 patch',
    'Preferowany wariant patchowy',
    'Patch jest domyślnym workflow',
)
for path in ACTIVE_DOCUMENTS:
    text = texts[path]
    for phrase in STALE_ACTIVE_PHRASES:
        assert phrase not in text, f'{path} contains stale active status: {phrase}'

for publication_doc in ('AGENT_WORKFLOW.md', 'DELIVERY_WORKFLOW.md', 'PUSH_INSTRUCTIONS.md'):
    text = texts[publication_doc]
    assert all(
        line.strip() != 'git add -A -- .'
        for line in text.splitlines()
    ), f'{publication_doc} must not recommend uncontrolled repository-wide staging'

print({
    'requiredDocuments': len(required),
    'activeDocuments': len(ACTIVE_DOCUMENTS),
    'phaseReportsArchived': len(PHASE_REPORTS),
    'historicalReviewsArchived': len(HISTORICAL_REVIEWS),
    'staleActiveStatus': 0,
    'currentPhase': '1D.4A',
    'nextGate': 'Gate C',
    'documentationIndex': 'ok',
    'workflowV3': 'ok',
})
