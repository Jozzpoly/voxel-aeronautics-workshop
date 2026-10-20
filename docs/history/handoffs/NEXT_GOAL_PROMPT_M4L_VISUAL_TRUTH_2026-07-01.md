# Next Goal Prompt - M4L Visual Truth And VectorThruster Proof

Status: legacy prompt retained for context; use the current continuation prompt below
Date: 2026-07-01
Scope: next execution lane after roadmap rebase and recalibration audit integration

Use the current continuation prompt when starting the next focused implementation goal. The older prompt block remains below only as evidence of the original M4L start state.

## Current Continuation Prompt

```text
Work on Voxel Aeronautics Workshop in:
C:\Pliki_Joza\Gamo_devovo\VAW\voxel-aeronautics-workshop-foundation-gate-c-assembly-spaces

Goal:
Continue M4L Visual Truth. Do not start Gate D. Do not recolor assets by taste.
Make the Blockbench/Studio-to-game visual pipeline more trustworthy by proving the remaining rendered parity gap for local imported block visuals.

First read:
1. README_FOR_AGENTS.md
2. ROADMAP_NEXT.md
3. docs/ROADMAP_REBASE_2026-07-01.md
4. docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md
5. docs/M4L_VISUAL_TRUTH_BASELINE_2026-07-01.md
6. .codex/handoff/FEATURE_EXPANSION_READINESS_HANDOFF_2026-07-01.md
7. docs/visual_asset_pack_v1.md
8. docs/blockbench_import_studio.md
9. docs/adr/0043-visual-asset-boundary.md
10. docs/adr/0045-renderer-only-vector-thruster-rig-profile.md

Start gate:
- git status --short --branch
- git rev-parse HEAD origin/current_work origin/main
- git diff --stat
- git diff --name-status
- git status --porcelain=v1 -- SOURCE_MANIFEST.json assets/visual_packs/local_working_visuals release .agent-validation tailwind.generated.css
- node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
- npm.cmd run probe:vector-thruster:summary
- node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals

Current evidence:
- Balloon cleanup is closed. Do not reopen JSON cleanup without new diagnostics.
- VectorThruster 24-orientation gate is green for runtime-default and local VectorThruster profiles.
- Game and Studio now both set sRGB renderer output.
- Static baseline covers Balloon, Hull, Fuel, Thruster and VectorThruster.
- The remaining visual-truth gap is likely lighting/fog/shadow/preview mismatch.

Work order:
1. Build a rendered diagnostic capture or diagnostic render mode that compares Studio preview and game under matched camera/framing.
2. Isolate remaining differences: lighting, fog, shadows, tone mapping, material policy or asset data.
3. Keep Visual Asset Pack renderer-only. Do not move gameplay authority into visual manifests.
4. If a visual fix requires gameplay force/control/schema changes, stop and write a design note instead.
5. Keep M5 Voxel Fit, M6 Mechanical V2, M7 device tuning and Gate D schema implementation out of this goal.

Minimum validation:
- node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
- npm.cmd run probe:vector-thruster:summary
- npm.cmd run probe:vector-thruster
- node tools/run_with_python_env.js python tools/visual_parity_baseline.py assets/visual_packs/local_working_visuals
- npm.cmd run visual:test
- npm.cmd run studio:test
- npm.cmd run browser:smoke
- npm.cmd run validate:fast
- node tools/run_with_python_env.js python tests/test_documentation_contract.py
- git diff --check

Success:
- remaining Studio-vs-game visual mismatch is classified from rendered evidence, not hidden by recolor;
- local imported visual pipeline remains the core creative workflow but renderer-only;
- VectorThruster gate remains green;
- next step to M5/M6/M7 is clear and does not mix sources of truth.
```

## Legacy Initial Prompt

```text
Pracujesz nad Voxel Aeronautics Workshop w:
C:\Pliki_Joza\Gamo_devovo\VAW\voxel-aeronautics-workshop-foundation-gate-c-assembly-spaces

Cel nie brzmi "zrób wszystko" ani "zacznij Gate D". Cel brzmi:
domknij M4L Visual Truth na tyle, żeby asset pipeline był realnym, wiarygodnym workflow twórczym Jozza, a VectorThruster przestał być naprawiany zgadywaniem osi.

Najpierw przeczytaj:
1. README_FOR_AGENTS.md
2. ROADMAP_NEXT.md
3. docs/ROADMAP_REBASE_2026-07-01.md
4. docs/FEATURE_EXPANSION_READINESS_AUDIT_2026-07-01.md
5. .codex/handoff/FEATURE_EXPANSION_READINESS_HANDOFF_2026-07-01.md
6. docs/visual_asset_pack_v1.md
7. docs/blockbench_import_studio.md
8. docs/adr/0043-visual-asset-boundary.md
9. docs/adr/0045-renderer-only-vector-thruster-rig-profile.md

Start gate:
- git status --short --branch
- git rev-parse HEAD origin/current_work origin/main
- git diff --stat
- git diff --name-status
- git status --porcelain=v1 -- SOURCE_MANIFEST.json assets/visual_packs/local_working_visuals release .agent-validation
- node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
- npm.cmd run probe:vector-thruster:summary

Sklasyfikuj lokalne zmiany jako USER_ART, CODE, DOCS, GENERATED albo UNKNOWN. Nie używaj git add . Nie resetuj, nie cleanuj, nie rebase'uj i nie normalizuj local_working_visuals bez konkretnego dowodu.

Kierunek pracy:
1. Utrzymaj Balloon cleanup jako zamknięty. Nie wracaj do JSON cleanupu Balloon bez nowej diagnostyki.
2. Zbuduj lub zaprojektuj Studio-vs-game visual parity baseline dla Balloon i jednego nie-Balloon imported block.
3. Ustal, czy ciemność Balloon wynika z asset data, material policy, color-space/tone mapping, światła, fog/shadow czy różnicy Studio preview.
4. Przeanalizuj VectorThruster mismatch przez tools/probe_vector_thruster_direction.js.
5. Nie poprawiaj VectorThruster przez zmianę gameplay force math.
6. Jeśli obecny ADR 0045 renderer-only rig profile nie może poprawnie wyrazić kierunku dyszy, napisz najpierw krótką ADR/design note dla bogatszego renderer-only gimbal-frame contract.
7. Dopiero po zrozumieniu kontraktu napraw profil/adapter tak, aby npm.cmd run probe:vector-thruster przeszedł.

Non-goals:
- brak Gate D schema implementation;
- brak ControlRuntime;
- brak persistent bodyId;
- brak Blueprint/CraftModel/compiler schema expansion;
- brak gameplay force/control changes dla naprawy dyszy;
- brak release/** cleanup;
- brak full particle editor;
- brak greedy meshing;
- brak hinge schema growth.

Walidacja minimalna dla wyniku:
- node tools/run_with_python_env.js python tools/audit_visual_asset_pack.py assets/visual_packs/local_working_visuals --allow-diagnostics --suggest-cleanup
- npm.cmd run probe:vector-thruster:summary
- npm.cmd run probe:vector-thruster
- npm.cmd run visual:test
- npm.cmd run studio:test
- npm.cmd run browser:smoke
- npm.cmd run validate:fast
- node tools/run_with_python_env.js python tests/test_documentation_contract.py
- git diff --check

Sukces:
- visual parity problem jest sklasyfikowany, nie ukryty recolorem;
- VectorThruster ma zielony 24-orientation gate albo istnieje zaakceptowana ADR/design note, która wyjaśnia dlaczego obecny kontrakt nie wystarcza;
- asset pipeline pozostaje core creative workflow, ale renderer-only;
- następny krok do M5/M6/M7 jest jasny i nie miesza źródeł prawdy.
```
