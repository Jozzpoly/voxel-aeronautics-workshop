from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CURRENT_DOCS = {
    'README.md',
    'AI_PROJECT_MEMORY.md',
    'PROJECT_VISION.md',
    'ARCHITECTURE.md',
    'ROADMAP.md',
    'AGENTS.md',
    'docs/README.md',
    'docs/research/programming_model.md',
}

CURRENT_EVIDENCE = {
    'docs/CODE_REALITY_AUDIT.md',
}

CURRENT_CONTRACTS = {
    'docs/blockbench_import_studio.md',
    'docs/visual_asset_pack_v1.md',
    'docs/mission_map_terrain_authoring.md',
}

LEGACY_ACTIVE_PATHS = {
    'README_FOR_AGENTS.md',
    'AGENT_WORKFLOW.md',
    'DELIVERY_WORKFLOW.md',
    'PUSH_INSTRUCTIONS.md',
    'ROADMAP_NEXT.md',
    'FUTURE_READINESS_REVIEW.md',
    'PROGRAMMABLE_MACHINE_RESEARCH.md',
    'CHANGELOG.md',
    'docs/ROADMAP_REBASE_2026-07-01.md',
    'docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md',
    'docs/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md',
    'docs/WORKFLOW_REPAIR_HANDOFF.md',
}

HISTORY_ANCHORS = {
    'docs/history/README.md',
    'docs/history/CHANGELOG.md',
    'docs/history/workflows/README_FOR_AGENTS_2026-07-01.md',
    'docs/history/workflows/AGENT_WORKFLOW_V3.md',
    'docs/history/workflows/DELIVERY_WORKFLOW_V3.md',
    'docs/history/workflows/PUSH_INSTRUCTIONS_2026-06.md',
    'docs/history/planning/ROADMAP_NEXT_2026-07-01.md',
    'docs/history/planning/ROADMAP_REBASE_2026-07-01.md',
    'docs/history/reviews/FUTURE_READINESS_REVIEW_2026-06-18.md',
    'docs/history/reviews/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md',
    'docs/history/validation/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md',
    'docs/history/handoffs/WORKFLOW_REPAIR_HANDOFF.md',
    'docs/history/recovery/2026-06-16/README.md',
    'docs/history/research/PROGRAMMABLE_MACHINE_RESEARCH_legacy.md',
    'docs/history/repository/REPOSITORY_STRUCTURE_AUDIT.md',
}

classified_paths = (*CURRENT_DOCS, *CURRENT_EVIDENCE, *CURRENT_CONTRACTS, *HISTORY_ANCHORS)
missing = sorted(path for path in classified_paths if not (ROOT / path).is_file())
assert not missing, f'Missing current/history-classified docs: {missing}'

legacy_present = sorted(path for path in LEGACY_ACTIVE_PATHS if (ROOT / path).exists())
assert not legacy_present, f'Legacy documents must not remain in active locations: {legacy_present}'

assert not (ROOT / '.codex' / 'handoff').exists(), 'Legacy .codex/handoff must be archived under docs/history.'
assert not (ROOT / 'docs' / 'recovery').exists(), 'Undated legacy recovery docs must be archived under docs/history/recovery/<date>.'
assert not (ROOT / 'docs' / 'repository').exists(), 'Historical repository reports must be archived under docs/history/repository.'

texts = {path: (ROOT / path).read_text(encoding='utf-8') for path in CURRENT_DOCS}
evidence_texts = {path: (ROOT / path).read_text(encoding='utf-8') for path in CURRENT_EVIDENCE}

# Current docs must not reactivate stale branches or milestone plans.
STALE_CURRENT_MARKERS = (
    'maintenance/workflow-repair-clean',
    'maintenance/workflow-bootstrap',
    'Current checkpoint branch for foundation hardening: `current_work`',
    'Current source of truth: **Workbench Foundation on stable Gate C**',
    'Active detailed rebase: `docs/ROADMAP_REBASE_2026-07-01.md`',
)
for path, text in texts.items():
    for marker in STALE_CURRENT_MARKERS:
        assert marker not in text, f'{path} contains stale active authority: {marker}'

readme = texts['README.md']
memory = texts['AI_PROJECT_MEMORY.md']
vision = texts['PROJECT_VISION.md']
architecture = texts['ARCHITECTURE.md']
roadmap = texts['ROADMAP.md']
agents = texts['AGENTS.md']
docs_index = texts['docs/README.md']
programming = texts['docs/research/programming_model.md']
history = (ROOT / 'docs/history/README.md').read_text(encoding='utf-8')
audit = evidence_texts['docs/CODE_REALITY_AUDIT.md']

for required in ('AI_PROJECT_MEMORY.md', 'PROJECT_VISION.md', 'ARCHITECTURE.md', 'ROADMAP.md', 'AGENTS.md', 'docs/README.md'):
    assert required in readme

for phrase in (
    'Sandbox przed checklistą',
    'Dowolny pierwszy blok',
    'Manualne sterowanie pozostaje pełnoprawne',
    'Programowanie rośnie warstwami',
):
    assert phrase in vision, f'Project vision lost durable pillar: {phrase}'

for token in ('Blueprint v12', 'CompiledCraft V5', 'RuntimeAssemblyPlan V3', 'assemblySpaceId', 'blockId', 'bodyId'):
    assert token in architecture, f'Architecture misses current boundary token: {token}'

for token in ('PROVEN', 'PARTIAL', 'ROUGH', 'STUB/CLAIM', 'ABSENT'):
    assert token in roadmap, f'Roadmap misses audit classification: {token}'
    assert token in audit, f'Code reality audit misses classification: {token}'

assert '## P1 — Code reality and technical-debt audit' in roadmap
assert '**Complete**' in roadmap[roadmap.index('## P1 — Code reality and technical-debt audit'):]
assert '## P2 — Recover the smallest truthful VAW loop' in roadmap
assert '**Current phase.**' in roadmap[roadmap.index('## P2 — Recover the smallest truthful VAW loop'):]
assert '### P2-A — Engineering Analysis Truth' in roadmap
p2a = roadmap[roadmap.index('### P2-A — Engineering Analysis Truth'):roadmap.index('### P2-B — Test → Workshop Feedback Continuity')]
assert '**Complete**' in p2a
assert '### P2-B — Test → Workshop Feedback Continuity' in roadmap
p2b = roadmap[roadmap.index('### P2-B — Test → Workshop Feedback Continuity'):roadmap.index('### P2-C — Workshop Editing Fundamentals')]
assert '**Current milestone.**' in p2b

assert 'docs/history/' in agents
assert 'passing test does not prove' in agents.lower()
assert 'Current evidence' in docs_index
assert 'CODE_REALITY_AUDIT.md' in docs_index
assert 'evidence, not independent roadmap authority' in docs_index
assert 'Everything under' in docs_index and 'history/' in docs_index
assert 'never current authority' in docs_index
assert 'non-authoritative history' in history
assert 'not an implementation claim' in programming
assert '{blockId, portId}' in programming
assert 'ControlRuntime' in programming
assert 'P2-B — Test → Workshop Feedback Continuity' in readme
assert 'P2-A Engineering Analysis Truth' in readme

# Current memory must distinguish owner evidence, machine evidence and audit outcome.
for heading in ('Manual product truth', 'Machine evidence', 'P1 code-reality result', 'Current priority', 'Documentation authority'):
    assert heading in memory, f'AI_PROJECT_MEMORY misses current-truth section: {heading}'
assert 'did not accept the current quality' in memory
assert 'P1 is complete' in memory
assert 'P2-A Engineering Analysis Truth is complete' in memory
assert 'P2-B is active' in memory
assert 'CODE_REALITY_AUDIT.md' in memory
assert 'no active M4/M5/M6/Gate-D feature roadmap' in memory

# The current evidence must record the reproduced truth gaps that drive P2.
for phrase in (
    'engineering `weakLinks = 4`',
    'compiled `rigidNeighborBlockIds = 3`',
    'Failure -> diagnosis -> rebuild',
    'Device tuning / direct device binding',
    'Signal graph / ControlRuntime',
    'P2-A — Engineering Analysis Truth: resolved in recovery',
    'compiler-owned `rigidNeighborBlockIds`',
):
    assert phrase in audit, f'Code reality audit misses current evidence: {phrase}'

print({
    'currentDocs': len(CURRENT_DOCS),
    'currentEvidence': len(CURRENT_EVIDENCE),
    'currentContracts': len(CURRENT_CONTRACTS),
    'legacyActivePaths': 0,
    'historyAnchors': len(HISTORY_ANCHORS),
    'authorityBoundary': 'current-vs-history-ok',
    'p1Audit': 'classified-and-linked',
    'p2A': 'complete',
    'p2B': 'current',
})
