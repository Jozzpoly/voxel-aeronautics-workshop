'use strict';

    const FOUNDATION = window.VAW_RUNTIME;
    if (!FOUNDATION) throw new Error('Foundation runtime was not initialized before game.js.');

    const SceneEnvironment = window.VAW.require('game.scene-environment');
    const CareerService = window.VAW.require('game.career-service');
    const WorkspaceController = window.VAW.require('game.workspace-controller');
    const InputSettingsController = window.VAW.require('game.input-settings-controller');
    const OrientationService = window.VAW.require('game.orientation-service');
    const ModuleVisualFactory = window.VAW.require('game.module-visual-factory');
    const EngineeringAnalysis = window.VAW.require('game.engineering-analysis');
    const BlueprintController = window.VAW.require('game.blueprint-controller');
    const MissionController = window.VAW.require('game.mission-controller');
    const FlightSession = window.VAW.require('game.flight-session');
    const FlightIntegrity = window.VAW.require('game.flight-integrity');

    const { Config, Catalog, Orientation, Blueprint, ControlFrame, MassProperties, CraftCompiler, RuntimeAssembly, AssemblyBuilder, InputProfile, UIWorkspace, MissionEvaluator, Aerostatics, FlightControl, State, Physics } = FOUNDATION;
    const {
      GRID, SAVE_VERSION, SAVE_KEY, LEGACY_SAVE_KEYS,
      CAREER_SAVE_KEY, CAREER_SAVE_VERSION, UI_SAVE_VERSION, UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS,
      NEIGHBOR_DIRECTIONS, COLLISION_GROUP, TEST_RANGE, MISSION, AEROSTATICS,
      MISSION_PAYLOAD_POSITION, PHYSICS, AXIS_LABELS,
      SYMMETRY_MODES, CONTROL_AXES, CONTROL_SIGNS
    } = Config;
    const { BLOCKS, CONTRACTS } = Catalog;
    const LANDING_POLICY = MissionEvaluator.normalizeLandingPolicy(MISSION.landing);
    const AEROSTATIC_POLICY = Aerostatics.normalizePolicy(AEROSTATICS);
    const {
      AXES, ORIENTATION_BASES, DEFAULT_ORIENTATION,
      LEGACY_ORIENTATION_MAP, axisLabelForVector, findOrientationId
    } = Orientation;
    const STATE = State.createInitialState();
    const CRAFT = STATE.craft;
    const WORKSHOP = STATE.workshop;

    const container = document.getElementById('canvas-container');
    const environment = SceneEnvironment.create({
      THREE, Physics, container, GRID, AEROSTATIC_POLICY, COLLISION_GROUP, TEST_RANGE, BLOCKS
    });
    const {
      scene, camera, renderer, gridHelper, basePlane,
      comSphere, thrustSphere, liftSphere, thrustVectorArrow, liftVectorArrow,
      ghost, symmetryGhosts, ghostArrow, ghostNormalArrow, axesHelper, stars,
      world, groundBody, testRangeGroup, missionMarkerGroup, rangeStaticBodies,
      sharedGeometry, materials, cloneMaterial
    } = environment;

    function makeKey(x, y, z) { return Blueprint.makeKey(x, y, z); }
    function snapInt(v) { return Math.round(v); }
    function isOverUI(target) { return !!(target && target.closest && (target.closest('#ui-layer') || target.closest('#help-modal') || target.closest('#debrief-modal'))); }


    const careerService = CareerService.create({ state: STATE, storage: localStorage });
    const {
      getContractById, isContractUnlocked, getSelectedContract, knownContractIds,
      normalizeCareerData, careerRank, recalculateCareerStars, loadCareer, saveCareer
    } = careerService;

    const workspaceController = WorkspaceController.create({
      state: STATE, document, window, storage: localStorage, showStatus
    });
    const {
      readFirstStoredJSON, loadUIPreferences, saveUIPreferences, scheduleWorkspaceSave, flushPendingSave,
      panelElement, panelAvailableInCurrentMode, panelVisibleInCurrentMode, workspaceTopInset,
      applyWorkspaceLayout, focusWorkspacePanel, updateWorkspacePanel, setWorkspacePanelOpen,
      syncContractPanelVisibility, setContractPanelCollapsed, toggleContractPanel,
      closeTopmostWorkspacePanel, resetWorkspaceLayout, bindWorkspacePanels
    } = workspaceController;

    const inputSettingsController = InputSettingsController.create({
      state: STATE, craft: CRAFT, document, navigator, showStatus,
      recomputePilotAxes, clearControlActions, saveUIPreferences, syncPowerControlReadouts
    });
    const {
      axisLabelFromArray, syncControlFrameReadout, flightFocusSupported, syncFlightFocusStatus,
      refreshKeyboardLock, toggleFlightFocus, renderBindingControls, syncInputProfileUI,
      updateInputAxis, commitBindingCapture, handleFullscreenChange, bindInputProfileControls
    } = inputSettingsController;

    function recomputePilotAxes() {
      const intent = FlightControl.pilotFromActions(STATE.input.controlActions, STATE.input.profile);
      Object.assign(STATE.controlIntent, intent);
      const compiled = STATE.flight.compiled || CraftCompiler.compile(CRAFT);
      const bodyPilot = FlightControl.pilotToBodyFrame(intent, compiled.controlFrame);
      STATE.pilot.pitch = bodyPilot.pitch;
      STATE.pilot.yaw = bodyPilot.yaw;
      STATE.pilot.roll = bodyPilot.roll;
      STATE.pilot.surge = bodyPilot.surge;
      STATE.pilot.sway = bodyPilot.sway;
      STATE.pilot.lift = bodyPilot.lift;
      updateFlightFeedback();
    }

    function setControlAction(action, active) {
      if (active) STATE.input.controlActions.add(action);
      else STATE.input.controlActions.delete(action);
      recomputePilotAxes();
    }

    function clearControlActions() {
      STATE.input.controlActions.clear();
      STATE.pilot.pitch = 0;
      STATE.pilot.yaw = 0;
      STATE.pilot.roll = 0;
      STATE.pilot.surge = 0;
      STATE.pilot.lift = 0;
      STATE.pilot.sway = 0;
      for (const axis of InputProfile.AXES) STATE.controlIntent[axis] = 0;
      document.querySelectorAll('.hold-btn.active').forEach(button => button.classList.remove('active'));
      updateFlightFeedback();
    }

    function staticPassiveThrusterLift(parts, power) {
      let lift = 0;
      for (const part of parts || []) {
        if (!part || !part.attached || (part.type !== 'Thruster' && part.type !== 'VectorThruster')) continue;
        const axisY = Number(part.localAxis?.y ?? part.basis?.chord?.y ?? 0);
        lift += Math.max(0, axisY) * (part.force || part.def?.force || 0) * THREE.MathUtils.clamp(power, 0, 1) * runtimePartHealthFraction(part);
      }
      return lift;
    }

    function primaryFlightBody() {
      return STATE.flight.primaryBody || STATE.flight.assemblyRuntime?.rootBody || STATE.flight.body || null;
    }

    function runtimeBodyForPart(part) {
      if (!part) return primaryFlightBody();
      if (part.bodyId && STATE.flight.bodyById?.has(part.bodyId)) return STATE.flight.bodyById.get(part.bodyId);
      const runtimePart = part.blockId ? STATE.flight.assemblyRuntime?.partByBlockId?.get(part.blockId) : null;
      return runtimePart?.body || primaryFlightBody();
    }

    function currentAerostaticAltitude() {
      const body = primaryFlightBody();
      return body ? Math.max(0, body.position.y - TEST_RANGE.groundY) : 0;
    }

    function verticalSupportSample() {
      const flight = STATE.mode === 'FLIGHT' && primaryFlightBody();
      const altitude = flight ? currentAerostaticAltitude() : 0;
      let weight = 0;
      let maxSeaLevelLift = 0;
      let maxPassiveLift = 0;
      if (flight) {
        weight = Math.max(0, STATE.flight.runtimeMass) * AEROSTATIC_POLICY.gravity;
        for (const part of STATE.flight.functionalBlocks) {
          if (!part.attached) continue;
          const health = runtimePartHealthFraction(part);
          if (part.type === 'Balloon') maxSeaLevelLift += part.force * health;
          if (part.type === 'Thruster' || part.type === 'VectorThruster') {
            const axisY = Number(part.localAxis?.y ?? part.basis?.chord?.y ?? 0);
            maxPassiveLift += Math.max(0, axisY) * (part.force || part.def?.force || 0) * health;
          }
        }
      } else {
        const analysis = STATE.flight.analysis || computeCraftAnalysis();
        weight = Math.max(0, analysis.mass) * AEROSTATIC_POLICY.gravity;
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
      const passiveLift = sample.maxPassiveLift * STATE.thrusterPower;
      const requiredPower = Aerostatics.requiredPowerForHover({
        weight: sample.weight,
        passiveLift,
        maxSeaLevelLift: sample.maxSeaLevelLift,
        altitude: sample.altitude
      }, AEROSTATIC_POLICY);
      const equilibriumAltitude = Aerostatics.equilibriumAltitude({
        weight: sample.weight,
        passiveLift,
        maxSeaLevelLift: sample.maxSeaLevelLift,
        power: STATE.balloonPower
      }, AEROSTATIC_POLICY);
      return { ...sample, passiveLift, requiredPower, equilibriumAltitude };
    }

    function passiveThrustGuidance(sample = verticalSupportSample()) {
      const balloonLift = Aerostatics.availableLift(
        sample.maxSeaLevelLift,
        STATE.balloonPower,
        sample.altitude,
        AEROSTATIC_POLICY
      );
      const requiredPower = Aerostatics.requiredSupplementalPowerForHover({
        weight: sample.weight,
        baselineLift: balloonLift,
        maxSupplementalLift: sample.maxPassiveLift
      });
      return { ...sample, balloonLift, requiredPower };
    }

    function primaryBindingLabel(action) {
      const profile = InputProfile.normalize(STATE.input.profile);
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
        : (requiredPower > 1 ? `${Math.round(requiredPower * 100)}% required • unavailable` : neutralText);
      guidance.innerHTML = `<span>${thresholdText}</span><span>${bindingHint} • ${selectedText}</span>`;
      marker.title = thresholdText;
      climbZone.title = reachable ? 'Settings above this marker produce upward acceleration at the current altitude.' : thresholdText;
    }

    function syncPowerControlReadouts() {
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      setText('ui-thruster-power', `${Math.round(STATE.thrusterPower * 100)}%`);
      setText('ui-balloon-power', `${Math.round(STATE.balloonPower * 100)}%`);
      setText('ui-stability', `${Math.round(STATE.stabilityAssist * 100)}%`);

      const sample = verticalSupportSample();
      const selectedSupport = sample.maxPassiveLift * STATE.thrusterPower + Aerostatics.availableLift(sample.maxSeaLevelLift, STATE.balloonPower, sample.altitude, AEROSTATIC_POLICY);
      const supportRatio = sample.weight > 1e-6 ? selectedSupport / sample.weight : 0;
      setText('ui-vertical-support', sample.weight > 1e-6 ? `${supportRatio.toFixed(2)}× weight` : '—');
      const hasCraft = sample.weight > 1e-6;
      const hasPassiveLift = sample.maxPassiveLift > 1e-6;
      const thrusterInfo = passiveThrustGuidance(sample);
      const thrusterRequired = hasCraft && hasPassiveLift ? thrusterInfo.requiredPower : Number.POSITIVE_INFINITY;
      const thrusterDelta = Number.isFinite(thrusterRequired) ? STATE.thrusterPower - thrusterRequired : -1;
      const thrusterSelected = !hasCraft
        ? 'waiting for craft'
        : (!hasPassiveLift
          ? 'no upward thrusters'
          : (thrusterDelta > 0.015 ? 'selected: climb' : (thrusterDelta < -0.015 ? 'selected: descend' : 'selected: near hover')));
      const thrusterNeutral = thrusterRequired <= 0
        ? 'Balloons already cover hover • passive thrust optional'
        : `Hover ≈ ${Math.round(thrusterRequired * 100)}% • climb above marker`;
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
      const balloonNeutral = `Hover ≈ ${Math.round(balloonRequired * 100)}% at launch level • lift falls with altitude`;
      let balloonSelected = 'selected: below hover';
      if (balloonInfo.equilibriumAltitude === Number.POSITIVE_INFINITY) balloonSelected = 'selected: continuous climb';
      else if (Number.isFinite(balloonInfo.equilibriumAltitude)) balloonSelected = `equilibrium ≈ ${balloonInfo.equilibriumAltitude.toFixed(0)} m`;
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

    function updateFlightFeedback() {
      syncPowerControlReadouts();
      const body = primaryFlightBody();
      const speed = body ? Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2 + body.velocity.z ** 2) : 0;
      const pitch = STATE.controlIntent.pitch || 0;
      const yaw = STATE.controlIntent.yaw || 0;
      const roll = STATE.controlIntent.roll || 0;
      const surge = STATE.controlIntent.surge || 0;
      const sway = STATE.controlIntent.sway || 0;
      const liftCommand = STATE.controlIntent.lift || 0;

      let tiltDegrees = 0;
      if (body) {
        const attitude = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        const worldUp = new THREE.Vector3(0, 1, 0);
        const craftUp = worldUp.clone().applyQuaternion(attitude).normalize();
        tiltDegrees = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(craftUp.dot(worldUp), -1, 1)));
      }

      const setBar = (id, value) => {
        const bar = document.getElementById(id);
        if (!bar) return;
        const normalized = THREE.MathUtils.clamp(value, -1, 1);
        const positive = normalized >= 0;
        const abs = Math.abs(normalized);
        bar.style.left = positive ? '50%' : `${50 - abs * 50}%`;
        bar.style.width = `${abs * 50}%`;
      };

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };

      setText('ui-speed', `${speed.toFixed(1)} m/s`);
      setText('ui-altitude', body ? `${currentCraftAltitude().toFixed(1)} m` : '0.0 m');
      setText('ui-vertical-speed', body ? `${body.velocity.y >= 0 ? '+' : ''}${body.velocity.y.toFixed(1)} m/s` : '0.0 m/s');
      const loads = STATE.flight.lastLoads || { lift: 0, drag: 0, thrust: 0, impact: 0 };
      setText('ui-loads', `${Math.round(loads.thrust)} / ${Math.round(loads.lift)} / ${Math.round(loads.drag)} N`);
      const payloadText = STATE.flight.payload?.attached ? ` • cargo ${Math.round(payloadHealthFraction() * 100)}%` : (STATE.flight.payload ? ' • cargo lost' : '');
      setText('ui-damage-status', STATE.mode === 'FLIGHT' ? `${STATE.flight.lostParts} lost • ${STATE.flight.leakingFuelRate.toFixed(2)}/s leak${payloadText}` : 'No active damage');
      if (body && STATE.mode === 'FLIGHT') {
        setText('ui-fuel', `${Math.max(0, Math.round(STATE.flight.fuel))} / ${Math.max(0, Math.round(STATE.flight.fuelMax))}`);
      }
      setText('ui-pitch-value', `${Math.round(pitch * 100)}%`);
      setText('ui-yaw-value', `${Math.round(yaw * 100)}%`);
      setText('ui-roll-value', `${Math.round(roll * 100)}%`);
      setText('ui-surge-value', `${Math.round(surge * 100)}%`);
      setText('ui-lift-command-value', `${Math.round(liftCommand * 100)}%`);
      setText('ui-sway-value', `${Math.round(sway * 100)}%`);
      setText('ui-pitch-readout', Math.round(pitch * 100));
      setText('ui-yaw-readout', Math.round(yaw * 100));
      setText('ui-roll-readout', Math.round(roll * 100));
      setText('ui-surge-readout', Math.round(surge * 100));
      setText('ui-lift-command-readout', Math.round(liftCommand * 100));
      setText('ui-sway-readout', Math.round(sway * 100));
      setText('ui-angle-readout', `${Math.round(tiltDegrees)}°`);

      setBar('ui-pitch-bar', pitch);
      setBar('ui-yaw-bar', yaw);
      setBar('ui-roll-bar', roll);
      setBar('ui-surge-bar', surge);
      setBar('ui-lift-command-bar', liftCommand);
      setBar('ui-sway-bar', sway);

      updateMissionHud();
    }

    function clearPilotAxes() {
      clearControlActions();
    }

    function setStabilize(enabled) {
      STATE.pilot.stabilize = !!enabled;
      updateFlightFeedback();
    }

    let statusToastToken = 0;
    function showStatus(text, duration = 1000) {
      const token = ++statusToastToken;
      const previous = STATE.statusText;
      STATE.statusText = text;
      updateHUD();
      if (duration > 0) {
        setTimeout(() => {
          if (token !== statusToastToken || STATE.statusText !== text) return;
          STATE.statusText = previous || (STATE.mode === 'BUILD' ? 'DRYDOCK' : 'IN FLIGHT');
          updateHUD();
        }, duration);
      }
    }

    function cancelStatusToast() {
      statusToastToken += 1;
    }

    function updateHUD() {
      const modeChip = document.getElementById('ui-mode');
      modeChip.textContent = STATE.mode;
      modeChip.className = STATE.mode === 'BUILD' ? 'chip text-amber-300' : 'chip text-emerald-300';

      const statusEl = document.getElementById('ui-status');
      const defaultStatus = STATE.mode === 'BUILD' ? 'DRYDOCK' : 'IN FLIGHT';
      const statusText = STATE.statusText || defaultStatus;
      statusEl.textContent = statusText;
      statusEl.className = statusText.includes('INVALID') || statusText.includes('ERROR') || statusText.includes('CRITICAL') || statusText.includes('SEVERE') || statusText.includes('OUT OF FUEL')
        ? 'font-bold text-rose-400'
        : (statusText.includes('WARNING') || statusText.includes('HARD')
          ? 'font-bold text-amber-300'
          : (STATE.mode === 'BUILD' ? 'font-bold text-yellow-500' : 'font-bold text-emerald-400'));
      const orientationRelevant = partUsesOrientation(STATE.selectedBlock);
      document.getElementById('ui-orientation').textContent = orientationRelevant ? axisLabelForVector(getOrientationVector(STATE.orientation)) : 'N/A';
      const rollRelevant = partUsesRoll(STATE.selectedBlock);
      const rollReadout = document.getElementById('ui-roll-orientation');
      if (rollReadout) rollReadout.textContent = rollRelevant ? axisLabelForVector(getOrientationUpVector(STATE.orientation)) : 'N/A';
      document.getElementById('ui-symmetry').textContent = STATE.symmetry;
      syncPowerControlReadouts();

      const buildButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-build'));
      const flightButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-flight'));
      buildButton.disabled = STATE.mode === 'BUILD';
      flightButton.disabled = STATE.mode === 'FLIGHT';
      buildButton.textContent = STATE.mission.status === 'ACTIVE' && STATE.mission.contractId !== 'sandbox' ? 'Abort Contract' : 'Return to Drydock';
      if (STATE.mode === 'BUILD') {
        const contract = getSelectedContract();
        flightButton.textContent = contract.id === 'sandbox' ? 'Launch Sandbox Test' : `Launch ${contract.title.replace(/^\d+\s*•\s*/, '')}`;
      }
      document.getElementById('btn-symmetry').textContent = `SYMMETRY: ${STATE.symmetry}`;


      const selectedForward = getOrientationVector(STATE.orientation);
      const directionButtons = document.querySelectorAll('.axis-btn');
      directionButtons.forEach(element => {
        const btn = /** @type {HTMLButtonElement} */ (element);
        const axisIndex = Number(btn.dataset.axisIndex);
        btn.classList.toggle('active', orientationRelevant && selectedForward.dot(AXES[axisIndex]) > 0.999);
        btn.disabled = !orientationRelevant;
      });
      const rollLeft = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-roll-orientation-left'));
      const rollRight = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-roll-orientation-right'));
      if (rollLeft) rollLeft.disabled = !rollRelevant;
      if (rollRight) rollRight.disabled = !rollRelevant;
      updateFlightFeedback();
    }

    function syncHudVisibility() {
      document.getElementById('ui-layer').classList.toggle('hud-collapsed', STATE.uiCollapsed);
      syncContractPanelVisibility();
      updateFlightFeedback();
    }


    function addRootMesh(mesh) {
      if (!WORKSHOP.rootMeshes.includes(mesh)) WORKSHOP.rootMeshes.push(mesh);
    }

    function removeRootMesh(mesh) {
      const idx = WORKSHOP.rootMeshes.indexOf(mesh);
      if (idx >= 0) WORKSHOP.rootMeshes.splice(idx, 1);
    }

    const orientationService = OrientationService.create({ THREE });
    const {
      normalizeOrientationId, partUsesOrientation, partUsesRoll,
      normalizeControlAxis, normalizeControlSign, controlAxisVector,
      controlSignLabel, normalizeSavedOrientation
    } = orientationService;
    const getModuleBasis = (index = STATE.orientation) => orientationService.getModuleBasis(index);
    const getOrientationVector = (index = STATE.orientation) => orientationService.getOrientationVector(index);
    const getOrientationUpVector = (index = STATE.orientation) => orientationService.getOrientationUpVector(index);
    const getOrientationLabel = (index = STATE.orientation) => orientationService.getOrientationLabel(index);
    const axisColor = orientation => orientationService.axisColor(orientation);
    const mirrorOrientation = (orientation, mirrorX, mirrorZ, type = STATE.selectedBlock) => (
      orientationService.mirrorOrientation(orientation, mirrorX, mirrorZ, type)
    );

    function cycleControlAxis() {
      if (STATE.mode !== 'BUILD') return;
      const index = CONTROL_AXES.indexOf(STATE.controlAxis);
      STATE.controlAxis = CONTROL_AXES[(index + 1) % CONTROL_AXES.length];
      updateControlConfigurationUI();
      updateGhost();
      autoSave(false);
    }

    function cycleControlSign() {
      if (STATE.mode !== 'BUILD') return;
      const index = CONTROL_SIGNS.indexOf(STATE.controlSign);
      STATE.controlSign = CONTROL_SIGNS[(index + 1) % CONTROL_SIGNS.length];
      updateControlConfigurationUI();
      updateGhost();
      autoSave(false);
    }

    function updateControlConfigurationUI() {
      const panel = document.getElementById('control-config-panel');
      if (panel) panel.hidden = STATE.selectedBlock !== 'ControlSurface';
      const axisButton = document.getElementById('btn-control-axis');
      const signButton = document.getElementById('btn-control-sign');
      if (axisButton) axisButton.textContent = `AXIS: ${STATE.controlAxis.toUpperCase()}`;
      if (signButton) signButton.textContent = `SIGN: ${controlSignLabel(STATE.controlSign)}`;
    }

    function setOrientation(index) {
      if (STATE.mode !== 'BUILD') return;
      STATE.orientation = normalizeOrientationId(index);
      updateHUD();
      updateGhost();
      autoSave(false);
    }

    function setOrientationByVector(vec) {
      let desiredForward = AXES[0];
      let desiredDot = -Infinity;
      for (const axis of AXES) {
        const dot = vec.dot(axis);
        if (dot > desiredDot) { desiredDot = dot; desiredForward = axis; }
      }
      const currentUp = getOrientationUpVector(STATE.orientation);
      let best = DEFAULT_ORIENTATION;
      let bestDot = -Infinity;
      for (let i = 0; i < ORIENTATION_BASES.length; i++) {
        const basis = ORIENTATION_BASES[i];
        if (basis.forward.dot(desiredForward) < 0.999) continue;
        const score = basis.up.dot(currentUp);
        if (score > bestDot) { bestDot = score; best = i; }
      }
      setOrientation(best);
    }

    function rotateOrientationRoll(step = 1) {
      const basis = getModuleBasis(STATE.orientation);
      const rotation = new THREE.Quaternion().setFromAxisAngle(basis.chord, step * Math.PI / 2);
      const rotatedUp = basis.normal.clone().applyQuaternion(rotation).round();
      setOrientation(findOrientationId(basis.chord, rotatedUp));
    }

    const engineeringAnalysis = EngineeringAnalysis.create({
      THREE, state: STATE, craft: CRAFT, document, aerostaticPolicy: AEROSTATIC_POLICY,
      makeKey, getModuleBasis, controlAxisVector,
      markers: { comSphere, thrustSphere, liftSphere, thrustVectorArrow, liftVectorArrow }
    });
    const {
      formatDuration, vectorComponent, computeWingCoefficients, evaluateWingAtVelocityThree,
      buildCraftSnapshot, computeMixerCommandFromTorque, controlSurfaceAutoSign,
      computeControlSurfaceTorqueThree, computeGimbalForceThree, computeAuxiliaryControlTorque,
      computeSnapshotTorqueMax, computeThrusterTorqueForPilot, missionPayloadPositionVector,
      buildLoadedSnapshot, computeControlMetrics, computeCraftAnalysis,
      setHorizontalBar, updateEngineeringAnalysisUI, updateAnalysisVisuals
    } = engineeringAnalysis;

    const moduleVisualFactory = ModuleVisualFactory.create({ THREE, sharedGeometry, cloneMaterial });
    const { createModuleVisual } = moduleVisualFactory;

    function symmetryOffsets(x, z) {
      const pairs = [];
      const add = (px, pz, mirrorX = false, mirrorZ = false) => {
        const key = `${px},${pz}`;
        if (!pairs.some(item => item.key === key)) {
          pairs.push({ key, x: px, z: pz, mirrorX, mirrorZ });
        }
      };

      add(x, z, false, false);
      const sx = STATE.symmetry.includes('X');
      const sz = STATE.symmetry.includes('Z');
      if (sx) add(-x, z, true, false);
      if (sz) add(x, -z, false, true);
      if (sx && sz) add(-x, -z, true, true);
      return pairs;
    }

    function isWithinGrid(x, y, z) { return Blueprint.isWithinGrid(x, y, z); }

    function buildPlacementPlan(x, y, z, type, orientation, allowMirror) {
      const placements = allowMirror
        ? symmetryOffsets(x, z)
        : [{ key: `${x},${z}`, x, z, mirrorX: false, mirrorZ: false }];

      return placements.map(p => ({
        x: p.x,
        y,
        z: p.z,
        type,
        orientation: mirrorOrientation(orientation, p.mirrorX, p.mirrorZ, type),
        controlAxis: type === 'ControlSurface' ? STATE.controlAxis : 'pitch',
        controlSign: type === 'ControlSurface' ? STATE.controlSign : 0
      }));
    }

    function canPlacePlan(plan) {
      return CRAFT.validateAddMany(plan).ok;
    }

    function isStructureContiguous() {
      return CRAFT.isContiguous();
    }

    function refreshRaycastList() {
      WORKSHOP.rootMeshes.length = 0;
      for (const mesh of WORKSHOP.meshesByKey.values()) addRootMesh(mesh);
    }

    function addWorkshopVisual(block) {
      if (!block || WORKSHOP.meshesByKey.has(block.key)) return WORKSHOP.meshesByKey.get(block?.key) || null;
      const mesh = createModuleVisual(block.type, block.orientation);
      mesh.position.set(block.x, block.y, block.z);
      mesh.userData.blockKey = block.key;
      scene.add(mesh);
      WORKSHOP.meshesByKey.set(block.key, mesh);
      addRootMesh(mesh);
      return mesh;
    }

    function removeWorkshopVisual(blockOrKey) {
      const key = typeof blockOrKey === 'string' ? blockOrKey : blockOrKey?.key;
      if (!key) return false;
      const mesh = WORKSHOP.meshesByKey.get(key);
      if (!mesh) return false;
      scene.remove(mesh);
      removeRootMesh(mesh);
      WORKSHOP.meshesByKey.delete(key);
      disposeObjectTree(mesh);
      return true;
    }

    function rebuildWorkshopView() {
      for (const mesh of WORKSHOP.meshesByKey.values()) {
        scene.remove(mesh);
        disposeObjectTree(mesh);
      }
      WORKSHOP.meshesByKey.clear();
      WORKSHOP.rootMeshes.length = 0;
      for (const block of CRAFT.values()) addWorkshopVisual(block);
      refreshRaycastList();
    }

    function assertWorkshopViewConsistency() {
      if (WORKSHOP.meshesByKey.size !== CRAFT.size) {
        throw new Error(`Workshop view/model size mismatch: ${WORKSHOP.meshesByKey.size} != ${CRAFT.size}`);
      }
      for (const block of CRAFT.values()) {
        const mesh = WORKSHOP.meshesByKey.get(block.key);
        if (!mesh || mesh.userData.blockKey !== block.key || mesh.userData.type !== block.type) {
          throw new Error(`Workshop view is missing or stale for block ${block.key}.`);
        }
      }
      return true;
    }

    function handleCraftModelChange(event) {
      try {
        for (const block of event.removed) removeWorkshopVisual(block);
        for (const change of event.updated) removeWorkshopVisual(change.before);
        for (const block of event.added) addWorkshopVisual(block);
        for (const change of event.updated) addWorkshopVisual(change.after);
        refreshRaycastList();
        assertWorkshopViewConsistency();
      } catch (error) {
        console.error('Incremental workshop view update failed; rebuilding from CraftModel.', error);
        rebuildWorkshopView();
        assertWorkshopViewConsistency();
      }
    }

    CRAFT.subscribe(handleCraftModelChange);

    function updateTelemetry() {
      syncControlFrameReadout();
      const analysis = computeCraftAnalysis();
      STATE.flight.analysis = analysis;
      STATE.flight.compiled = analysis.snapshot.compiled;

      if (analysis.mass > 0) {
        comSphere.position.copy(analysis.com);
        comSphere.visible = STATE.mode === 'BUILD';
      } else {
        comSphere.visible = false;
      }

      document.getElementById('ui-mass').textContent = `${analysis.mass.toFixed(1)} kg`;
      document.getElementById('ui-blocks').textContent = String(CRAFT.size);

      if (STATE.mode === 'BUILD') {
        document.getElementById('ui-fuel').textContent = `${Math.round(analysis.fuelCapacity)} reserve`;
      } else {
        document.getElementById('ui-fuel').textContent = `${Math.max(0, Math.round(STATE.flight.fuel))} / ${Math.max(0, Math.round(STATE.flight.fuelMax))}`;
      }

      updateEngineeringAnalysisUI(analysis);
      updateAnalysisVisuals(analysis);
      renderContractPanel();
      updateHUD();
    }

    function applyBuildRotation(step = 1) {
      if (STATE.mode !== 'BUILD' || !partUsesRoll(STATE.selectedBlock)) return;
      rotateOrientationRoll(step);
    }

    function setSelectedTool(tool) {
      if (STATE.mode !== 'BUILD' || !BLOCKS[tool]) return;
      STATE.selectedBlock = tool;
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      const active = Array.from(document.querySelectorAll('.tool-btn')).find(element => /** @type {HTMLElement} */ (element).dataset.tool === tool);
      if (active) active.classList.add('active');
      updateControlConfigurationUI();
      updateTelemetry();
      updateGhost();
      updateFlightFeedback();
      autoSave(false);
    }

    function disposeObjectTree(root) {
      if (!root) return;
      root.traverse(obj => {
        if (obj.geometry && obj.geometry !== sharedGeometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        const objectMaterials = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        objectMaterials.forEach(material => {
          if (material && typeof material.dispose === 'function') material.dispose();
        });
      });
    }

    function cleanupFlightState() {
      if (STATE.flight.assemblyRuntime) STATE.flight.assemblyRuntime.dispose();
      else {
        const craftBodies = new Set(STATE.flight.bodies || []);
        for (const body of STATE.flight.bodyById?.values?.() || []) craftBodies.add(body);
        for (const body of craftBodies) Physics.removeBody(world, body);
      }
      STATE.flight.body = null;
      STATE.flight.primaryBody = null;
      STATE.flight.assembly = null;
      STATE.flight.bodies = [];
      STATE.flight.bodyById = new Map();
      STATE.flight.assemblyPlan = null;
      STATE.flight.assemblyRuntime = null;
      STATE.flight.assembly = null;
      if (STATE.flight.group) {
        scene.remove(STATE.flight.group);
        disposeObjectTree(STATE.flight.group);
        STATE.flight.group = null;
      }
      STATE.flight.functionalBlocks = [];
      STATE.flight.fuel = 0;
      STATE.flight.fuelMax = 0;
      STATE.flight.analysis = null;
      STATE.flight.compiled = null;
      STATE.flight.thrusterTorqueMax.set(0, 0, 0);
      STATE.flight.gyroCount = 0;
      STATE.flight.blockCount = 0;
      STATE.flight.dragArea = 0;
      STATE.flight.lastLoads = { lift: 0, drag: 0, thrust: 0, impact: 0 };
      STATE.flight.outOfFuel = false;
      STATE.flight.severeImpact = false;
      STATE.flight.integrity = 100;
      STATE.flight.maxImpact = 0;
      STATE.flight.runtimeMass = 0;
      STATE.flight.payloadMass = 0;
      STATE.flight.lastImpactAt = -Infinity;
      for (const debris of STATE.flight.debris) {
        if (debris.body) Physics.removeBody(world, debris.body);
        if (debris.visual) { scene.remove(debris.visual); disposeObjectTree(debris.visual); }
      }
      STATE.flight.runtimeParts = [];
      STATE.flight.runtimePartById = new Map();
      STATE.flight.currentInertia.set(0, 0, 0);
      STATE.flight.debris = [];
      STATE.flight.lostParts = 0;
      STATE.flight.leakingFuelRate = 0;
      STATE.flight.firstFailure = '';
      STATE.flight.structuralFailures = 0;
      STATE.flight.initialHealth = 0;
      STATE.flight.gyroAuthority = 0;
      STATE.flight.payloadLocalPos = null;
      STATE.flight.payload = null;
      STATE.flight.pendingImpacts = [];
      STATE.flight.structuralAccumulator = 0;
      STATE.flight.runtimePartByKey = new Map();
      STATE.flight.metricsDirty = true;
      thrustSphere.visible = false;
      liftSphere.visible = false;
      thrustVectorArrow.visible = false;
      liftVectorArrow.visible = false;
      for (const mesh of WORKSHOP.meshesByKey.values()) mesh.visible = true;
      clearPilotAxes();
      setStabilize(false);
    }


    function resetToEmptyCraft(persist = true) {
      cleanupFlightState();
      STATE.mode = 'BUILD';
      STATE.statusText = 'DRYDOCK';
      const cleared = CRAFT.clear('new-empty-craft');
      if (!cleared.ok) throw new Error(`Unable to clear craft: ${cleared.reason}`);
      updateTelemetry();
      updateGhost();
      if (persist) autoSave(false);
    }



    function addBlock(x, y, z, type, orientation = STATE.orientation, allowMirror = true) {
      if (STATE.mode !== 'BUILD') return false;
      x = snapInt(x); y = snapInt(y); z = snapInt(z);
      const safeOrientation = partUsesOrientation(type) ? normalizeOrientationId(orientation) : DEFAULT_ORIENTATION;
      const plan = buildPlacementPlan(x, y, z, type, safeOrientation, allowMirror);
      const validation = CRAFT.validateAddMany(plan);
      if (!validation.ok) return false;
      const historyBefore = collectBlueprint();
      const placed = CRAFT.addMany(plan, 'place-blocks');
      if (!placed.ok) return false;

      commitHistory(historyBefore);
      STATE.statusText = 'DRYDOCK';
      updateTelemetry();
      updateGhost();
      autoSave(false);
      return true;
    }

    function flashInvalid(mesh) {
      if (!mesh || !mesh.material || !mesh.material.emissive) return;
      const original = mesh.material.emissive.getHex();
      mesh.material.emissive.setHex(0xff0000);
      setTimeout(() => {
        if (mesh.material && mesh.material.emissive) mesh.material.emissive.setHex(original);
      }, 160);
    }

    function removeBlock(x, y, z) {
      if (STATE.mode !== 'BUILD') return false;
      x = snapInt(x); y = snapInt(y); z = snapInt(z);
      const key = makeKey(x, y, z);
      const block = CRAFT.get(key);
      if (!block) return false;
      const mesh = WORKSHOP.meshesByKey.get(key);
      const historyBefore = collectBlueprint();
      const removed = CRAFT.remove(key, 'remove-block');
      if (!removed.ok) {
        if (removed.reason === 'disconnected') flashInvalid(mesh);
        updateTelemetry();
        return false;
      }

      commitHistory(historyBefore);
      STATE.statusText = 'DRYDOCK';
      updateTelemetry();
      updateGhost();
      autoSave(false);
      return true;
    }

    function getRootVoxelFromHit(obj) {
      let current = obj;
      while (current && !current.userData.isVoxelRoot && current.parent) current = current.parent;
      return current && current.userData.isVoxelRoot ? current : null;
    }

    const raycaster = new THREE.Raycaster();
    function raycastBuildTarget(ndc) {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([basePlane, ...WORKSHOP.rootMeshes], true);
      if (!hits.length) return null;

      const hit = hits[0];
      if (hit.object === basePlane || hit.object.userData.isBuildSurface) {
        return {
          kind: 'surface',
          position: new THREE.Vector3(snapInt(hit.point.x), 0, snapInt(hit.point.z)),
          root: null,
          normal: new THREE.Vector3(0, 1, 0)
        };
      }

      const root = getRootVoxelFromHit(hit.object);
      if (!root || !hit.face) return null;

      const normal = hit.face.normal.clone().round();
      const position = root.position.clone().add(normal);
      position.set(snapInt(position.x), snapInt(position.y), snapInt(position.z));
      if (position.y < GRID.minY) position.y = GRID.minY;
      return { kind: 'voxel', position, root, normal };
    }

    function hideSymmetryGhosts() {
      symmetryGhosts.forEach(preview => { preview.visible = false; });
    }

    function updateSymmetryGhosts(plan, valid) {
      hideSymmetryGhosts();
      plan.slice(1, 4).forEach((item, index) => {
        const preview = symmetryGhosts[index];
        preview.visible = true;
        preview.position.set(item.x, item.y, item.z);
        preview.material.color.setHex(BLOCKS[item.type].color);
        preview.material.opacity = valid ? 0.45 : 0.16;
      });
    }

    function updateGhost() {
      if (STATE.mode !== 'BUILD' || !STATE.input.pointerInside) {
        ghost.visible = false;
        ghostArrow.visible = false;
        ghostNormalArrow.visible = false;
        hideSymmetryGhosts();
        STATE.hovered.valid = false;
        document.getElementById('ui-adj').textContent = '—';
        return;
      }

      const target = raycastBuildTarget(STATE.input.pointerNDC);
      STATE.hovered.valid = !!target;
      STATE.hovered.kind = target ? target.kind : null;
      STATE.hovered.pos = target ? target.position.clone() : new THREE.Vector3();
      STATE.hovered.normal = target ? target.normal.clone() : new THREE.Vector3(0, 1, 0);
      STATE.hovered.root = target ? target.root : null;

      if (!target) {
        ghost.visible = false;
        ghostArrow.visible = false;
        ghostNormalArrow.visible = false;
        hideSymmetryGhosts();
        document.getElementById('ui-adj').textContent = '—';
        return;
      }

      ghost.visible = true;
      ghost.position.copy(target.position);
      ghost.material.color.setHex(BLOCKS[STATE.selectedBlock].color);
      const plan = buildPlacementPlan(
        target.position.x,
        target.position.y,
        target.position.z,
        STATE.selectedBlock,
        STATE.orientation,
        true
      );
      const valid = canPlacePlan(plan);
      ghost.material.opacity = valid ? 0.55 : 0.2;
      updateSymmetryGhosts(plan, valid);
      document.getElementById('ui-adj').textContent = valid ? `OK ×${plan.length}` : 'NO';

      const showArrow = partUsesOrientation(STATE.selectedBlock);
      ghostArrow.visible = showArrow;
      ghostNormalArrow.visible = STATE.selectedBlock === 'Wing' || STATE.selectedBlock === 'ControlSurface' || STATE.selectedBlock === 'VectorThruster';
      if (showArrow) {
        const basis = getModuleBasis(STATE.orientation);
        ghostArrow.position.copy(target.position);
        ghostArrow.setDirection(basis.chord);
        ghostArrow.setLength(1.35, 0.32, 0.22);
        ghostArrow.setColor(new THREE.Color(axisColor(STATE.orientation)));
        if (STATE.selectedBlock === 'Wing' || STATE.selectedBlock === 'ControlSurface' || STATE.selectedBlock === 'VectorThruster') {
          ghostNormalArrow.position.copy(target.position);
          ghostNormalArrow.setDirection(basis.normal);
          ghostNormalArrow.setLength(1.05, 0.28, 0.18);
        }
      }
    }

    function rayToNDC(clientX, clientY) {
      STATE.input.pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
      STATE.input.pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    }

    function runtimePartHealthFraction(part) {
      return part && part.maxHealth > 0 ? THREE.MathUtils.clamp(part.health / part.maxHealth, 0, 1) : 0;
    }

    function updateRuntimePartVisual(part) {
      if (!part?.visual) return;
      const health = runtimePartHealthFraction(part);
      part.visual.traverse(object => {
        const mats = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
        for (const material of mats) {
          if (!material || !material.emissive) continue;
          if (health < 0.75) material.emissive.setRGB((1 - health) * 0.72, 0.02, 0.01);
        }
      });
    }

    function markFlightMetricsDirty() {
      STATE.flight.metricsDirty = true;
    }

    function getRuntimeCore() {
      return STATE.flight.runtimeParts.find(part => part.type === 'Core') || null;
    }

    function recomputeFlightIntegrity(force = false) {
      if (!force && !STATE.flight.metricsDirty) return;
      const attached = STATE.flight.runtimeParts.filter(part => part.attached);
      const health = attached.reduce((sum, part) => sum + Math.max(0, part.health), 0);
      const core = getRuntimeCore();
      const coreOperational = Boolean(core?.attached && core.health > 0);
      STATE.flight.integrity = coreOperational && STATE.flight.initialHealth > 0
        ? THREE.MathUtils.clamp(health / STATE.flight.initialHealth * 100, 0, 100)
        : 0;
      STATE.flight.dragArea = attached.reduce((sum, part) => sum + (part.def.dragArea || 0) * Math.max(0.15, runtimePartHealthFraction(part)), 0)
        + (STATE.flight.payload?.attached ? 0.2 : 0);
      STATE.flight.gyroAuthority = attached.filter(part => part.type === 'Gyro').reduce((sum, part) => sum + runtimePartHealthFraction(part), 0);
      STATE.flight.gyroCount = STATE.flight.gyroAuthority;
      STATE.flight.leakingFuelRate = attached.filter(part => part.type === 'Fuel').reduce((sum, part) => {
        const health = runtimePartHealthFraction(part);
        return sum + (part.def.leakRate || 0) * Math.max(0, (0.82 - health) / 0.82);
      }, 0);
      STATE.flight.metricsDirty = false;
    }

    function removeShapeFromBody(body, shape) {
      Physics.removeCollider(body, shape);
    }

    function createDebrisFromVisual(visual, mass, localPos) {
      const craftBody = primaryFlightBody();
      const group = STATE.flight.group;
      if (!craftBody || !group || !visual) return;
      const worldPosition = Physics.pointToWorldFrame(craftBody, localPos);
      const worldVelocity = pointVelocityWorld(craftBody, localPos);
      const craftQuaternion = new THREE.Quaternion(craftBody.quaternion.x, craftBody.quaternion.y, craftBody.quaternion.z, craftBody.quaternion.w);
      const worldQuaternion = craftQuaternion.multiply(visual.quaternion.clone());
      group.remove(visual);
      if (STATE.flight.debris.length >= PHYSICS.maxPhysicalDebris) {
        disposeObjectTree(visual);
        return;
      }
      scene.add(visual);
      visual.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
      visual.quaternion.copy(worldQuaternion);
      const debrisBody = Physics.createBody({
        mass: Math.max(0.15, mass),
        linearDamping: 0.025,
        angularDamping: 0.04,
        allowSleep: true,
        collisionGroup: COLLISION_GROUP.debris,
        collisionMask: COLLISION_GROUP.world | COLLISION_GROUP.craft,
        position: worldPosition,
        quaternion: worldQuaternion,
        userData: { debris: true }
      });
      Physics.addBoxCollider(debrisBody, { halfExtents: { x: 0.47, y: 0.47, z: 0.47 } });
      Physics.setBodyVelocity(debrisBody, { linear: worldVelocity, angular: craftBody.angularVelocity });
      debrisBody.angularVelocity.x += (Math.random() - 0.5) * 2.5;
      debrisBody.angularVelocity.y += (Math.random() - 0.5) * 2.5;
      debrisBody.angularVelocity.z += (Math.random() - 0.5) * 2.5;
      Physics.addBody(world, debrisBody);
      STATE.flight.debris.push({ body: debrisBody, visual, age: 0 });
    }

    function createDetachedDebris(part) {
      if (!part?.visual) return;
      createDebrisFromVisual(part.visual, part.mass, part.localPos);
      part.visual = null;
    }

    function recomputeThrusterTorqueEnvelope() {
      const max = new THREE.Vector3();
      for (const part of STATE.flight.runtimeParts) {
        if (!part.attached || (part.type !== 'Thruster' && part.type !== 'VectorThruster')) continue;
        const force = Physics.vec3(part.localAxis.x * part.force, part.localAxis.y * part.force, part.localAxis.z * part.force);
        const torque = Physics.vec3();
        part.localPos.cross(force, torque);
        part.localTorque.copy(torque);
        max.x = Math.max(max.x, Math.abs(torque.x));
        max.y = Math.max(max.y, Math.abs(torque.y));
        max.z = Math.max(max.z, Math.abs(torque.z));
      }
      STATE.flight.thrusterTorqueMax.copy(max);
    }


    function computeRuntimeMassProperties(attached, payload = null) {
      return MassProperties.compute([
        ...attached.map(part => ({
          id: part.blockId,
          mass: part.mass,
          center: part.localPos,
          halfExtents: [0.5, 0.5, 0.5]
        })),
        ...(payload ? [{
          id: 'mission-payload',
          mass: payload.mass,
          center: payload.localPos,
          halfExtents: [0.42, 0.42, 0.42]
        }] : [])
      ]);
    }

    function recenterCraftBody() {
      const body = primaryFlightBody();
      const group = STATE.flight.group;
      if (!body || !group) return;
      const attached = STATE.flight.runtimeParts.filter(part => part.attached);
      const payload = STATE.flight.payload?.attached ? STATE.flight.payload : null;
      const massProperties = computeRuntimeMassProperties(attached, payload);
      const totalMass = massProperties.mass;
      if (totalMass <= 0) return;
      const shift = Physics.vec3(...massProperties.centerOfMass);
      if (shift.lengthSquared() >= 1e-8) {
        const assemblyRuntime = STATE.flight.assemblyRuntime;
        let recentered = null;
        if (assemblyRuntime) recentered = assemblyRuntime.recenterBody(STATE.flight.assemblyPlan.rootBodyId, shift);
        else {
          const newWorldPosition = Physics.pointToWorldFrame(body, shift);
          const newVelocity = pointVelocityWorld(body, shift);
          Physics.shiftColliderOffsets(body, shift);
          Physics.setBodyTransform(body, { position: newWorldPosition });
          Physics.setBodyVelocity(body, { linear: newVelocity });
          recentered = { worldPosition: newWorldPosition, linearVelocity: newVelocity };
        }
        for (const part of attached) {
          part.localPos.x -= shift.x; part.localPos.y -= shift.y; part.localPos.z -= shift.z;
        }
        if (payload) {
          payload.localPos.x -= shift.x; payload.localPos.y -= shift.y; payload.localPos.z -= shift.z;
          STATE.flight.payloadLocalPos = payload.localPos;
        }
        for (const child of group.children) {
          child.position.x -= shift.x; child.position.y -= shift.y; child.position.z -= shift.z;
        }
      }
      const inertia = Physics.vec3(...massProperties.inertiaDiagonal);
      const assemblyRuntime = STATE.flight.assemblyRuntime;
      if (assemblyRuntime) assemblyRuntime.setBodyMassProperties(STATE.flight.assemblyPlan.rootBodyId, { mass: totalMass, inertiaDiagonal: inertia });
      else Physics.setBodyMassProperties(body, { mass: totalMass, inertiaDiagonal: inertia });
      STATE.flight.runtimeMass = totalMass;
      STATE.flight.currentInertia.copy(inertia);
      STATE.flight.payloadMass = payload ? payload.mass : 0;
      STATE.flight.lowestLocalY = Math.min(
        ...attached.map(part => part.localPos.y - 0.5),
        payload ? payload.localPos.y - 0.42 : Infinity
      );
      recomputeThrusterTorqueEnvelope();
      markFlightMetricsDirty();
    }

    function collectDisconnectedRuntimeParts() {
      const byKey = STATE.flight.runtimePartByKey;
      const core = getRuntimeCore();
      if (!core?.attached) return STATE.flight.runtimeParts.filter(part => part.attached && part.type !== 'Core');
      const visited = new Set([core.key]);
      const queue = [core.key];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [x,y,z] = queue[cursor].split(',').map(Number);
        for (const [dx,dy,dz] of NEIGHBOR_DIRECTIONS) {
          const key = makeKey(x+dx,y+dy,z+dz);
          const neighbor = byKey.get(key);
          if (neighbor?.attached && !visited.has(key)) { visited.add(key); queue.push(key); }
        }
      }
      return STATE.flight.runtimeParts.filter(part => part.attached && part.type !== 'Core' && !visited.has(part.key));
    }


    function detachRuntimeParts(entries, cascade = true) {
      const pending = new Map();
      for (const entry of entries || []) {
        const part = entry?.part || entry;
        if (part?.attached) pending.set(part, entry?.reason || 'structural failure');
      }
      if (!pending.size) return 0;
      let detachedCount = 0;
      let fuelCapacityLost = 0;
      let coreFailed = false;
      const detachOne = (part, reason) => {
        if (!part?.attached) return;
        if (part.type === 'Core') {
          part.health = 0;
          coreFailed = true;
          STATE.flight.integrity = 0;
          STATE.flight.firstFailure = `Command core failed: ${reason}`;
          return;
        }
        part.attached = false;
        part.health = 0;
        if (!STATE.flight.assemblyRuntime?.removeColliderByBlockId(part.blockId)) removeShapeFromBody(runtimeBodyForPart(part), part.shape);
        createDetachedDebris(part);
        detachedCount += 1;
        STATE.flight.lostParts += 1;
        STATE.flight.structuralFailures += 1;
        if (!STATE.flight.firstFailure) STATE.flight.firstFailure = `${part.type} detached: ${reason}`;
        if (part.type === 'Fuel') fuelCapacityLost += part.def.fuelCapacity || 0;
      };
      for (const [part, reason] of pending) detachOne(part, reason);
      if (cascade && !coreFailed) {
        for (const part of collectDisconnectedRuntimeParts()) detachOne(part, 'connection to core was severed');
      }
      if (fuelCapacityLost > 0) {
        STATE.flight.fuelMax = Math.max(0, STATE.flight.fuelMax - fuelCapacityLost);
        STATE.flight.fuel = Math.min(STATE.flight.fuel, STATE.flight.fuelMax);
      }
      if (detachedCount > 0) {
        STATE.flight.blockCount = Math.max(1, STATE.flight.blockCount - detachedCount);
        recenterCraftBody();
      }
      markFlightMetricsDirty();
      recomputeFlightIntegrity(true);
      if (detachedCount > 0) showStatus(detachedCount === 1 ? 'MODULE LOST' : `${detachedCount} MODULES LOST`, 1100);
      return detachedCount;
    }

    function detachRuntimePart(part, reason = 'structural failure', cascade = true) {
      return detachRuntimeParts([{ part, reason }], cascade) > 0;
    }

    function detachDisconnectedRuntimeParts() {
      const disconnected = collectDisconnectedRuntimeParts();
      return detachRuntimeParts(disconnected.map(part => ({ part, reason: 'connection to core was severed' })), false);
    }

    function applyDamageOnly(part, amount, reason = 'impact') {
      if (!part?.attached || amount <= 0) return false;
      const absorbed = Math.max(0.25, part.def.structural || 1);
      part.health = Math.max(0, part.health - amount / absorbed);
      if (!STATE.flight.firstFailure && runtimePartHealthFraction(part) < 0.55) STATE.flight.firstFailure = `${part.type} critically damaged by ${reason}`;
      updateRuntimePartVisual(part);
      markFlightMetricsDirty();
      return part.health <= 0;
    }

    function damageRuntimePart(part, amount, reason = 'impact') {
      if (applyDamageOnly(part, amount, reason)) detachRuntimeParts([{ part, reason }], true);
      else recomputeFlightIntegrity();
    }

    function updatePayloadVisual() {
      const payload = STATE.flight.payload;
      if (!payload?.visual?.material?.emissive) return;
      const health = payloadHealthFraction();
      payload.visual.material.emissive.setRGB((1 - health) * 0.8, 0.03, 0.01);
    }

    function detachPayload(reason = 'payload mount failure') {
      const payload = STATE.flight.payload;
      if (!payload?.attached) return false;
      payload.attached = false;
      payload.health = 0;
      if (!STATE.flight.assemblyRuntime?.removeCollider(payload.colliderId)) removeShapeFromBody(runtimeBodyForPart(payload), payload.shape);
      if (payload.coupler) {
        STATE.flight.group?.remove(payload.coupler);
        disposeObjectTree(payload.coupler);
        payload.coupler = null;
      }
      if (payload.visual) {
        createDebrisFromVisual(payload.visual, payload.mass, payload.localPos);
        payload.visual = null;
      }
      STATE.flight.payloadMass = 0;
      STATE.flight.payloadLocalPos = null;
      if (!STATE.flight.firstFailure) STATE.flight.firstFailure = `Payload lost: ${reason}`;
      recenterCraftBody();
      recomputeFlightIntegrity(true);
      showStatus('PAYLOAD LOST', 1500);
      return true;
    }

    function damagePayload(amount, reason = 'impact') {
      const payload = STATE.flight.payload;
      if (!payload?.attached || amount <= 0) return false;
      payload.health = Math.max(0, payload.health - amount);
      updatePayloadVisual();
      if (payload.health <= 0) return detachPayload(reason);
      return false;
    }

    function applyImpactDamage(localImpact, impact, collisionKind = 'ground') {
      const candidates = STATE.flight.runtimeParts.filter(part => part.attached);
      if (!candidates.length) return;
      let nearest = candidates[0];
      let nearestDistance = Infinity;
      for (const part of candidates) {
        const dx = part.localPos.x - localImpact.x;
        const dy = part.localPos.y - localImpact.y;
        const dz = part.localPos.z - localImpact.z;
        const distance = dx*dx + dy*dy + dz*dz;
        if (distance < nearestDistance) { nearestDistance = distance; nearest = part; }
      }
      const payload = STATE.flight.payload;
      let payloadNearest = false;
      if (payload?.attached) {
        const dx = payload.localPos.x - localImpact.x;
        const dy = payload.localPos.y - localImpact.y;
        const dz = payload.localPos.z - localImpact.z;
        payloadNearest = dx*dx + dy*dy + dz*dz < nearestDistance;
      }
      const multiplier = collisionKind === 'obstacle' ? 4.4 : (collisionKind === 'debris' ? 3.7 : 3.2);
      const energyDamage = Math.max(0, (impact - 3.5) ** 2 * multiplier);
      if (energyDamage <= 0) return;
      const reason = collisionKind === 'obstacle' ? 'collision with range obstacle' : (collisionKind === 'debris' ? 'collision with debris' : 'hard landing');
      const failures = [];
      if (payloadNearest) {
        damagePayload(energyDamage * 0.72, reason);
        const core = getRuntimeCore();
        if (core && applyDamageOnly(core, energyDamage * 0.18, 'payload mount transferred impact')) failures.push({ part: core, reason: 'payload mount transferred impact' });
      } else {
        if (applyDamageOnly(nearest, energyDamage, reason)) failures.push({ part: nearest, reason });
        for (const [dx,dy,dz] of NEIGHBOR_DIRECTIONS) {
          const neighbor = STATE.flight.runtimePartByKey.get(makeKey(nearest.grid.x+dx, nearest.grid.y+dy, nearest.grid.z+dz));
          if (neighbor?.attached && applyDamageOnly(neighbor, energyDamage * PHYSICS.damagePropagation, 'load propagated through connection')) {
            failures.push({ part: neighbor, reason: 'load propagated through connection' });
          }
        }
      }
      if (failures.length) detachRuntimeParts(failures, true);
      recomputeFlightIntegrity(true);
    }

    function runtimeNeighborCount(part) {
      let count = 0;
      for (const [dx,dy,dz] of NEIGHBOR_DIRECTIONS) {
        const neighbor = STATE.flight.runtimePartByKey.get(makeKey(part.grid.x+dx, part.grid.y+dy, part.grid.z+dz));
        if (neighbor?.attached) count += 1;
      }
      return count;
    }

    function applyStructuralLoadDamage(dt, totalThrust, totalLift, totalDrag) {
      const body = primaryFlightBody();
      if (!body || body.mass <= 0) return;
      const loadAcceleration = (Math.abs(totalThrust) + Math.abs(totalLift) + Math.abs(totalDrag)) / Math.max(1, body.mass);
      const spin = body.angularVelocity.length();
      const failures = [];
      const candidates = STATE.flight.runtimeParts.filter(part => part.attached && part.type !== 'Core');
      for (const part of candidates) {
        const support = runtimeNeighborCount(part);
        const lever = part.localPos.length();
        const structural = Math.max(0.2, part.def.structural || 1);
        const supportFactor = 0.72 + support * 0.42;
        const translationalStress = loadAcceleration * (0.24 + lever * 0.12);
        const rotationalStress = spin * spin * lever * 1.55;
        const stress = (translationalStress + rotationalStress) / (structural * supportFactor);
        if (stress > 42 && applyDamageOnly(part, (stress - 42) * dt * 1.7, 'flight-load overstress')) failures.push({ part, reason: 'flight-load overstress' });
      }
      if (failures.length) detachRuntimeParts(failures, true);
      recomputeFlightIntegrity();
    }

    function processPendingImpacts() {
      if (!primaryFlightBody() || !STATE.flight.pendingImpacts.length) return;
      const impacts = STATE.flight.pendingImpacts.splice(0);
      for (const entry of impacts) {
        if (!primaryFlightBody()) break;
        applyImpactDamage(entry.localImpact, entry.impact, entry.collisionKind);
        if (entry.impact >= PHYSICS.severeImpactSpeed && !STATE.flight.severeImpact) {
          STATE.flight.severeImpact = true;
          showStatus(entry.collisionKind === 'obstacle' ? 'SEVERE COLLISION' : (entry.collisionKind === 'debris' ? 'DEBRIS IMPACT' : 'SEVERE IMPACT'), 1800);
        } else if (entry.impact >= PHYSICS.hardImpactSpeed) {
          showStatus(entry.collisionKind === 'obstacle' ? 'OBSTACLE COLLISION' : (entry.collisionKind === 'debris' ? 'DEBRIS IMPACT' : 'HARD LANDING'), 1100);
        }
      }
    }

    function syncDebris(dt) {
      for (let index = STATE.flight.debris.length - 1; index >= 0; index--) {
        const debris = STATE.flight.debris[index];
        debris.age += dt;
        debris.visual.position.copy(debris.body.position);
        debris.visual.quaternion.copy(debris.body.quaternion);
        if (debris.age > PHYSICS.debrisLifetime || debris.body.position.y < -20) {
          Physics.removeBody(world, debris.body);
          scene.remove(debris.visual);
          disposeObjectTree(debris.visual);
          STATE.flight.debris.splice(index, 1);
        }
      }
    }

    function buildFlightBody() {
      cleanupFlightState();

      const analysis = computeCraftAnalysis();
      if (!analysis.snapshot.ready || analysis.mass <= 0 || !isStructureContiguous()) {
        const reason = analysis.snapshot.errors?.[0] || 'invalid-craft';
        showStatus(`CANNOT LAUNCH: ${String(reason).replaceAll('-', ' ').toUpperCase()}`, 2200);
        return false;
      }
      const contract = getSelectedContract();
      const payloadMass = Math.max(0, contract.payloadMass || 0);
      const snapshot = buildLoadedSnapshot(analysis.snapshot, payloadMass);
      const payloadPosition = snapshot.payloadPosition || missionPayloadPositionVector(snapshot);
      const assemblyPlan = RuntimeAssembly.createPlan(snapshot);
      const rootBodyPlan = RuntimeAssembly.rootBody(assemblyPlan);
      if (!rootBodyPlan) throw new Error('Runtime assembly plan has no root body.');
      const runtimeMass = rootBodyPlan.massProperties.mass;
      const colliderPlanByBlockId = new Map(
        rootBodyPlan.colliders.filter(collider => collider.blockId).map(collider => [collider.blockId, collider])
      );
      const payloadColliderPlan = rootBodyPlan.colliders.find(collider => collider.payload) || null;
      const runtimeCom = snapshot.com;
      STATE.flight.com.copy(runtimeCom);
      let lowestLocalY = Math.min(...rootBodyPlan.colliders.map(collider => collider.center[1] - collider.halfExtents[1]));
      if (!Number.isFinite(lowestLocalY)) lowestLocalY = -0.5;

      let body = null;
      const assemblyRuntime = AssemblyBuilder.build({
        plan: assemblyPlan,
        physics: Physics,
        world,
        bodyDescriptor: bodyPlan => ({
          linearDamping: 0.005,
          angularDamping: 0.012,
          allowSleep: false,
          collisionGroup: COLLISION_GROUP.craft,
          collisionMask: COLLISION_GROUP.world | COLLISION_GROUP.debris,
          position: bodyPlan.bodyId === rootBodyPlan.bodyId
            ? { x: TEST_RANGE.spawn.x + runtimeCom.x, y: -0.45 - lowestLocalY, z: TEST_RANGE.spawn.z + runtimeCom.z }
            : { x: TEST_RANGE.spawn.x, y: TEST_RANGE.spawn.y, z: TEST_RANGE.spawn.z }
        }),
        collisionListener: ({ body: collidedBody, event }) => {
          if (!STATE.flight.bodyById || ![...STATE.flight.bodyById.values()].includes(collidedBody)) return;
          const impact = event.impactSpeed > 0 ? event.impactSpeed : Math.abs(collidedBody.velocity.y);
          STATE.flight.lastLoads.impact = Math.max(STATE.flight.lastLoads.impact || 0, impact);
          STATE.flight.maxImpact = Math.max(STATE.flight.maxImpact, impact);
          const otherBody = event.otherBody;
          if (otherBody === groundBody) STATE.mission.lastGroundContact = STATE.mission.elapsed;
          const damageNow = STATE.mission.elapsed;
          const collisionKind = otherBody?.userData?.rangeObstacle ? 'obstacle' : (otherBody?.userData?.debris ? 'debris' : 'ground');
          if (impact > 3.5 && damageNow - STATE.flight.lastImpactAt > 0.25) {
            let localImpact = { x: 0, y: STATE.flight.lowestLocalY, z: 0 };
            if (event.relativePoint) localImpact = Physics.vectorToLocalFrame(collidedBody, event.relativePoint);
            STATE.flight.pendingImpacts.push({
              localImpact: { x: localImpact.x, y: localImpact.y, z: localImpact.z },
              impact,
              collisionKind,
              timestamp: damageNow
            });
            STATE.flight.lastImpactAt = damageNow;
          }
        }
      });
      body = assemblyRuntime.rootBody;
      const group = new THREE.Group();
      scene.add(group);

      const functionalBlocks = [];
      const runtimeParts = [];
      STATE.flight.payloadLocalPos = null;
      STATE.flight.payload = null;
      const thrusterTorqueMax = new THREE.Vector3();
      let gyroCount = 0;

      for (const part of snapshot.parts) {
        const colliderPlan = colliderPlanByBlockId.get(part.blockId);
        if (!colliderPlan) throw new Error(`Runtime assembly is missing collider for ${part.blockId}.`);
        const offsetThree = part.offset;
        const localOffset = Physics.vec3(...colliderPlan.center);
        const runtimeCollider = assemblyRuntime.colliderByBlockId.get(part.blockId);
        if (!runtimeCollider) throw new Error(`Runtime assembly builder is missing collider for ${part.blockId}.`);
        const shape = runtimeCollider.shape;

        const visual = createModuleVisual(part.type, part.orientation, false);
        visual.position.set(localOffset.x, localOffset.y, localOffset.z);
        group.add(visual);
        const key = part.key;
        const sourceMesh = WORKSHOP.meshesByKey.get(key);
        if (sourceMesh) sourceMesh.visible = false;

        const fullForce = (part.type === 'Thruster' || part.type === 'VectorThruster') ? part.basis.chord.clone().multiplyScalar(part.def.force || 0) : new THREE.Vector3();
        const torqueThree = offsetThree.clone().cross(fullForce);
        const localTorque = Physics.vec3(torqueThree.x, torqueThree.y, torqueThree.z);
        const runtimePart = {
          blockId: part.blockId,
          bodyId: rootBodyPlan.bodyId,
          key, grid: { x: part.position.x, y: part.position.y, z: part.position.z }, type: part.type, def: part.def,
          visual, shape, localPos: localOffset.clone(), orientation: part.orientation,
          localAxis: Physics.vec3(part.basis.chord.x, part.basis.chord.y, part.basis.chord.z),
          localNormal: Physics.vec3(part.basis.normal.x, part.basis.normal.y, part.basis.normal.z),
          localSpan: Physics.vec3(part.basis.span.x, part.basis.span.y, part.basis.span.z),
          localTorque, force: part.def.force || 0, wingArea: part.def.wingArea || 0, fuelRate: part.def.fuelRate || 0,
          controlAxis: normalizeControlAxis(part.controlAxis), controlSign: normalizeControlSign(part.controlSign),
          mass: part.def.mass || 0, maxHealth: part.def.durability || 60, health: part.def.durability || 60,
          attached: true, lastCommand: 0, gimbalA: 0, gimbalB: 0, controlDeflection: 0
        };
        runtimeParts.push(runtimePart);
        if (part.type === 'Thruster' || part.type === 'VectorThruster') {
          thrusterTorqueMax.x = Math.max(thrusterTorqueMax.x, Math.abs(localTorque.x));
          thrusterTorqueMax.y = Math.max(thrusterTorqueMax.y, Math.abs(localTorque.y));
          thrusterTorqueMax.z = Math.max(thrusterTorqueMax.z, Math.abs(localTorque.z));
        }
        if (part.type === 'Gyro') gyroCount += 1;
        if (['Thruster','VectorThruster','Balloon','Wing','ControlSurface','Gyro','Fuel'].includes(part.type)) functionalBlocks.push(runtimePart);
      }

      if (payloadMass > 0) {
        if (!payloadColliderPlan) throw new Error('Runtime assembly is missing the mission payload collider.');
        const payloadOffsetThree = snapshot.payloadOffset || payloadPosition.clone().sub(runtimeCom);
        const payloadOffset = Physics.vec3(...payloadColliderPlan.center);
        const payloadRuntimeCollider = assemblyRuntime.colliderById.get(payloadColliderPlan.colliderId);
        if (!payloadRuntimeCollider) throw new Error('Runtime assembly builder is missing the mission payload collider.');
        const payloadShape = payloadRuntimeCollider.shape;
        STATE.flight.payloadLocalPos = payloadOffset.clone();
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.84, 0.84, 0.84),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.72, metalness: 0.18, emissive: 0x082f49, emissiveIntensity: 0.16 })
        );
        crate.position.set(payloadOffset.x, payloadOffset.y, payloadOffset.z);
        crate.castShadow = true;
        crate.receiveShadow = true;
        crate.userData.isMissionPayload = true;
        group.add(crate);
        let coupler = null;
        const corePart = snapshot.parts.find(part => part.type === 'Core');
        if (corePart) {
          coupler = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.24, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.48, metalness: 0.45, emissive: 0x0c4a6e, emissiveIntensity: 0.12 })
          );
          coupler.position.copy(payloadOffsetThree.clone().add(corePart.offset).multiplyScalar(0.5));
          coupler.castShadow = true;
          group.add(coupler);
        }
        const payloadMaxHealth = 80 + payloadMass * 2.5;
        STATE.flight.payload = { mass: payloadMass, localPos: payloadOffset, shape: payloadShape, colliderId: payloadColliderPlan.colliderId, visual: crate, coupler, health: payloadMaxHealth, maxHealth: payloadMaxHealth, attached: true };
      }


      STATE.flight.body = assemblyRuntime.rootBody;
      STATE.flight.primaryBody = assemblyRuntime.rootBody;
      STATE.flight.assembly = assemblyRuntime;
      STATE.flight.bodies = [...assemblyRuntime.bodyById.values()].map(entry => entry.body);
      STATE.flight.bodyById = new Map([...assemblyRuntime.bodyById].map(([bodyId, entry]) => [bodyId, entry.body]));
      STATE.flight.assemblyPlan = assemblyPlan;
      STATE.flight.assemblyRuntime = assemblyRuntime;
      STATE.flight.group = group;
      STATE.flight.functionalBlocks = functionalBlocks;
      STATE.flight.runtimeParts = runtimeParts;
      STATE.flight.runtimePartById = new Map(runtimeParts.map(part => [part.blockId, part]));
      STATE.flight.runtimePartByKey = new Map(runtimeParts.map(part => [part.key, part]));
      STATE.flight.fuelMax = Math.max(0, analysis.fuelCapacity);
      STATE.flight.fuel = STATE.flight.fuelMax;
      STATE.flight.analysis = analysis;
      STATE.flight.compiled = snapshot.compiled;
      STATE.flight.thrusterTorqueMax.copy(thrusterTorqueMax);
      STATE.flight.gyroCount = gyroCount;
      STATE.flight.blockCount = snapshot.parts.length;
      STATE.flight.dragArea = snapshot.dragArea;
      STATE.flight.lastLoads = { lift: 0, drag: 0, thrust: 0, impact: 0 };
      STATE.flight.outOfFuel = false;
      STATE.flight.severeImpact = false;
      STATE.flight.integrity = 100;
      STATE.flight.maxImpact = 0;
      STATE.flight.lowestLocalY = Number.isFinite(lowestLocalY) ? lowestLocalY : -0.5;
      STATE.flight.runtimeMass = runtimeMass;
      STATE.flight.currentInertia.copy(snapshot.inertia);
      STATE.flight.payloadMass = payloadMass;
      STATE.flight.lastImpactAt = -Infinity;
      STATE.flight.lostParts = 0;
      STATE.flight.leakingFuelRate = 0;
      STATE.flight.firstFailure = '';
      STATE.flight.structuralFailures = 0;
      STATE.flight.initialHealth = runtimeParts.reduce((sum, part) => sum + part.maxHealth, 0);
      STATE.flight.gyroAuthority = gyroCount;
      STATE.flight.pendingImpacts = [];
      STATE.flight.metricsDirty = true;
      recomputeFlightIntegrity(true);

      STATE.camera.target.copy(body.position);
      camera.position.set(body.position.x + 13, body.position.y + 7, body.position.z + 13);
      return true;
    }

    function setMode(mode) {
      if (mode !== 'BUILD' && mode !== 'FLIGHT') return;
      cancelStatusToast();
      if (mode === STATE.mode) return;

      if (mode === 'BUILD') {
        cleanupFlightState();
        STATE.mode = 'BUILD';
        for (const mesh of WORKSHOP.meshesByKey.values()) mesh.visible = true;
        comSphere.visible = CRAFT.size > 0;
        axesHelper.visible = true;
        gridHelper.visible = true;
        basePlane.visible = true;
        STATE.statusText = 'DRYDOCK';
        testRangeGroup.visible = false;
        missionMarkerGroup.visible = false;
        document.getElementById('mission-hud').hidden = true;
        STATE.mission.status = 'IDLE';
        STATE.mission.active = false;
        STATE.mission.contractId = null;
        STATE.mission.previousPosition = null;
        STATE.mission.landingAssessment = null;
        STATE.mission.helpPaused = false;
      } else {
        const compiled = CraftCompiler.compile(CRAFT);
        if (compiled.blockCount > PHYSICS.maxFlightParts) {
          STATE.statusText = 'CRAFT TOO LARGE';
          showStatus(`FLIGHT LIMIT: ${PHYSICS.maxFlightParts} MODULES`, 2200);
          updateTelemetry();
              updateHistoryButtons();
          return;
        }
        const ok = buildFlightBody();
        if (!ok) {
          STATE.mode = 'BUILD';
          STATE.statusText = 'INVALID CRAFT';
          updateTelemetry();
              updateHistoryButtons();
          return;
        }
        STATE.mode = 'FLIGHT';
        ghost.visible = false;
        ghostArrow.visible = false;
        ghostNormalArrow.visible = false;
        hideSymmetryGhosts();
        comSphere.visible = false;
        thrustSphere.visible = false;
        liftSphere.visible = false;
        thrustVectorArrow.visible = false;
        liftVectorArrow.visible = false;
        axesHelper.visible = false;
        gridHelper.visible = false;
        basePlane.visible = false;
        const criticalCount = STATE.flight.analysis.warnings.filter(item => item.level === 'critical').length;
        const warningCount = STATE.flight.analysis.warnings.filter(item => item.level === 'warn').length;
        STATE.statusText = criticalCount
          ? `TEST • ${criticalCount} CRITICAL`
          : (warningCount ? `TEST • ${warningCount} WARNINGS` : 'STABLE TEST');
        testRangeGroup.visible = true;
        startMissionSession();
      }

      applyWorkspaceLayout();
      syncContractPanelVisibility();
      updateTelemetry();
      updateGhost();
      updateFlightFeedback();
      updateHistoryButtons();
      autoSave(false);
    }



    function syncFlightVisuals() {
      const body = primaryFlightBody();
      if (!body || !STATE.flight.group) return;
      STATE.flight.group.position.copy(body.position);
      STATE.flight.group.quaternion.copy(body.quaternion);
    }


    function applyCameraOrbit() {
      const pitch = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, STATE.camera.pitch));
      const r = STATE.camera.distance;
      const x = STATE.camera.target.x + r * Math.cos(pitch) * Math.cos(STATE.camera.yaw);
      const z = STATE.camera.target.z + r * Math.cos(pitch) * Math.sin(STATE.camera.yaw);
      const y = STATE.camera.target.y + r * Math.sin(pitch);
      camera.position.set(x, y, z);
      camera.lookAt(STATE.camera.target);
    }

    function performBuildAction(button) {
      if (STATE.mode !== 'BUILD') return;
      const target = raycastBuildTarget(STATE.input.pointerNDC);
      if (!target) return;
      if (button === 0) {
        addBlock(target.position.x, target.position.y, target.position.z, STATE.selectedBlock, STATE.orientation, true);
      } else if (button === 2 && target.kind === 'voxel') {
        removeBlock(target.root.position.x, target.root.position.y, target.root.position.z);
      }
    }


    function resetCamera() {
      STATE.camera.target.copy(STATE.camera.defaultTarget);
      STATE.camera.yaw = STATE.camera.defaultYaw;
      STATE.camera.pitch = STATE.camera.defaultPitch;
      STATE.camera.distance = STATE.camera.defaultDistance;
      if (STATE.mode === 'FLIGHT' && primaryFlightBody()) {
        STATE.camera.target.copy(primaryFlightBody().position);
      }
      applyCameraOrbit();
    }

    function toggleSymmetry() {
      if (STATE.mode !== 'BUILD') return;
      const idx = SYMMETRY_MODES.indexOf(STATE.symmetry);
      STATE.symmetry = SYMMETRY_MODES[(idx + 1) % SYMMETRY_MODES.length];
      updateHUD();
      updateGhost();
      autoSave(false);
    }

    const blueprintController = BlueprintController.create({
      state: STATE, craft: CRAFT, document, storage: localStorage,
      defaultOrientation: DEFAULT_ORIENTATION,
      markers: { comSphere, axesHelper },
      callbacks: {
        cleanupFlightState, updateTelemetry, updateGhost, updateControlConfigurationUI,
        syncHudVisibility, resetToEmptyCraft, updateHUD, showStatus
      }
    });
    const {
      collectBlueprint, cloneBlueprint, blueprintSignature, updateHistoryButtons,
      commitHistory, restoreHistoryBlueprint, undoBlueprint, redoBlueprint,
      normalizeBlueprintData, loadBlueprintData, persistBlueprint, saveBlueprint,
      autoSave, flushPendingAutosave, loadBlueprint, newBlueprint, exportBlueprint, importBlueprintFile
    } = blueprintController;

    const missionController = MissionController.create({
      THREE, Physics, state: STATE, craft: CRAFT, document,
      landingPolicy: LANDING_POLICY, defaultOrientation: DEFAULT_ORIENTATION,
      missionMarkerGroup,
      services: {
        getContractById, isContractUnlocked, getSelectedContract, careerRank,
        recalculateCareerStars, saveCareer
      },
      callbacks: {
        computeCraftAnalysis, buildLoadedSnapshot, computeControlMetrics,
        collectBlueprint, cleanupFlightState, findOrientationId, commitHistory,
        updateTelemetry, autoSave, showStatus, updateHUD, disposeObjectTree,
        clearControlActions, setStabilize, setMode
      }
    });
    const {
      formatMissionTime, contractReadiness, loadStarterCraft, renderContractPanel,
      selectContract, clearMissionMarkers, createGateMarker, createLandingMarker,
      landingZonesForContract, prepareMissionMarkers, refreshMissionMarkerStates,
      isDebriefVisible, setHelpVisible, gateNormalVector, segmentCrossesGate,
      isStableHover, payloadHealthFraction, landingObjectiveText, missionObjectiveText,
      missionProgress, updateMissionHud, craftTiltDegrees, estimateCraftGroundClearance,
      currentCraftAltitude, landingSample, evaluateCraftLanding,
      evaluateCraftLandingZones, isCraftSettledAtAny, startMissionSession,
      calculateMissionStars, showDebrief, finishMission, updateMission,
      requestReturnToWorkshop, returnToWorkshopFromDebrief, retryContractFromDebrief
    } = missionController;

    const directionContainer = document.getElementById('direction-container');
    AXES.forEach((axis, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.axisIndex = String(index);
      btn.className = 'axis-btn';
      const label = AXIS_LABELS[index];
      const tone = Math.abs(axis.y) > 0.5 ? 'text-emerald-300' : (Math.abs(axis.z) > 0.5 ? 'text-sky-300' : 'text-rose-300');
      btn.innerHTML = `<span class="block text-sm ${tone}">${label}</span><span class="block text-[10px] text-gray-400">set direction</span>`;
      btn.addEventListener('click', () => setOrientationByVector(axis));
      directionContainer.appendChild(btn);
    });
    document.getElementById('btn-roll-orientation-left')?.addEventListener('click', () => applyBuildRotation(-1));
    document.getElementById('btn-roll-orientation-right')?.addEventListener('click', () => applyBuildRotation(1));

    const toolContainer = document.getElementById('tool-container');
    Object.keys(BLOCKS).forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tool = name;
      btn.className = `tool-btn ${name === STATE.selectedBlock ? 'active' : ''}`;
      const colorHex = `#${BLOCKS[name].color.toString(16).padStart(6, '0')}`;
      const displayName = name.replace(/([a-z])([A-Z])/g, '$1 $2');
      const shortcutIndex = name === 'Core' ? 0 : Object.keys(BLOCKS).filter(type => type !== 'Core').indexOf(name) + 1;
      btn.innerHTML = `
        <div class="w-6 h-6 rounded border border-white/30 shrink-0" style="background:${colorHex}"></div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-white leading-tight">${displayName}</div>
          <div class="text-[10px] text-gray-400">${BLOCKS[name].desc}</div>
        </div>
        <div class="text-[10px] font-mono text-slate-500">${shortcutIndex <= 9 ? shortcutIndex : ''}</div>
      `;
      btn.addEventListener('click', () => setSelectedTool(name));
      toolContainer.appendChild(btn);
    });

    renderer.domElement.addEventListener('pointerenter', () => {
      STATE.input.pointerInside = true;
      updateGhost();
    });

    renderer.domElement.addEventListener('pointerleave', () => {
      STATE.input.pointerInside = false;
      STATE.hovered.valid = false;
      updateGhost();
    });

    renderer.domElement.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' || isOverUI(event.target)) return;
      rayToNDC(event.clientX, event.clientY);
      STATE.input.downButton = event.button;
      STATE.input.downMoved = false;
      STATE.input.dragStartX = event.clientX;
      STATE.input.dragStartY = event.clientY;

      if (event.altKey || event.button === 1) {
        STATE.input.orbitDrag = true;
      }
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    });

    renderer.domElement.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || isOverUI(event.target)) return;
      rayToNDC(event.clientX, event.clientY);
      if (STATE.input.orbitDrag) {
        const dx = event.clientX - STATE.input.dragStartX;
        const dy = event.clientY - STATE.input.dragStartY;
        STATE.input.dragStartX = event.clientX;
        STATE.input.dragStartY = event.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          STATE.camera.yaw -= dx * 0.008;
          STATE.camera.pitch -= dy * 0.008;
          STATE.input.downMoved = true;
        }
      }
      if (STATE.mode === 'BUILD') updateGhost();
    });

    renderer.domElement.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch' || isOverUI(event.target)) return;
      rayToNDC(event.clientX, event.clientY);
      const orbitWasActive = STATE.input.orbitDrag;
      STATE.input.orbitDrag = false;
      if (!orbitWasActive && STATE.mode === 'BUILD' && !STATE.input.downMoved) {
        if (event.button === 0 || event.button === 2) performBuildAction(event.button);
      }
      STATE.input.downButton = -1;
      updateGhost();
    });

    renderer.domElement.addEventListener('pointercancel', () => {
      STATE.input.orbitDrag = false;
      STATE.input.downButton = -1;
    });

    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    renderer.domElement.addEventListener('wheel', (e) => {
      if (isOverUI(e.target)) return;
      STATE.camera.distance = THREE.MathUtils.clamp(STATE.camera.distance + e.deltaY * 0.01, 6, 55);
      updateGhost();
      e.preventDefault();
    }, { passive: false });

    document.getElementById('thruster-power').addEventListener('input', (e) => {
      setThrusterPower(Number(/** @type {HTMLInputElement} */ (e.target).value) / 100, { syncInput: false });
    });

    document.getElementById('balloon-power').addEventListener('input', (e) => {
      setBalloonPower(Number(/** @type {HTMLInputElement} */ (e.target).value) / 100, { syncInput: false });
    });

    document.getElementById('stability').addEventListener('input', (e) => {
      STATE.stabilityAssist = Number(/** @type {HTMLInputElement} */ (e.target).value) / 100;
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    });

    bindWorkspacePanels();
    bindInputProfileControls();
    applyWorkspaceLayout();
    document.getElementById('btn-flight').addEventListener('click', () => setMode('FLIGHT'));
    document.getElementById('btn-build').addEventListener('click', requestReturnToWorkshop);
    document.getElementById('btn-help').addEventListener('click', () => setHelpVisible(true));
    document.getElementById('close-help').addEventListener('click', () => setHelpVisible(false));
    document.getElementById('start-engineering').addEventListener('click', () => setHelpVisible(false));
    document.getElementById('btn-debrief-workshop').addEventListener('click', returnToWorkshopFromDebrief);
    document.getElementById('btn-debrief-retry').addEventListener('click', retryContractFromDebrief);
    document.getElementById('btn-starter-craft').addEventListener('click', loadStarterCraft);
    document.getElementById('btn-control-axis')?.addEventListener('click', cycleControlAxis);
    document.getElementById('btn-control-sign')?.addEventListener('click', cycleControlSign);
    document.getElementById('btn-symmetry').addEventListener('click', toggleSymmetry);
    document.getElementById('btn-save').addEventListener('click', () => saveBlueprint());
    document.getElementById('btn-load').addEventListener('click', () => {
      if (!loadBlueprint(true)) showStatus('LOAD ERROR', 1400);
    });
    document.getElementById('btn-clear').addEventListener('click', () => newBlueprint());
    document.getElementById('btn-undo')?.addEventListener('click', undoBlueprint);
    document.getElementById('btn-redo')?.addEventListener('click', redoBlueprint);
    document.getElementById('btn-export')?.addEventListener('click', exportBlueprint);
    document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('blueprint-file')?.click());
    document.getElementById('blueprint-file')?.addEventListener('change', event => {
      const input = /** @type {HTMLInputElement} */ (event.target);
      importBlueprintFile(input.files?.[0]);
      input.value = '';
    });



    function setThrusterPower(value, options = {}) {
      STATE.thrusterPower = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
      if (options.syncInput !== false) {
        /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = String(Math.round(STATE.thrusterPower * 100));
      }
      syncPowerControlReadouts();
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    }

    function adjustThrusterPower(delta) {
      setThrusterPower(STATE.thrusterPower + delta);
    }


    function setBalloonPower(value, options = {}) {
      STATE.balloonPower = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
      if (options.syncInput !== false) {
        /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = String(Math.round(STATE.balloonPower * 100));
      }
      syncPowerControlReadouts();
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    }

    function adjustBalloonPower(delta) {
      setBalloonPower(STATE.balloonPower + delta);
    }


    function controlActionForEvent(event) {
      return FlightControl.actionForInput(event.code, STATE.input.profile);
    }

    function controlAdjustmentForEvent(event) {
      return FlightControl.adjustmentForInput(event.code, STATE.input.profile);
    }


    window.addEventListener('keydown', event => {
      if (commitBindingCapture(event)) return;
      const key = event.key.toLowerCase();
      if (isDebriefVisible()) {
        if (event.key === 'Escape' || key === 'f') returnToWorkshopFromDebrief();
        return;
      }
      const helpVisible = document.getElementById('help-modal').style.display !== 'none';
      if (helpVisible) {
        if (event.key === 'Escape') setHelpVisible(false);
        return;
      }
      // Flight controls use the user profile. Modifier bindings such as Left Ctrl
      // are supported, while Flight Focus provides browser-level capture for chords.
      if (STATE.mode === 'FLIGHT') {
        const action = controlActionForEvent(event);
        if (action) {
          event.preventDefault();
          event.stopPropagation?.();
          setControlAction(action, true);
          return;
        }
        const adjustment = controlAdjustmentForEvent(event);
        if (adjustment?.target === 'thrusterPower' || adjustment?.target === 'balloonPower') {
          event.preventDefault();
          event.stopPropagation?.();
          const delta = adjustment.direction * AEROSTATICS.controlStep;
          if (adjustment.target === 'thrusterPower') adjustThrusterPower(delta);
          else adjustBalloonPower(delta);
          return;
        }
        if (event.repeat) return;
        if (key === 'g') {
          setStabilize(!STATE.pilot.stabilize);
        } else if (key === 'f') {
          requestReturnToWorkshop();
        } else if (event.key === 'Escape') {
          closeTopmostWorkspacePanel();
        }
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && key === 's') {
        event.preventDefault();
        saveBlueprint();
        return;
      }
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoBlueprint();
        else undoBlueprint();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        redoBlueprint();
        return;
      }

      if (event.repeat) return;
      if (key === 'c') {
        toggleContractPanel();
      } else if (key === 'r') {
        applyBuildRotation(event.shiftKey ? -1 : 1);
      } else if (event.key === 'Escape') {
        if (!closeTopmostWorkspacePanel()) setHelpVisible(false);
      } else if (key === 'f') {
        setMode('FLIGHT');
      } else if (key === 's') {
        saveBlueprint();
      } else if (key === 'x') {
        toggleSymmetry();
      } else if (event.key === '0') {
        setSelectedTool('Core');
      } else if (event.key === '1') {
        setSelectedTool('Hull');
      } else if (event.key === '2') {
        setSelectedTool('Frame');
      } else if (event.key === '3') {
        setSelectedTool('Thruster');
      } else if (event.key === '4') {
        setSelectedTool('Balloon');
      } else if (event.key === '5') {
        setSelectedTool('Wing');
      } else if (event.key === '6') {
        setSelectedTool('Gyro');
      } else if (event.key === '7') {
        setSelectedTool('Fuel');
      } else if (event.key === '8') {
        setSelectedTool('ControlSurface');
      } else if (event.key === '9') {
        setSelectedTool('VectorThruster');
      }
    });

    window.addEventListener('keyup', event => {
      const action = controlActionForEvent(event);
      if (action) setControlAction(action, false);
    });
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', clearControlActions);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearControlActions();
    });
    window.addEventListener('pagehide', () => {
      flushPendingAutosave();
      saveCareer();
      flushPendingSave();
    });

    function clamp01(value) {
      return Math.max(0, Math.min(1, value));
    }

    function cannonDot(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    function pointVelocityWorld(body, localPoint) {
      return Physics.getPointVelocity(body, localPoint);
    }

    function updateFlameVisibility() {
      for (const mod of STATE.flight.functionalBlocks) {
        if ((mod.type !== 'Thruster' && mod.type !== 'VectorThruster') || !mod.visual || !mod.attached) continue;
        const intensity = Math.max(0, mod.lastCommand || 0);
        const gimbal = mod.visual.getObjectByName('gimbalAssembly');
        if (gimbal) { gimbal.rotation.y = (mod.gimbalB || 0) * PHYSICS.gimbalAngle; gimbal.rotation.z = -(mod.gimbalA || 0) * PHYSICS.gimbalAngle; }
        mod.visual.traverse(obj => {
          if (!obj || (obj.name !== 'flame' && obj.name !== 'flameGlow')) return;
          const isGlow = obj.name === 'flameGlow';
          const baseScale = isGlow ? 1.15 : 0.95;
          const scaleBoost = 0.55 + intensity * (isGlow ? 0.55 : 0.85);
          obj.visible = STATE.mode === 'FLIGHT' && intensity > 0.01;
          obj.scale.setScalar(baseScale * scaleBoost);
          if (obj.material && 'opacity' in obj.material) {
            obj.material.opacity = obj.visible ? (isGlow ? 0.16 + intensity * 0.28 : 0.55 + intensity * 0.35) : 0;
          }
        });
      }
    }

    function computeThrusterCommand(mod, pilot) {
      const localAxis = [mod.localAxis.x, mod.localAxis.y, mod.localAxis.z];
      const neutralCommand = FlightControl.neutralCommand(localAxis, STATE.thrusterPower);
      const rotationalCommand = computeMixerCommandFromTorque(
        mod.localTorque,
        pilot,
        neutralCommand,
        STATE.flight.thrusterTorqueMax
      );
      return FlightControl.applyTranslationMix(
        localAxis,
        pilot,
        rotationalCommand,
        1
      );
    }

    function applyWingAerodynamics(body, mod) {
      const pointVelocity = pointVelocityWorld(body, mod.localPos);
      const speed = pointVelocity.length();
      if (speed < 0.25) return { lift: 0, drag: 0 };

      const chordWorld = Physics.vectorToWorldFrame(body, mod.localAxis).unit();
      const normalWorld = Physics.vectorToWorldFrame(body, mod.localNormal).unit();
      const spanWorld = Physics.vectorToWorldFrame(body, mod.localSpan).unit();
      const velocityDirection = pointVelocity.scale(1 / speed);
      const chordSpeed = cannonDot(pointVelocity, chordWorld);
      const normalSpeed = cannonDot(pointVelocity, normalWorld);
      const spanSpeed = cannonDot(pointVelocity, spanWorld);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);

      const dynamicPressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
      const health = runtimePartHealthFraction(mod);
      const liftMagnitude = dynamicPressure * mod.wingArea * coefficients.liftCoefficient * health;
      const mainDrag = dynamicPressure * mod.wingArea * coefficients.dragCoefficient * Math.max(0.25, health);
      const crossflowSpeedSq = normalSpeed * normalSpeed + spanSpeed * spanSpeed;
      const crossflowDrag = 0.5 * PHYSICS.airDensity * crossflowSpeedSq * mod.wingArea * PHYSICS.crossflowDragCoefficient;
      const dragMagnitude = mainDrag + crossflowDrag;

      const liftDirection = normalWorld.vsub(velocityDirection.scale(cannonDot(normalWorld, velocityDirection)));
      if (liftDirection.lengthSquared() < 0.0001) return { lift: 0, drag: Math.abs(dragMagnitude) };
      liftDirection.normalize();
      const worldPoint = Physics.pointToWorldFrame(body, mod.localPos);
      Physics.applyForce(body, liftDirection.scale(liftMagnitude), worldPoint);
      Physics.applyForce(body, velocityDirection.scale(-dragMagnitude), worldPoint);
      return { lift: Math.abs(liftMagnitude), drag: Math.abs(dragMagnitude) };
    }

    function applyControlSurfaceAerodynamics(body, mod) {
      if (!mod.attached) return { lift: 0, drag: 0 };
      const pointVelocity = pointVelocityWorld(body, mod.localPos);
      const speed = pointVelocity.length();
      const commandRaw = Number(STATE.pilot[mod.controlAxis]) || 0;
      if (speed < 0.35) {
        mod.controlDeflection = commandRaw * runtimePartHealthFraction(mod);
        const flap = mod.visual?.getObjectByName('controlFlapPivot');
        if (flap) flap.rotation.z = -mod.controlDeflection * PHYSICS.controlSurfaceMaxDeflection;
        return { lift: 0, drag: 0 };
      }
      const chordWorld = Physics.vectorToWorldFrame(body, mod.localAxis).unit();
      const normalWorld = Physics.vectorToWorldFrame(body, mod.localNormal).unit();
      const spanWorld = Physics.vectorToWorldFrame(body, mod.localSpan).unit();
      const velocityDirection = pointVelocity.scale(1 / speed);
      const chordSpeed = cannonDot(pointVelocity, chordWorld);
      const normalSpeed = cannonDot(pointVelocity, normalWorld);
      const spanSpeed = cannonDot(pointVelocity, spanWorld);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
      const targetAxis = controlAxisVector(mod.controlAxis);
      const torqueVector = new THREE.Vector3(mod.localPos.x, mod.localPos.y, mod.localPos.z).cross(new THREE.Vector3(mod.localNormal.x, mod.localNormal.y, mod.localNormal.z));
      const autoSign = Math.sign(torqueVector.dot(targetAxis)) || 1;
      const sign = mod.controlSign || autoSign;
      const health = runtimePartHealthFraction(mod);
      const command = commandRaw * sign * health;
      mod.controlDeflection = command;
      const dynamicPressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
      const liftCoefficient = coefficients.liftCoefficient * 0.45 * health + command * PHYSICS.controlSurfaceLiftGain;
      const liftMagnitude = dynamicPressure * mod.wingArea * liftCoefficient;
      const dragMagnitude = dynamicPressure * mod.wingArea * (0.045 + 0.12 * liftCoefficient * liftCoefficient + Math.abs(command) * 0.08)
        + 0.5 * PHYSICS.airDensity * (normalSpeed*normalSpeed + spanSpeed*spanSpeed) * mod.wingArea * PHYSICS.crossflowDragCoefficient;
      const liftDirection = normalWorld.vsub(velocityDirection.scale(cannonDot(normalWorld, velocityDirection)));
      if (liftDirection.lengthSquared() < 0.0001) return { lift: 0, drag: Math.abs(dragMagnitude) };
      liftDirection.normalize();
      const worldPoint = Physics.pointToWorldFrame(body, mod.localPos);
      Physics.applyForce(body, liftDirection.scale(liftMagnitude), worldPoint);
      Physics.applyForce(body, velocityDirection.scale(-dragMagnitude), worldPoint);
      const flap = mod.visual?.getObjectByName('controlFlapPivot');
      if (flap) flap.rotation.z = -command * PHYSICS.controlSurfaceMaxDeflection;
      return { lift: Math.abs(liftMagnitude), drag: Math.abs(dragMagnitude) };
    }

    function computeVectorThrusterForceCannon(mod, pilot, command) {
      const baseForce = mod.force * command * runtimePartHealthFraction(mod);
      const forward = mod.localAxis;
      if (baseForce <= 0) return forward.scale(0);
      const desired = Physics.vec3(pilot.roll || 0, pilot.yaw || 0, pilot.pitch || 0);
      const lateral = baseForce * Math.sin(PHYSICS.gimbalAngle);
      const torqueNormal = Physics.vec3();
      mod.localPos.cross(mod.localNormal.scale(lateral), torqueNormal);
      const torqueSpan = Physics.vec3();
      mod.localPos.cross(mod.localSpan.scale(lateral), torqueSpan);
      const desiredLength = THREE.MathUtils.clamp(desired.length(), 0, 1);
      const normalization = Math.max(0.0001, desired.length());
      let a = torqueNormal.lengthSquared() > 0.0001 ? cannonDot(desired, torqueNormal) / (normalization * torqueNormal.length()) * desiredLength : 0;
      let b = torqueSpan.lengthSquared() > 0.0001 ? cannonDot(desired, torqueSpan) / (normalization * torqueSpan.length()) * desiredLength : 0;
      const magnitude = Math.hypot(a, b);
      if (magnitude > 1) { a /= magnitude; b /= magnitude; }
      mod.gimbalA = a; mod.gimbalB = b;
      const forwardScale = Math.cos(PHYSICS.gimbalAngle * Math.min(1, Math.hypot(a,b)));
      return forward.scale(baseForce * forwardScale).vadd(mod.localNormal.scale(lateral*a)).vadd(mod.localSpan.scale(lateral*b));
    }

    function applyGyroControl(body) {
      const gyroCount = STATE.flight.gyroAuthority;
      if (gyroCount <= 0) return;

      const pilot = STATE.pilot;
      const manualTorque = gyroCount * PHYSICS.gyroManualTorque;
      const localAngularVelocity = Physics.vectorToLocalFrame(body, body.angularVelocity);
      const dampingStrength = gyroCount * (0.7 + STATE.stabilityAssist * 5.5 + (pilot.stabilize ? 6 : 0));
      const localTorque = Physics.vec3(
        pilot.roll * manualTorque - localAngularVelocity.x * dampingStrength,
        pilot.yaw * manualTorque - localAngularVelocity.y * dampingStrength,
        pilot.pitch * manualTorque - localAngularVelocity.z * dampingStrength
      );

      if (STATE.stabilityAssist > 0.001 || pilot.stabilize) {
        const craftUp = Physics.vectorToWorldFrame(body, Physics.vec3(0, 1, 0)).unit();
        const worldUp = Physics.vec3(0, 1, 0);
        const levelErrorWorld = Physics.vec3();
        craftUp.cross(worldUp, levelErrorWorld);
        const levelErrorLocal = Physics.vectorToLocalFrame(body, levelErrorWorld);
        const levelStrength = gyroCount * (STATE.stabilityAssist * 10 + (pilot.stabilize ? 18 : 0));
        localTorque.x += levelErrorLocal.x * levelStrength;
        localTorque.y += levelErrorLocal.y * levelStrength * 0.35;
        localTorque.z += levelErrorLocal.z * levelStrength;
      }

      const maxTorque = gyroCount * PHYSICS.gyroManualTorque * 3.2;
      const torqueLength = localTorque.length();
      if (torqueLength > maxTorque) localTorque.scale(maxTorque / torqueLength, localTorque);
      const worldTorque = Physics.vectorToWorldFrame(body, localTorque);
      Physics.addTorque(body, worldTorque);
    }

    function stepFlightPhysics(dt) {
      const body = primaryFlightBody();
      if (!body) return;

      const speed = body.velocity.length();
      let totalDrag = 0;
      if (speed > 0.001) {
        const dragMagnitude = 0.5 * PHYSICS.airDensity * PHYSICS.bodyDragCoefficient * STATE.flight.dragArea * speed * speed;
        const drag = body.velocity.scale(-dragMagnitude / speed);
        Physics.applyForce(body, drag, body.position);
        totalDrag += dragMagnitude;
      }

      const pilot = STATE.pilot;
      recomputeFlightIntegrity();
      const fuelBeforeLeak = STATE.flight.fuel;
      if (STATE.flight.leakingFuelRate > 0) STATE.flight.fuel = Math.max(0, STATE.flight.fuel - STATE.flight.leakingFuelRate * dt);
      if (fuelBeforeLeak > 0.000001 && STATE.flight.fuel <= 0.000001 && STATE.flight.leakingFuelRate > 0 && !STATE.flight.outOfFuel) {
        STATE.flight.outOfFuel = true;
        showStatus('FUEL LOST TO LEAK', 1800);
      }
      const thrusterJobs = [];
      const balloonJobs = [];
      let requestedFuel = 0;

      for (const mod of STATE.flight.functionalBlocks) {
        if (!mod.attached) continue;
        if (mod.type === 'Thruster' || mod.type === 'VectorThruster') {
          const command = computeThrusterCommand(mod, pilot);
          mod.lastCommand = command;
          const fuelNeed = mod.fuelRate * command * dt;
          requestedFuel += fuelNeed;
          thrusterJobs.push({ mod, command, fuelNeed });
        } else if (mod.type === 'Balloon') {
          const command = clamp01(STATE.balloonPower);
          mod.lastCommand = command;
          const fuelNeed = mod.fuelRate * command * dt;
          requestedFuel += fuelNeed;
          balloonJobs.push({ mod, command, fuelNeed });
        }
      }

      const hadFuel = STATE.flight.fuel > 0.000001;
      const fuelScale = requestedFuel > 0 ? Math.min(1, STATE.flight.fuel / requestedFuel) : 1;
      STATE.flight.fuel = Math.max(0, STATE.flight.fuel - requestedFuel * fuelScale);
      if (hadFuel && STATE.flight.fuel <= 0.000001 && requestedFuel > 0 && !STATE.flight.outOfFuel) {
        STATE.flight.outOfFuel = true;
        showStatus('OUT OF FUEL', 1800);
      }

      let totalThrust = 0;
      let totalLift = 0;
      for (const job of thrusterJobs) {
        if (!job.mod.attached) continue;
        const health = runtimePartHealthFraction(job.mod);
        const effectiveCommand = job.command * fuelScale;
        job.mod.lastCommand = effectiveCommand * health;
        const localForce = job.mod.type === 'VectorThruster'
          ? computeVectorThrusterForceCannon(job.mod, pilot, effectiveCommand)
          : job.mod.localAxis.scale(job.mod.force * effectiveCommand * health);
        const forceMagnitude = localForce.length();
        if (forceMagnitude <= 0) continue;
        const worldForce = Physics.vectorToWorldFrame(body, localForce);
        const worldPoint = Physics.pointToWorldFrame(body, job.mod.localPos);
        Physics.applyForce(body, worldForce, worldPoint);
        totalThrust += forceMagnitude;
      }

      const balloonEfficiency = Aerostatics.liftEfficiencyAtAltitude(currentAerostaticAltitude(), AEROSTATIC_POLICY);
      for (const job of balloonJobs) {
        const liftMagnitude = job.mod.force * job.command * fuelScale * runtimePartHealthFraction(job.mod) * balloonEfficiency;
        job.mod.lastCommand = job.command * fuelScale;
        if (liftMagnitude <= 0) continue;
        const worldPoint = Physics.pointToWorldFrame(body, job.mod.localPos);
        Physics.applyForce(body, Physics.vec3(0, liftMagnitude, 0), worldPoint);
        totalLift += liftMagnitude;
      }

      const aerostaticDamping = Aerostatics.verticalDampingForce({
        mass: STATE.flight.runtimeMass,
        verticalSpeed: body.velocity.y,
        commandedLift: totalLift,
        weight: STATE.flight.runtimeMass * AEROSTATIC_POLICY.gravity
      }, AEROSTATIC_POLICY);
      if (Math.abs(aerostaticDamping) > 1e-6) {
        Physics.applyForce(body, Physics.vec3(0, aerostaticDamping, 0), body.position);
      }

      for (const mod of STATE.flight.functionalBlocks) {
        if (!mod.attached || (mod.type !== 'Wing' && mod.type !== 'ControlSurface')) continue;
        const loads = mod.type === 'ControlSurface' ? applyControlSurfaceAerodynamics(body, mod) : applyWingAerodynamics(body, mod);
        totalLift += loads.lift;
        totalDrag += loads.drag;
      }

      applyGyroControl(body);
      STATE.flight.structuralAccumulator += dt;
      if (STATE.flight.structuralAccumulator >= PHYSICS.structuralCheckInterval) {
        applyStructuralLoadDamage(STATE.flight.structuralAccumulator, totalThrust, totalLift, totalDrag);
        STATE.flight.structuralAccumulator = 0;
      }
      const impact = STATE.flight.lastLoads.impact || 0;
      STATE.flight.lastLoads = { lift: totalLift, drag: totalDrag, thrust: totalThrust, impact };
    }


    function fitCameraToFlightTarget() {
      if (STATE.mode === 'FLIGHT' && primaryFlightBody()) {
        STATE.camera.target.lerp(primaryFlightBody().position, 0.08);
      } else {
        STATE.camera.target.lerp(STATE.camera.defaultTarget, 0.04);
      }
    }

    let physicsAccumulator = 0;
    let hudAccumulator = 0;
    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.08);

      if (STATE.mode === 'FLIGHT' && primaryFlightBody()) {
        if (!STATE.mission.paused) {
          physicsAccumulator = Math.min(physicsAccumulator + delta, PHYSICS.fixedDt * PHYSICS.maxSubSteps);
          let subSteps = 0;
          while (physicsAccumulator >= PHYSICS.fixedDt && subSteps < PHYSICS.maxSubSteps && !STATE.mission.paused) {
            stepFlightPhysics(PHYSICS.fixedDt);
            Physics.step(world, PHYSICS.fixedDt);
            processPendingImpacts();
            updateMission(PHYSICS.fixedDt);
            physicsAccumulator -= PHYSICS.fixedDt;
            subSteps += 1;
          }
        }
        syncFlightVisuals();
        syncDebris(delta);
        updateFlameVisibility();
        hudAccumulator += delta;
        if (hudAccumulator >= PHYSICS.hudRefreshInterval) {
          hudAccumulator = 0;
          updateFlightFeedback();
        }
      } else {
        physicsAccumulator = 0;
        hudAccumulator = 0;
      }

      fitCameraToFlightTarget();
      applyCameraOrbit();
      updateGhost();
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      applyWorkspaceLayout();
      updateFlightFeedback();
    });

    function loadDefaultsOrSave() {
      loadCareer();
      loadUIPreferences();
      const loaded = loadBlueprint();
      if (!loaded) {
        resetToEmptyCraft(false);
      }
      refreshRaycastList();
      updateTelemetry();
      syncInputProfileUI();
      applyWorkspaceLayout();
      updateHUD();
      syncHudVisibility();
      syncContractPanelVisibility();
      updateFlightFeedback();
      applyCameraOrbit();
      updateGhost();
      updateHistoryButtons();
    }

    const clock = new THREE.Clock();
    STATE.uiCollapsed = false;
    syncHudVisibility();
    loadDefaultsOrSave();
    animate();
