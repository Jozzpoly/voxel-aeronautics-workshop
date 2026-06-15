(() => {
  'use strict';

  window.VAW.define(
    'foundation.craft-history',
    ['foundation.config', 'foundation.blueprint'],
    (config, blueprint) => {
      function create(options = {}) {
        const maxSnapshots = Number.isInteger(options.maxSnapshots)
          ? Math.max(1, options.maxSnapshots)
          : config.HISTORY_POLICY.maxSnapshots;
        const maxStoredParts = Number.isInteger(options.maxStoredParts)
          ? Math.max(1, options.maxStoredParts)
          : config.HISTORY_POLICY.maxStoredParts;
        const undoStack = [];
        const redoStack = [];
        let revision = 0;

        function clone(value) {
          return blueprint.clone(value);
        }

        function trim(stack) {
          blueprint.trimHistory(stack, maxSnapshots, maxStoredParts);
        }

        function same(a, b) {
          return blueprint.signature(a) === blueprint.signature(b);
        }

        function commit(previous, current) {
          if (!previous || !current || same(previous, current)) return false;
          undoStack.push(clone(previous));
          trim(undoStack);
          redoStack.length = 0;
          revision += 1;
          return true;
        }

        function undo(current) {
          if (!current || undoStack.length === 0) return null;
          const target = undoStack.pop();
          redoStack.push(clone(current));
          trim(redoStack);
          revision += 1;
          return clone(target);
        }

        function redo(current) {
          if (!current || redoStack.length === 0) return null;
          const target = redoStack.pop();
          undoStack.push(clone(current));
          trim(undoStack);
          revision += 1;
          return clone(target);
        }

        function rollbackUndo(current, target) {
          if (!current || !target || redoStack.length === 0) return false;
          const expectedCurrent = redoStack[redoStack.length - 1];
          if (!same(expectedCurrent, current)) return false;
          redoStack.pop();
          undoStack.push(clone(target));
          trim(undoStack);
          revision += 1;
          return true;
        }

        function rollbackRedo(current, target) {
          if (!current || !target || undoStack.length === 0) return false;
          const expectedCurrent = undoStack[undoStack.length - 1];
          if (!same(expectedCurrent, current)) return false;
          undoStack.pop();
          redoStack.push(clone(target));
          trim(redoStack);
          revision += 1;
          return true;
        }

        function clear() {
          if (!undoStack.length && !redoStack.length) return false;
          undoStack.length = 0;
          redoStack.length = 0;
          revision += 1;
          return true;
        }

        function inspect() {
          return Object.freeze({
            revision,
            undoCount: undoStack.length,
            redoCount: redoStack.length,
            undoParts: undoStack.reduce((sum, entry) => sum + (entry.blocks?.length || 0), 0),
            redoParts: redoStack.reduce((sum, entry) => sum + (entry.blocks?.length || 0), 0),
            maxSnapshots,
            maxStoredParts
          });
        }

        const api = {
          commit,
          undo,
          redo,
          rollbackUndo,
          rollbackRedo,
          clear,
          inspect
        };
        Object.defineProperties(api, {
          canUndo: { enumerable: true, get: () => undoStack.length > 0 },
          canRedo: { enumerable: true, get: () => redoStack.length > 0 },
          undoCount: { enumerable: true, get: () => undoStack.length },
          redoCount: { enumerable: true, get: () => redoStack.length },
          revision: { enumerable: true, get: () => revision }
        });
        return Object.freeze(api);
      }

      return Object.freeze({ create });
    }
  );
})();
