'use strict';

    if (!window.VAW) throw new Error('Foundation kernel was not initialized before game.js.');

    const SceneEnvironment = window.VAW.require('game.scene-environment');
    const CareerService = window.VAW.require('game.career-service');
    const WorkspaceController = window.VAW.require('game.workspace-controller');
    const InputSettingsController = window.VAW.require('game.input-settings-controller');
    const CameraController = window.VAW.require('game.camera-controller');
    const BT = window.VAW.require('game.build-targeting');
    const OrientationService = window.VAW.require('game.orientation-service');
    const VisualAssetRegistry = window.VAW.require('game.visual-asset-registry');
    const VisualAssetLoader = window.VAW.require('game.visual-asset-loader');
    const VisualRuntimeAdapter = window.VAW.require('game.visual-runtime-adapter');
    const ModuleVisualFactory = window.VAW.require('game.module-visual-factory');
    const AssemblySpaceController = window.VAW.require('game.assembly-space-controller');
    const EngineeringAnalysis = window.VAW.require('game.engineering-analysis');
    const BlueprintController = window.VAW.require('game.blueprint-controller');
    const MissionController = window.VAW.require('game.mission-controller');
    const FlightSession = window.VAW.require('game.flight-session');
    const FlightThrusterRouter = window.VAW.require('game.flight-thruster-router');
    const FlightMechanicalVisuals = window.VAW.require('game.flight-mechanical-visuals');
    const FlightIntegrity = window.VAW.require('game.flight-integrity');
    const DebrisRuntime = window.VAW.require('game.debris-runtime');

    const Config = window.VAW.require('foundation.config');
    const Catalog = window.VAW.require('foundation.catalog');
    const Orientation = window.VAW.require('foundation.orientation');
    const Blueprint = window.VAW.require('foundation.blueprint');
    const AssemblySpaces = window.VAW.require('foundation.assembly-spaces');
    const ControlFrame = window.VAW.require('foundation.control-frame');
    const MassProperties = window.VAW.require('foundation.mass-properties');
    const CraftCompiler = window.VAW.require('foundation.craft-compiler');
    const RuntimeAssembly = window.VAW.require('foundation.runtime-assembly');
    const AssemblyBuilder = window.VAW.require('runtime.assembly-builder');
    const InputProfile = window.VAW.require('foundation.input-profile');
    const UIWorkspace = window.VAW.require('foundation.ui-workspace');
    const MissionEvaluator = window.VAW.require('foundation.mission-evaluator');
    const Aerostatics = window.VAW.require('foundation.aerostatics');
    const FlightControl = window.VAW.require('foundation.flight-control');
    const FixedStepScheduler = window.VAW.require('foundation.fixed-step-scheduler');
    const State = window.VAW.require('foundation.state');
    const { Physics } = window.VAW.require('runtime.active-context');

    const {
      GRID, SAVE_VERSION, SAVE_KEY, LEGACY_SAVE_KEYS,
      CAREER_SAVE_KEY, CAREER_SAVE_VERSION, UI_SAVE_VERSION, UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS,
      COLLISION_GROUP, TEST_RANGE, MISSION, AEROSTATICS,
      MISSION_PAYLOAD_POSITION, PHYSICS, AXIS_LABELS,
      SYMMETRY_MODES, CONTROL_AXES, CONTROL_SIGNS
    } = Config;
    const { BLOCKS, CONTRACTS } = Catalog;
    const LANDING_POLICY = MissionEvaluator.normalizeLandingPolicy(MISSION.landing);
    const AEROSTATIC_POLICY = Aerostatics.normalizePolicy(AEROSTATICS);
    const {
      AXES, ORIENTATION_BASES, DEFAULT_ORIENTATION,
      findOrientationId
    } = Orientation;
    const STATE = State.createInitialState();
    const CRAFT = STATE.craft;
    const WORKSHOP = STATE.workshop;
    let assemblySpaceController = null;

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

    function activeAssemblySpaceId() { return assemblySpaceController?.activeAssemblySpaceId() || AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID; }
    function makeKey(x, y, z, assemblySpaceId = activeAssemblySpaceId()) { return Blueprint.makeOwnedKey(assemblySpaceId, x, y, z); }
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
      updateInputAxis, commitBindingCapture, handleFullscreenChange, bindInputProfileControls,
      isEditableInteractionActive, releaseEditableInteraction
    } = inputSettingsController;

    const cameraController = CameraController.create({ state: STATE, camera, THREE, document, saveUIPreferences, showStatus, primaryFlightBodyId, primaryFlightTransform });
    const { normalizeCameraState, clampCameraPitch, applyCameraOrbit, syncCameraControls, setCameraMode, setCameraFollowStrength, resetCamera, panCameraTargetByPixels, fitCameraToFlightTarget } = cameraController;

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

    function primaryFlightBodyId() {
      return flightSession.isActive() ? flightSession.primaryBodyId() : null;
    }

    function primaryFlightTransform() {
      const bodyId = primaryFlightBodyId();
      return bodyId ? flightSession.getBodyTransform(bodyId) : null;
    }

    function primaryFlightVelocity() {
      const bodyId = primaryFlightBodyId();
      return bodyId ? flightSession.getBodyLinearVelocity(bodyId) : null;
    }

    function currentAerostaticAltitude() {
      const transform = primaryFlightTransform();
      return transform ? Math.max(0, transform.position.y - TEST_RANGE.groundY) : 0;
    }

    function verticalSupportSample() {
      const flight = STATE.mode === 'FLIGHT' && primaryFlightBodyId();
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
      const bodyId = primaryFlightBodyId();
      const velocity = bodyId ? flightSession.getBodyLinearVelocity(bodyId) : null;
      const transform = bodyId ? flightSession.getBodyTransform(bodyId) : null;
      const speed = velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : 0;
      const pitch = STATE.controlIntent.pitch || 0;
      const yaw = STATE.controlIntent.yaw || 0;
      const roll = STATE.controlIntent.roll || 0;
      const surge = STATE.controlIntent.surge || 0;
      const sway = STATE.controlIntent.sway || 0;
      const liftCommand = STATE.controlIntent.lift || 0;

      let tiltDegrees = 0;
      if (transform) {
        const attitude = new THREE.Quaternion(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
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
      setText('ui-altitude', bodyId ? `${currentCraftAltitude().toFixed(1)} m` : '0.0 m');
      setText('ui-vertical-speed', velocity ? `${velocity.y >= 0 ? '+' : ''}${velocity.y.toFixed(1)} m/s` : '0.0 m/s');
      const loads = STATE.flight.lastLoads || { lift: 0, drag: 0, thrust: 0, impact: 0 };
      setText('ui-loads', `${Math.round(loads.thrust)} / ${Math.round(loads.lift)} / ${Math.round(loads.drag)} N`);
      const payloadText = STATE.flight.payload?.attached ? ` • cargo ${Math.round(payloadHealthFraction() * 100)}%` : (STATE.flight.payload ? ' • cargo lost' : '');
      setText('ui-damage-status', STATE.mode === 'FLIGHT' ? `${STATE.flight.lostParts} lost • ${STATE.flight.leakingFuelRate.toFixed(2)}/s leak${payloadText}` : 'No active damage');
      const timing = fixedStepScheduler.snapshot();
      setText('ui-simulation-health', timing.droppedSeconds > 0 ? `${timing.droppedSeconds.toFixed(2)} s dropped • ${timing.overloadFrames} overloads` : 'Healthy');
      if (bodyId && STATE.mode === 'FLIGHT') {
        syncTelemetryMassAndBlockReadouts();
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
      const orientationUi = orientationService.semanticOrientationReadout(STATE.selectedBlock, STATE.orientation, STATE.controlAxis, STATE.controlSign);
      document.getElementById('ui-orientation').textContent = orientationUi.axis;
      const axisName = document.getElementById('ui-orientation-label'); if (axisName) axisName.textContent = orientationUi.axisLabel;
      const hint = document.getElementById('ui-orientation-hint'); if (hint) hint.textContent = orientationUi.hint;
      const rollRelevant = partUsesRoll(STATE.selectedBlock);
      const rollReadout = document.getElementById('ui-roll-orientation');
      if (rollReadout) rollReadout.textContent = rollRelevant ? orientationUi.up : 'N/A';
      const rollName = document.getElementById('ui-roll-label'); if (rollName) rollName.textContent = orientationUi.upLabel;
      document.getElementById('ui-symmetry').textContent = STATE.symmetry;
      syncPowerControlReadouts();

      const buildButton = (document.getElementById('btn-build'));
      const flightButton = (document.getElementById('btn-flight'));
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
        const btn = (element);
        const axisIndex = Number(btn.dataset.axisIndex);
        btn.classList.toggle('active', orientationRelevant && selectedForward.dot(AXES[axisIndex]) > 0.999);
        btn.disabled = !orientationRelevant;
      });
      const rollLeft = (document.getElementById('btn-roll-orientation-left'));
      const rollRight = (document.getElementById('btn-roll-orientation-right'));
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

    const visualAssetRegistry=VisualAssetRegistry.create();
    const visualAssetLoader = VisualAssetLoader.create({THREE,visualAssetRegistry,disposeObjectTree,logger:console});
    visualAssetLoader.bootstrapInstalledPacks().catch(console.warn);
    const visualRuntimeAdapter=VisualRuntimeAdapter.create();
    const moduleVisualFactory=ModuleVisualFactory.create({THREE,sharedGeometry,cloneMaterial,visualAssetRegistry});
    const { createModuleVisual } = moduleVisualFactory;
    window.VAW.require('game.visual-asset-dev-controls').create({visualAssetLoader,showStatus,document,window});

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
        assemblySpaceId: activeAssemblySpaceId(),
        x: p.x,
        y,
        z: p.z,
        type,
        orientation: mirrorOrientation(orientation, p.mirrorX, p.mirrorZ, type),
        controlAxis: type === 'ControlSurface' ? STATE.controlAxis : 'pitch',
        controlSign: type === 'ControlSurface' ? STATE.controlSign : 0
      }));
    }

    function canPlacePlan(plan) { return BT.validationFeedback(CRAFT.validateAddMany(plan)); }

    function refreshRaycastList() {
      WORKSHOP.rootMeshes.length = 0;
      for (const mesh of WORKSHOP.meshesByKey.values()) addRootMesh(mesh);
    }

    function addWorkshopVisual(block) {
      if (!block || WORKSHOP.meshesByKey.has(block.key)) return WORKSHOP.meshesByKey.get(block?.key) || null;
      const mesh = createModuleVisual(block.type, block.orientation);
      mesh.userData.blockKey = block.key;
      assemblySpaceController.attachBlockVisual(block, mesh);
      WORKSHOP.meshesByKey.set(block.key, mesh);
      addRootMesh(mesh);
      visualAssetLoader.attachImportedVisual(mesh);
      return mesh;
    }

    function removeWorkshopVisual(blockOrKey) {
      const key = typeof blockOrKey === 'string' ? blockOrKey : blockOrKey?.key;
      if (!key) return false;
      const mesh = WORKSHOP.meshesByKey.get(key);
      if (!mesh) return false;
      assemblySpaceController.detachBlockVisual(mesh);
      removeRootMesh(mesh);
      WORKSHOP.meshesByKey.delete(key);
      disposeObjectTree(mesh);
      return true;
    }

    function disposeMechanicalLinkVisual(linkId) {
      const visual = WORKSHOP.mechanicalLinkVisualsById.get(String(linkId));
      if (!visual) return false;
      scene.remove(visual);
      WORKSHOP.mechanicalLinkVisualsById.delete(String(linkId));
      disposeObjectTree(visual);
      return true;
    }

    function createMechanicalLinkVisual(link) {
      const blockA = CRAFT.getById(link.endpointA.blockId);
      const blockB = CRAFT.getById(link.endpointB.blockId);
      if (!blockA || !blockB) return null;
      const pointA = assemblySpaceController.blockRootPosition(blockA);
      const pointB = assemblySpaceController.blockRootPosition(blockB);
      const midpoint = new THREE.Vector3((pointA[0] + pointB[0]) * 0.5, (pointA[1] + pointB[1]) * 0.5, (pointA[2] + pointB[2]) * 0.5);
      const ownerAxis = Blueprint.FACE_VECTORS[link.axis] || [0, 1, 0];
      const axis = assemblySpaceController.spaceVectorToRoot(link.assemblySpaceId, ownerAxis);
      const group = new THREE.Group();
      group.userData.mechanicalLinkId = link.mechanicalLinkId;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          midpoint.clone().add(new THREE.Vector3(...axis).multiplyScalar(-0.58)),
          midpoint.clone().add(new THREE.Vector3(...axis).multiplyScalar(0.58))
        ]),
        new THREE.LineBasicMaterial({ color: 0x22d3ee })
      );
      const pivot = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      pivot.position.copy(midpoint);
      group.add(line, pivot);
      scene.add(group);
      WORKSHOP.mechanicalLinkVisualsById.set(link.mechanicalLinkId, group);
      return group;
    }

    function refreshMechanicalLinkList() {
      const select = document.getElementById('mechanical-link-list');
      if (!select) return;
      const previous = select.value;
      select.innerHTML = '';
      const links = CRAFT.mechanicalLinks();
      if (!links.length) {
        const option = document.createElement('option'); option.value = ''; option.textContent = 'NO LINKS'; select.appendChild(option);
      } else {
        for (const link of links) {
          const option = document.createElement('option');
          option.value = link.mechanicalLinkId;
          option.textContent = `${link.mechanicalLinkId} • ${link.axis}`;
          select.appendChild(option);
        }
        if (links.some(link => link.mechanicalLinkId === previous)) select.value = previous;
      }
    }

    function rebuildMechanicalLinkVisuals() {
      for (const linkId of [...WORKSHOP.mechanicalLinkVisualsById.keys()]) disposeMechanicalLinkVisual(linkId);
      for (const link of CRAFT.mechanicalLinks()) createMechanicalLinkVisual(link);
      refreshMechanicalLinkList();
    }

    function rebuildWorkshopView() {
      assemblySpaceController.syncRoots();
      for (const mesh of WORKSHOP.meshesByKey.values()) {
        scene.remove(mesh);
        disposeObjectTree(mesh);
      }
      WORKSHOP.meshesByKey.clear();
      WORKSHOP.rootMeshes.length = 0;
      for (const block of CRAFT.values()) addWorkshopVisual(block);
      refreshRaycastList();
      rebuildMechanicalLinkVisuals();
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
        assemblySpaceController?.syncRoots();
        for (const block of event.removed) removeWorkshopVisual(block);
        for (const change of event.updated) removeWorkshopVisual(change.before);
        for (const block of event.added) addWorkshopVisual(block);
        for (const change of event.updated) addWorkshopVisual(change.after);
        refreshRaycastList();
        if (event.mechanicalLinksAdded.length || event.mechanicalLinksRemoved.length || event.mechanicalLinksUpdated.length || event.updated.length) rebuildMechanicalLinkVisuals();
        assertWorkshopViewConsistency();
      } catch (error) {
        console.error('Incremental workshop view update failed; rebuilding from CraftModel.', error);
        rebuildWorkshopView();
        assertWorkshopViewConsistency();
      }
    }

    CRAFT.subscribe(handleCraftModelChange);

    function syncTelemetryMassAndBlockReadouts(analysis = STATE.flight.analysis) {
      const massEl = document.getElementById('ui-mass');
      const blocksEl = document.getElementById('ui-blocks');
      if (STATE.mode === 'FLIGHT') {
        const runtimeMass = Number.isFinite(STATE.flight.runtimeMass) && STATE.flight.runtimeMass > 0 ? STATE.flight.runtimeMass : (analysis?.mass || 0);
        const activeBlocks = Math.max(0, Math.round(STATE.flight.blockCount || 0));
        const lostParts = Math.max(0, Math.round(STATE.flight.lostParts || 0));
        if (massEl) massEl.textContent = `${runtimeMass.toFixed(1)} kg`;
        if (blocksEl) blocksEl.textContent = lostParts > 0 ? `${activeBlocks} active • ${lostParts} lost` : `${activeBlocks} active`;
        return;
      }
      if (massEl) massEl.textContent = `${(analysis?.mass || 0).toFixed(1)} kg`;
      if (blocksEl) blocksEl.textContent = String(CRAFT.size);
    }

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

      syncTelemetryMassAndBlockReadouts(analysis);

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
      document.querySelectorAll('.tool-btn').forEach(element => element.classList.toggle('active', element.dataset.tool === tool));
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

    const flightSession = FlightSession.create({
      state: STATE,
      RuntimeAssembly,
      AssemblyBuilder,
      Physics,
      world,
      removeVisualRoot(root) {
        scene.remove(root);
        disposeObjectTree(root);
        return true;
      }
    });

    const flightThrusterRouter = FlightThrusterRouter.create({ flightSession });
    const flightMechanicalVisuals = FlightMechanicalVisuals.create({
      flightSession,
      createVisual(constraint) {
        const group = new THREE.Group();
        group.userData.runtimeMechanicalLinkId = constraint.mechanicalLinkId;
        const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x22d3ee }));
        const pivotA = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
        const pivotB = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        group.userData.line = line; group.userData.pivotA = pivotA; group.userData.pivotB = pivotB;
        group.add(line, pivotA, pivotB); scene.add(group);
        return group;
      },
      updateVisual(group, { endpointA, endpointB }) {
        const a = new THREE.Vector3(endpointA.x, endpointA.y, endpointA.z), b = new THREE.Vector3(endpointB.x, endpointB.y, endpointB.z);
        group.userData.line.geometry.setFromPoints([a, b]);
        group.userData.pivotA.position.copy(a); group.userData.pivotB.position.copy(b);
        group.userData.endpointA = { x: a.x, y: a.y, z: a.z }; group.userData.endpointB = { x: b.x, y: b.y, z: b.z };
      },
      disposeVisual(group) { scene.remove(group); disposeObjectTree(group); },
      onDiagnostic(diagnostic) { if (diagnostic?.error) console.warn(diagnostic.code, diagnostic.error); }
    });

    const debrisRuntime = DebrisRuntime.create({
      Physics, world, scene, disposeObjectTree,
      maxLifetime: PHYSICS.debrisLifetime,
      collisionGroup: COLLISION_GROUP.debris,
      collisionMask: COLLISION_GROUP.world | COLLISION_GROUP.craft
    });

    const flightIntegrity = FlightIntegrity.create({
      state: STATE,
      flightSession,
      MassProperties,
      makeKey,
      clamp: THREE.MathUtils.clamp,
      hooks: {
        onDiagnostic(diagnostic) {
          if (diagnostic?.error) console.error(`FlightIntegrity hook failed: ${diagnostic.hook || 'unknown'}`, diagnostic.error);
          else if (diagnostic?.code) console.warn(`FlightIntegrity diagnostic: ${diagnostic.code}`, diagnostic);
        },
        onPartDamaged(part) { updateRuntimePartVisual(part); },
        onPartDetached(part) { createDetachedDebris(part); },
        onRecenter() { recomputeThrusterTorqueEnvelope(); },
        onDetachBatch(count) {
          if (count > 0) showStatus(count === 1 ? 'MODULE LOST' : `${count} MODULES LOST`, 1100);
        },
        onPayloadDamaged() { updatePayloadVisual(); },
        onPayloadDetached(payload) {
          const root = flightSession.getVisualRoot(payload.bodyId);
          if (payload.coupler) {
            root?.remove(payload.coupler);
            disposeObjectTree(payload.coupler);
            payload.coupler = null;
          }
          if (payload.visual) {
            createDebrisFromVisual(payload.visual, payload.mass, payload.bodyLocalPosition, payload.bodyId);
            payload.visual = null;
          }
          showStatus('PAYLOAD LOST', 1500);
        },
        createDebris(descriptor) { return debrisRuntime.spawn(descriptor); },
        updateDebris(entry, dt) { return debrisRuntime.update(entry, dt); },
        disposeDebris(entry) { return debrisRuntime.dispose(entry); }
      }
    });

    function cleanupFlightState() {
      flightIntegrity.disposeAllDebris();
      flightSession.stop();
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
      STATE.flight.runtimeParts = [];
      STATE.flight.runtimePartById = new Map();
      STATE.flight.runtimePartsByBodyId = new Map();
      STATE.flight.currentInertia.set(0, 0, 0);
      STATE.flight.lostParts = 0;
      STATE.flight.leakingFuelRate = 0;
      STATE.flight.firstFailure = '';
      STATE.flight.structuralFailures = 0;
      STATE.flight.initialHealth = 0;
      STATE.flight.gyroAuthority = 0;
      STATE.flight.payloadBodyLocalPosition = null;
      STATE.flight.payload = null;
      STATE.flight.pendingImpacts = [];
      STATE.flight.structuralAccumulator = 0;
      fixedStepScheduler.reset({ resetMetrics: true });
      STATE.flight.runtimePartByKey = new Map();
      STATE.flight.metricsDirty = true;
      thrustSphere.visible = false;
      liftSphere.visible = false;
      thrustVectorArrow.visible = false;
      liftVectorArrow.visible = false;
      for (const mesh of WORKSHOP.meshesByKey.values()) mesh.visible = true;
      clearPilotAxes();
      setStabilize(false);
      return true;
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
      const validation = canPlacePlan(plan);
      if (!validation.ok) { showStatus(BT.placementFeedback(validation).status, 1300); return false; }
      const historyBefore = collectBlueprint();
      const placed = CRAFT.addMany(plan, 'place-blocks');
      if (!placed.ok) { showStatus(BT.placementFeedback(BT.validationFeedback(placed)).status, 1300); return false; }

      commitHistory(historyBefore);
      STATE.statusText = 'DRYDOCK';
      updateTelemetry();
      updateGhost();
      autoSave(false);
      return true;
    }

    function flashInvalid(mesh) {
      let target = null;
      mesh?.traverse?.(object => {
        if (target) return;
        const materials = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
        target = materials.find(material => material?.emissive && typeof material.emissive.getHex === 'function') || null;
      });
      if (!target) return;
      const original = target.emissive.getHex();
      target.emissive.setHex(0xff0000);
      setTimeout(() => {
        if (target?.emissive) target.emissive.setHex(original);
      }, 160);
    }

    function removeBlock(x, y, z) {
      if (STATE.mode !== 'BUILD') return false;
      const key = typeof x === 'string' ? x : makeKey(snapInt(x), snapInt(y), snapInt(z));
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
    function hitOk(target) { WORKSHOP.lastTargetResult = BT.targetOk({ target }); return target; }
    function hitFail(reason, details) { WORKSHOP.lastTargetResult = BT.targetFail(reason, details); return null; }
    function raycastBuildTarget(ndc) {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([basePlane, ...WORKSHOP.rootMeshes], true);
      if (!hits.length) return hitFail('no-hit');

      const hit = hits[0];
      if (hit.object === basePlane || hit.object.userData.isBuildSurface) {
        const local = assemblySpaceController.rootPointToActive([hit.point.x, hit.point.y, hit.point.z]);
        const target = {
          kind: 'surface',
          position: new THREE.Vector3(snapInt(local[0]), snapInt(local[1]), snapInt(local[2])),
          root: null,
          normal: new THREE.Vector3(0, 1, 0)
        };
        return hitOk(target);
      }

      const voxelRootMesh = getRootVoxelFromHit(hit.object);
      if (!voxelRootMesh || !hit.face) return hitFail('no-face');

      const clickedBlock = CRAFT.get(voxelRootMesh.userData.blockKey);
      const activeSpaceId = activeAssemblySpaceId();
      if (!clickedBlock) return hitFail('invalid-block', { blockKey: voxelRootMesh.userData.blockKey });
      if (clickedBlock.assemblySpaceId !== activeSpaceId) return hitFail('wrong-assembly-space', { activeSpaceId, hitAssemblySpaceId: clickedBlock.assemblySpaceId, blockId: clickedBlock.blockId });
      const hitObjectLocalNormal = hit.face.normal.clone();
      const sceneNormal = hitObjectLocalNormal.clone().transformDirection(hit.object.matrixWorld);
      const gridResult = BT.sceneNormalToActiveGridNormal(sceneNormal, activeSpaceId, (id, vector) => assemblySpaceController.rootVectorToSpace(id, vector));
      if (!gridResult.ok) { WORKSHOP.lastTargetResult = gridResult; return null; }
      const gridNormal = gridResult.gridNormal;
      const placementCell = BT.placementCellFromNormal(clickedBlock, gridNormal);
      const position = new THREE.Vector3(snapInt(placementCell.x), snapInt(placementCell.y), snapInt(placementCell.z));
      if (position.y < GRID.minY) position.y = GRID.minY;
      const normal = new THREE.Vector3(gridNormal[0], gridNormal[1], gridNormal[2]);
      return hitOk({ kind: 'voxel', position, root: voxelRootMesh, normal, block: clickedBlock });
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
        for (const visual of WORKSHOP.mechanicalLinkVisualsById.values()) visual.visible = false;
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
        document.getElementById('ui-adj').textContent = BT.placementFeedback(WORKSHOP.lastTargetResult).ui;
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
      const placement = canPlacePlan(plan);
      const valid = placement.ok;
      ghost.material.opacity = valid ? 0.55 : 0.2;
      updateSymmetryGhosts(plan, valid);
      document.getElementById('ui-adj').textContent = BT.placementFeedback(placement, plan.length).ui;

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
      return flightIntegrity.healthFraction(part);
    }

    function updateRuntimePartVisual(part) {
      if (!part?.visual) return;
      visualRuntimeAdapter.setDamageTint(part.visual, runtimePartHealthFraction(part), { redScale: 0.72, green: 0.02, blue: 0.01 });
    }

    function markFlightMetricsDirty() {
      STATE.flight.metricsDirty = true;
    }

    function getRuntimeCore() {
      return flightIntegrity.getRuntimeCore();
    }

    function recomputeFlightIntegrity(force = false) {
      return flightIntegrity.recompute(force);
    }

    function createDebrisFromVisual(visual, mass, bodyLocalPosition, bodyId = flightSession.primaryBodyId()) {
      const group = flightSession.getVisualRoot(bodyId);
      if (!flightSession.hasBody(bodyId) || !group || !visual) return;
      const worldPosition = flightSession.pointToWorldFrame(bodyId, bodyLocalPosition);
      const worldVelocity = flightSession.getBodyPointVelocity(bodyId, bodyLocalPosition);
      const angularVelocity = flightSession.getBodyAngularVelocity(bodyId);
      const transform = flightSession.getBodyTransform(bodyId);
      const craftQuaternion = new THREE.Quaternion(
        transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w
      );
      const localPosition = visual.position.clone();
      const localQuaternion = visual.quaternion.clone();
      const worldQuaternion = craftQuaternion.multiply(localQuaternion.clone());
      group.remove(visual);
      if (STATE.flight.debris.length >= PHYSICS.maxPhysicalDebris) {
        disposeObjectTree(visual);
        return;
      }
      try {
        flightIntegrity.createDebris({
          visual,
          mass,
          worldPosition,
          worldVelocity,
          angularVelocity: {
            x: angularVelocity.x + (Math.random() - 0.5) * 2.5,
            y: angularVelocity.y + (Math.random() - 0.5) * 2.5,
            z: angularVelocity.z + (Math.random() - 0.5) * 2.5
          },
          worldQuaternion,
          sourceBodyId: bodyId
        });
      } catch (error) {
        group.add(visual);
        visual.position.copy(localPosition);
        visual.quaternion.copy(localQuaternion);
        throw error;
      }
    }

    function createDetachedDebris(part) {
      if (!part?.visual) return;
      createDebrisFromVisual(part.visual, part.mass, part.bodyLocalPosition, flightIntegrity.requireOwnedPart(part));
      part.visual = null;
    }

    function recomputeThrusterTorqueEnvelope() {
      const max = new THREE.Vector3();
      for (const part of STATE.flight.functionalBlocks) {
        if (!part.attached || !part.pilotControlled || (part.type !== 'Thruster' && part.type !== 'VectorThruster')) continue;
        const force = Physics.vec3(part.localAxis.x * part.force, part.localAxis.y * part.force, part.localAxis.z * part.force);
        const torque = Physics.vec3();
        part.bodyLocalPosition.cross(force, torque);
        part.localTorque.copy(torque);
        max.x = Math.max(max.x, Math.abs(torque.x));
        max.y = Math.max(max.y, Math.abs(torque.y));
        max.z = Math.max(max.z, Math.abs(torque.z));
      }
      STATE.flight.thrusterTorqueMax.copy(max);
    }

    function detachRuntimeParts(entries, cascade = true) {
      return flightIntegrity.detachParts(entries, cascade);
    }

    function applyDamageOnly(part, amount, reason = 'impact') {
      return flightIntegrity.applyDamageOnly(part, amount, reason);
    }

    function updatePayloadVisual() {
      const payload = STATE.flight.payload;
      if (!payload?.visual) return;
      visualRuntimeAdapter.setDamageTint(payload.visual, payloadHealthFraction(), { redScale: 0.8, green: 0.03, blue: 0.01 });
    }

    function detachPayload(reason = 'payload mount failure') {
      return flightIntegrity.detachPayload(reason);
    }

    function damagePayload(amount, reason = 'impact') {
      return flightIntegrity.damagePayload(amount, reason);
    }

    function applyImpactDamage(bodyId, localImpact, impact, collisionKind = 'ground') {
      const candidates = (STATE.flight.runtimePartsByBodyId.get(String(bodyId)) || []).filter(part => part.attached);
      if (!candidates.length) return;
      let nearest = candidates[0];
      let nearestDistance = Infinity;
      for (const part of candidates) {
        const dx = part.bodyLocalPosition.x - localImpact.x;
        const dy = part.bodyLocalPosition.y - localImpact.y;
        const dz = part.bodyLocalPosition.z - localImpact.z;
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance < nearestDistance) { nearestDistance = distance; nearest = part; }
      }
      const payload = STATE.flight.payload;
      let payloadNearest = false;
      if (payload?.attached && payload.bodyId === bodyId) {
        const dx = payload.bodyLocalPosition.x - localImpact.x;
        const dy = payload.bodyLocalPosition.y - localImpact.y;
        const dz = payload.bodyLocalPosition.z - localImpact.z;
        payloadNearest = dx * dx + dy * dy + dz * dz < nearestDistance;
      }
      const multiplier = collisionKind === 'obstacle' ? 4.4 : (collisionKind === 'debris' ? 3.7 : 3.2);
      const energyDamage = Math.max(0, (impact - 3.5) ** 2 * multiplier);
      if (energyDamage <= 0) return;
      const reason = collisionKind === 'obstacle' ? 'collision with range obstacle' : (collisionKind === 'debris' ? 'collision with debris' : 'hard landing');
      const failures = [];
      if (payloadNearest) {
        damagePayload(energyDamage * 0.72, reason);
        const core = getRuntimeCore();
        if (core?.bodyId === bodyId && applyDamageOnly(core, energyDamage * 0.18, 'payload mount transferred impact')) failures.push({ part: core, reason: 'payload mount transferred impact' });
      } else {
        if (applyDamageOnly(nearest, energyDamage, reason)) failures.push({ part: nearest, reason });
        for (const neighborId of nearest.rigidNeighborBlockIds || []) {
          const neighbor = STATE.flight.runtimePartById.get(neighborId);
          if (neighbor?.attached && neighbor.bodyId === bodyId && applyDamageOnly(neighbor, energyDamage * PHYSICS.damagePropagation, 'load propagated through rigid connection')) {
            failures.push({ part: neighbor, reason: 'load propagated through rigid connection' });
          }
        }
      }
      if (failures.length) detachRuntimeParts(failures, true);
      recomputeFlightIntegrity(true);
    }

    function runtimeNeighborCount(part) {
      let count = 0;
      for (const neighborId of part.rigidNeighborBlockIds || []) {
        const neighbor = STATE.flight.runtimePartById.get(neighborId);
        if (neighbor?.attached && neighbor.bodyId === part.bodyId) count += 1;
      }
      return count;
    }

    function applyStructuralLoadDamage(dt, loadsByBodyId) {
      const failures = [];
      for (const [bodyId, loads] of loadsByBodyId) {
        if (!flightSession.hasBody(bodyId)) continue;
        const bodyPlan = STATE.flight.assemblyPlan?.bodyById?.[bodyId];
        const bodyMass = bodyPlan?.massProperties?.mass || 0;
        if (bodyMass <= 0) continue;
        const loadAcceleration = (Math.abs(loads.thrust) + Math.abs(loads.lift) + Math.abs(loads.drag)) / Math.max(1, bodyMass);
        const angularVelocity = flightSession.getBodyAngularVelocity(bodyId);
        const spin = Math.hypot(angularVelocity.x, angularVelocity.y, angularVelocity.z);
        const candidates = (STATE.flight.runtimePartsByBodyId.get(String(bodyId)) || []).filter(part => part.attached && part.type !== 'Core');
        for (const part of candidates) {
          const support = runtimeNeighborCount(part);
          const lever = part.bodyLocalPosition.length();
          const structural = Math.max(0.2, part.def.structural || 1);
          const supportFactor = 0.72 + support * 0.42;
          const translationalStress = loadAcceleration * (0.24 + lever * 0.12);
          const rotationalStress = spin * spin * lever * 1.55;
          const stress = (translationalStress + rotationalStress) / (structural * supportFactor);
          if (stress > 42 && applyDamageOnly(part, (stress - 42) * dt * 1.7, 'flight-load overstress')) failures.push({ part, reason: 'flight-load overstress' });
        }
      }
      if (failures.length) detachRuntimeParts(failures, true);
      recomputeFlightIntegrity();
    }

    function processPendingImpacts() {
      if (!primaryFlightBodyId() || !STATE.flight.pendingImpacts.length) return;
      const impacts = STATE.flight.pendingImpacts.splice(0);
      for (const entry of impacts) {
        if (!primaryFlightBodyId()) break;
        applyImpactDamage(entry.bodyId, entry.localImpact, entry.impact, entry.collisionKind);
        if (entry.impact >= PHYSICS.severeImpactSpeed && !STATE.flight.severeImpact) {
          STATE.flight.severeImpact = true;
          showStatus(entry.collisionKind === 'obstacle' ? 'SEVERE COLLISION' : (entry.collisionKind === 'debris' ? 'DEBRIS IMPACT' : 'SEVERE IMPACT'), 1800);
        } else if (entry.impact >= PHYSICS.hardImpactSpeed) {
          showStatus(entry.collisionKind === 'obstacle' ? 'OBSTACLE COLLISION' : (entry.collisionKind === 'debris' ? 'DEBRIS IMPACT' : 'HARD LANDING'), 1100);
        }
      }
    }

    function syncDebris(dt) {
      return flightIntegrity.updateDebris(dt);
    }

    function buildFlightBody() {
      cleanupFlightState();

      const analysis = computeCraftAnalysis();
      if (!analysis.snapshot.ready || analysis.mass <= 0) {
        const reason = analysis.snapshot.errors?.[0] || 'invalid-craft';
        showStatus(`CANNOT LAUNCH: ${String(reason).replaceAll('-', ' ').toUpperCase()}`, 2200);
        return false;
      }
      const contract = getSelectedContract();
      const payloadMass = Math.max(0, contract.payloadMass || 0);
      const snapshot = buildLoadedSnapshot(analysis.snapshot, payloadMass);
      const payloadPosition = snapshot.payloadAssemblyPosition || missionPayloadPositionVector(snapshot);
      const assemblyPlan = snapshot.runtimePlan;
      const rootBodyPlan = RuntimeAssembly.rootBody(assemblyPlan);
      if (!rootBodyPlan) throw new Error('Runtime assembly plan has no root body.');
      const runtimeMass = rootBodyPlan.massProperties.mass;
      const colliderPlanByBlockId = new Map();
      let payloadColliderPlan = null;
      for (const bodyPlan of assemblyPlan.rigidBodies) {
        for (const collider of bodyPlan.colliders) {
          if (collider.blockId) colliderPlanByBlockId.set(collider.blockId, collider);
          if (collider.payload) payloadColliderPlan = collider;
        }
      }
      const runtimeCom = new THREE.Vector3(...rootBodyPlan.assemblyPose.position);
      STATE.flight.com.copy(runtimeCom);
      let lowestAssemblyY = Infinity;
      const lowestBodyLocalYByBodyId = new Map();
      for (const bodyPlan of assemblyPlan.rigidBodies) {
        let lowestBodyLocalY = Infinity;
        for (const collider of bodyPlan.colliders) {
          const colliderBottomLocalY = collider.center[1] - collider.halfExtents[1];
          lowestBodyLocalY = Math.min(lowestBodyLocalY, colliderBottomLocalY);
          lowestAssemblyY = Math.min(lowestAssemblyY, bodyPlan.assemblyPose.position[1] + colliderBottomLocalY);
        }
        lowestBodyLocalYByBodyId.set(bodyPlan.bodyId, Number.isFinite(lowestBodyLocalY) ? lowestBodyLocalY : -0.5);
      }
      if (!Number.isFinite(lowestAssemblyY)) lowestAssemblyY = -0.5;
      const spawnTransform = {
        position: [TEST_RANGE.spawn.x, -0.45 - lowestAssemblyY, TEST_RANGE.spawn.z],
        quaternion: [0, 0, 0, 1]
      };

      try {
        const started = flightSession.start({
        assemblyPlan,
        bodyDescriptor: bodyPlan => ({
          linearDamping: 0.005,
          angularDamping: 0.012,
          allowSleep: false,
          collisionGroup: COLLISION_GROUP.craft,
          collisionMask: COLLISION_GROUP.world | COLLISION_GROUP.debris,
          position: (() => {
            const pose = RuntimeAssembly.worldBodyPose(spawnTransform, bodyPlan);
            return { x: pose.position[0], y: pose.position[1], z: pose.position[2] };
          })(),
          quaternion: (() => {
            const pose = RuntimeAssembly.worldBodyPose(spawnTransform, bodyPlan);
            return { x: pose.quaternion[0], y: pose.quaternion[1], z: pose.quaternion[2], w: pose.quaternion[3] };
          })()
        }),
        classifyCollision(otherBody) {
          if (otherBody === groundBody) return 'ground';
          if (otherBody?.userData?.rangeObstacle) return 'obstacle';
          if (otherBody?.userData?.debris) return 'debris';
          return 'other';
        },
        collisionListener: ({ bodyId, collision }) => {
          if (!flightSession.hasBody(bodyId)) return;
          const velocity = flightSession.getBodyLinearVelocity(bodyId);
          const impact = collision.impactSpeed > 0 ? collision.impactSpeed : Math.abs(velocity.y);
          STATE.flight.lastLoads.impact = Math.max(STATE.flight.lastLoads.impact || 0, impact);
          STATE.flight.maxImpact = Math.max(STATE.flight.maxImpact, impact);
          if (collision.kind === 'ground') STATE.mission.lastGroundContact = STATE.mission.elapsed;
          const damageNow = STATE.mission.elapsed;
          if (impact > 3.5 && damageNow - STATE.flight.lastImpactAt > 0.25) {
            let localImpact = { x: 0, y: lowestBodyLocalYByBodyId.get(bodyId) ?? -0.5, z: 0 };
            if (collision.relativePoint) localImpact = flightSession.vectorToLocalFrame(bodyId, collision.relativePoint);
            STATE.flight.pendingImpacts.push({
              bodyId,
              localImpact: { x: localImpact.x, y: localImpact.y, z: localImpact.z },
              impact,
              collisionKind: collision.kind,
              timestamp: damageNow
            });
            STATE.flight.lastImpactAt = damageNow;
          }
        }
      });
      const visualRootByBodyId = new Map();
      for (const bodyPlan of assemblyPlan.rigidBodies) {
        const root = new THREE.Group();
        root.userData.assemblyBodyId = bodyPlan.bodyId;
        flightSession.registerVisualRoot(bodyPlan.bodyId, root);
        scene.add(root);
        visualRootByBodyId.set(bodyPlan.bodyId, root);
      }
      flightMechanicalVisuals.start();

      const functionalBlocks = [];
      const runtimeParts = [];
      STATE.flight.payloadBodyLocalPosition = null;
      STATE.flight.payload = null;
      const thrusterTorqueMax = new THREE.Vector3();
      let gyroCount = 0;

      for (const part of snapshot.parts) {
        const colliderPlan = colliderPlanByBlockId.get(part.blockId);
        if (!colliderPlan) throw new Error(`Runtime assembly is missing collider for ${part.blockId}.`);
        const localOffset = Physics.vec3(...colliderPlan.center);
        const bodyId = flightSession.getBodyIdForBlock(part.blockId);
        const ownership = flightSession.getColliderOwnershipByBlockId(part.blockId);
        if (!bodyId || !ownership || ownership.bodyId !== bodyId) {
          throw new Error(`Runtime assembly ownership is missing for ${part.blockId}.`);
        }
        const partRoot = visualRootByBodyId.get(bodyId);
        if (!partRoot) throw new Error(`Visual root is missing for body ${bodyId}.`);

        const visual = createModuleVisual(part.type, part.orientation, false);
        visual.position.set(localOffset.x, localOffset.y, localOffset.z);
        partRoot.add(visual);
        visualAssetLoader.attachImportedVisual(visual);
        const key = part.key;
        const sourceMesh = WORKSHOP.meshesByKey.get(key);
        if (sourceMesh) sourceMesh.visible = false;

        const fullForce = (part.type === 'Thruster' || part.type === 'VectorThruster') ? part.basis.chord.clone().multiplyScalar(part.def.force || 0) : new THREE.Vector3();
        const torqueThree = new THREE.Vector3(localOffset.x, localOffset.y, localOffset.z).cross(fullForce);
        const localTorque = Physics.vec3(torqueThree.x, torqueThree.y, torqueThree.z);
        const runtimePart = {
          blockId: part.blockId,
          bodyId,
          key, grid: { x: part.assemblyPosition.x, y: part.assemblyPosition.y, z: part.assemblyPosition.z }, type: part.type, def: part.def,
          visual, bodyLocalPosition: localOffset.clone(), orientation: part.orientation,
          localAxis: Physics.vec3(part.basis.chord.x, part.basis.chord.y, part.basis.chord.z),
          localNormal: Physics.vec3(part.basis.normal.x, part.basis.normal.y, part.basis.normal.z),
          localSpan: Physics.vec3(part.basis.span.x, part.basis.span.y, part.basis.span.z),
          localTorque, force: part.def.force || 0, wingArea: part.def.wingArea || 0, fuelRate: part.def.fuelRate || 0,
          controlAxis: normalizeControlAxis(part.controlAxis), controlSign: normalizeControlSign(part.controlSign),
          mass: part.def.mass || 0, maxHealth: part.def.durability || 60, health: part.def.durability || 60,
          rigidNeighborBlockIds: [...part.rigidNeighborBlockIds],
          pilotControlled: bodyId === started.primaryBodyId || part.type === 'Thruster' || part.type === 'VectorThruster',
          attached: true, lastCommand: 0, gimbalA: 0, gimbalB: 0, controlDeflection: 0
        };
        runtimeParts.push(runtimePart);
        if (runtimePart.pilotControlled && (part.type === 'Thruster' || part.type === 'VectorThruster')) {
          thrusterTorqueMax.x = Math.max(thrusterTorqueMax.x, Math.abs(localTorque.x));
          thrusterTorqueMax.y = Math.max(thrusterTorqueMax.y, Math.abs(localTorque.y));
          thrusterTorqueMax.z = Math.max(thrusterTorqueMax.z, Math.abs(localTorque.z));
        }
        if (runtimePart.pilotControlled && part.type === 'Gyro') gyroCount += 1;
        if (['Thruster','VectorThruster','Balloon','Wing','ControlSurface','Gyro','Fuel'].includes(part.type)) functionalBlocks.push(runtimePart);
      }

      if (payloadMass > 0) {
        if (!payloadColliderPlan) throw new Error('Runtime assembly is missing the mission payload collider.');
        const payloadOffset = Physics.vec3(...payloadColliderPlan.center);
        const payloadBodyId = payloadColliderPlan.bodyId;
        const payloadOwnership = flightSession.getColliderOwnership(payloadColliderPlan.colliderId);
        if (!payloadOwnership || payloadOwnership.bodyId !== payloadBodyId) {
          throw new Error('Runtime assembly builder is missing the mission payload ownership.');
        }
        const payloadRoot = visualRootByBodyId.get(payloadBodyId);
        if (!payloadRoot) throw new Error(`Visual root is missing for payload body ${payloadBodyId}.`);
        STATE.flight.payloadBodyLocalPosition = payloadOffset.clone();
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.84, 0.84, 0.84),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.72, metalness: 0.18, emissive: 0x082f49, emissiveIntensity: 0.16 })
        );
        crate.position.set(payloadOffset.x, payloadOffset.y, payloadOffset.z);
        crate.castShadow = true;
        crate.receiveShadow = true;
        crate.userData.isMissionPayload = true;
        payloadRoot.add(crate);
        let coupler = null;
        const corePart = snapshot.parts.find(part => part.type === 'Core');
        if (corePart) {
          coupler = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.24, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.48, metalness: 0.45, emissive: 0x0c4a6e, emissiveIntensity: 0.12 })
          );
          coupler.position.copy(snapshot.payloadBodyLocalPosition.clone().add(corePart.bodyLocalPosition).multiplyScalar(0.5));
          coupler.castShadow = true;
          payloadRoot.add(coupler);
        }
        const payloadMaxHealth = 80 + payloadMass * 2.5;
        STATE.flight.payload = { bodyId: payloadBodyId, mass: payloadMass, bodyLocalPosition: payloadOffset, colliderId: payloadColliderPlan.colliderId, visual: crate, coupler, health: payloadMaxHealth, maxHealth: payloadMaxHealth, attached: true };
      }

      STATE.flight.functionalBlocks = functionalBlocks;
      STATE.flight.runtimeParts = runtimeParts;
      STATE.flight.runtimePartById = new Map(runtimeParts.map(part => [part.blockId, part]));
      STATE.flight.runtimePartsByBodyId = new Map();
      for (const part of runtimeParts) {
        if (!STATE.flight.runtimePartsByBodyId.has(part.bodyId)) STATE.flight.runtimePartsByBodyId.set(part.bodyId, []);
        STATE.flight.runtimePartsByBodyId.get(part.bodyId).push(part);
      }
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
      STATE.flight.lowestLocalY = lowestBodyLocalYByBodyId.get(started.primaryBodyId) ?? -0.5;
      STATE.flight.runtimeMass = runtimeMass;
      STATE.flight.currentInertia.copy(snapshot.rootBodyInertia);
      STATE.flight.payloadMass = payloadMass;
      STATE.flight.lastImpactAt = -Infinity;
      STATE.flight.lostParts = 0;
      STATE.flight.leakingFuelRate = 0;
      STATE.flight.firstFailure = '';
      STATE.flight.structuralFailures = 0;
      STATE.flight.initialHealth = runtimeParts
        .filter(part => part.bodyId === started.primaryBodyId)
        .reduce((sum, part) => sum + part.maxHealth, 0);
      STATE.flight.gyroAuthority = gyroCount;
      STATE.flight.pendingImpacts = [];
      STATE.flight.metricsDirty = true;
      recomputeFlightIntegrity(true);

        const primaryTransform = flightSession.getBodyTransform(started.primaryBodyId);
        STATE.camera.target.set(primaryTransform.position.x, primaryTransform.position.y, primaryTransform.position.z);
        STATE.camera.targetOffset.set(0, 0, 0);
        camera.position.set(primaryTransform.position.x + 13, primaryTransform.position.y + 7, primaryTransform.position.z + 13);
        return true;
      } catch (error) {
        const cleanupErrors = [];
        try {
          if (STATE.flight.assembly || STATE.flight.cleanupPending || flightSession.isActive()) cleanupFlightState();
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
        for (const mesh of WORKSHOP.meshesByKey.values()) mesh.visible = true;
        for (const visual of WORKSHOP.mechanicalLinkVisualsById.values()) visual.visible = true;
        if (cleanupErrors.length) {
          Object.defineProperty(error, 'cleanupErrors', { value: cleanupErrors, enumerable: true, configurable: true });
        }
        throw error;
      }
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
        STATE.mission.status = 'IDLE';
        STATE.mission.active = false;
        STATE.mission.contractId = null;
        STATE.mission.previousPosition = null;
        STATE.mission.landingAssessment = null;
        STATE.mission.helpPaused = false;
        STATE.camera.target.copy(STATE.camera.defaultTarget);
        STATE.camera.targetOffset.set(0, 0, 0);
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
        setWorkspacePanelOpen('contracts', false, true);
        setMechanicalAuthoring(false, false); STATE.mode = 'FLIGHT';
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
      if (!flightSession.isActive()) return;
      flightSession.syncVisuals();
      flightMechanicalVisuals.sync();
    }

    function setMechanicalAuthoring(active, refreshGhost = true) {
      const nextActive = STATE.mode === 'BUILD' && Boolean(active); WORKSHOP.mechanicalAuthoring.active = nextActive;
      WORKSHOP.mechanicalAuthoring.firstBlockId = null;
      const button = document.getElementById('btn-hinge-link');
      if (button) { button.textContent = `HINGE LINK: ${nextActive ? 'ON' : 'OFF'}`; button.classList.toggle('active', nextActive); button.setAttribute('aria-pressed', String(nextActive)); }
      const status = document.getElementById('ui-hinge-status');
      if (status) status.textContent = nextActive ? 'Click the first endpoint block.' : 'Select HINGE LINK, then click two face-adjacent blocks.';
      if (refreshGhost) updateGhost();
    }

    function handleMechanicalEndpointSelection(target) {
      const key = target?.root?.userData?.blockKey;
      const blockId = key ? CRAFT.get(key)?.blockId : null;
      const axis = document.getElementById('hinge-axis')?.value || WORKSHOP.mechanicalAuthoring.axis || 'PY';
      return assemblySpaceController.authorHingeEndpoint(blockId, axis);
    }

    function performBuildAction(button) {
      if (STATE.mode !== 'BUILD') return;
      const target = raycastBuildTarget(STATE.input.pointerNDC);
      if (!target) { showStatus(BT.placementFeedback(WORKSHOP.lastTargetResult).status, 1300); return; }
      if (button === 0 && WORKSHOP.mechanicalAuthoring.active) { handleMechanicalEndpointSelection(target); return; }
      if (button === 0) {
        addBlock(target.position.x, target.position.y, target.position.z, STATE.selectedBlock, STATE.orientation, true);
      } else if (button === 2 && target.kind === 'voxel') {
        removeBlock(target.root.userData.blockKey);
      }
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
        syncHudVisibility, resetToEmptyCraft, updateHUD, showStatus, setMechanicalAuthoring
      }
    });
    const {
      collectBlueprint, cloneBlueprint, blueprintSignature, updateHistoryButtons,
      commitHistory, restoreHistoryBlueprint, undoBlueprint, redoBlueprint,
      normalizeBlueprintData, loadBlueprintData, persistBlueprint, saveBlueprint,
      autoSave, flushPendingAutosave, loadBlueprint, newBlueprint, exportBlueprint, importBlueprintFile
    } = blueprintController;

    assemblySpaceController = AssemblySpaceController.create({
      THREE, craft: CRAFT, state: STATE, scene, document,
      callbacks: {
        collectBlueprint,
        commitHistory,
        autoSave,
        updateTelemetry,
        updateGhost,
        showStatus,
        compileCraft: () => CraftCompiler.compile(CRAFT),
        attachAuthoringObjects(group) {
          for (const object of [ghost, ghostArrow, ghostNormalArrow, ...symmetryGhosts]) group?.add(object);
        }
      }
    });
    assemblySpaceController.bindUI({
      hoveredBlockId: () => {
        const key = STATE.hovered.root?.userData?.blockKey;
        return key ? CRAFT.get(key)?.blockId || null : null;
      }
    });
    assemblySpaceController.setActiveAssemblySpace(AssemblySpaces.ROOT_ASSEMBLY_SPACE_ID);

    const missionController = MissionController.create({
      THREE, Physics, state: STATE, craft: CRAFT, document,
      landingPolicy: LANDING_POLICY, defaultOrientation: DEFAULT_ORIENTATION,
      missionMarkerGroup,
      services: {
        getContractById, isContractUnlocked, getSelectedContract, careerRank,
        recalculateCareerStars, saveCareer, flightSession
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

    const toolContainer = document.getElementById('tool-container'), hotbarList = document.getElementById('parts-hotbar-list');
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
          <div class="tool-description text-[10px] text-gray-400">${BLOCKS[name].desc}</div>
        </div>
        <div class="tool-shortcut text-[10px] font-mono text-slate-500">${shortcutIndex <= 9 ? shortcutIndex : ''}</div>
      `;
      btn.addEventListener('click', () => setSelectedTool(name));
      toolContainer.appendChild(btn);
      if (hotbarList) { const hotbarBtn = btn.cloneNode(true); hotbarBtn.classList.add('hotbar-tool-btn'); hotbarBtn.addEventListener('click', () => setSelectedTool(name)); hotbarList.appendChild(hotbarBtn); }
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
      releaseEditableInteraction();
      rayToNDC(event.clientX, event.clientY);
      STATE.input.downButton = event.button;
      STATE.input.downMoved = false;
      STATE.input.dragStartX = event.clientX;
      STATE.input.dragStartY = event.clientY;

      if (event.button === 1 && event.shiftKey) {
        STATE.input.panDrag = true;
      } else if (event.altKey || event.button === 1) {
        STATE.input.orbitDrag = true;
      }
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    });

    renderer.domElement.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || isOverUI(event.target)) return;
      rayToNDC(event.clientX, event.clientY);
      if (STATE.input.orbitDrag || STATE.input.panDrag) {
        const dx = event.clientX - STATE.input.dragStartX;
        const dy = event.clientY - STATE.input.dragStartY;
        STATE.input.dragStartX = event.clientX;
        STATE.input.dragStartY = event.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          if (STATE.input.panDrag) {
            panCameraTargetByPixels(dx, dy);
          } else {
            STATE.camera.yaw -= dx * 0.008;
            STATE.camera.pitch = clampCameraPitch(STATE.camera.pitch - dy * 0.008);
          }
          STATE.input.downMoved = true;
        }
      }
      if (STATE.mode === 'BUILD') updateGhost();
    });

    renderer.domElement.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch' || isOverUI(event.target)) return;
      rayToNDC(event.clientX, event.clientY);
      const cameraDragWasActive = STATE.input.orbitDrag || STATE.input.panDrag;
      STATE.input.orbitDrag = false;
      STATE.input.panDrag = false;
      if (!cameraDragWasActive && STATE.mode === 'BUILD' && !STATE.input.downMoved) {
        if (event.button === 0 || event.button === 2) performBuildAction(event.button);
      }
      STATE.input.downButton = -1;
      updateGhost();
    });

    renderer.domElement.addEventListener('pointercancel', () => {
      STATE.input.orbitDrag = false;
      STATE.input.panDrag = false;
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
      setThrusterPower(Number((e.target).value) / 100, { syncInput: false });
    });

    document.getElementById('balloon-power').addEventListener('input', (e) => {
      setBalloonPower(Number((e.target).value) / 100, { syncInput: false });
    });

    document.getElementById('stability').addEventListener('input', (e) => {
      STATE.stabilityAssist = Number((e.target).value) / 100;
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    });

    document.getElementById('camera-mode')?.addEventListener('change', (e) => setCameraMode((e.target).value));
    document.getElementById('camera-follow-strength')?.addEventListener('input', (e) => setCameraFollowStrength(Number((e.target).value) / 100));
    document.getElementById('btn-camera-reset')?.addEventListener('click', () => {
      resetCamera();
      saveUIPreferences();
      showStatus('CAMERA RESET', 900);
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
    document.getElementById('btn-hinge-link')?.addEventListener('click', () => setMechanicalAuthoring(!WORKSHOP.mechanicalAuthoring.active));
    document.getElementById('hinge-axis')?.addEventListener('change', event => {
      WORKSHOP.mechanicalAuthoring.axis = event.target.value;
      releaseEditableInteraction(event.currentTarget || event.target);
    });
    document.getElementById('mechanical-link-list')?.addEventListener('change', event => {
      releaseEditableInteraction(event.currentTarget || event.target);
    });
    document.getElementById('btn-remove-mechanical-link')?.addEventListener('click', () => {
      const select = document.getElementById('mechanical-link-list');
      const id = select?.value;
      if (!id) { showStatus('NO MECHANICAL LINK SELECTED', 1000); return; }
      const historyBefore = collectBlueprint();
      const result = CRAFT.removeMechanicalLink(id, 'remove-authored-mechanical-link');
      if (!result.ok) { showStatus('REMOVE LINK FAILED', 1200); return; }
      commitHistory(historyBefore); autoSave(false); updateTelemetry(); showStatus('MECHANICAL LINK REMOVED', 1000);
    });
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
      const input = (event.target);
      importBlueprintFile(input.files?.[0]);
      input.value = '';
    });

    function setThrusterPower(value, options = {}) {
      STATE.thrusterPower = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
      if (options.syncInput !== false) {
        (document.getElementById('thruster-power')).value = String(Math.round(STATE.thrusterPower * 100));
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
        (document.getElementById('balloon-power')).value = String(Math.round(STATE.balloonPower * 100));
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

    /*Flight controls use the user profile*/
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
      if (isEditableInteractionActive(event.target, document.activeElement)) {
        if (event.key === 'Escape') {
          releaseEditableInteraction();
          clearControlActions();
        }
        return;
      }
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
      if (STATE.mode === 'FLIGHT') {
        try { setMode('BUILD'); }
        catch (error) { console.error('Flight cleanup during pagehide failed; retry handles were retained.', error); }
      }
    });

    function clamp01(value) {
      return Math.max(0, Math.min(1, value));
    }

    function cannonDot(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    function pointVelocityWorld(bodyId, localPoint) {
      return Physics.vec3(flightSession.getBodyPointVelocity(bodyId, localPoint));
    }

    function updateFlameVisibility() {
      for (const mod of STATE.flight.functionalBlocks) {
        if ((mod.type !== 'Thruster' && mod.type !== 'VectorThruster') || !mod.visual || !mod.attached) continue;
        const intensity = Math.max(0, mod.lastCommand || 0);
        visualRuntimeAdapter.setGimbal(mod.visual, mod.gimbalA || 0, mod.gimbalB || 0, PHYSICS.gimbalAngle);
        visualRuntimeAdapter.setThrusterIntensity(mod.visual, intensity, { active: STATE.mode === 'FLIGHT' });
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

    function applyWingAerodynamics(bodyId, mod) {
      const pointVelocity = pointVelocityWorld(bodyId, mod.bodyLocalPosition);
      const speed = pointVelocity.length();
      if (speed < 0.25) return { lift: 0, drag: 0 };

      const chordWorld = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, mod.localAxis)).unit();
      const normalWorld = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, mod.localNormal)).unit();
      const spanWorld = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, mod.localSpan)).unit();
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
      const worldPoint = flightSession.pointToWorldFrame(bodyId, mod.bodyLocalPosition);
      flightSession.applyBodyForce(bodyId, liftDirection.scale(liftMagnitude), worldPoint);
      flightSession.applyBodyForce(bodyId, velocityDirection.scale(-dragMagnitude), worldPoint);
      return { lift: Math.abs(liftMagnitude), drag: Math.abs(dragMagnitude) };
    }

    function applyControlSurfaceAerodynamics(bodyId, mod) {
      if (!mod.attached) return { lift: 0, drag: 0 };
      const pointVelocity = pointVelocityWorld(bodyId, mod.bodyLocalPosition);
      const speed = pointVelocity.length();
      const commandRaw = mod.pilotControlled ? (Number(STATE.pilot[mod.controlAxis]) || 0) : 0;
      if (speed < 0.35) {
        mod.controlDeflection = commandRaw * runtimePartHealthFraction(mod);
        visualRuntimeAdapter.setControlDeflection(mod.visual, mod.controlDeflection, PHYSICS.controlSurfaceMaxDeflection);
        return { lift: 0, drag: 0 };
      }
      const chordWorld = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, mod.localAxis)).unit();
      const normalWorld = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, mod.localNormal)).unit();
      const spanWorld = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, mod.localSpan)).unit();
      const velocityDirection = pointVelocity.scale(1 / speed);
      const chordSpeed = cannonDot(pointVelocity, chordWorld);
      const normalSpeed = cannonDot(pointVelocity, normalWorld);
      const spanSpeed = cannonDot(pointVelocity, spanWorld);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
      const targetAxis = controlAxisVector(mod.controlAxis);
      const torqueVector = new THREE.Vector3(mod.bodyLocalPosition.x, mod.bodyLocalPosition.y, mod.bodyLocalPosition.z).cross(new THREE.Vector3(mod.localNormal.x, mod.localNormal.y, mod.localNormal.z));
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
      const worldPoint = flightSession.pointToWorldFrame(bodyId, mod.bodyLocalPosition);
      flightSession.applyBodyForce(bodyId, liftDirection.scale(liftMagnitude), worldPoint);
      flightSession.applyBodyForce(bodyId, velocityDirection.scale(-dragMagnitude), worldPoint);
      visualRuntimeAdapter.setControlDeflection(mod.visual, command, PHYSICS.controlSurfaceMaxDeflection);
      return { lift: Math.abs(liftMagnitude), drag: Math.abs(dragMagnitude) };
    }

    function computeVectorThrusterForceCannon(mod, pilot, command) {
      const baseForce = mod.force * command * runtimePartHealthFraction(mod);
      const forward = mod.localAxis;
      if (baseForce <= 0) return forward.scale(0);
      const desired = Physics.vec3(pilot.roll || 0, pilot.yaw || 0, pilot.pitch || 0);
      const lateral = baseForce * Math.sin(PHYSICS.gimbalAngle);
      const torqueNormal = Physics.vec3();
      mod.bodyLocalPosition.cross(mod.localNormal.scale(lateral), torqueNormal);
      const torqueSpan = Physics.vec3();
      mod.bodyLocalPosition.cross(mod.localSpan.scale(lateral), torqueSpan);
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

    function applyGyroControl(bodyId) {
      const gyroCount = (STATE.flight.runtimePartsByBodyId.get(String(bodyId)) || [])
        .filter(part => part.attached && part.type === 'Gyro')
        .reduce((sum, part) => sum + runtimePartHealthFraction(part), 0);
      if (gyroCount <= 0) return;

      const pilot = STATE.pilot;
      const manualTorque = gyroCount * PHYSICS.gyroManualTorque;
      const angularVelocity = Physics.vec3(flightSession.getBodyAngularVelocity(bodyId));
      const localAngularVelocity = Physics.vec3(flightSession.vectorToLocalFrame(bodyId, angularVelocity));
      const dampingStrength = gyroCount * (0.7 + STATE.stabilityAssist * 5.5 + (pilot.stabilize ? 6 : 0));
      const localTorque = Physics.vec3(
        pilot.roll * manualTorque - localAngularVelocity.x * dampingStrength,
        pilot.yaw * manualTorque - localAngularVelocity.y * dampingStrength,
        pilot.pitch * manualTorque - localAngularVelocity.z * dampingStrength
      );

      if (STATE.stabilityAssist > 0.001 || pilot.stabilize) {
        const craftUp = Physics.vec3(flightSession.vectorToWorldFrame(bodyId, { x: 0, y: 1, z: 0 })).unit();
        const worldUp = Physics.vec3(0, 1, 0);
        const levelErrorWorld = Physics.vec3();
        craftUp.cross(worldUp, levelErrorWorld);
        const levelErrorLocal = Physics.vec3(flightSession.vectorToLocalFrame(bodyId, levelErrorWorld));
        const levelStrength = gyroCount * (STATE.stabilityAssist * 10 + (pilot.stabilize ? 18 : 0));
        localTorque.x += levelErrorLocal.x * levelStrength;
        localTorque.y += levelErrorLocal.y * levelStrength * 0.35;
        localTorque.z += levelErrorLocal.z * levelStrength;
      }

      const maxTorque = gyroCount * PHYSICS.gyroManualTorque * 3.2;
      const torqueLength = localTorque.length();
      if (torqueLength > maxTorque) localTorque.scale(maxTorque / torqueLength, localTorque);
      const worldTorque = flightSession.vectorToWorldFrame(bodyId, localTorque);
      flightSession.addBodyTorque(bodyId, worldTorque);
    }

    function stepFlightPhysics(dt) {
      const primaryBodyId = primaryFlightBodyId();
      if (!primaryBodyId) return;

      let totalDrag = 0;
      const loadsByBodyId = new Map(flightSession.bodyIds().map(bodyId => [bodyId, { thrust: 0, lift: 0, drag: 0 }]));
      for (const bodyId of flightSession.bodyIds()) {
        const velocity = Physics.vec3(flightSession.getBodyLinearVelocity(bodyId));
        const speed = velocity.length();
        if (speed <= 0.001) continue;
        const bodyDragArea = (STATE.flight.runtimePartsByBodyId.get(String(bodyId)) || [])
          .filter(part => part.attached)
          .reduce((sum, part) => sum + (part.def.dragArea || 0) * Math.max(0.15, runtimePartHealthFraction(part)), 0)
          + (STATE.flight.payload?.attached && STATE.flight.payload.bodyId === bodyId ? 0.2 : 0);
        if (bodyDragArea <= 0) continue;
        const dragMagnitude = 0.5 * PHYSICS.airDensity * PHYSICS.bodyDragCoefficient * bodyDragArea * speed * speed;
        const drag = velocity.scale(-dragMagnitude / speed);
        const transform = flightSession.getBodyTransform(bodyId);
        flightSession.applyBodyForce(bodyId, drag, transform.position);
        totalDrag += dragMagnitude;
        loadsByBodyId.get(bodyId).drag += dragMagnitude;
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
        if (!mod.attached) { if (flightThrusterRouter.isThruster(mod)) mod.lastCommand = 0; continue; }
        if (mod.bodyId == null) throw new Error(`Functional module ${mod.blockId || '<unknown>'} has no body ownership.`);
        if (!flightSession.hasBody(mod.bodyId)) { if (flightThrusterRouter.isThruster(mod)) mod.lastCommand = 0; continue; }
        const rootOnlyControl = mod.type === 'Balloon' || mod.type === 'ControlSurface' || mod.type === 'Gyro';
        if (rootOnlyControl && !mod.pilotControlled) continue;
        if (mod.type === 'Thruster' || mod.type === 'VectorThruster') {
          const bodyPilot = flightThrusterRouter.pilotForBody(primaryBodyId, mod.bodyId, pilot);
          if (!bodyPilot) { mod.lastCommand = 0; continue; }
          const command = computeThrusterCommand(mod, bodyPilot);
          mod.lastCommand = command;
          const fuelNeed = mod.fuelRate * command * dt;
          requestedFuel += fuelNeed;
          thrusterJobs.push({ mod, bodyPilot, command, fuelNeed });
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
        flightThrusterRouter.recordCommand(job.mod, job.command, fuelScale, health);
        const localForce = job.mod.type === 'VectorThruster'
          ? computeVectorThrusterForceCannon(job.mod, job.bodyPilot, effectiveCommand)
          : job.mod.localAxis.scale(job.mod.force * effectiveCommand * health);
        const forceMagnitude = localForce.length();
        if (forceMagnitude <= 0) continue;
        const routed = flightThrusterRouter.routeLocalForce(job.mod, localForce);
        if (!routed.applied) { job.mod.lastCommand = 0; continue; }
        totalThrust += forceMagnitude;
        loadsByBodyId.get(job.mod.bodyId).thrust += forceMagnitude;
      }

      const balloonEfficiency = Aerostatics.liftEfficiencyAtAltitude(currentAerostaticAltitude(), AEROSTATIC_POLICY);
      for (const job of balloonJobs) {
        const liftMagnitude = job.mod.force * job.command * fuelScale * runtimePartHealthFraction(job.mod) * balloonEfficiency;
        job.mod.lastCommand = job.command * fuelScale;
        if (liftMagnitude <= 0) continue;
        const worldPoint = flightSession.pointToWorldFrame(job.mod.bodyId, job.mod.bodyLocalPosition);
        flightSession.applyBodyForce(job.mod.bodyId, { x: 0, y: liftMagnitude, z: 0 }, worldPoint);
        totalLift += liftMagnitude;
        loadsByBodyId.get(job.mod.bodyId).lift += liftMagnitude;
      }

      const primaryVelocity = flightSession.getBodyLinearVelocity(primaryBodyId);
      const primaryTransform = flightSession.getBodyTransform(primaryBodyId);
      const aerostaticDamping = Aerostatics.verticalDampingForce({
        mass: STATE.flight.runtimeMass,
        verticalSpeed: primaryVelocity.y,
        commandedLift: loadsByBodyId.get(primaryBodyId)?.lift || 0,
        weight: STATE.flight.runtimeMass * AEROSTATIC_POLICY.gravity
      }, AEROSTATIC_POLICY);
      if (Math.abs(aerostaticDamping) > 1e-6) {
        flightSession.applyBodyForce(primaryBodyId, { x: 0, y: aerostaticDamping, z: 0 }, primaryTransform.position);
      }

      for (const mod of STATE.flight.functionalBlocks) {
        if (!mod.attached || (mod.type !== 'Wing' && mod.type !== 'ControlSurface')) continue;
        const loads = mod.type === 'ControlSurface'
          ? applyControlSurfaceAerodynamics(mod.bodyId, mod)
          : applyWingAerodynamics(mod.bodyId, mod);
        totalLift += loads.lift;
        totalDrag += loads.drag;
        const bodyLoads = loadsByBodyId.get(mod.bodyId);
        if (bodyLoads) { bodyLoads.lift += loads.lift; bodyLoads.drag += loads.drag; }
      }

      const gyroBodies = new Set(
        STATE.flight.functionalBlocks.filter(part => part.attached && part.type === 'Gyro' && part.pilotControlled).map(part => part.bodyId)
      );
      for (const bodyId of gyroBodies) applyGyroControl(bodyId);

      STATE.flight.structuralAccumulator += dt;
      if (STATE.flight.structuralAccumulator >= PHYSICS.structuralCheckInterval) {
        applyStructuralLoadDamage(STATE.flight.structuralAccumulator, loadsByBodyId);
        STATE.flight.structuralAccumulator = 0;
      }
      const impact = STATE.flight.lastLoads.impact || 0;
      STATE.flight.lastLoads = { lift: totalLift, drag: totalDrag, thrust: totalThrust, impact };
    }

    const fixedStepScheduler = FixedStepScheduler.create({ fixedDt: PHYSICS.fixedDt, maxSubSteps: PHYSICS.maxSubSteps, maxFrameDelta: 0.08 });
    let hudAccumulator = 0;
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (STATE.mode === 'FLIGHT' && primaryFlightBodyId()) {
        fixedStepScheduler.advance(delta, dt => {
          stepFlightPhysics(dt); Physics.step(world, dt);
          processPendingImpacts(); updateMission(dt);
        }, { paused: STATE.mission.paused });
        syncFlightVisuals();
        syncDebris(delta);
        updateFlameVisibility();
        hudAccumulator += delta;
        if (hudAccumulator >= PHYSICS.hudRefreshInterval) {
          hudAccumulator = 0;
          updateFlightFeedback();
        }
      } else {
        fixedStepScheduler.reset();
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
      syncCameraControls();
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
