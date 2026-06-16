(() => {
  'use strict';

  window.VAW.define('game.engineering-analysis', [
    'foundation.config', 'foundation.catalog', 'foundation.craft-compiler',
    'foundation.runtime-assembly', 'foundation.flight-control'
  ], (Config, Catalog, CraftCompiler, RuntimeAssembly, FlightControl) => {
    const { GRID, PHYSICS, MISSION_PAYLOAD_POSITION } = Config;
    const { BLOCKS } = Catalog;

    function create({
      THREE = window.THREE, state: STATE, craft: CRAFT, document: documentRef = window.document,
      aerostaticPolicy: AEROSTATIC_POLICY, makeKey, getModuleBasis, controlAxisVector,
      markers = {}
    } = {}) {
      if (!THREE?.Vector3 || !STATE || !CRAFT || !AEROSTATIC_POLICY) {
        throw new TypeError('Engineering analysis requires THREE, application state, CraftModel, and aerostatic policy.');
      }
      if (typeof makeKey !== 'function' || typeof getModuleBasis !== 'function' || typeof controlAxisVector !== 'function') {
        throw new TypeError('Engineering analysis requires key and orientation helpers.');
      }
      const document = documentRef;
      const { comSphere, thrustSphere, liftSphere, thrustVectorArrow, liftVectorArrow } = markers;

      function formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '—';
        if (seconds < 60) return `${Math.round(seconds)} s`;
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.round(seconds % 60);
        return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
      }

      function vectorComponent(vector, axis) {
        return axis === 'x' ? vector.x : (axis === 'y' ? vector.y : vector.z);
      }

      function computeWingCoefficients(chordSpeed, normalSpeed) {
        const effectiveSpeed = Math.abs(chordSpeed);
        if (effectiveSpeed < 0.25) {
          return { effectiveSpeed, angleOfAttack: 0, stallFactor: 1, liftCoefficient: 0, dragCoefficient: 0.04 };
        }
        const angleOfAttack = Math.atan2(-normalSpeed, effectiveSpeed + 0.15);
        const absoluteAoA = Math.abs(angleOfAttack);
        let stallFactor = 1;
        if (absoluteAoA > PHYSICS.wingStallStart) {
          stallFactor = 1 - (absoluteAoA - PHYSICS.wingStallStart) / (PHYSICS.wingStallEnd - PHYSICS.wingStallStart);
          stallFactor = THREE.MathUtils.clamp(stallFactor, 0.10, 1);
        }
        const liftCoefficient = THREE.MathUtils.clamp(
          (PHYSICS.wingBaseLiftCoefficient + angleOfAttack * PHYSICS.wingLiftSlope) * stallFactor,
          -1.45,
          1.60
        );
        const dragCoefficient = 0.035 + 0.09 * liftCoefficient * liftCoefficient + (1 - stallFactor) * 0.28;
        return { effectiveSpeed, angleOfAttack, stallFactor, liftCoefficient, dragCoefficient };
      }

      function evaluateWingAtVelocityThree(part, velocity) {
        const speed = velocity.length();
        const zero = new THREE.Vector3();
        if (speed < 0.25) return { force: zero, lift: 0, drag: 0, angleOfAttack: 0, stallFactor: 1 };

        const velocityDirection = velocity.clone().divideScalar(speed);
        const chordSpeed = velocity.dot(part.basis.chord);
        const normalSpeed = velocity.dot(part.basis.normal);
        const spanSpeed = velocity.dot(part.basis.span);
        const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
        const dynamicPressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
        const isControlSurface = part.type === 'ControlSurface';
        const liftCoefficient = coefficients.liftCoefficient * (isControlSurface ? 0.45 : 1);
        const dragCoefficient = isControlSurface
          ? 0.045 + 0.12 * liftCoefficient * liftCoefficient
          : coefficients.dragCoefficient;
        const liftMagnitude = dynamicPressure * part.def.wingArea * liftCoefficient;
        const mainDrag = dynamicPressure * part.def.wingArea * dragCoefficient;
        const crossflowSpeedSq = normalSpeed * normalSpeed + spanSpeed * spanSpeed;
        const crossflowDrag = 0.5 * PHYSICS.airDensity * crossflowSpeedSq * part.def.wingArea * PHYSICS.crossflowDragCoefficient;

        const liftDirection = part.basis.normal.clone().sub(
          velocityDirection.clone().multiplyScalar(part.basis.normal.dot(velocityDirection))
        );
        if (liftDirection.lengthSq() > 0.0001) liftDirection.normalize();
        else liftDirection.set(0, 0, 0);

        const dragMagnitude = mainDrag + crossflowDrag;
        const force = liftDirection.multiplyScalar(liftMagnitude)
          .add(velocityDirection.clone().multiplyScalar(-dragMagnitude));
        return {
          force,
          lift: Math.abs(liftMagnitude),
          drag: Math.abs(dragMagnitude),
          angleOfAttack: coefficients.angleOfAttack,
          stallFactor: coefficients.stallFactor
        };
      }

      function buildCraftSnapshot() {
        const compiled = CraftCompiler.compile(CRAFT);
        const rootBody = compiled.rootBodyId ? compiled.bodyById[compiled.rootBodyId] : null;
        return {
          compiled,
          ready: compiled.ready,
          errors: [...compiled.errors],
          diagnostics: [...compiled.diagnostics],
          mass: compiled.mass,
          weight: compiled.weight,
          fuelCapacity: compiled.fuelCapacity,
          dragArea: compiled.dragArea,
          assemblyCenterOfMass: new THREE.Vector3(...compiled.assemblyCenterOfMass),
          aggregateInertia: new THREE.Vector3(...compiled.aggregateInertiaDiagonal),
          rootBodyInertia: new THREE.Vector3(...(rootBody?.massProperties?.inertiaDiagonal || [1, 1, 1])),
          counts: { ...compiled.counts },
          rootBodyId: compiled.rootBodyId,
          coreKey: compiled.coreKey,
          coreAssemblyPosition: compiled.coreAssemblyPosition ? new THREE.Vector3(...compiled.coreAssemblyPosition) : null,
          parts: compiled.parts.map(part => {
            const def = BLOCKS[part.type];
            const assemblyPosition = new THREE.Vector3(...part.assemblyPosition);
            const bodyLocalPosition = new THREE.Vector3(...part.bodyLocalPosition);
            const basis = {
              chord: new THREE.Vector3(...part.basis.forward),
              normal: new THREE.Vector3(...part.basis.up),
              span: new THREE.Vector3(...part.basis.span)
            };
            const fullForce = (part.type === 'Thruster' || part.type === 'VectorThruster')
              ? basis.chord.clone().multiplyScalar(def.force || 0)
              : new THREE.Vector3();
            return {
              index: part.index,
              blockId: part.blockId,
              bodyId: part.bodyId,
              key: part.gridKey,
              type: part.type,
              assemblyPosition,
              bodyLocalPosition,
              orientation: part.orientation,
              basis,
              def,
              controlAxis: part.controlAxis,
              controlSign: part.controlSign,
              fullForce,
              localTorque: bodyLocalPosition.clone().cross(fullForce),
              rigidNeighborBlockIds: [...part.rigidNeighborBlockIds]
            };
          })
        };
      }


      function computeMixerCommandFromTorque(localTorque, pilot, basePower, torqueMax) {
        const base = THREE.MathUtils.clamp(Number(basePower) || 0, 0, 1);
        let score = 0;
        let activeAxes = 0;
        if (Math.abs(pilot.roll) > 0.0001 && torqueMax.x > 0.0001) {
          score += pilot.roll * localTorque.x / torqueMax.x;
          activeAxes += 1;
        }
        if (Math.abs(pilot.yaw) > 0.0001 && torqueMax.y > 0.0001) {
          score += pilot.yaw * localTorque.y / torqueMax.y;
          activeAxes += 1;
        }
        if (Math.abs(pilot.pitch) > 0.0001 && torqueMax.z > 0.0001) {
          score += pilot.pitch * localTorque.z / torqueMax.z;
          activeAxes += 1;
        }
        if (activeAxes > 1) score /= Math.sqrt(activeAxes);
        score = THREE.MathUtils.clamp(score, -1, 1);
        const headroom = score >= 0 ? (1 - base) : base;
        return THREE.MathUtils.clamp(base + score * headroom * PHYSICS.thrusterControlGain, 0, 1);
      }

      function controlSurfaceAutoSign(part) {
        const target = controlAxisVector(part.controlAxis);
        const positiveTorque = part.bodyLocalPosition.clone().cross(part.basis.normal);
        const projection = positiveTorque.dot(target);
        return Math.abs(projection) < 0.0001 ? 1 : Math.sign(projection);
      }

      function computeControlSurfaceTorqueThree(part, pilot, speed = PHYSICS.cruiseReferenceSpeed) {
        if (part.type !== 'ControlSurface') return new THREE.Vector3();
        const command = Number(pilot[part.controlAxis]) || 0;
        if (Math.abs(command) < 0.0001) return new THREE.Vector3();
        const referenceVelocity = new THREE.Vector3(speed, 0, 0);
        const referenceSpeed = referenceVelocity.length();
        if (referenceSpeed < 0.25) return new THREE.Vector3();
        const chordSpeed = referenceVelocity.dot(part.basis.chord);
        const normalSpeed = referenceVelocity.dot(part.basis.normal);
        const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
        if (coefficients.effectiveSpeed < 0.25) return new THREE.Vector3();
        const sign = part.controlSign || controlSurfaceAutoSign(part);
        const pressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
        const forceMagnitude = pressure * (part.def.wingArea || 0.5) * PHYSICS.controlSurfaceLiftGain * command * sign;
        const velocityDirection = referenceVelocity.divideScalar(referenceSpeed);
        const forceDirection = part.basis.normal.clone().sub(
          velocityDirection.clone().multiplyScalar(part.basis.normal.dot(velocityDirection))
        );
        if (forceDirection.lengthSq() < 0.0001) return new THREE.Vector3();
        forceDirection.normalize();
        return part.bodyLocalPosition.clone().cross(forceDirection.multiplyScalar(forceMagnitude));
      }

      function computeGimbalForceThree(part, pilot, command = 0) {
        if (part.type !== 'VectorThruster') return part.basis.chord.clone().multiplyScalar((part.def.force || 0) * command);
        const desired = new THREE.Vector3(pilot.roll || 0, pilot.yaw || 0, pilot.pitch || 0);
        const baseForce = (part.def.force || 0) * command;
        if (desired.lengthSq() < 0.0001 || baseForce <= 0) return part.basis.chord.clone().multiplyScalar(baseForce);
        const lateral = baseForce * Math.sin(PHYSICS.gimbalAngle);
        const torqueNormal = part.bodyLocalPosition.clone().cross(part.basis.normal.clone().multiplyScalar(lateral));
        const torqueSpan = part.bodyLocalPosition.clone().cross(part.basis.span.clone().multiplyScalar(lateral));
        const desiredAmplitude = THREE.MathUtils.clamp(desired.length(), 0, 1);
        const normalization = Math.max(0.0001, desired.length());
        let a = torqueNormal.lengthSq() > 0.0001 ? desired.dot(torqueNormal) / (normalization * torqueNormal.length()) * desiredAmplitude : 0;
        let b = torqueSpan.lengthSq() > 0.0001 ? desired.dot(torqueSpan) / (normalization * torqueSpan.length()) * desiredAmplitude : 0;
        const length = Math.hypot(a, b);
        if (length > 1) { a /= length; b /= length; }
        const forwardScale = Math.cos(PHYSICS.gimbalAngle * Math.min(1, Math.hypot(a, b)));
        return part.basis.chord.clone().multiplyScalar(baseForce * forwardScale)
          .add(part.basis.normal.clone().multiplyScalar(lateral * a))
          .add(part.basis.span.clone().multiplyScalar(lateral * b));
      }

      function computeAuxiliaryControlTorque(snapshot, pilot, torqueMax = computeSnapshotTorqueMax(snapshot)) {
        const torque = new THREE.Vector3();
        for (const part of snapshot.parts) {
          if (part.bodyId !== snapshot.rootBodyId) continue;
          if (part.type === 'ControlSurface') torque.add(computeControlSurfaceTorqueThree(part, pilot));
          if (part.type === 'VectorThruster') {
            const command = computeMixerCommandFromTorque(
              part.localTorque, pilot,
              FlightControl.neutralCommand([part.basis.chord.x, part.basis.chord.y, part.basis.chord.z], STATE.thrusterPower),
              torqueMax
            );
            const base = part.basis.chord.clone().multiplyScalar((part.def.force || 0) * command);
            const deflected = computeGimbalForceThree(part, pilot, command);
            torque.add(part.bodyLocalPosition.clone().cross(deflected.sub(base)));
          }
        }
        return torque;
      }

      function computeSnapshotTorqueMax(snapshot) {
        const max = new THREE.Vector3();
        for (const part of snapshot.parts) {
          if (part.bodyId !== snapshot.rootBodyId) continue;
          if (part.type !== 'Thruster' && part.type !== 'VectorThruster') continue;
          max.x = Math.max(max.x, Math.abs(part.localTorque.x));
          max.y = Math.max(max.y, Math.abs(part.localTorque.y));
          max.z = Math.max(max.z, Math.abs(part.localTorque.z));
        }
        return max;
      }

      function computeThrusterTorqueForPilot(snapshot, pilot, torqueMax) {
        const torque = new THREE.Vector3();
        for (const part of snapshot.parts) {
          if (part.bodyId !== snapshot.rootBodyId) continue;
          if (part.type !== 'Thruster' && part.type !== 'VectorThruster') continue;
          const command = computeMixerCommandFromTorque(
              part.localTorque, pilot,
              FlightControl.neutralCommand([part.basis.chord.x, part.basis.chord.y, part.basis.chord.z], STATE.thrusterPower),
              torqueMax
            );
          torque.add(part.localTorque.clone().multiplyScalar(command));
        }
        return torque;
      }

      function missionPayloadPositionVector(snapshot = null) {
        const anchor = snapshot?.coreAssemblyPosition ? snapshot.coreAssemblyPosition.clone() : new THREE.Vector3();
        return anchor.add(new THREE.Vector3(MISSION_PAYLOAD_POSITION.x, MISSION_PAYLOAD_POSITION.y, MISSION_PAYLOAD_POSITION.z));
      }

      function buildLoadedSnapshot(baseSnapshot, payloadMass = 0) {
        const safePayloadMass = Math.max(0, Number(payloadMass) || 0);
        const payloadAssemblyPosition = missionPayloadPositionVector(baseSnapshot);
        if (!baseSnapshot?.compiled?.ready) {
          return {
            ...baseSnapshot,
            runtimePlan: null,
            payloadMass: 0,
            payloadAssemblyPosition,
            payloadBodyLocalPosition: null,
            payloadOwnerBodyId: null
          };
        }
        const runtimePlan = RuntimeAssembly.createPlan(baseSnapshot.compiled, safePayloadMass > 0 ? {
          payloadMass: safePayloadMass,
          payloadAnchorBlockId: baseSnapshot.compiled.coreBlockId,
          payloadAssemblyPosition: [payloadAssemblyPosition.x, payloadAssemblyPosition.y, payloadAssemblyPosition.z]
        } : {});
        const rootBody = RuntimeAssembly.rootBody(runtimePlan);
        const plannedPartById = new Map(runtimePlan.parts.map(part => [part.blockId, part]));
        const parts = baseSnapshot.parts.map(part => {
          const planned = plannedPartById.get(part.blockId);
          const bodyLocalPosition = new THREE.Vector3(...planned.bodyLocalPosition);
          return {
            ...part,
            bodyLocalPosition,
            localTorque: bodyLocalPosition.clone().cross(part.fullForce)
          };
        });
        const payloadCollider = runtimePlan.rigidBodies.flatMap(body => body.colliders).find(collider => collider.payload) || null;
        return {
          ...baseSnapshot,
          runtimePlan,
          mass: runtimePlan.rigidBodies.reduce((sum, body) => sum + body.massProperties.mass, 0),
          weight: runtimePlan.rigidBodies.reduce((sum, body) => sum + body.massProperties.mass, 0) * AEROSTATIC_POLICY.gravity,
          rootBodyInertia: new THREE.Vector3(...rootBody.massProperties.inertiaDiagonal),
          parts,
          payloadMass: safePayloadMass,
          payloadAssemblyPosition,
          payloadBodyLocalPosition: payloadCollider ? new THREE.Vector3(...payloadCollider.center) : null,
          payloadOwnerBodyId: payloadCollider?.bodyId || null
        };
      }


      function computeControlMetrics(snapshot) {
        const torqueMax = computeSnapshotTorqueMax(snapshot);
        const baselineTorque = computeThrusterTorqueForPilot(snapshot, { roll: 0, yaw: 0, pitch: 0 }, torqueMax);
        const controlTorque = new THREE.Vector3();
        const controlRating = { pitch: 0, yaw: 0, roll: 0 };
        const controlCoupling = { pitch: 0, yaw: 0, roll: 0 };
        const axisDefinitions = [
          { control: 'roll', component: 'x', inertia: snapshot.rootBodyInertia.x },
          { control: 'yaw', component: 'y', inertia: snapshot.rootBodyInertia.y },
          { control: 'pitch', component: 'z', inertia: snapshot.rootBodyInertia.z }
        ];
        const gyroAuthority = snapshot.counts.Gyro * PHYSICS.gyroManualTorque;
        for (const axis of axisDefinitions) {
          const positivePilot = { roll: 0, yaw: 0, pitch: 0, [axis.control]: 1 };
          const negativePilot = { roll: 0, yaw: 0, pitch: 0, [axis.control]: -1 };
          const positiveDelta = computeThrusterTorqueForPilot(snapshot, positivePilot, torqueMax).sub(baselineTorque).add(computeAuxiliaryControlTorque(snapshot, positivePilot, torqueMax));
          const negativeDelta = computeThrusterTorqueForPilot(snapshot, negativePilot, torqueMax).sub(baselineTorque).add(computeAuxiliaryControlTorque(snapshot, negativePilot, torqueMax));
          const positiveAuthority = Math.max(0, vectorComponent(positiveDelta, axis.component));
          const negativeAuthority = Math.max(0, -vectorComponent(negativeDelta, axis.component));
          const bidirectional = Math.min(positiveAuthority, negativeAuthority) + gyroAuthority;
          const requiredTorque = Math.max(1, axis.inertia * PHYSICS.targetAngularAcceleration);
          controlTorque[axis.component] = bidirectional;
          controlRating[axis.control] = THREE.MathUtils.clamp(bidirectional / requiredTorque, 0, 1);
          const offAxis = axis.component === 'x'
            ? Math.hypot(positiveDelta.y, positiveDelta.z, negativeDelta.y, negativeDelta.z)
            : (axis.component === 'y'
              ? Math.hypot(positiveDelta.x, positiveDelta.z, negativeDelta.x, negativeDelta.z)
              : Math.hypot(positiveDelta.x, positiveDelta.y, negativeDelta.x, negativeDelta.y));
          const primary = positiveAuthority + negativeAuthority + 0.001;
          controlCoupling[axis.control] = THREE.MathUtils.clamp(offAxis / primary, 0, 4);
        }
        return { torqueMax, baselineTorque, controlTorque, controlRating, controlCoupling };
      }

      function computeCraftAnalysis() {
        const snapshot = buildCraftSnapshot();
        const analysis = {
          snapshot,
          mass: snapshot.mass,
          weight: snapshot.weight,
          blockCount: snapshot.parts.length,
          fuelCapacity: snapshot.fuelCapacity,
          com: snapshot.assemblyCenterOfMass.clone(),
          counts: { ...snapshot.counts },
          netThrust: new THREE.Vector3(),
          centerThrust: new THREE.Vector3(),
          centerLift: new THREE.Vector3(),
          staticLift: 0,
          cruiseLift: 0,
          cruiseDrag: 0,
          staticLiftRatio: 0,
          cruiseLiftRatio: 0,
          trimTorque: new THREE.Vector3(),
          trimTorqueMagnitude: 0,
          controlTorque: new THREE.Vector3(),
          controlRating: { pitch: 0, yaw: 0, roll: 0 },
          controlCoupling: { pitch: 0, yaw: 0, roll: 0 },
          enduranceSeconds: 0,
          totalDurability: 0,
          structuralReserve: 0,
          weakLinks: 0,
          exposedFuel: 0,
          warnings: [],
          grade: 'UNTESTED'
        };
        const warn = (level, text) => analysis.warnings.push({ level, text });
        const compileMessages = {
          'empty-craft': 'The workshop is empty. Place any first module, then add exactly one Command Core before launch.',
          'missing-core': 'No Command Core is installed. The craft may be edited and saved, but cannot launch.',
          'multiple-cores': 'Only one Command Core may be installed.',
          'disconnected': 'The craft contains disconnected structural islands.',
          'block-limit': `The blueprint exceeds the ${GRID.maxBlocks}-module editor limit.`,
          'invalid-block': 'The blueprint contains an invalid module record.',
          'duplicate-position': 'Two modules occupy the same grid position.'
        };
        for (const error of snapshot.errors || []) warn('critical', compileMessages[error] || `Craft compilation failed: ${error}.`);
        if (snapshot.mass <= 0) {
          analysis.grade = 'DANGEROUS';
          return analysis;
        }

        const craftKeys = new Set(snapshot.parts.map(part => part.key));
        const neighborDirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        for (const part of snapshot.parts) {
          analysis.totalDurability += part.def.durability || 0;
          const neighbors = neighborDirs.reduce((count, [dx,dy,dz]) => count + (craftKeys.has(makeKey(part.assemblyPosition.x+dx, part.assemblyPosition.y+dy, part.assemblyPosition.z+dz)) ? 1 : 0), 0);
          if (part.type !== 'Core' && neighbors <= 1) analysis.weakLinks += 1;
          if (part.type === 'Fuel' && neighbors <= 2) analysis.exposedFuel += 1;
        }
        analysis.structuralReserve = analysis.mass > 0 ? analysis.totalDurability / Math.max(1, analysis.mass * 5.5) : 0;

        let thrustWeight = 0;
        let liftWeight = 0;
        let nominalFuelRate = 0;
        const cruiseVelocity = new THREE.Vector3(PHYSICS.cruiseReferenceSpeed, 0, 0);

        for (const part of snapshot.parts) {
          if (part.type === 'Thruster' || part.type === 'VectorThruster') {
            const command = FlightControl.neutralCommand(
              [part.basis.chord.x, part.basis.chord.y, part.basis.chord.z],
              STATE.thrusterPower
            );
            const force = part.fullForce.clone().multiplyScalar(command);
            const torque = part.bodyLocalPosition.clone().cross(force);
            analysis.netThrust.add(force);
            analysis.trimTorque.add(torque);
            analysis.staticLift += force.y;
            const magnitude = force.length();
            if (magnitude > 0) {
              analysis.centerThrust.add(part.assemblyPosition.clone().multiplyScalar(magnitude));
              thrustWeight += magnitude;
            }
            nominalFuelRate += part.def.fuelRate * command;
          } else if (part.type === 'Balloon') {
            const liftMagnitude = part.def.force * STATE.balloonPower;
            const force = new THREE.Vector3(0, liftMagnitude, 0);
            analysis.trimTorque.add(part.bodyLocalPosition.clone().cross(force));
            analysis.staticLift += liftMagnitude;
            if (liftMagnitude > 0) {
              analysis.centerLift.add(part.assemblyPosition.clone().multiplyScalar(liftMagnitude));
              liftWeight += liftMagnitude;
            }
            nominalFuelRate += part.def.fuelRate * STATE.balloonPower;
          } else if (part.type === 'Wing' || part.type === 'ControlSurface') {
            const loads = evaluateWingAtVelocityThree(part, cruiseVelocity);
            analysis.cruiseLift += loads.force.y;
            analysis.cruiseDrag += loads.drag;
            const liftWeightForCenter = Math.max(0, loads.force.y);
            if (liftWeightForCenter > 0) {
              analysis.centerLift.add(part.assemblyPosition.clone().multiplyScalar(liftWeightForCenter));
              liftWeight += liftWeightForCenter;
            }
          }
        }

        analysis.cruiseLift += analysis.staticLift;
        analysis.staticLiftRatio = analysis.weight > 0 ? analysis.staticLift / analysis.weight : 0;
        analysis.cruiseLiftRatio = analysis.weight > 0 ? analysis.cruiseLift / analysis.weight : 0;
        analysis.trimTorqueMagnitude = analysis.trimTorque.length();
        if (thrustWeight > 0) analysis.centerThrust.divideScalar(thrustWeight);
        else analysis.centerThrust.copy(analysis.com);
        if (liftWeight > 0) analysis.centerLift.divideScalar(liftWeight);
        else analysis.centerLift.copy(analysis.com);

        const controls = computeControlMetrics(snapshot);
        analysis.controlTorque.copy(controls.controlTorque);
        analysis.controlRating = controls.controlRating;
        analysis.controlCoupling = controls.controlCoupling;

        analysis.enduranceSeconds = nominalFuelRate > 0 ? analysis.fuelCapacity / nominalFuelRate : Infinity;
        if (snapshot.parts.length === 1) warn('info', 'The craft currently contains a single module.');
        if (snapshot.counts.Thruster + snapshot.counts.VectorThruster + snapshot.counts.Balloon === 0) warn('critical', 'No propulsion or powered lift is installed.');
        if (nominalFuelRate > 0 && analysis.fuelCapacity <= 0) warn('critical', 'Powered modules have no fuel tank.');
        if (snapshot.counts.Wing + snapshot.counts.ControlSurface === 0 && analysis.staticLiftRatio < 0.95) warn('warn', 'Current power cannot support a vertical take-off.');
        if (snapshot.counts.Wing + snapshot.counts.ControlSurface > 0 && analysis.cruiseLiftRatio < 0.9) warn('warn', `Estimated lift at ${PHYSICS.cruiseReferenceSpeed} m/s is below craft weight.`);
        if (snapshot.counts.Wing + snapshot.counts.ControlSurface > 0 && analysis.cruiseLift <= analysis.staticLift + 0.1) warn('warn', 'Installed wings do not create useful upward lift in the +X cruise test.');
        if (analysis.controlRating.pitch < 0.12) warn('warn', 'Almost no bidirectional pitch authority.');
        if (analysis.controlRating.yaw < 0.12) warn('warn', 'Almost no bidirectional yaw authority.');
        if (analysis.controlRating.roll < 0.12) warn('warn', 'Almost no bidirectional roll authority.');
        if (analysis.controlCoupling.pitch > 1.1 || analysis.controlCoupling.yaw > 1.1 || analysis.controlCoupling.roll > 1.1) warn('info', 'Engine steering has strong cross-axis coupling.');
        const controlMagnitude = analysis.controlTorque.length();
        if (analysis.trimTorqueMagnitude > Math.max(5, controlMagnitude * 1.2)) warn('warn', 'Current power creates a strong unbalanced turning moment.');
        if (snapshot.counts.Gyro === 0) warn('info', 'No gyro: stabilization depends entirely on engine layout and aerodynamic surfaces.');
        if (snapshot.counts.ControlSurface > 0) warn('info', 'Control surfaces require airflow; authority fades during hover and stall.');
        if (analysis.fuelCapacity > 0 && analysis.enduranceSeconds < 20) warn('info', 'Estimated fuel endurance at current power is very short.');
        if (analysis.weakLinks > 0) warn(analysis.weakLinks > 4 ? 'warn' : 'info', `${analysis.weakLinks} part${analysis.weakLinks === 1 ? '' : 's'} depend on a single structural connection.`);
        if (analysis.exposedFuel > 0) warn('info', `${analysis.exposedFuel} fuel tank${analysis.exposedFuel === 1 ? ' is' : 's are'} weakly protected and vulnerable to impact leaks.`);
        if (analysis.structuralReserve < 0.75 && snapshot.parts.length > 8) warn('warn', 'Low durability-to-mass reserve; reinforce long branches with Frame modules.');
        if (snapshot.parts.length > PHYSICS.maxFlightParts) warn('critical', `Flight is limited to ${PHYSICS.maxFlightParts} attached modules until collider merging is implemented.`);
        else if (snapshot.parts.length > PHYSICS.maxFlightParts * 0.8) warn('info', 'The craft is approaching the current flight-solver module limit.');

        const criticalCount = analysis.warnings.filter(item => item.level === 'critical').length;
        const warningCount = analysis.warnings.filter(item => item.level === 'warn').length;
        analysis.grade = criticalCount ? 'DANGEROUS' : (warningCount >= 3 ? 'EXPERIMENTAL' : (warningCount ? 'FLY WITH CARE' : 'READY'));
        return analysis;
      }

      function setHorizontalBar(id, value) {
        const bar = document.getElementById(id);
        if (!bar) return;
        bar.style.left = '0%';
        bar.style.width = `${Math.round(THREE.MathUtils.clamp(value, 0, 1) * 100)}%`;
      }

      function updateEngineeringAnalysisUI(analysis) {
        const setText = (id, value) => {
          const element = document.getElementById(id);
          if (element) element.textContent = value;
        };
        setText('ui-static-lift', `${analysis.staticLiftRatio.toFixed(2)}×`);
        setText('ui-cruise-lift', `${analysis.cruiseLiftRatio.toFixed(2)}×`);
        setText('ui-endurance', formatDuration(analysis.enduranceSeconds));
        setText('ui-trim-torque', analysis.trimTorqueMagnitude.toFixed(1));
        setText('ui-structural-reserve', `${analysis.structuralReserve.toFixed(2)}×`);
        setText('ui-weak-links', String(analysis.weakLinks));
        setText('ui-control-pitch', `${Math.round(analysis.controlRating.pitch * 100)}%`);
        setText('ui-control-yaw', `${Math.round(analysis.controlRating.yaw * 100)}%`);
        setText('ui-control-roll', `${Math.round(analysis.controlRating.roll * 100)}%`);
        setHorizontalBar('ui-control-pitch-bar', analysis.controlRating.pitch);
        setHorizontalBar('ui-control-yaw-bar', analysis.controlRating.yaw);
        setHorizontalBar('ui-control-roll-bar', analysis.controlRating.roll);

        const grade = document.getElementById('ui-flight-grade');
        if (grade) {
          grade.textContent = analysis.grade;
          grade.className = analysis.grade === 'READY'
            ? 'font-bold text-emerald-300'
            : (analysis.grade === 'DANGEROUS' ? 'font-bold text-rose-300' : 'font-bold text-amber-300');
        }

        const launchButton = document.getElementById('btn-flight');
        if (launchButton && STATE.mode === 'BUILD') {
          launchButton.textContent = analysis.grade === 'DANGEROUS'
            ? 'Launch Dangerous Test'
            : (analysis.grade === 'EXPERIMENTAL' ? 'Launch Experimental Test' : 'Launch Test Flight');
        }

        const warningList = document.getElementById('ui-analysis-warnings');
        if (warningList) {
          const visibleWarnings = analysis.warnings.slice(0, 4);
          warningList.innerHTML = visibleWarnings.length
            ? visibleWarnings.map(item => {
                const tone = item.level === 'critical' ? 'text-rose-300' : (item.level === 'warn' ? 'text-amber-200' : 'text-slate-400');
                const icon = item.level === 'critical' ? '●' : (item.level === 'warn' ? '▲' : '•');
                return `<div class="${tone}">${icon} ${item.text}</div>`;
              }).join('')
            : '<div class="text-emerald-300">● No major engineering warnings.</div>';
          if (analysis.warnings.length > visibleWarnings.length) {
            warningList.innerHTML += `<div class="text-slate-500">+${analysis.warnings.length - visibleWarnings.length} more observations</div>`;
          }
        }
      }

      function updateAnalysisVisuals(analysis) {
        const visible = STATE.mode === 'BUILD' && analysis.mass > 0;
        thrustSphere.visible = visible && analysis.counts.Thruster + analysis.counts.VectorThruster > 0;
        liftSphere.visible = visible && analysis.counts.Balloon + analysis.counts.Wing + analysis.counts.ControlSurface > 0;
        if (thrustSphere.visible) thrustSphere.position.copy(analysis.centerThrust);
        if (liftSphere.visible) liftSphere.position.copy(analysis.centerLift);

        const thrustMagnitude = analysis.netThrust.length();
        thrustVectorArrow.visible = visible && thrustMagnitude > 0.01;
        if (thrustVectorArrow.visible) {
          thrustVectorArrow.position.copy(analysis.centerThrust);
          thrustVectorArrow.setDirection(analysis.netThrust.clone().normalize());
          thrustVectorArrow.setLength(0.8 + Math.min(4.2, thrustMagnitude / 30), 0.35, 0.22);
        }

        liftVectorArrow.visible = visible && analysis.cruiseLift > 0.01;
        if (liftVectorArrow.visible) {
          liftVectorArrow.position.copy(analysis.centerLift);
          liftVectorArrow.setDirection(new THREE.Vector3(0, 1, 0));
          liftVectorArrow.setLength(0.8 + Math.min(4.2, analysis.cruiseLiftRatio * 1.8), 0.35, 0.22);
        }
      }

      return Object.freeze({
        formatDuration, vectorComponent, computeWingCoefficients, evaluateWingAtVelocityThree,
        buildCraftSnapshot, computeMixerCommandFromTorque, controlSurfaceAutoSign,
        computeControlSurfaceTorqueThree, computeGimbalForceThree, computeAuxiliaryControlTorque,
        computeSnapshotTorqueMax, computeThrusterTorqueForPilot, missionPayloadPositionVector,
        buildLoadedSnapshot, computeControlMetrics, computeCraftAnalysis,
        setHorizontalBar, updateEngineeringAnalysisUI, updateAnalysisVisuals
      });
    }

    return Object.freeze({ create });
  });
})();
