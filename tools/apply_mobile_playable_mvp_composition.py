#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'src' / 'game.js'
MARKER = "MobileCommandPort.register({"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}.')
    return source.replace(old, new, 1)


def main() -> None:
    source = GAME.read_text(encoding='utf-8')
    if MARKER in source:
        print('Mobile command composition already present.')
        return

    require_anchor = "    const DebrisRuntime = window.VAW.require('game.debris-runtime');\n"
    source = replace_once(
        source,
        require_anchor,
        require_anchor + "    const MobileCommandPort = window.VAW.require('game.mobile-command-port');\n",
        'mobile command module require',
    )

    composition_anchor = """      if (hotbarList) { const hotbarBtn = btn.cloneNode(true); hotbarBtn.classList.add('hotbar-tool-btn'); hotbarBtn.addEventListener('click', () => setSelectedTool(name)); hotbarList.appendChild(hotbarBtn); }
    });

    renderer.domElement.addEventListener('pointerenter', () => {
"""
    composition_block = """      if (hotbarList) { const hotbarBtn = btn.cloneNode(true); hotbarBtn.classList.add('hotbar-tool-btn'); hotbarBtn.addEventListener('click', () => setSelectedTool(name)); hotbarList.appendChild(hotbarBtn); }
    });

    MobileCommandPort.register({
      build: {
        catalog() {
          return Object.freeze(Object.entries(BLOCKS).map(([id, definition]) => Object.freeze({
            id,
            label: id.replace(/([a-z])([A-Z])/g, '$1 $2'),
            description: String(definition.desc || ''),
            color: `#${Number(definition.color || 0).toString(16).padStart(6, '0')}`
          })));
        },
        selectPart(partId) {
          const normalized = String(partId || '');
          if (STATE.mode !== 'BUILD' || !BLOCKS[normalized]) return false;
          setSelectedTool(normalized);
          return STATE.selectedBlock === normalized;
        },
        placeAtScreen(x, y) {
          const clientX = Number(x);
          const clientY = Number(y);
          if (STATE.mode !== 'BUILD' || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
          const before = CRAFT.size;
          rayToNDC(clientX, clientY);
          performBuildAction(0);
          return CRAFT.size !== before;
        },
        removeAtScreen(x, y) {
          const clientX = Number(x);
          const clientY = Number(y);
          if (STATE.mode !== 'BUILD' || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
          const before = CRAFT.size;
          rayToNDC(clientX, clientY);
          performBuildAction(2);
          return CRAFT.size !== before;
        },
        rotate(direction) {
          if (STATE.mode !== 'BUILD') return false;
          applyBuildRotation(Number(direction) < 0 ? -1 : 1);
          return true;
        },
        setDirection(direction) {
          const index = Number(direction);
          if (STATE.mode !== 'BUILD' || !Number.isInteger(index) || !AXES[index]) return false;
          setOrientationByVector(AXES[index]);
          return true;
        },
        undo() {
          if (STATE.mode !== 'BUILD') return false;
          const before = blueprintSignature(collectBlueprint());
          undoBlueprint();
          return blueprintSignature(collectBlueprint()) !== before;
        },
        redo() {
          if (STATE.mode !== 'BUILD') return false;
          const before = blueprintSignature(collectBlueprint());
          redoBlueprint();
          return blueprintSignature(collectBlueprint()) !== before;
        }
      },
      session: {
        snapshot() {
          return Object.freeze({
            mode: STATE.mode,
            selectedPart: STATE.selectedBlock,
            orientation: STATE.orientation,
            symmetry: STATE.symmetry,
            craftSize: CRAFT.size,
            resetMeaning: 'return-to-workshop'
          });
        },
        launch() {
          if (STATE.mode !== 'FLIGHT') setMode('FLIGHT');
          return STATE.mode === 'FLIGHT';
        },
        returnToWorkshop() {
          if (STATE.mode !== 'BUILD') setMode('BUILD');
          return STATE.mode === 'BUILD';
        },
        reset() {
          if (STATE.mode !== 'BUILD') setMode('BUILD');
          clearControlActions();
          return STATE.mode === 'BUILD';
        }
      },
      flight: {
        setAction(action, active) {
          const normalized = String(action || '');
          if (!InputProfile.BINDABLE_ACTIONS.includes(normalized)) return false;
          setControlAction(normalized, Boolean(active));
          return true;
        },
        clearActions() {
          clearControlActions();
          return true;
        }
      }
    });

    renderer.domElement.addEventListener('pointerenter', () => {
"""
    source = replace_once(source, composition_anchor, composition_block, 'mobile command composition')
    GAME.write_text(source, encoding='utf-8', newline='\n')
    print('Applied explicit mobile command composition to src/game.js.')


if __name__ == '__main__':
    main()
