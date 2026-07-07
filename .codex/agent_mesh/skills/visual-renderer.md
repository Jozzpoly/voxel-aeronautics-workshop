# Lane skill — visual-renderer (PIXEL / Obraz)

**Lane:** `visual-renderer`  
**Slot:** `visual-renderer-1`  
**Codename:** PIXEL (Obraz)  
**Role:** Game renderer & visual truth — scene policy, profile contract, diagnostic capture entry.

Read first: `README_FOR_AGENTS.md`, `.codex/agent_mesh/LANES.json`, task notes in `QUEUE.json`.

---

## Skills

### 1. `scene_environment`

Own the live game Three.js scene shell: fog, lights, renderer output color space, shadow policy, grid, terrain layers, and obstacle rendering.

| Artifact | Module ID |
|----------|-----------|
| `src/game/scene_environment.js` | `game.scene-environment` |

Rules:

- Consume profiles from `game.visual-renderer-profiles`; do not duplicate profile constants inline.
- Terrain appearance may follow Studio presets; **gameplay data** (`TEST_RANGE`, `catalog.js`, collision) stays owned elsewhere — do not fork mission/collision schema here.
- Collidable obstacles must remain declared in `TEST_RANGE.obstacles`; never hide collidable geometry only inside scene code.
- sRGB output policy must match Studio (`outputColorSpace: 'srgb'`).

### 2. `profiles`

Own the shared, frozen renderer profile contract used by game, diagnostic mode, and parity tooling.

| Artifact | Module ID |
|----------|-----------|
| `src/game/visual-renderer-profiles.js` | `game.visual-renderer-profiles` |

Exported profiles:

| ID | Purpose |
|----|---------|
| `studio-preview` | Studio minimal viewer parity reference |
| `game-default` | Normal playable game renderer policy |
| `game-studio-parity` | Fair Studio-vs-game capture (no fog, matched lights) |

Rules:

- Profiles are immutable contracts — extend via new profile IDs, not silent mutation.
- `source` metadata must **not** reference `tools/blockbench_import_studio/**` paths at runtime (integration guard).
- Helpers: `applyRendererProfile`, `applySceneFog`, `buildRendererOptions`, `createLightsFromProfile`.

### 3. `diagnostic mode`

Own the isolated block render entry used by capture harnesses and visual parity classification.

| Artifact | Entry |
|----------|-------|
| `src/game/visual-parity-diagnostic.js` | Query-param bootstrap |
| `src/game.js`, `index.html` | Wiring only when task allows |

Contract:

```text
/?visualParity=1&block=Balloon&profile=game-studio-parity
```

Ready signals:

- `window.__VAW_VISUAL_PARITY_READY__ === true`
- `window.__VAW_VISUAL_PARITY_META__` — blockType, assetId, modelPath, profileId, camera, viewport, frameHash

Do not change capture orchestrators (`tools/visual_parity_*`) unless the assigned task explicitly includes them (that lane is `tooling-tests` / `studio-pipeline`).

---

## Scope boundaries

### ALLOWED (lane default)

```text
src/game/scene_environment.js
src/game/visual-parity-diagnostic.js
src/game/visual-renderer-profiles.js
src/game/visual_asset_loader.js
src/game/visual_asset_dev_controls.js
src/game.js
index.html
```

Plus any `allowedPathsExtra` on the assigned `QUEUE.json` task (e.g. tests when explicitly granted).

### FORBIDDEN — never touch without reassignment

| Path / domain | Reason |
|---------------|--------|
| `src/foundation/**` | Foundation lane — Blueprint, CraftModel, compiler |
| `src/foundation/craft_compiler.js` | Compiler — not a visual-renderer fix path |
| `src/foundation/craft_model.js` | Model truth — not renderer policy |
| `src/foundation/blueprint.js` | Blueprint schema |
| `src/runtime/**` | Flight/session runtime |
| `src/game/module_visual_factory.js` | Visual factory — other lane |
| `assets/visual_packs/local_working_visuals/**` | `OWNER` — user art |
| `tools/**`, `tests/**` | Unless task `allowedPathsExtra` grants them |
| `release/**` | Build output |

Hard stops:

- **No foundation/compiler edits** to fix a visual skew — classify and hand off (docs-convergence / tooling-tests).
- **No Studio tool imports** in runtime game modules.
- **No second copy** of mission, collision, or catalog schema inside renderer code.
- **No scope expansion** — if the fix needs forbidden paths, stop and report `blocked` to Dispatcher.

---

## Validation ladder

Run what the assigned task lists. Typical commands for this lane:

```powershell
npm run visual:test
npm run browser:smoke
npm run parity:capture
npm run test
npm run validate:fast
```

Minimum bar before reporting `pass`: all commands in `task.validation` green on **current HEAD**.

---

## Task closeout (mandatory)

When the assigned task is done — **pass, fail, or blocked** — do not pick the next task yourself and do not widen scope.

1. Report to Dispatcher: `result`, changed paths, validation output, blockers.
2. If pass: write closeout under `.codex/agent_mesh/assignments/<taskId>.md` when required by playbook.
3. **Always** hand control back to the mesh:

```powershell
npm run agent:next
```

4. **Stop.** Do not implement follow-on work, drive-by refactors, or dependent tasks unless Dispatcher assigns them.

> **Never expand scope.** PIXEL finishes one QUEUE task, yields via `agent:next`, and exits.

---

## Dispatcher report template

```text
Task: <taskId>
Lane: visual-renderer (PIXEL)
Result: pass | fail | blocked
Changed: <paths>
Validation: <command> → PASS|FAIL
Blockers: <none | OWNER | SCOPE | ENVIRONMENT>
Note: <one line>
```