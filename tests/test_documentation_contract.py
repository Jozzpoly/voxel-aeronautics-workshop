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
    'docs/history/reviews/CODE_REVIEW_REPORT.md',
    'docs/history/reviews/HOTFIX_REPORT.md',
    'docs/history/reviews/FOUNDATION_CONVERGENCE_REVIEW.md',
    'docs/history/reviews/FOUNDATION_READINESS_REVIEW_2026-06-18.md',
}
OLD_REVIEW_PATHS = {
    'FOUNDATION_REVIEW.md',
    'CRITICAL_REVIEW.md',
    'GAME_MODULARIZATION_REVIEW.md',
    'CODE_REVIEW_REPORT.md',
    'HOTFIX_REPORT.md',
    'FOUNDATION_CONVERGENCE_REVIEW.md',
}
RECOVERY_EVIDENCE = {
    'docs/recovery/README.md',
    'docs/recovery/BROWSER_RECOVERY_SCENARIO_2026-06-16.md',
    'docs/recovery/RECOVERY_AUDIT_2026-06-16.md',
    'docs/recovery/RECOVERY_BASELINE_TESTS.md',
    'docs/recovery/RECOVERY_DELIVERY_2026-06-16.md',
    'docs/recovery/RECOVERY_VALIDATION_REPORT_2026-06-16.md',
}
VALIDATION_HISTORY = {
    'docs/history/validation/README.md',
    'docs/history/validation/TEST_REPORT.md',
    'docs/history/validation/VALIDATION_REPORT.md',
}
OLD_RECOVERY_PATHS = {Path(path).name for path in RECOVERY_EVIDENCE if path.endswith('.md') and Path(path).name != 'README.md'}
OLD_VALIDATION_PATHS = {'TEST_REPORT.md', 'VALIDATION_REPORT.md'}

ACTIVE_DOCUMENTS = {
    'README_FOR_AGENTS.md',
    'README.md',
    'docs/README.md',
    'AI_PROJECT_MEMORY.md',
    'PROJECT_VISION.md',
    'ARCHITECTURE.md',
    'ROADMAP_NEXT.md',
    'PROGRAMMABLE_MACHINE_RESEARCH.md',
    'FUTURE_READINESS_REVIEW.md',
    'AGENT_WORKFLOW.md',
    'DELIVERY_WORKFLOW.md',
    'PUSH_INSTRUCTIONS.md',
    'docs/WORKFLOW_REPAIR_HANDOFF.md',
}
ACTIVE_CONTRACT_DOCS = {
    'docs/blockbench_import_studio.md',
    'docs/visual_asset_pack_v1.md',
}
STUDIO_CONTRACT_POINTER = 'tools/blockbench_import_studio/docs/VISUAL_ASSET_PACK_V1.md'

required = {
    *ACTIVE_DOCUMENTS,
    *ACTIVE_CONTRACT_DOCS,
    STUDIO_CONTRACT_POINTER,
    'examples/articulated_hinge_v11.json',
    'examples/assembly_spaces_v12.json',
    'docs/history/phases/README.md',
    'docs/history/reviews/README.md',
    'docs/repository/REPOSITORY_STRUCTURE_AUDIT.md',
    'docs/repository/REPOSITORY_STRUCTURE_TARGET.md',
    'docs/repository/REPOSITORY_STRUCTURE_MIGRATION_REPORT.md',
    'docs/repository/DOCUMENTATION_CONVERGENCE_STAGE2_REPORT.md',
    'docs/repository/RELEASE_ARTIFACT_POLICY_RECOMMENDATION.md',
    *PHASE_REPORTS,
    *HISTORICAL_REVIEWS,
    *RECOVERY_EVIDENCE,
    *VALIDATION_HISTORY,
    *{f'docs/adr/{number:04d}-{name}.md' for number, name in [
        (33, 'blueprint-v11-mechanical-link-schema'),
        (34, 'persistent-mechanical-and-rigid-island-identities'),
        (35, 'structural-cuts-rigid-bypass-and-assembly-connectivity'),
        (36, 'coordinate-spaces-and-body-assembly-pose'),
        (37, 'pure-topology-compilers-and-structured-diagnostics'),
        (38, 'launch-loadout-payload-ownership-per-body'),
        (39, 'body-frame-rebase-with-active-constraints'),
        (40, 'minimal-workshop-hinge-authoring'),
        (41, 'assembly-spaces-and-spatial-ownership'),
        (42, 'workbench-ui-layout'),
        (43, 'visual-asset-boundary'),
        (44, 'workflow-checkpoint-branch-and-ci-policy'),
        (45, 'renderer-only-vector-thruster-rig-profile'),
    ]},
}

missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f'Missing active or classified documents: {missing}'

old_phase_paths = sorted(name for name in PHASE_REPORT_NAMES if (ROOT / name).exists())
assert not old_phase_paths, f'Phase reports must not remain in repository root: {old_phase_paths}'

old_review_paths = sorted(path for path in OLD_REVIEW_PATHS if (ROOT / path).exists())
assert not old_review_paths, f'Superseded reviews must not remain in repository root: {old_review_paths}'

old_recovery_paths = sorted(path for path in OLD_RECOVERY_PATHS if (ROOT / path).exists())
assert not old_recovery_paths, f'Recovery evidence must not remain in repository root: {old_recovery_paths}'

old_validation_paths = sorted(path for path in OLD_VALIDATION_PATHS if (ROOT / path).exists())
assert not old_validation_paths, f'Validation snapshots must not remain in repository root: {old_validation_paths}'

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
    'FUTURE_READINESS_REVIEW.md',
):
    assert 'Gate C' in texts[path], f'{path} does not identify the current gate.'
assert 'Phase 1D.4A' in texts['docs/history/phases/PHASE_1D4A_REPORT.md']

vision = texts['PROJECT_VISION.md']
future = texts['FUTURE_READINESS_REVIEW.md']
research = texts['PROGRAMMABLE_MACHINE_RESEARCH.md']
architecture = texts['ARCHITECTURE.md']
roadmap = texts['ROADMAP_NEXT.md']
memory = texts['AI_PROJECT_MEMORY.md']
docs_index = texts['docs/README.md']
studio_contract_pointer = texts[STUDIO_CONTRACT_POINTER]
agent_entry = texts['README_FOR_AGENTS.md']
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

for phrase in ('Gate C', 'Gate D', 'Device & Port Schema'):
    assert phrase in future or phrase in roadmap, f'Foundation documents miss gate: {phrase}'

for phrase in ('{blockId, portId}', 'ControlRuntime', 'Cables, bus and wireless', 'sublevel'):
    assert phrase in research, f'Programming research is missing concept: {phrase}'

for phrase in ('Blueprint v12', 'CompiledCraft V5', 'RuntimeAssemblyPlan V3', 'assemblySpaceId', 'bodyId'):
    assert phrase in architecture

for phrase in ('Gate C', 'Gate D', 'Gate E', 'dynamic rigid-body split'):
    assert phrase in roadmap or phrase in memory

for number in range(33, 46):
    path = next(path for path in required if path.startswith(f'docs/adr/{number:04d}-'))
    assert 'Status: Accepted' in texts[path]

for name in PHASE_REPORT_NAMES:
    assert f'`{name}`' in phase_index, f'Phase archive index misses {name}'

for path in HISTORICAL_REVIEWS:
    name = Path(path).name
    assert f'`{name}`' in review_index, f'Historical review index misses {name}'

validation_index = texts['docs/history/validation/README.md']
for path in VALIDATION_HISTORY:
    name = Path(path).name
    if name != 'README.md':
        assert f'`{name}`' in validation_index, f'Validation archive index misses {name}'

recovery_index = texts['docs/recovery/README.md']
for path in RECOVERY_EVIDENCE:
    name = Path(path).name
    if name != 'README.md':
        assert f'`{name}`' in recovery_index, f'Recovery archive index misses {name}'

for heading in (
    'Active product authority',
    'Active workflow authority',
    'Active contract docs',
    'Accepted ADRs',
    'Current supporting evidence',
    'Recovery evidence',
    'Historical and superseded material',
):
    assert heading in docs_index, f'Documentation index misses category: {heading}'

assert 'README_FOR_AGENTS.md' in texts['README.md']
assert 'docs/README.md' in texts['README.md']
assert 'direct Git > one final milestone ZIP > complete single file > patch' in docs_index
assert 'docs/visual_asset_pack_v1.md' in docs_index
assert 'tools/blockbench_import_studio/docs/**' in docs_index
assert '../../../docs/visual_asset_pack_v1.md' in studio_contract_pointer
assert 'Non-canonical' in studio_contract_pointer
assert 'Minimal manifest' not in studio_contract_pointer
assert '"format": "VAW_VISUAL_ASSET_PACK_V1"' not in studio_contract_pointer
assert 'current_work' in agent_entry and 'current_work' in agent
assert 'main' in agent_entry and 'main' in agent
assert 'Mode R' in agent and 'Mode Z' in agent and 'Mode P' in agent
assert 'three genuinely different safe mechanisms' in agent
for label in ('PRODUCT', 'HARNESS', 'ENVIRONMENT', 'OWNER', 'SCOPE'):
    assert label in agent_entry, f'Agent entrypoint misses failure class: {label}'
    assert label in agent, f'Agent workflow misses failure class: {label}'
assert 'bezpośredni Git > jeden końcowy ZIP milestone' in delivery
assert 'git push origin' in delivery and ('force-push' in delivery or '--force' in delivery)
assert 'git push origin' in push and 'Never force-push' in push
assert 'Gate C' in handoff and 'Gate D' in handoff and 'Workbench Foundation' in handoff
assert 'ddce6b4' in handoff

STALE_ACTIVE_PHRASES = (
    'NOT-PUBLISHED',
    'Stage 1 has not yet been published',
    'Stage 1 is unpublished',
    'use the complete Stage 1-R1 patch',
    'Preferowany wariant patchowy',
    'Patch jest domyślnym workflow',
)
STALE_ACTIVE_PHRASES = (*STALE_ACTIVE_PHRASES, 'implemented locally')
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

for workflow_path in (
    '.github/workflows/recovery-validation.yml',
    '.github/workflows/release-reproducibility.yml',
):
    workflow_text = (ROOT / workflow_path).read_text(encoding='utf-8')
    for branch in ('recovery/2026-06-16-regression-repair', 'maintenance/workflow-repair-clean'):
        assert branch not in workflow_text, f'{workflow_path} references stale branch {branch}'

release_policy = texts['docs/repository/RELEASE_ARTIFACT_POLICY_RECOMMENDATION.md']
assert 'No files under `release/**` are removed' in release_policy
assert 'owner decision' in release_policy.lower()

print({
    'requiredDocuments': len(required),
    'activeDocuments': len(ACTIVE_DOCUMENTS),
    'phaseReportsArchived': len(PHASE_REPORTS),
    'historicalReviewsArchived': len(HISTORICAL_REVIEWS),
    'staleActiveStatus': 0,
    'currentGate': 'Gate C stable base',
    'nextGate': 'Workbench Foundation',
    'documentationIndex': 'ok',
    'workflowV3': 'ok',
})
