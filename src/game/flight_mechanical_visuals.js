(() => {
  'use strict';

  window.VAW.define('game.flight-mechanical-visuals', [], () => {
    function vectorFromArray(value, label) {
      if (!Array.isArray(value) || value.length < 3 || value.slice(0, 3).some(component => !Number.isFinite(Number(component)))) {
        throw new TypeError(`${label} must be a finite local pivot vector.`);
      }
      return Object.freeze({ x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) });
    }

    function create({ flightSession, createVisual, updateVisual, disposeVisual, onDiagnostic = null }) {
      if (!flightSession?.getPlan || !flightSession?.hasBody || !flightSession?.pointToWorldFrame ||
          !flightSession?.getConstraintState || !flightSession?.registerTransient) {
        throw new TypeError('FlightMechanicalVisuals requires explicit FlightSession plan, body, constraint, frame, and lifecycle APIs.');
      }
      if (typeof createVisual !== 'function' || typeof updateVisual !== 'function' || typeof disposeVisual !== 'function') {
        throw new TypeError('FlightMechanicalVisuals requires create/update/dispose visual adapters.');
      }

      const entries = new Map();
      let releaseTransient = null;
      let active = false;

      function diagnostic(code, details = {}) {
        if (typeof onDiagnostic === 'function') onDiagnostic(Object.freeze({ code, ...details }));
      }

      function disposeEntry(entry, reason = 'cleanup') {
        if (!entry || entry.disposed) return false;
        entry.disposed = true;
        try {
          disposeVisual(entry.visual, entry.constraint, reason);
        } finally {
          entries.delete(entry.constraint.constraintId);
        }
        return true;
      }

      function disposeAll(reason = 'cleanup') {
        const errors = [];
        for (const entry of [...entries.values()].reverse()) {
          try { disposeEntry(entry, reason); }
          catch (error) { errors.push(error); }
        }
        entries.clear();
        active = false;
        releaseTransient = null;
        if (errors.length) {
          const failure = typeof AggregateError === 'function'
            ? new AggregateError(errors, 'Flight mechanical visual cleanup failed.')
            : Object.assign(new Error('Flight mechanical visual cleanup failed.'), { errors });
          throw failure;
        }
        return true;
      }

      function start() {
        if (active || entries.size || releaseTransient) throw new Error('Flight mechanical visuals are already active.');
        const plan = flightSession.getPlan();
        if (!plan || !Array.isArray(plan.constraints)) throw new Error('Flight mechanical visuals require an active assembly plan.');
        active = true;
        try {
          for (const source of plan.constraints) {
            if (source.kind !== 'hinge') continue;
            const constraint = Object.freeze({
              constraintId: String(source.constraintId),
              mechanicalLinkId: String(source.mechanicalLinkId || source.constraintId),
              kind: source.kind,
              bodyAId: String(source.bodyAId || ''),
              bodyBId: String(source.bodyBId || ''),
              pivotA: vectorFromArray(source.pivotA, `Constraint ${source.constraintId} pivotA`),
              pivotB: vectorFromArray(source.pivotB, `Constraint ${source.constraintId} pivotB`)
            });
            if (!constraint.bodyAId || !constraint.bodyBId) throw new Error(`Constraint ${constraint.constraintId} has missing body ownership.`);
            if (!flightSession.hasBody(constraint.bodyAId) || !flightSession.hasBody(constraint.bodyBId)) {
              throw new Error(`Constraint ${constraint.constraintId} references a missing runtime body.`);
            }
            const visual = createVisual(constraint);
            if (!visual) throw new Error(`Visual adapter returned no visual for ${constraint.constraintId}.`);
            entries.set(constraint.constraintId, { constraint, visual, disposed: false });
          }
          releaseTransient = flightSession.registerTransient(() => disposeAll('flight-session-stop'), 'runtime mechanical visuals');
          sync();
          return entries.size;
        } catch (error) {
          try { disposeAll('start-rollback'); }
          catch (cleanupError) { Object.defineProperty(error, 'cleanupError', { value: cleanupError, enumerable: true }); }
          throw error;
        }
      }

      function removeInactive(entry, reason) {
        try { disposeEntry(entry, reason); }
        catch (error) { diagnostic('mechanical-visual-dispose-failed', { constraintId: entry.constraint.constraintId, error }); }
      }

      function sync() {
        if (!active) return 0;
        let updated = 0;
        for (const entry of [...entries.values()]) {
          const { constraint } = entry;
          if (!flightSession.hasBody(constraint.bodyAId) || !flightSession.hasBody(constraint.bodyBId)) {
            diagnostic('mechanical-visual-body-missing', { constraintId: constraint.constraintId });
            removeInactive(entry, 'body-missing');
            continue;
          }
          try { flightSession.getConstraintState(constraint.constraintId); }
          catch (error) {
            diagnostic('mechanical-visual-constraint-inactive', { constraintId: constraint.constraintId, error });
            removeInactive(entry, 'constraint-inactive');
            continue;
          }
          const endpointA = flightSession.pointToWorldFrame(constraint.bodyAId, constraint.pivotA);
          const endpointB = flightSession.pointToWorldFrame(constraint.bodyBId, constraint.pivotB);
          updateVisual(entry.visual, Object.freeze({ constraint, endpointA, endpointB }));
          updated += 1;
        }
        return updated;
      }

      function stop() {
        if (releaseTransient) {
          const release = releaseTransient;
          releaseTransient = null;
          return release();
        }
        if (!active && !entries.size) return false;
        return disposeAll('manual-stop');
      }

      return Object.freeze({ start, sync, stop, cleanup: stop, get size() { return entries.size; }, get active() { return active; } });
    }

    return Object.freeze({ create });
  });
})();
