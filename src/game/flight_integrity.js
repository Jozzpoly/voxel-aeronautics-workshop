(() => {
  'use strict';

  window.VAW.define('game.flight-integrity', [], () => {
    function create({ state }) {
      function bodyForPart(part) {
        if (!part) return state.flight.primaryBody || state.flight.body || null;
        if (part.bodyId && state.flight.bodyById?.has(part.bodyId)) return state.flight.bodyById.get(part.bodyId);
        const runtimePart = part.blockId ? state.flight.assemblyRuntime?.partByBlockId?.get(part.blockId) : null;
        return runtimePart?.body || state.flight.primaryBody || state.flight.body || null;
      }
      function colliderForBlock(blockId) {
        return blockId ? state.flight.assemblyRuntime?.colliderByBlockId?.get(blockId) || null : null;
      }
      function markRemoved(blockId) {
        if (!blockId) return false;
        state.flight.runtimePartById?.delete(blockId);
        return state.flight.assemblyRuntime?.removeColliderByBlockId?.(blockId) === true;
      }
      return Object.freeze({ bodyForPart, colliderForBlock, markRemoved });
    }
    return Object.freeze({ create });
  });
})();
