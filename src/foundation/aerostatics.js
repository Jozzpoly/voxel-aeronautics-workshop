(() => {
  'use strict';

  window.VAW.define('foundation.aerostatics', [], () => {
    const DEFAULT_POLICY = Object.freeze({
      scaleHeight: 72,
      minimumEfficiency: 0.06,
      gravity: 9.81,
      verticalDampingRate: 0.52,
      maxDampingWeightRatio: 0.10,
      minimumDampingActivation: 0.08
    });

    function finite(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    }

    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    function normalizePolicy(value = {}) {
      const source = value && typeof value === 'object' ? value : {};
      return Object.freeze({
        scaleHeight: Math.max(1, finite(source.scaleHeight, DEFAULT_POLICY.scaleHeight)),
        minimumEfficiency: clamp(finite(source.minimumEfficiency, DEFAULT_POLICY.minimumEfficiency), 0, 1),
        gravity: Math.max(0.01, finite(source.gravity, DEFAULT_POLICY.gravity)),
        verticalDampingRate: clamp(finite(source.verticalDampingRate, DEFAULT_POLICY.verticalDampingRate), 0, 4),
        maxDampingWeightRatio: clamp(finite(source.maxDampingWeightRatio, DEFAULT_POLICY.maxDampingWeightRatio), 0, 1),
        minimumDampingActivation: clamp(finite(source.minimumDampingActivation, DEFAULT_POLICY.minimumDampingActivation), 0, 1)
      });
    }

    function liftEfficiencyAtAltitude(altitudeValue, policyValue = DEFAULT_POLICY) {
      const policy = normalizePolicy(policyValue);
      const altitude = Math.max(0, finite(altitudeValue));
      return Math.max(policy.minimumEfficiency, Math.exp(-altitude / policy.scaleHeight));
    }

    function availableLift(maxSeaLevelLiftValue, powerValue, altitudeValue, policyValue = DEFAULT_POLICY) {
      const maxSeaLevelLift = Math.max(0, finite(maxSeaLevelLiftValue));
      const power = clamp(finite(powerValue), 0, 1);
      return maxSeaLevelLift * power * liftEfficiencyAtAltitude(altitudeValue, policyValue);
    }

    function requiredPowerForHover(sampleValue = {}, policyValue = DEFAULT_POLICY) {
      const sample = sampleValue && typeof sampleValue === 'object' ? sampleValue : {};
      const policy = normalizePolicy(policyValue);
      const weight = Math.max(0, finite(sample.weight, Math.max(0, finite(sample.mass)) * policy.gravity));
      const passiveLift = Math.max(0, finite(sample.passiveLift));
      const maxSeaLevelLift = Math.max(0, finite(sample.maxSeaLevelLift));
      const efficiency = liftEfficiencyAtAltitude(sample.altitude, policy);
      const liftNeeded = Math.max(0, weight - passiveLift);
      if (liftNeeded <= 1e-9) return 0;
      if (maxSeaLevelLift <= 1e-9 || efficiency <= 1e-9) return Number.POSITIVE_INFINITY;
      return liftNeeded / (maxSeaLevelLift * efficiency);
    }

    function equilibriumAltitude(sampleValue = {}, policyValue = DEFAULT_POLICY) {
      const sample = sampleValue && typeof sampleValue === 'object' ? sampleValue : {};
      const policy = normalizePolicy(policyValue);
      const weight = Math.max(0, finite(sample.weight, Math.max(0, finite(sample.mass)) * policy.gravity));
      const passiveLift = Math.max(0, finite(sample.passiveLift));
      const maxSeaLevelLift = Math.max(0, finite(sample.maxSeaLevelLift));
      const power = clamp(finite(sample.power), 0, 1);
      const liftNeeded = weight - passiveLift;
      if (liftNeeded <= 1e-9) return Number.POSITIVE_INFINITY;
      const seaLevelCommandLift = maxSeaLevelLift * power;
      if (seaLevelCommandLift + 1e-9 < liftNeeded) return null;
      if (Math.abs(seaLevelCommandLift - liftNeeded) <= 1e-9) return 0;
      const minimumLift = seaLevelCommandLift * policy.minimumEfficiency;
      if (minimumLift > liftNeeded + 1e-9) return Number.POSITIVE_INFINITY;
      const rawAltitude = policy.scaleHeight * Math.log(seaLevelCommandLift / liftNeeded);
      return Math.max(0, rawAltitude);
    }


    function verticalDampingForce(sampleValue = {}, policyValue = DEFAULT_POLICY) {
      const sample = sampleValue && typeof sampleValue === 'object' ? sampleValue : {};
      const policy = normalizePolicy(policyValue);
      const mass = Math.max(0, finite(sample.mass));
      const verticalSpeed = finite(sample.verticalSpeed);
      const weight = Math.max(0, finite(sample.weight, mass * policy.gravity));
      const commandedLift = Math.max(0, finite(sample.commandedLift));
      if (mass <= 1e-9 || weight <= 1e-9 || Math.abs(verticalSpeed) <= 1e-9) return 0;

      // Balloon envelopes add mild vertical drag. The effect scales with how much
      // aerostatic lift is actually active, remains capped to a small fraction of
      // weight, and therefore damps oscillation without becoming altitude hold.
      const activation = clamp(commandedLift / weight, 0, 1);
      if (activation < policy.minimumDampingActivation) return 0;
      const rawForce = -verticalSpeed * mass * policy.verticalDampingRate * activation;
      const maximumForce = weight * policy.maxDampingWeightRatio * activation;
      return clamp(rawForce, -maximumForce, maximumForce);
    }

    return Object.freeze({
      DEFAULT_POLICY,
      normalizePolicy,
      liftEfficiencyAtAltitude,
      availableLift,
      requiredPowerForHover,
      equilibriumAltitude,
      verticalDampingForce
    });
  });
})();
