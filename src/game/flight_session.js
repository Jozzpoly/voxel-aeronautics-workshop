(() => {
  'use strict';

  window.VAW.define('game.flight-session', [], () => {
    function create({ state, RuntimeAssembly, AssemblyBuilder, Physics, world }) {
      function primaryBody() {
        return state.flight.primaryBody || state.flight.assembly?.rootBody || state.flight.assemblyRuntime?.rootBody || state.flight.body || null;
      }
      function setRuntime(runtime, plan) {
        state.flight.assembly = runtime;
        state.flight.assemblyRuntime = runtime;
        state.flight.assemblyPlan = plan;
        state.flight.primaryBody = runtime?.rootBody || null;
        state.flight.body = state.flight.primaryBody;
        state.flight.bodies = runtime ? [...runtime.bodyById.values()].map(entry => entry.body) : [];
        state.flight.bodyById = runtime ? new Map([...runtime.bodyById].map(([id, entry]) => [id, entry.body])) : new Map();
      }
      function build({ snapshot, bodyDescriptor, collisionListener }) {
        const plan = RuntimeAssembly.createPlan(snapshot);
        const runtime = AssemblyBuilder.build({ plan, physics: Physics, world, bodyDescriptor, collisionListener });
        setRuntime(runtime, plan);
        return { plan, runtime, primaryBody: primaryBody() };
      }
      function cleanup() {
        const runtime = state.flight.assembly || state.flight.assemblyRuntime;
        if (runtime && typeof runtime.dispose === 'function') runtime.dispose();
        setRuntime(null, null);
      }
      function ownsBody(body) {
        if (!body) return false;
        return [...(state.flight.bodyById?.values?.() || [])].includes(body);
      }
      return Object.freeze({ build, cleanup, primaryBody, ownsBody });
    }
    return Object.freeze({ create });
  });
})();
