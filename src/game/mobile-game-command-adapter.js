'use strict';

(function registerMobileGameCommandAdapter(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-game-command-adapter.js.');
  root.VAW.define('game.mobile-game-command-adapter', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileGameCommandAdapterModule() {
  function requireFunction(value, name) {
    if (typeof value !== 'function') throw new TypeError(`Mobile game command adapter requires ${name}().`);
    return value;
  }

  function requireObject(value, name) {
    if (!value || typeof value !== 'object') throw new TypeError(`Mobile game command adapter requires ${name}.`);
    return value;
  }

  function create(options = {}) {
    const blocks = requireObject(options.blocks, 'blocks');
    const axes = Array.isArray(options.axes) ? options.axes : (() => { throw new TypeError('Mobile game command adapter requires axes.'); })();
    const state = requireObject(options.state, 'state');
    const craft = requireObject(options.craft, 'craft');
    const selectPart = requireFunction(options.selectPart, 'selectPart');
    const targetScreen = requireFunction(options.targetScreen, 'targetScreen');
    const buildAction = requireFunction(options.buildAction, 'buildAction');
    const rotate = requireFunction(options.rotate, 'rotate');
    const setOrientation = requireFunction(options.setOrientation, 'setOrientation');
    const undo = requireFunction(options.undo, 'undo');
    const redo = requireFunction(options.redo, 'redo');
    const collectBlueprint = requireFunction(options.collectBlueprint, 'collectBlueprint');
    const blueprintSignature = requireFunction(options.blueprintSignature, 'blueprintSignature');
    const setMode = requireFunction(options.setMode, 'setMode');
    const clearControlActions = requireFunction(options.clearControlActions, 'clearControlActions');
    const bindableActions = Array.isArray(options.bindableActions) ? options.bindableActions : (() => { throw new TypeError('Mobile game command adapter requires bindableActions.'); })();
    const setControlAction = requireFunction(options.setControlAction, 'setControlAction');

    function inBuildMode() {
      return state.mode === 'BUILD';
    }

    function finiteScreenPoint(x, y) {
      const clientX = Number(x);
      const clientY = Number(y);
      return Number.isFinite(clientX) && Number.isFinite(clientY) ? { clientX, clientY } : null;
    }

    function runHistory(action) {
      if (!inBuildMode()) return false;
      const before = blueprintSignature(collectBlueprint());
      action();
      return blueprintSignature(collectBlueprint()) !== before;
    }

    const build = Object.freeze({
      catalog() {
        return Object.freeze(Object.entries(blocks).map(([id, definition]) => Object.freeze({
          id,
          label: id.replace(/([a-z])([A-Z])/g, '$1 $2'),
          description: String(definition?.desc || ''),
          color: `#${Number(definition?.color || 0).toString(16).padStart(6, '0')}`
        })));
      },
      selectPart(partId) {
        const normalized = String(partId || '');
        if (!inBuildMode() || !blocks[normalized]) return false;
        selectPart(normalized);
        return state.selectedBlock === normalized;
      },
      placeAtScreen(x, y) {
        const point = finiteScreenPoint(x, y);
        if (!inBuildMode() || !point) return false;
        const before = craft.size;
        targetScreen(point.clientX, point.clientY);
        buildAction(0);
        return craft.size !== before;
      },
      removeAtScreen(x, y) {
        const point = finiteScreenPoint(x, y);
        if (!inBuildMode() || !point) return false;
        const before = craft.size;
        targetScreen(point.clientX, point.clientY);
        buildAction(2);
        return craft.size !== before;
      },
      rotate(direction) {
        if (!inBuildMode()) return false;
        rotate(Number(direction) < 0 ? -1 : 1);
        return true;
      },
      setDirection(direction) {
        const index = Number(direction);
        if (!inBuildMode() || !Number.isInteger(index) || !axes[index]) return false;
        setOrientation(axes[index]);
        return true;
      },
      undo: () => runHistory(undo),
      redo: () => runHistory(redo)
    });

    const session = Object.freeze({
      snapshot() {
        return Object.freeze({
          mode: state.mode,
          selectedPart: state.selectedBlock,
          orientation: state.orientation,
          symmetry: state.symmetry,
          craftSize: craft.size,
          resetMeaning: 'return-to-workshop'
        });
      },
      launch() {
        if (state.mode !== 'FLIGHT') setMode('FLIGHT');
        return state.mode === 'FLIGHT';
      },
      returnToWorkshop() {
        if (state.mode !== 'BUILD') setMode('BUILD');
        return state.mode === 'BUILD';
      },
      reset() {
        if (state.mode !== 'BUILD') setMode('BUILD');
        clearControlActions();
        return state.mode === 'BUILD';
      }
    });

    const flight = Object.freeze({
      setAction(action, active) {
        const normalized = String(action || '');
        if (!bindableActions.includes(normalized)) return false;
        setControlAction(normalized, Boolean(active));
        return true;
      },
      clearActions() {
        clearControlActions();
        return true;
      }
    });

    return Object.freeze({ build, session, flight });
  }

  return Object.freeze({ create });
});
