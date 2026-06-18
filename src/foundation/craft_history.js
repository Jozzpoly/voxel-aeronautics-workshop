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
        const maxStoredBytes = Number.isInteger(options.maxStoredBytes)
          ? Math.max(1024, options.maxStoredBytes)
          : config.HISTORY_POLICY.maxStoredBytes;
        const undoStack = [];
        const redoStack = [];
        let revision = 0;

        function clone(value) { return blueprint.clone(value); }
        function entityWeight(document) {
          return (document?.blocks?.length || 0)
            + (document?.mechanicalLinks?.length || 0)
            + (document?.assemblySpaces?.length || 0);
        }
        function makeEntry(document) {
          const snapshot = clone(document);
          const signature = blueprint.signature(snapshot);
          return Object.freeze({
            snapshot,
            signature,
            bytes: signature.length * 2,
            entities: entityWeight(snapshot)
          });
        }
        function signatureOf(document) { return blueprint.signature(document); }
        function trim(stack) {
          let bytes = stack.reduce((sum, entry) => sum + entry.bytes, 0);
          let entities = stack.reduce((sum, entry) => sum + entry.entities, 0);
          while (stack.length > maxSnapshots || ((bytes > maxStoredBytes || entities > maxStoredParts) && stack.length > 1)) {
            const removed = stack.shift();
            bytes -= removed.bytes;
            entities -= removed.entities;
          }
        }
        function sameDocumentAndEntry(document, entry) {
          return Boolean(document && entry && signatureOf(document) === entry.signature);
        }
        function sameDocuments(a, b) {
          return Boolean(a && b && signatureOf(a) === signatureOf(b));
        }

        function commit(previous, current) {
          if (!previous || !current || sameDocuments(previous, current)) return false;
          undoStack.push(makeEntry(previous));
          trim(undoStack);
          redoStack.length = 0;
          revision += 1;
          return true;
        }

        function undo(current) {
          if (!current || undoStack.length === 0) return null;
          const target = undoStack.pop();
          redoStack.push(makeEntry(current));
          trim(redoStack);
          revision += 1;
          return clone(target.snapshot);
        }

        function redo(current) {
          if (!current || redoStack.length === 0) return null;
          const target = redoStack.pop();
          undoStack.push(makeEntry(current));
          trim(undoStack);
          revision += 1;
          return clone(target.snapshot);
        }

        function rollbackUndo(current, target) {
          if (!current || !target || redoStack.length === 0) return false;
          const expectedCurrent = redoStack[redoStack.length - 1];
          if (!sameDocumentAndEntry(current, expectedCurrent)) return false;
          redoStack.pop();
          undoStack.push(makeEntry(target));
          trim(undoStack);
          revision += 1;
          return true;
        }

        function rollbackRedo(current, target) {
          if (!current || !target || undoStack.length === 0) return false;
          const expectedCurrent = undoStack[undoStack.length - 1];
          if (!sameDocumentAndEntry(current, expectedCurrent)) return false;
          undoStack.pop();
          redoStack.push(makeEntry(target));
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

        function summary(stack) {
          return {
            count: stack.length,
            parts: stack.reduce((sum, entry) => sum + (entry.snapshot.blocks?.length || 0), 0),
            entities: stack.reduce((sum, entry) => sum + entry.entities, 0),
            bytes: stack.reduce((sum, entry) => sum + entry.bytes, 0)
          };
        }

        function inspect() {
          const undo = summary(undoStack);
          const redo = summary(redoStack);
          return Object.freeze({
            revision,
            undoCount: undo.count,
            redoCount: redo.count,
            undoParts: undo.parts,
            redoParts: redo.parts,
            undoEntities: undo.entities,
            redoEntities: redo.entities,
            undoBytes: undo.bytes,
            redoBytes: redo.bytes,
            maxSnapshots,
            maxStoredParts,
            maxStoredBytes
          });
        }

        const api = { commit, undo, redo, rollbackUndo, rollbackRedo, clear, inspect };
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
