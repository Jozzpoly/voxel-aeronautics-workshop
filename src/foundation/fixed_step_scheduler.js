(() => {
  'use strict';

  window.VAW.define('foundation.fixed-step-scheduler', [], () => {
    function positiveFinite(value, label) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) throw new TypeError(`${label} must be a positive finite number.`);
      return numeric;
    }

    function positiveInteger(value, label) {
      const numeric = Number(value);
      if (!Number.isInteger(numeric) || numeric <= 0) throw new TypeError(`${label} must be a positive integer.`);
      return numeric;
    }

    function create({ fixedDt, maxSubSteps, maxFrameDelta = Infinity } = {}) {
      const stepSeconds = positiveFinite(fixedDt, 'fixedDt');
      const stepLimit = positiveInteger(maxSubSteps, 'maxSubSteps');
      const frameLimit = maxFrameDelta === Infinity ? Infinity : positiveFinite(maxFrameDelta, 'maxFrameDelta');
      const capacity = stepSeconds * stepLimit;
      let accumulator = 0;
      let totalFrames = 0;
      let totalSteps = 0;
      let overloadFrames = 0;
      let droppedSeconds = 0;
      let frameClampDroppedSeconds = 0;
      let capacityDroppedSeconds = 0;
      let maxObservedFrameDelta = 0;

      function snapshot() {
        return Object.freeze({
          fixedDt: stepSeconds,
          maxSubSteps: stepLimit,
          maxFrameDelta: frameLimit,
          accumulator,
          totalFrames,
          totalSteps,
          overloadFrames,
          droppedSeconds,
          frameClampDroppedSeconds,
          capacityDroppedSeconds,
          maxObservedFrameDelta
        });
      }

      function advance(rawDelta, step, { paused = false } = {}) {
        if (typeof step !== 'function') throw new TypeError('Fixed-step scheduler requires a step callback.');
        const delta = Number(rawDelta);
        if (!Number.isFinite(delta) || delta < 0) throw new TypeError('Frame delta must be a non-negative finite number.');
        totalFrames += 1;
        maxObservedFrameDelta = Math.max(maxObservedFrameDelta, delta);
        if (paused || delta === 0) return Object.freeze({ steps: 0, droppedSeconds: 0, accumulator, overloaded: false });

        const accepted = Math.min(delta, frameLimit);
        const frameDrop = delta - accepted;
        let nextAccumulator = accumulator + accepted;
        const capacityDrop = Math.max(0, nextAccumulator - capacity);
        if (capacityDrop > 0) nextAccumulator = capacity;
        const droppedThisFrame = frameDrop + capacityDrop;
        if (droppedThisFrame > 0) {
          overloadFrames += 1;
          droppedSeconds += droppedThisFrame;
          frameClampDroppedSeconds += frameDrop;
          capacityDroppedSeconds += capacityDrop;
        }
        accumulator = nextAccumulator;

        let steps = 0;
        while (accumulator + Number.EPSILON >= stepSeconds && steps < stepLimit) {
          step(stepSeconds, steps);
          accumulator = Math.max(0, accumulator - stepSeconds);
          steps += 1;
          totalSteps += 1;
        }
        return Object.freeze({
          steps,
          droppedSeconds: droppedThisFrame,
          accumulator,
          overloaded: droppedThisFrame > 0
        });
      }

      function reset({ resetMetrics = false } = {}) {
        accumulator = 0;
        if (resetMetrics) {
          totalFrames = 0;
          totalSteps = 0;
          overloadFrames = 0;
          droppedSeconds = 0;
          frameClampDroppedSeconds = 0;
          capacityDroppedSeconds = 0;
          maxObservedFrameDelta = 0;
        }
        return snapshot();
      }

      return Object.freeze({ advance, reset, snapshot });
    }

    return Object.freeze({ create });
  });
})();
