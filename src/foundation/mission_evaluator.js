(() => {
  'use strict';

  window.VAW.define('foundation.mission-evaluator', [], () => {
    const DEFAULT_LANDING_POLICY = Object.freeze({
      requiredHoldSeconds: 1.6,
      zoneMargin: 0.25,
      maxGroundClearance: 0.30,
      contactGraceSeconds: 0.45,
      maxContactClearance: 0.55,
      maxHorizontalSpeed: 1.8,
      maxVerticalSpeed: 0.85,
      maxTotalSpeed: 2.2,
      maxTiltDegrees: 24,
      holdDecayRate: 1.75
    });

    function finite(value, fallback = 0) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    }

    function positive(value, fallback, minimum = 0) {
      return Math.max(minimum, finite(value, fallback));
    }

    function normalizeLandingPolicy(value = {}) {
      const source = value && typeof value === 'object' ? value : {};
      return Object.freeze({
        requiredHoldSeconds: positive(source.requiredHoldSeconds, DEFAULT_LANDING_POLICY.requiredHoldSeconds, 0.1),
        zoneMargin: positive(source.zoneMargin, DEFAULT_LANDING_POLICY.zoneMargin, 0),
        maxGroundClearance: positive(source.maxGroundClearance, DEFAULT_LANDING_POLICY.maxGroundClearance, 0),
        contactGraceSeconds: positive(source.contactGraceSeconds, DEFAULT_LANDING_POLICY.contactGraceSeconds, 0),
        maxContactClearance: positive(source.maxContactClearance, DEFAULT_LANDING_POLICY.maxContactClearance, 0),
        maxHorizontalSpeed: positive(source.maxHorizontalSpeed, DEFAULT_LANDING_POLICY.maxHorizontalSpeed, 0),
        maxVerticalSpeed: positive(source.maxVerticalSpeed, DEFAULT_LANDING_POLICY.maxVerticalSpeed, 0),
        maxTotalSpeed: positive(source.maxTotalSpeed, DEFAULT_LANDING_POLICY.maxTotalSpeed, 0),
        maxTiltDegrees: positive(source.maxTiltDegrees, DEFAULT_LANDING_POLICY.maxTiltDegrees, 0),
        holdDecayRate: positive(source.holdDecayRate, DEFAULT_LANDING_POLICY.holdDecayRate, 0)
      });
    }

    function normalizeVector(value = {}) {
      const source = value && typeof value === 'object' ? value : {};
      return Object.freeze({
        x: finite(source.x),
        y: finite(source.y),
        z: finite(source.z)
      });
    }

    function verticalRotationRow(quaternionValue = {}) {
      const source = quaternionValue && typeof quaternionValue === 'object' ? quaternionValue : {};
      let x = finite(source.x);
      let y = finite(source.y);
      let z = finite(source.z);
      let w = finite(source.w, 1);
      const length = Math.hypot(x, y, z, w);
      if (length <= 1e-9) { x = 0; y = 0; z = 0; w = 1; }
      else { x /= length; y /= length; z /= length; w /= length; }
      return Object.freeze({
        x: 2 * (x * y + z * w),
        y: 1 - 2 * (x * x + z * z),
        z: 2 * (y * z - x * w)
      });
    }

    function projectLocalPointY(bodyPositionValue, quaternionValue, localPointValue) {
      const bodyPosition = normalizeVector(bodyPositionValue);
      const localPoint = normalizeVector(localPointValue);
      const row = verticalRotationRow(quaternionValue);
      return bodyPosition.y + row.x * localPoint.x + row.y * localPoint.y + row.z * localPoint.z;
    }

    function boxVerticalHalfExtent(quaternionValue, halfExtentsValue = { x: 0.5, y: 0.5, z: 0.5 }) {
      const halfExtents = normalizeVector(halfExtentsValue);
      const row = verticalRotationRow(quaternionValue);
      return Math.abs(row.x) * Math.abs(halfExtents.x)
        + Math.abs(row.y) * Math.abs(halfExtents.y)
        + Math.abs(row.z) * Math.abs(halfExtents.z);
    }

    function evaluateLanding(sampleValue = {}, zoneValue = {}, policyValue = DEFAULT_LANDING_POLICY) {
      const sample = sampleValue && typeof sampleValue === 'object' ? sampleValue : {};
      const zone = zoneValue && typeof zoneValue === 'object' ? zoneValue : {};
      const policy = normalizeLandingPolicy(policyValue);
      const position = normalizeVector(sample.position);
      const velocity = normalizeVector(sample.velocity);
      const zoneX = finite(zone.x);
      const zoneZ = finite(zone.z);
      const radius = positive(zone.radius, 0, 0);
      const horizontalDistance = Math.hypot(position.x - zoneX, position.z - zoneZ);
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      const verticalSpeed = Math.abs(velocity.y);
      const totalSpeed = Math.hypot(velocity.x, velocity.y, velocity.z);
      const groundClearance = finite(sample.groundClearance, Number.POSITIVE_INFINITY);
      const contactAge = finite(sample.contactAge, Number.POSITIVE_INFINITY);
      const tiltDegrees = Math.abs(finite(sample.tiltDegrees, 180));
      const insideZone = horizontalDistance <= radius + policy.zoneMargin;
      const nearGround = groundClearance <= policy.maxGroundClearance;
      const recentContact = contactAge <= policy.contactGraceSeconds && groundClearance <= policy.maxContactClearance;
      const grounded = nearGround || recentContact;
      const horizontalSpeedOk = horizontalSpeed <= policy.maxHorizontalSpeed;
      const verticalSpeedOk = verticalSpeed <= policy.maxVerticalSpeed;
      const totalSpeedOk = totalSpeed <= policy.maxTotalSpeed;
      const tiltOk = tiltDegrees <= policy.maxTiltDegrees;
      const settled = insideZone && grounded && horizontalSpeedOk && verticalSpeedOk && totalSpeedOk && tiltOk;

      let blockingReason = 'settled';
      if (!insideZone) blockingReason = 'outside-zone';
      else if (!grounded) blockingReason = 'not-grounded';
      else if (!horizontalSpeedOk || !verticalSpeedOk || !totalSpeedOk) blockingReason = 'moving';
      else if (!tiltOk) blockingReason = 'tilted';

      return Object.freeze({
        settled,
        blockingReason,
        insideZone,
        grounded,
        nearGround,
        recentContact,
        horizontalSpeedOk,
        verticalSpeedOk,
        totalSpeedOk,
        tiltOk,
        horizontalDistance,
        horizontalSpeed,
        verticalSpeed,
        totalSpeed,
        groundClearance,
        contactAge,
        tiltDegrees,
        requiredHoldSeconds: policy.requiredHoldSeconds
      });
    }


    function evaluateLandingZones(sampleValue = {}, zonesValue = [], policyValue = DEFAULT_LANDING_POLICY) {
      const zones = Array.isArray(zonesValue) ? zonesValue.filter(zone => zone && typeof zone === 'object') : [];
      if (!zones.length) return Object.freeze({ settled: false, assessment: null, zone: null, zoneIndex: -1, assessments: Object.freeze([]) });
      const assessments = zones.map(zone => evaluateLanding(sampleValue, zone, policyValue));
      let zoneIndex = assessments.findIndex(assessment => assessment.settled);
      if (zoneIndex < 0) {
        zoneIndex = assessments.reduce((bestIndex, assessment, index) => (
          bestIndex < 0 || assessment.horizontalDistance < assessments[bestIndex].horizontalDistance ? index : bestIndex
        ), -1);
      }
      return Object.freeze({
        settled: zoneIndex >= 0 && assessments[zoneIndex].settled,
        assessment: zoneIndex >= 0 ? assessments[zoneIndex] : null,
        zone: zoneIndex >= 0 ? zones[zoneIndex] : null,
        zoneIndex,
        assessments: Object.freeze(assessments)
      });
    }

    function advanceHold(currentValue, dtValue, settled, policyValue = DEFAULT_LANDING_POLICY) {
      const policy = normalizeLandingPolicy(policyValue);
      const current = Math.max(0, finite(currentValue));
      const dt = Math.max(0, finite(dtValue));
      if (settled) return Math.min(policy.requiredHoldSeconds, current + dt);
      return Math.max(0, current - dt * policy.holdDecayRate);
    }

    return Object.freeze({
      DEFAULT_LANDING_POLICY,
      normalizeLandingPolicy,
      verticalRotationRow,
      projectLocalPointY,
      boxVerticalHalfExtent,
      evaluateLanding,
      evaluateLandingZones,
      advanceHold
    });
  });
})();
