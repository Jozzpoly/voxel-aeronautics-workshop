(() => {
  'use strict';

  window.VAW.define('game.mission-controller', [
    'foundation.config', 'foundation.catalog', 'foundation.mission-evaluator'
  ], (Config, Catalog, MissionEvaluator) => {
    const { PHYSICS, TEST_RANGE } = Config;
    const { CONTRACTS } = Catalog;

    function create({
      THREE = window.THREE, Physics, state: STATE, craft: CRAFT,
      document: documentRef = window.document, landingPolicy: LANDING_POLICY,
      defaultOrientation: DEFAULT_ORIENTATION, missionMarkerGroup,
      services = {}, callbacks = {}
    } = {}) {
      if (!THREE?.Vector3 || !Physics || !STATE?.mission || !CRAFT || !LANDING_POLICY || !missionMarkerGroup) {
        throw new TypeError('Mission controller requires renderer/physics services, state, CraftModel, landing policy, and marker group.');
      }
      const document = documentRef;
      if (!services.flightSession) throw new TypeError('Mission controller requires FlightSession.');
      const {
        getContractById, isContractUnlocked, getSelectedContract, careerRank,
        recalculateCareerStars, saveCareer, flightSession
      } = services;
      const {
        computeCraftAnalysis, buildLoadedSnapshot, computeControlMetrics,
        collectBlueprint, cleanupFlightState, findOrientationId, commitHistory,
        updateTelemetry, autoSave, showStatus, updateHUD, disposeObjectTree,
        clearControlActions, setStabilize, setMode
      } = callbacks;

      function primaryBodyId() {
        return flightSession.isActive() ? flightSession.primaryBodyId() : null;
      }

      function primaryBodySample() {
        const bodyId = primaryBodyId();
        if (!bodyId) return null;
        return {
          bodyId,
          transform: flightSession.getBodyTransform(bodyId),
          velocity: flightSession.getBodyLinearVelocity(bodyId)
        };
      }

      function vector3(value) {
        return new THREE.Vector3(value.x, value.y, value.z);
      }

      function formatMissionTime(seconds) {
        const safe = Math.max(0, Math.floor(Number(seconds) || 0));
        const minutes = Math.floor(safe / 60);
        return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
      }

      function contractReadiness(contract, analysis = computeCraftAnalysis()) {
        if (contract.id === 'sandbox') return { level: 'good', text: 'Sandbox ignores mission constraints. Launch whenever the craft is physically valid.' };
        const loadedSnapshot = buildLoadedSnapshot(analysis.snapshot, contract.payloadMass || 0);
        const loadedControls = computeControlMetrics(loadedSnapshot);
        const effectiveWeight = loadedSnapshot.weight;
        const staticRatio = effectiveWeight > 0 ? analysis.staticLift / effectiveWeight : 0;
        const cruiseRatio = effectiveWeight > 0 ? analysis.cruiseLift / effectiveWeight : 0;
        const minimumControl = Math.min(loadedControls.controlRating.pitch, loadedControls.controlRating.yaw, loadedControls.controlRating.roll);
        const messages = [];
        let level = 'good';
        if (analysis.counts.Thruster + analysis.counts.VectorThruster + analysis.counts.Balloon === 0) { messages.push('No powered lift or propulsion.'); level = 'bad'; }
        if (analysis.fuelCapacity <= 0) { messages.push('No fuel reserve.'); level = 'bad'; }
        if (analysis.blockCount > PHYSICS.maxFlightParts) { messages.push(`This prototype flight solver supports up to ${PHYSICS.maxFlightParts} attached modules; this craft has ${analysis.blockCount}.`); level = 'bad'; }
        if (contract.kind === 'hover-return' && staticRatio < 1.02) { messages.push(`Loaded static lift is only ${staticRatio.toFixed(2)}× weight.`); level = staticRatio < 0.75 ? 'bad' : 'warn'; }
        if ((contract.kind === 'gate-course' || contract.kind === 'courier') && analysis.counts.Thruster + analysis.counts.VectorThruster <= 0) { messages.push('The route requires controllable propulsion.'); level = 'bad'; }
        if ((contract.kind === 'gate-course' || contract.kind === 'courier') && minimumControl < 0.12) { messages.push(`Loaded control authority falls to ${Math.round(minimumControl * 100)}% on the weakest axis.`); if (level !== 'bad') level = 'warn'; }
        if ((contract.kind === 'gate-course' || contract.kind === 'courier') && cruiseRatio < 0.75 && staticRatio < 0.9) { messages.push(`Loaded cruise lift is ${cruiseRatio.toFixed(2)}× weight.`); if (level !== 'bad') level = 'warn'; }
        if (contract.minFuelFraction) {
          const usableEndurance = analysis.enduranceSeconds * (1 - contract.minFuelFraction);
          const expectedDuration = contract.parTime || contract.timeLimit * 0.65;
          if (usableEndurance < expectedDuration) { messages.push(`Only ${formatDuration(usableEndurance)} estimated endurance is available before the required reserve.`); if (level !== 'bad') level = 'warn'; }
        }
        if (!messages.length) messages.push(`Loaded mass ${loadedSnapshot.mass.toFixed(1)} kg. Payload-adjusted balance and control appear suitable.`);
        return { level, text: messages.join(' '), loadedSnapshot, loadedControls, staticRatio, cruiseRatio };
      }

      function loadStarterCraft() {
        if (STATE.mode !== 'BUILD') return;
        const previous = collectBlueprint();
        cleanupFlightState();
        const upOrientation = findOrientationId(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
        /** @type {Array<[number, number, number, string, number]>} */
        const blocks = [
          [0,0,0,'Core',DEFAULT_ORIENTATION],
          [1,0,0,'Hull',DEFAULT_ORIENTATION],[-1,0,0,'Hull',DEFAULT_ORIENTATION],
          [0,0,1,'Hull',DEFAULT_ORIENTATION],[0,0,-1,'Hull',DEFAULT_ORIENTATION],
          [2,0,0,'Thruster',upOrientation],[-2,0,0,'Thruster',upOrientation],
          [0,0,2,'Thruster',upOrientation],[0,0,-2,'Thruster',upOrientation],
          [1,1,0,'VectorThruster',upOrientation],[-1,1,0,'VectorThruster',upOrientation],
          [0,1,1,'VectorThruster',upOrientation],[0,1,-1,'VectorThruster',upOrientation],
          [0,1,0,'Fuel',DEFAULT_ORIENTATION],[0,2,0,'Fuel',DEFAULT_ORIENTATION],
          [1,1,1,'Gyro',DEFAULT_ORIENTATION],[-1,1,-1,'Gyro',DEFAULT_ORIENTATION]
        ];
        const replacement = CRAFT.replace(blocks.map(([x, y, z, type, orientation]) => ({
          x, y, z, type, orientation, controlAxis: 'pitch', controlSign: 0
        })), 'load-starter-craft');
        if (!replacement.ok) {
          showStatus(`STARTER LOAD FAILED: ${replacement.reason}`, 1800);
          return;
        }
        STATE.selectedBlock = 'Hull';
        STATE.orientation = DEFAULT_ORIENTATION;
        STATE.symmetry = 'NONE';
        STATE.thrusterPower = 1;
        STATE.balloonPower = 0.7;
        STATE.stabilityAssist = 0.65;
        /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = '100';
        /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = '70';
        /** @type {HTMLInputElement} */ (document.getElementById('stability')).value = '65';
        document.querySelectorAll('.tool-btn').forEach(element => {
          const button = /** @type {HTMLElement} */ (element);
          button.classList.toggle('active', button.dataset.tool === STATE.selectedBlock);
        });
        commitHistory(previous);
        updateTelemetry();
        autoSave(false, true);
        showStatus('STARTER VTOL LOADED', 1200);
      }

      function renderContractPanel() {
        const list = document.getElementById('contract-list');
        if (!list) return;
        list.innerHTML = '';
        for (const contract of CONTRACTS) {
          const unlocked = isContractUnlocked(contract);
          const best = STATE.career.best[contract.id];
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `contract-card${STATE.career.selectedContractId === contract.id ? ' active' : ''}${unlocked ? '' : ' locked'}`;
          button.disabled = !unlocked;
          const safeStars = best ? THREE.MathUtils.clamp(Math.round(Number(best.stars) || 0), 0, 3) : 0;
          const stars = best ? `${'★'.repeat(safeStars)}${'☆'.repeat(3 - safeStars)}` : '☆☆☆';
          button.innerHTML = `<div class="contract-card-top"><span class="contract-card-title">${contract.title}</span><span class="contract-stars">${contract.id === 'sandbox' ? 'FREE' : stars}</span></div><div class="contract-card-meta">${unlocked ? contract.short : `Locked • Complete ${getContractById(contract.prerequisite).title}`}</div>`;
          button.addEventListener('click', () => selectContract(contract.id));
          list.appendChild(button);
        }

        const contract = getSelectedContract();
        document.getElementById('ui-credits').textContent = String(Math.round(STATE.career.credits));
        document.getElementById('ui-total-stars').textContent = String(STATE.career.totalStars);
        document.getElementById('ui-career-rank').textContent = careerRank();
        document.getElementById('ui-contract-title').textContent = contract.title;
        document.getElementById('ui-contract-subtitle').textContent = contract.short;
        document.getElementById('ui-contract-reward').textContent = `${contract.reward} cr`;
        document.getElementById('ui-contract-description').textContent = contract.description;
        document.getElementById('ui-contract-time').textContent = contract.timeLimit ? formatMissionTime(contract.timeLimit) : '—';
        document.getElementById('ui-contract-payload').textContent = `${contract.payloadMass || 0} kg`;
        const objectives = document.getElementById('ui-contract-objectives');
        objectives.innerHTML = contract.objectives.map(objective => `<div class="objective-line">${objective}</div>`).join('');
        const routeNotes = document.getElementById('ui-contract-route-notes');
        if (routeNotes) {
          const notes = [
            contract.routeLabel ? ['Route', contract.routeLabel] : null,
            Array.isArray(contract.engineeringFocus) && contract.engineeringFocus.length ? ['Focus', contract.engineeringFocus.join(', ')] : null,
            Array.isArray(contract.recommendedModules) && contract.recommendedModules.length ? ['Build', contract.recommendedModules.join(', ')] : null,
            Array.isArray(contract.hazards) && contract.hazards.length ? ['Watch', contract.hazards.join(', ')] : null
          ].filter(Boolean);
          routeNotes.innerHTML = notes.map(([label, value]) => `<div class="contract-note"><span>${label}</span><strong>${value}</strong></div>`).join('');
        }
        const readiness = contractReadiness(contract);
        const readinessEl = document.getElementById('ui-contract-readiness');
        readinessEl.className = `contract-readiness mt-3 ${readiness.level}`;
        readinessEl.textContent = readiness.text;
        const flightButton = document.getElementById('btn-flight');
        if (flightButton && STATE.mode === 'BUILD') flightButton.textContent = contract.id === 'sandbox' ? 'Launch Sandbox Test' : `Launch ${contract.title.replace(/^\d+\s*[-•]\s*/, '')}`;
      }

      function selectContract(id) {
        if (STATE.mode !== 'BUILD') return;
        const contract = getContractById(id);
        if (!isContractUnlocked(contract)) return;
        STATE.career.selectedContractId = contract.id;
        saveCareer();
        renderContractPanel();
        updateHUD();
      }

      function clearMissionMarkers() {
        for (const child of [...missionMarkerGroup.children]) {
          missionMarkerGroup.remove(child);
          disposeObjectTree(child);
        }
        STATE.mission.markers = [];
      }

      function createGateMarker(gate, index) {
        const root = new THREE.Group();
        root.position.set(gate.x, gate.y, gate.z);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(gate.radius, 0.28, 12, 56),
          new THREE.MeshBasicMaterial({ color: index === 0 ? 0x38bdf8 : 0x64748b, transparent: true, opacity: index === 0 ? 0.9 : 0.34 })
        );
        ring.rotation.y = Math.PI / 2;
        root.add(ring);
        const inner = new THREE.Mesh(
          new THREE.TorusGeometry(gate.radius * 0.72, 0.08, 8, 48),
          new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.24 })
        );
        inner.rotation.y = Math.PI / 2;
        root.add(inner);
        missionMarkerGroup.add(root);
        STATE.mission.markers.push({ type: 'gate', root, ring, index });
      }

      function createLandingMarker(zone, label) {
        const root = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(zone.radius * 0.82, 0.3, 12, 56),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.75 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(zone.x, -0.16, zone.z);
        root.add(ring);
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 18, 8),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.26 })
        );
        beacon.position.set(zone.x, 8.5, zone.z);
        root.add(beacon);
        root.userData.label = label;
        missionMarkerGroup.add(root);
        STATE.mission.markers.push({ type: 'landing', root, ring, index: -1, zone, label });
      }

      function landingZonesForContract(contract) {
        const ids = Array.isArray(contract?.landingZones) && contract.landingZones.length
          ? contract.landingZones
          : (contract?.kind === 'hover-return' ? ['startPad'] : ['finishPad']);
        return ids.map(id => ({ id, zone: TEST_RANGE.pads?.[id] || TEST_RANGE[id] })).filter(entry => entry.zone);
      }

      function prepareMissionMarkers(contract) {
        clearMissionMarkers();
        if (contract.gates) contract.gates.forEach((gate, index) => createGateMarker(gate, index));
        for (const entry of landingZonesForContract(contract)) {
          createLandingMarker(entry.zone, (entry.zone.label || (entry.id === 'startPad' ? 'Launch Pad' : 'Remote Pad')).toUpperCase());
        }
        missionMarkerGroup.visible = STATE.mode === 'FLIGHT';
      }

      function refreshMissionMarkerStates() {
        const setMarkerColor = (material, hex) => {
          if (material?.color && typeof material.color.setHex === 'function') material.color.setHex(hex);
          else if (material) material.color = hex;
        };
        const contract = getContractById(STATE.mission.contractId || STATE.career.selectedContractId);
        const landingActive = contract && (contract.kind === 'hover-return' ? STATE.mission.phase > 0 : STATE.mission.gateIndex >= (contract.gates?.length || 0));
        for (const marker of STATE.mission.markers) {
          if (marker.type === 'gate') {
            const passed = marker.index < STATE.mission.gateIndex;
            const active = marker.index === STATE.mission.gateIndex;
            setMarkerColor(marker.ring.material, passed ? 0x34d399 : (active ? 0x38bdf8 : 0x64748b));
            marker.ring.material.opacity = passed ? 0.42 : (active ? 0.92 : 0.26);
            marker.root.scale.setScalar(active ? 1 + Math.sin(STATE.mission.elapsed * 3) * 0.035 : 1);
          } else if (marker.type === 'landing') {
            setMarkerColor(marker.ring.material, landingActive ? 0xfbbf24 : 0x64748b);
            marker.ring.material.opacity = landingActive ? 0.95 : 0.18;
            marker.root.scale.setScalar(landingActive ? 1 + Math.sin(STATE.mission.elapsed * 4) * 0.055 : 1);
            for (const child of marker.root.children) {
              if (child !== marker.ring && child.material) child.material.opacity = landingActive ? 0.42 : 0.10;
            }
          }
        }
      }

      function isDebriefVisible() {
        const modal = document.getElementById('debrief-modal');
        return Boolean(modal && !modal.hidden);
      }

      function setHelpVisible(visible) {
        const modal = document.getElementById('help-modal');
        modal.style.display = visible ? 'flex' : 'none';
        if (visible && STATE.mode === 'FLIGHT' && STATE.mission.status === 'ACTIVE' && !STATE.mission.paused) {
          STATE.mission.helpPaused = true;
          STATE.mission.paused = true;
          clearControlActions();
        } else if (!visible && STATE.mission.helpPaused) {
          STATE.mission.helpPaused = false;
          if (STATE.mission.status === 'ACTIVE') STATE.mission.paused = false;
        }
      }

      function gateNormalVector(gate) {
        const raw = gate.normal || { x: 1, y: 0, z: 0 };
        const normal = new THREE.Vector3(Number(raw.x) || 0, Number(raw.y) || 0, Number(raw.z) || 0);
        if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);
        return normal.normalize();
      }

      function segmentCrossesGate(previous, current, gate) {
        if (!previous || !current) return false;
        const center = new THREE.Vector3(gate.x, gate.y, gate.z);
        const normal = gateNormalVector(gate);
        const from = new THREE.Vector3(previous.x, previous.y, previous.z);
        const to = new THREE.Vector3(current.x, current.y, current.z);
        const startDistance = from.clone().sub(center).dot(normal);
        const endDistance = to.clone().sub(center).dot(normal);
        if (!(startDistance < 0 && endDistance >= 0)) return false;
        const denominator = startDistance - endDistance;
        if (Math.abs(denominator) < 1e-6) return false;
        const t = THREE.MathUtils.clamp(startDistance / denominator, 0, 1);
        const intersection = from.lerp(to, t);
        const radial = intersection.sub(center);
        radial.sub(normal.clone().multiplyScalar(radial.dot(normal)));
        return radial.length() <= gate.radius;
      }

      function isStableHover(contract) {
        const sample = primaryBodySample();
        if (!sample) return false;
        const altitude = currentCraftAltitude();
        const target = Number(contract.targetAltitude) || 0;
        const horizontalSpeed = Math.hypot(sample.velocity.x, sample.velocity.z);
        return altitude >= target && altitude <= target + 6
          && Math.abs(sample.velocity.y) <= 2.4
          && horizontalSpeed <= 5.5
          && craftTiltDegrees(sample.bodyId) <= 42;
      }

      function payloadHealthFraction() {
        const payload = STATE.flight.payload;
        return payload?.attached && payload.maxHealth > 0
          ? THREE.MathUtils.clamp(payload.health / payload.maxHealth, 0, 1)
          : 0;
      }

      function landingObjectiveText(zones, destinationLabel) {
        const zoneList = Array.isArray(zones) ? zones : [zones];
        const result = STATE.mission.landingAssessment || evaluateCraftLandingZones(zoneList);
        const assessment = result?.assessment || result;
        if (!assessment) return destinationLabel;
        if (!assessment.insideZone) return `${destinationLabel} • nearest ${assessment.horizontalDistance.toFixed(0)} m`;
        if (!assessment.grounded) return `Descend onto the highlighted pad • clearance ${Math.max(0, assessment.groundClearance).toFixed(2)} m`;
        if (!assessment.horizontalSpeedOk || !assessment.verticalSpeedOk || !assessment.totalSpeedOk) {
          return `Settle the craft • horizontal ${assessment.horizontalSpeed.toFixed(1)} m/s • vertical ${assessment.verticalSpeed.toFixed(1)} m/s`;
        }
        if (!assessment.tiltOk) return `Level the craft • tilt ${assessment.tiltDegrees.toFixed(0)}°`;
        const remaining = Math.max(0, LANDING_POLICY.requiredHoldSeconds - STATE.mission.landingHold);
        return `Landing confirmed • hold still ${remaining.toFixed(1)} s`;
      }

      function missionObjectiveText(contract) {
        const sample = primaryBodySample();
        if (contract.id === 'sandbox') return 'Free flight • F returns to workshop';
        if (contract.kind === 'hover-return') {
          if (STATE.mission.phase === 0) {
            const target = contract.targetAltitude;
            const altitude = currentCraftAltitude();
            return STATE.mission.holdTime > 0
              ? `Stabilize at ${target}–${target + 6} m • ${Math.max(0, contract.holdSeconds - STATE.mission.holdTime).toFixed(1)} s`
              : `Climb to ${target} m, slow down and level out • now ${altitude.toFixed(1)} m`;
          }
          const zones = landingZonesForContract(contract).map(entry => entry.zone);
          return landingObjectiveText(zones, zones.length > 1 ? 'Settle on either highlighted pad' : 'Return and settle on the launch pad');
        }
        if (contract.gates && STATE.mission.gateIndex < contract.gates.length) {
          const gate = contract.gates[STATE.mission.gateIndex];
          const position = sample?.transform.position;
          const distance = position ? Math.hypot(position.x - gate.x, position.y - gate.y, position.z - gate.z) : 0;
          return `Pass gate ${STATE.mission.gateIndex + 1} of ${contract.gates.length} • ${distance.toFixed(0)} m`;
        }
        const landingText = landingObjectiveText(landingZonesForContract(contract).map(entry => entry.zone), 'Land on the highlighted remote pad');
        if (contract.kind === 'courier') return `${landingText} • fuel ≥${Math.round(contract.minFuelFraction * 100)}% • cargo ≥${Math.round((contract.minPayloadIntegrity || 0) * 100)}%`;
        return landingText;
      }

      function missionProgress(contract) {
        if (contract.id === 'sandbox') return 0;
        if (contract.kind === 'hover-return') {
          if (STATE.mission.phase === 0) {
            const altitudeShare = 0.36;
            const holdShare = 0.26;
            const altitudeProgress = contract.targetAltitude > 0 ? THREE.MathUtils.clamp(currentCraftAltitude() / contract.targetAltitude, 0, 1) : 1;
            const holdProgress = contract.holdSeconds > 0 ? THREE.MathUtils.clamp(STATE.mission.holdTime / contract.holdSeconds, 0, 1) : 1;
            return altitudeProgress * altitudeShare + holdProgress * holdShare;
          }
          return 0.62 + Math.min(0.38, STATE.mission.landingHold / LANDING_POLICY.requiredHoldSeconds * 0.38);
        }
        const gateCount = contract.gates?.length || 0;
        const routeShare = gateCount ? 0.72 : 0;
        return gateCount ? Math.min(routeShare, STATE.mission.gateIndex / gateCount * routeShare) + (STATE.mission.gateIndex >= gateCount ? Math.min(0.28, STATE.mission.landingHold / LANDING_POLICY.requiredHoldSeconds * 0.28) : 0) : 0;
      }

      function updateMissionHud() {
        const hud = document.getElementById('mission-hud');
        if (!hud) return;
        const contract = getContractById(STATE.mission.contractId || STATE.career.selectedContractId);
        const visible = STATE.mode === 'FLIGHT' && flightSession.isActive();
        hud.dataset.missionActive = String(visible);
        if (!visible) return;
        refreshMissionMarkerStates();
        document.getElementById('mission-hud-title').textContent = contract.title;
        document.getElementById('mission-hud-objective').textContent = missionObjectiveText(contract);
        document.getElementById('mission-hud-timer').textContent = contract.timeLimit
          ? `${formatMissionTime(STATE.mission.elapsed)} / ${formatMissionTime(contract.timeLimit)}`
          : formatMissionTime(STATE.mission.elapsed);
        const gateTotal = contract.gates?.length || 0;
        document.getElementById('mission-hud-progress').textContent = contract.kind === 'hover-return'
          ? (STATE.mission.phase === 0 ? 'ALTITUDE' : 'RECOVERY')
          : (gateTotal ? `${Math.min(STATE.mission.gateIndex, gateTotal)} / ${gateTotal} GATES` : 'FREE');
        document.getElementById('mission-hud-integrity').textContent = `${Math.round(STATE.flight.integrity)}%`;
        const fuelFraction = STATE.flight.fuelMax > 0 ? STATE.flight.fuel / STATE.flight.fuelMax : 0;
        document.getElementById('mission-hud-fuel').textContent = `${Math.round(fuelFraction * 100)}%`;
        document.getElementById('mission-hud-impact').textContent = `${STATE.mission.maxImpact.toFixed(1)} m/s`;
        document.getElementById('mission-hud-lost').textContent = String(STATE.flight.lostParts);
        document.getElementById('mission-hud-leak').textContent = `${STATE.flight.leakingFuelRate.toFixed(2)}/s`;
        const payloadReadout = document.getElementById('mission-hud-payload');
        if (payloadReadout) {
          payloadReadout.textContent = contract.payloadMass > 0
            ? (STATE.flight.payload?.attached ? `${Math.round(payloadHealthFraction() * 100)}%` : 'LOST')
            : '—';
        }
        document.getElementById('mission-progress-fill').style.width = `${Math.round(missionProgress(contract) * 100)}%`;
      }

      function craftTiltDegrees(bodyId = primaryBodyId()) {
        if (!bodyId) return 0;
        const up = flightSession.vectorToWorldFrame(bodyId, { x: 0, y: 1, z: 0 });
        const length = Math.hypot(up.x, up.y, up.z);
        return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.y / Math.max(0.0001, length), -1, 1)));
      }

      function estimateCraftGroundClearance() {
        const sample = primaryBodySample();
        if (!sample) return Number.POSITIVE_INFINITY;
        const { bodyId, transform } = sample;
        const voxelExtent = MissionEvaluator.boxVerticalHalfExtent(transform.quaternion, { x: 0.5, y: 0.5, z: 0.5 });
        let lowestWorldY = Number.POSITIVE_INFINITY;
        for (const part of STATE.flight.runtimePartsByBodyId?.get(String(bodyId)) || []) {
          if (!part.attached || !part.bodyLocalPosition) continue;
          const centerY = MissionEvaluator.projectLocalPointY(transform.position, transform.quaternion, part.bodyLocalPosition);
          lowestWorldY = Math.min(lowestWorldY, centerY - voxelExtent);
        }
        const payload = STATE.flight.payload;
        if (payload?.attached && payload.bodyLocalPosition && payload.bodyId === bodyId) {
          const payloadCenterY = MissionEvaluator.projectLocalPointY(transform.position, transform.quaternion, payload.bodyLocalPosition);
          const payloadExtent = MissionEvaluator.boxVerticalHalfExtent(transform.quaternion, { x: 0.42, y: 0.42, z: 0.42 });
          lowestWorldY = Math.min(lowestWorldY, payloadCenterY - payloadExtent);
        }
        if (!Number.isFinite(lowestWorldY)) lowestWorldY = transform.position.y + STATE.flight.lowestLocalY;
        return lowestWorldY - TEST_RANGE.groundY;
      }

      function currentCraftAltitude() {
        const clearance = estimateCraftGroundClearance();
        return Number.isFinite(clearance) ? Math.max(0, clearance) : 0;
      }

      function landingSample() {
        const sample = primaryBodySample();
        if (!sample) return null;
        return {
          position: sample.transform.position,
          velocity: sample.velocity,
          tiltDegrees: craftTiltDegrees(sample.bodyId),
          groundClearance: estimateCraftGroundClearance(),
          contactAge: STATE.mission.elapsed - STATE.mission.lastGroundContact
        };
      }

      function evaluateCraftLanding(zone) {
        const sample = landingSample();
        return sample ? MissionEvaluator.evaluateLanding(sample, zone, LANDING_POLICY) : null;
      }

      function evaluateCraftLandingZones(zones) {
        const sample = landingSample();
        return sample ? MissionEvaluator.evaluateLandingZones(sample, zones, LANDING_POLICY) : null;
      }

      function isCraftSettledAtAny(zones) {
        const result = evaluateCraftLandingZones(zones);
        STATE.mission.landingAssessment = result;
        return Boolean(result?.settled);
      }

      function startMissionSession() {
        const contract = getSelectedContract();
        STATE.mission.contractId = contract.id;
        STATE.mission.active = contract.id !== 'sandbox';
        STATE.mission.paused = false;
        STATE.mission.status = 'ACTIVE';
        STATE.mission.elapsed = 0;
        STATE.mission.phase = 0;
        STATE.mission.gateIndex = 0;
        STATE.mission.holdTime = 0;
        STATE.mission.landingHold = 0;
        STATE.mission.landingAssessment = null;
        STATE.mission.lastGroundContact = -Infinity;
        STATE.mission.maxAltitude = 0;
        STATE.mission.maxSpeed = 0;
        STATE.mission.maxImpact = 0;
        STATE.mission.startFuel = STATE.flight.fuel;
        STATE.mission.result = null;
        const sample = primaryBodySample();
        STATE.mission.previousPosition = sample ? vector3(sample.transform.position) : null;
        STATE.mission.helpPaused = false;
        prepareMissionMarkers(contract);
        document.getElementById('debrief-modal').hidden = true;
        updateMissionHud();
      }

      function calculateMissionStars(contract, success) {
        if (!success || contract.id === 'sandbox') return 0;
        let stars = 1;
        const fuelFraction = STATE.flight.fuelMax > 0 ? STATE.flight.fuel / STATE.flight.fuelMax : 0;
        const payloadFraction = contract.payloadMass > 0 ? payloadHealthFraction() : 1;
        if (STATE.flight.integrity >= 70 && payloadFraction >= Math.max(contract.minPayloadIntegrity || 0, 0.72) && (!contract.parTime || STATE.mission.elapsed <= contract.parTime * 1.25)) stars += 1;
        if (STATE.flight.integrity >= 92 && payloadFraction >= 0.92 && (!contract.parTime || STATE.mission.elapsed <= contract.parTime) && fuelFraction >= (contract.minFuelFraction || 0.18)) stars += 1;
        return Math.min(3, stars);
      }

      function showDebrief(result) {
        const modal = document.getElementById('debrief-modal');
        modal.hidden = false;
        document.getElementById('debrief-kicker').textContent = result.success ? 'CONTRACT COMPLETE' : 'FLIGHT TERMINATED';
        document.getElementById('debrief-title').textContent = result.title;
        document.getElementById('debrief-summary').textContent = result.summary;
        document.getElementById('debrief-stars').textContent = `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`;
        document.getElementById('debrief-time').textContent = formatMissionTime(result.elapsed);
        document.getElementById('debrief-fuel').textContent = `${Math.round(result.fuelFraction * 100)}%`;
        document.getElementById('debrief-integrity').textContent = `${Math.round(result.integrity)}%`;
        document.getElementById('debrief-impact').textContent = `${result.maxImpact.toFixed(1)} m/s`;
        document.getElementById('debrief-altitude').textContent = `${result.maxAltitude.toFixed(1)} m`;
        document.getElementById('debrief-reward').textContent = `${result.reward} cr`;
        document.getElementById('debrief-lost').textContent = String(result.lostParts);
        const payloadDebrief = document.getElementById('debrief-payload');
        if (payloadDebrief) {
          payloadDebrief.textContent = result.payloadRequired
            ? (result.payloadLost ? 'LOST' : `${Math.round(result.payloadIntegrity * 100)}%`)
            : '—';
        }
        document.getElementById('debrief-failure').textContent = result.firstFailure || 'No structural failure';
        document.getElementById('debrief-notes').textContent = result.notes;
        document.getElementById('btn-debrief-retry').hidden = result.contractId === 'sandbox';
      }

      function finishMission(success, reason = '') {
        if (STATE.mission.paused || STATE.mission.status !== 'ACTIVE') return;
        const contract = getContractById(STATE.mission.contractId);
        const fuelFraction = STATE.flight.fuelMax > 0 ? STATE.flight.fuel / STATE.flight.fuelMax : 0;
        if (success && contract.minFuelFraction && fuelFraction < contract.minFuelFraction) {
          success = false;
          reason = `Delivery reserve missed: ${Math.round(fuelFraction * 100)}% fuel remained.`;
        }
        const deliveredPayloadIntegrity = payloadHealthFraction();
        if (success && contract.payloadMass > 0 && deliveredPayloadIntegrity < (contract.minPayloadIntegrity || 0)) {
          success = false;
          reason = `Cargo integrity was only ${Math.round(deliveredPayloadIntegrity * 100)}%; the contract requires ${Math.round((contract.minPayloadIntegrity || 0) * 100)}%.`;
        }
        const stars = calculateMissionStars(contract, success);
        const firstCompletion = !STATE.career.completed[contract.id];
        const reward = success && contract.id !== 'sandbox' ? Math.round(contract.reward * (firstCompletion ? 1 : 0.25) + stars * 35) : 0;
        if (success && contract.id !== 'sandbox') {
          STATE.career.credits += reward;
          STATE.career.completed[contract.id] = true;
          const previous = STATE.career.best[contract.id];
          if (!previous || stars > previous.stars || (stars === previous.stars && STATE.mission.elapsed < previous.time)) {
            STATE.career.best[contract.id] = { stars, time: STATE.mission.elapsed, fuelFraction, integrity: STATE.flight.integrity };
          }
          recalculateCareerStars();
          saveCareer();
        }
        STATE.mission.status = success ? 'SUCCESS' : 'FAILED';
        STATE.mission.active = false;
        STATE.mission.paused = true;
        STATE.mission.helpPaused = false;
        clearControlActions();
        setStabilize(false);
        const bodyId = primaryBodyId();
        if (bodyId) flightSession.clearBodyMotion(bodyId);
        const result = {
          success, contractId: contract.id, stars, reward,
          elapsed: STATE.mission.elapsed,
          fuelFraction,
          integrity: STATE.flight.integrity,
          maxImpact: STATE.mission.maxImpact,
          maxAltitude: STATE.mission.maxAltitude,
          lostParts: STATE.flight.lostParts,
          payloadRequired: contract.payloadMass > 0,
          payloadIntegrity: deliveredPayloadIntegrity,
          payloadLost: contract.payloadMass > 0 && !STATE.flight.payload?.attached,
          firstFailure: STATE.flight.firstFailure,
          title: success ? `${contract.title} complete` : `${contract.title} failed`,
          summary: success ? 'The test objectives were completed and the flight data has been accepted by the workshop.' : (reason || 'The test ended before all objectives were completed.'),
          notes: success
            ? `${firstCompletion ? 'First completion reward awarded.' : 'Repeat-flight reward awarded at reduced rate.'} ${stars === 3 ? 'The machine met the workshop gold standard.' : 'Improve time, fuel reserve and landing quality to earn more stars.'}`
            : `Review the engineering analysis and impact speed before the next attempt.${STATE.flight.firstFailure ? ` First failure: ${STATE.flight.firstFailure}.` : ''}`
        };
        STATE.mission.result = result;
        showDebrief(result);
        renderContractPanel();
        updateMissionHud();
      }

      function updateMission(dt) {
        if (STATE.mission.status !== 'ACTIVE' || STATE.mission.paused || !flightSession.isActive()) return;
        const contract = getContractById(STATE.mission.contractId);
        const sample = primaryBodySample();
        if (!sample) return;
        const currentPosition = vector3(sample.transform.position);
        const previousPosition = STATE.mission.previousPosition || currentPosition.clone();
        STATE.mission.elapsed += dt;
        const altitude = currentCraftAltitude();
        const speed = Math.hypot(sample.velocity.x, sample.velocity.y, sample.velocity.z);
        STATE.mission.maxAltitude = Math.max(STATE.mission.maxAltitude, altitude);
        STATE.mission.maxSpeed = Math.max(STATE.mission.maxSpeed, speed);
        STATE.mission.maxImpact = Math.max(STATE.mission.maxImpact, STATE.flight.maxImpact || 0);

        const finishFrame = () => { STATE.mission.previousPosition = currentPosition; };
        const position = sample.transform.position;
        if (Math.abs(position.x) > TEST_RANGE.bounds || Math.abs(position.z) > TEST_RANGE.bounds || position.y > TEST_RANGE.maxAltitude) {
          finishFrame(); finishMission(false, 'The craft left the authorized test range.'); return;
        }
        if (STATE.flight.integrity <= 0) {
          finishFrame(); finishMission(false, 'Structural integrity reached zero.'); return;
        }
        if (contract.payloadMass > 0 && !STATE.flight.payload?.attached) {
          finishFrame(); finishMission(false, 'The contract payload was lost.'); return;
        }
        if (contract.timeLimit && STATE.mission.elapsed > contract.timeLimit) {
          finishFrame(); finishMission(false, 'The contract time limit expired.'); return;
        }
        if (contract.id === 'sandbox') { finishFrame(); return; }

        if (contract.kind === 'hover-return') {
          if (STATE.mission.phase === 0) {
            if (isStableHover(contract)) STATE.mission.holdTime += dt;
            else STATE.mission.holdTime = Math.max(0, STATE.mission.holdTime - dt * 1.8);
            if (STATE.mission.holdTime >= contract.holdSeconds) {
              STATE.mission.phase = 1;
              STATE.mission.landingHold = 0;
              STATE.mission.landingAssessment = null;
              showStatus('STABLE HOVER PASSED', 1400);
            }
          } else {
            const settled = isCraftSettledAtAny(landingZonesForContract(contract).map(entry => entry.zone));
            STATE.mission.landingHold = MissionEvaluator.advanceHold(STATE.mission.landingHold, dt, settled, LANDING_POLICY);
            if (STATE.mission.landingHold >= LANDING_POLICY.requiredHoldSeconds) { finishFrame(); finishMission(true); return; }
          }
        } else {
          const gates = contract.gates || [];
          if (STATE.mission.gateIndex < gates.length) {
            STATE.mission.landingAssessment = null;
            const gate = gates[STATE.mission.gateIndex];
            if (segmentCrossesGate(previousPosition, currentPosition, gate)) {
              STATE.mission.gateIndex += 1;
              STATE.mission.landingHold = 0;
              showStatus(`GATE ${STATE.mission.gateIndex} PASSED`, 1000);
            }
          } else {
            const settled = isCraftSettledAtAny(landingZonesForContract(contract).map(entry => entry.zone));
            STATE.mission.landingHold = MissionEvaluator.advanceHold(STATE.mission.landingHold, dt, settled, LANDING_POLICY);
            if (STATE.mission.landingHold >= LANDING_POLICY.requiredHoldSeconds) { finishFrame(); finishMission(true); return; }
          }
        }
        finishFrame();
      }

      function requestReturnToWorkshop() {
        if (STATE.mode !== 'FLIGHT') return;
        if (STATE.mission.status === 'ACTIVE' && STATE.mission.contractId !== 'sandbox') {
          finishMission(false, 'The test flight was aborted by the pilot.');
        } else {
          setMode('BUILD');
        }
      }

      function returnToWorkshopFromDebrief() {
        document.getElementById('debrief-modal').hidden = true;
        STATE.mission.paused = false;
        STATE.mission.helpPaused = false;
        setMode('BUILD');
      }

      function retryContractFromDebrief() {
        document.getElementById('debrief-modal').hidden = true;
        STATE.mission.paused = false;
        STATE.mission.helpPaused = false;
        setMode('BUILD');
        setMode('FLIGHT');
      }

      return Object.freeze({
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
      });
    }

    return Object.freeze({ create });
  });
})();
