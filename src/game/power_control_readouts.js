(() => {
  'use strict';

  window.VAW.define('game.power-control-readouts', [], () => {
    function create(options = {}) {
      const {
        state,
        document,
        THREE,
        InputProfile,
        Aerostatics,
        aerostaticPolicy,
        getPrimaryFlightBodyId = () => null,
        currentAerostaticAltitude = () => 0,
        computeCraftAnalysis,
        runtimePartHealthFraction = () => 1
      } = options;
      if (!state?.flight || !state?.input || !document?.getElementById || !THREE?.MathUtils) {
        throw new TypeError('Power control readouts require state, document and THREE.');
      }
      if (!InputProfile?.normalize || !InputProfile?.formatCode || !Aerostatics?.availableLift) {
        throw new TypeError('Power control readouts require InputProfile and Aerostatics.');
      }
      if (typeof computeCraftAnalysis !== 'function') {
        throw new TypeError('Power control readouts require computeCraftAnalysis().');
      }

      const policy = aerostaticPolicy || Aerostatics.DEFAULT_POLICY;

      function verticalSupportSample() {
        const flight = state.mode === 'FLIGHT' && getPrimaryFlightBodyId();
        const altitude = flight ? currentAerostaticAltitude() : 0;
        let weight = 0;
        let maxSeaLevelLift = 0;
        let maxPassiveLift = 0;
        if (flight) {
          weight = Math.max(0, state.flight.runtimeMass) * policy.gravity;
          for (const part of state.flight.functionalBlocks || []) {
            if (!part.attached) continue;
            const health = runtimePartHealthFraction(part);
            if (part.type === 'Balloon') maxSeaLevelLift += part.force * health;
            if (part.type === 'Thruster' || part.type === 'VectorThruster') {
              const axisY = Number(part.localAxis?.y ?? part.basis?.chord?.y ?? 0);
              maxPassiveLift += Math.max(0, axisY) * (part.force || part.def?.force || 0) * health;
            }
          }
        } else {
          const analysis = state.flight.analysis || computeCraftAnalysis();
          weight = Math.max(0, analysis.mass) * policy.gravity;
          for (const part of analysis.snapshot.parts) {
            if (part.type === 'Balloon') maxSeaLevelLift += part.def.force || 0;
            if (part.type === 'Thruster' || part.type === 'VectorThruster') {
              maxPassiveLift += Math.max(0, Number(part.basis?.chord?.y) || 0) * (part.def.force || 0);
            }
          }
        }
        return { altitude, weight, maxSeaLevelLift, maxPassiveLift };
      }

      function balloonLiftGuidance(sample = verticalSupportSample()) {
        const passiveLift = sample.maxPassiveLift * state.thrusterPower;
        const requiredPower = Aerostatics.requiredPowerForHover({
          weight: sample.weight,
          passiveLift,
          maxSeaLevelLift: sample.maxSeaLevelLift,
          altitude: sample.altitude
        }, policy);
        const equilibriumAltitude = Aerostatics.equilibriumAltitude({
          weight: sample.weight,
          passiveLift,
          maxSeaLevelLift: sample.maxSeaLevelLift,
          power: state.balloonPower
        }, policy);
        return { ...sample, passiveLift, requiredPower, equilibriumAltitude };
      }

      function passiveThrustGuidance(sample = verticalSupportSample()) {
        const balloonLift = Aerostatics.availableLift(
          sample.maxSeaLevelLift,
          state.balloonPower,
          sample.altitude,
          policy
        );
        const requiredPower = Aerostatics.requiredSupplementalPowerForHover({
          weight: sample.weight,
          baselineLift: balloonLift,
          maxSupplementalLift: sample.maxPassiveLift
        });
        return { ...sample, balloonLift, requiredPower };
      }

      function primaryBindingLabel(action) {
        const profile = InputProfile.normalize(state.input.profile);
        return InputProfile.formatCode(profile.bindings[action]?.[0] || '');
      }

      function powerBindingHint(decreaseAction, increaseAction) {
        return `${primaryBindingLabel(decreaseAction)} / ${primaryBindingLabel(increaseAction)}`;
      }

      function syncGuidedPowerControl({ markerId, zoneId, guidanceId, requiredPower, unavailableText, neutralText, selectedText, bindingHint }) {
        const marker = document.getElementById(markerId);
        const climbZone = document.getElementById(zoneId);
        const guidance = document.getElementById(guidanceId);
        if (!marker || !climbZone || !guidance) return;
        const finiteRequired = Number.isFinite(requiredPower);
        const reachable = finiteRequired && requiredPower <= 1;
        const markerPercent = finiteRequired ? THREE.MathUtils.clamp(requiredPower * 100, 0, 100) : 100;
        marker.style.left = `${markerPercent}%`;
        marker.classList.toggle('unreachable', !reachable);
        climbZone.style.left = `${markerPercent}%`;
        climbZone.style.width = `${Math.max(0, 100 - markerPercent)}%`;
        climbZone.classList.toggle('unreachable', !reachable);
        const thresholdText = !finiteRequired
          ? unavailableText
          : (requiredPower > 1 ? `${Math.round(requiredPower * 100)}% required \u2022 unavailable` : neutralText);
        guidance.innerHTML = `<span>${thresholdText}</span><span>${bindingHint} \u2022 ${selectedText}</span>`;
        marker.title = thresholdText;
        climbZone.title = reachable ? 'Settings above this marker produce upward acceleration at the current altitude.' : thresholdText;
      }

      function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      }

      function syncPowerControlReadouts() {
        setText('ui-thruster-power', `${Math.round(state.thrusterPower * 100)}%`);
        setText('ui-balloon-power', `${Math.round(state.balloonPower * 100)}%`);
        setText('ui-stability', `${Math.round(state.stabilityAssist * 100)}%`);

        const sample = verticalSupportSample();
        const selectedSupport = sample.maxPassiveLift * state.thrusterPower + Aerostatics.availableLift(sample.maxSeaLevelLift, state.balloonPower, sample.altitude, policy);
        const supportRatio = sample.weight > 1e-6 ? selectedSupport / sample.weight : 0;
        setText('ui-vertical-support', sample.weight > 1e-6 ? `${supportRatio.toFixed(2)}\u00d7 weight` : '\u2014');
        const hasCraft = sample.weight > 1e-6;
        const hasPassiveLift = sample.maxPassiveLift > 1e-6;
        const thrusterInfo = passiveThrustGuidance(sample);
        const thrusterRequired = hasCraft && hasPassiveLift ? thrusterInfo.requiredPower : Number.POSITIVE_INFINITY;
        const thrusterDelta = Number.isFinite(thrusterRequired) ? state.thrusterPower - thrusterRequired : -1;
        const thrusterSelected = !hasCraft
          ? 'waiting for craft'
          : (!hasPassiveLift
            ? 'no upward thrusters'
            : (thrusterDelta > 0.015 ? 'selected: climb' : (thrusterDelta < -0.015 ? 'selected: descend' : 'selected: near hover')));
        const thrusterNeutral = thrusterRequired <= 0
          ? 'Balloons already cover hover \u2022 passive thrust optional'
          : `Hover \u2248 ${Math.round(thrusterRequired * 100)}% \u2022 climb above marker`;
        syncGuidedPowerControl({
          markerId: 'ui-thruster-hover-marker',
          zoneId: 'ui-thruster-climb-zone',
          guidanceId: 'ui-thruster-guidance',
          requiredPower: thrusterRequired,
          unavailableText: !hasCraft ? 'Build a craft to calculate hover' : 'No upward passive thrusters installed',
          neutralText: thrusterNeutral,
          selectedText: thrusterSelected,
          bindingHint: powerBindingHint('thrusterPower-', 'thrusterPower+')
        });

        const hasBalloonLift = sample.maxSeaLevelLift > 1e-6;
        const balloonInfo = balloonLiftGuidance(sample);
        const balloonRequired = hasCraft && hasBalloonLift ? balloonInfo.requiredPower : Number.POSITIVE_INFINITY;
        const balloonNeutral = `Hover \u2248 ${Math.round(balloonRequired * 100)}% at launch level \u2022 lift falls with altitude`;
        let balloonSelected = 'selected: below hover';
        if (balloonInfo.equilibriumAltitude === Number.POSITIVE_INFINITY) balloonSelected = 'selected: continuous climb';
        else if (Number.isFinite(balloonInfo.equilibriumAltitude)) balloonSelected = `equilibrium \u2248 ${balloonInfo.equilibriumAltitude.toFixed(0)} m`;
        syncGuidedPowerControl({
          markerId: 'ui-balloon-hover-marker',
          zoneId: 'ui-balloon-climb-zone',
          guidanceId: 'ui-balloon-guidance',
          requiredPower: balloonRequired,
          unavailableText: !hasCraft ? 'Build a craft to calculate hover' : 'No balloons installed',
          neutralText: balloonNeutral,
          selectedText: balloonSelected,
          bindingHint: powerBindingHint('balloonPower-', 'balloonPower+')
        });
      }

      return Object.freeze({
        syncPowerControlReadouts,
        verticalSupportSample,
        balloonLiftGuidance,
        passiveThrustGuidance,
        powerBindingHint
      });
    }

    return Object.freeze({ create });
  });
})();
