(() => {
  'use strict';

  window.VAW.define('foundation.runtime-assembly', ['foundation.mass-properties', 'foundation.transform-math'], (MassProperties, TransformMath) => {
    function deepFreeze(value, seen = new Set()) {
      if (!value || typeof value !== 'object' || seen.has(value)) return value;
      seen.add(value); for (const nested of Object.values(value)) deepFreeze(nested, seen); return Object.freeze(value);
    }
    function requireNumber(value, label, minimum = -Infinity) {
      const numeric = Number(value); if (!Number.isFinite(numeric)) throw new TypeError(`${label} must be a finite number.`);
      if (numeric < minimum) throw new RangeError(`${label} must be at least ${minimum}.`); return numeric;
    }
    function requireVector(value, label) {
      const result = TransformMath.vec3(value);
      const source = Array.isArray(value) ? value : value && [value.x, value.y, value.z];
      if (!source || source.some(component => !Number.isFinite(Number(component)))) throw new TypeError(`${label} must be a finite 3D vector.`);
      return result;
    }
    function requireId(value, label) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`); return value; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

    function normalizeLoadout(compiledCraft, raw = {}) {
      const payloadMass = requireNumber(raw.payloadMass ?? raw.payload?.mass ?? 0, 'Launch payload mass', 0);
      if (payloadMass <= 0) return Object.freeze({ payload: null });
      const anchorBlockId = requireId(raw.payloadAnchorBlockId ?? raw.payload?.anchorBlockId ?? compiledCraft.coreBlockId, 'Launch payload anchorBlockId');
      const ownerBodyId = compiledCraft.blockIdToBodyId[anchorBlockId];
      if (!ownerBodyId) throw new Error(`Launch payload anchor block is not part of the compiled craft: ${anchorBlockId}`);
      const anchorPart = compiledCraft.parts.find(part => part.blockId === anchorBlockId);
      const defaultPosition = anchorPart ? [anchorPart.assemblyPosition[0], anchorPart.assemblyPosition[1] - 1, anchorPart.assemblyPosition[2]] : [0, -1, 0];
      const assemblyPosition = requireVector(raw.payloadAssemblyPosition ?? raw.payload?.assemblyPosition ?? defaultPosition, 'Launch payload assemblyPosition');
      const halfExtents = requireVector(raw.payloadHalfExtents ?? raw.payload?.halfExtents ?? [0.42, 0.42, 0.42], 'Launch payload halfExtents');
      if (halfExtents.some(value => value <= 0)) throw new RangeError('Launch payload halfExtents must be positive.');
      return Object.freeze({ payload: Object.freeze({ payloadId: 'mission-payload', mass: payloadMass, anchorBlockId, ownerBodyId, assemblyPosition: Object.freeze(assemblyPosition), halfExtents: Object.freeze(halfExtents) }) });
    }

    function createPlan(compiledCraft, launchLoadout = {}) {
      if (!compiledCraft || compiledCraft.format !== 'VAW_COMPILED_CRAFT_V4') throw new TypeError('RuntimeAssemblyPlan V2 requires a verified CompiledCraft V4.');
      if (!compiledCraft.ready) throw new Error(`Cannot create runtime plan from an unready craft: ${(compiledCraft.errors || []).join(', ')}`);
      const loadout = normalizeLoadout(compiledCraft, launchLoadout);
      const partsByBodyId = new Map(compiledCraft.rigidIslands.map(island => [island.bodyId, []]));
      for (const part of compiledCraft.parts) partsByBodyId.get(part.bodyId)?.push(part);
      const bodyState = new Map();
      for (const island of compiledCraft.rigidIslands) {
        const sourceParts = partsByBodyId.get(island.bodyId) || [];
        const elements = sourceParts.map(part => ({ id: part.blockId, mass: part.mass, center: part.assemblyPosition, halfExtents: [0.5, 0.5, 0.5] }));
        if (loadout.payload?.ownerBodyId === island.bodyId) elements.push({ id: loadout.payload.payloadId, mass: loadout.payload.mass, center: loadout.payload.assemblyPosition, halfExtents: loadout.payload.halfExtents });
        const mass = MassProperties.compute(elements);
        bodyState.set(island.bodyId, {
          island, sourceParts, assemblyCenterOfMass: [...mass.centerOfMass],
          massProperties: { mass: mass.mass, centerOfMass: [0, 0, 0], inertiaDiagonal: [...mass.inertiaDiagonal] }
        });
      }

      const parts = []; const blockIdToBodyId = Object.create(null); const blockIdToPartIndex = Object.create(null); const rigidBodies = [];
      for (const island of [...compiledCraft.rigidIslands].sort((a, b) => a.bodyId.localeCompare(b.bodyId))) {
        const state = bodyState.get(island.bodyId); const colliders = [];
        for (const sourcePart of state.sourceParts.sort((a, b) => a.blockId.localeCompare(b.blockId))) {
          const bodyLocalPosition = sub(sourcePart.assemblyPosition, state.assemblyCenterOfMass);
          const constraintIds = compiledCraft.mechanicalGraph.constraintsByEndpointBlockId[sourcePart.blockId] || [];
          const part = {
            partIndex: parts.length, blockId: sourcePart.blockId, bodyId: island.bodyId,
            gridKey: sourcePart.gridKey, type: sourcePart.type,
            assemblyPosition: [...sourcePart.assemblyPosition], bodyLocalPosition,
            orientation: sourcePart.orientation, controlAxis: sourcePart.controlAxis, controlSign: sourcePart.controlSign,
            basis: sourcePart.basis, properties: { ...sourcePart.properties }, mass: sourcePart.mass,
            rigidNeighborBlockIds: [...sourcePart.rigidNeighborBlockIds], mechanicalConstraintIds: [...constraintIds]
          };
          blockIdToBodyId[part.blockId] = island.bodyId; blockIdToPartIndex[part.blockId] = parts.length; parts.push(part);
          colliders.push({ colliderId: `collider:${part.blockId}`, blockId: part.blockId, bodyId: island.bodyId, kind: 'box', center: bodyLocalPosition, halfExtents: [0.5, 0.5, 0.5] });
        }
        if (loadout.payload?.ownerBodyId === island.bodyId) {
          colliders.push({
            colliderId: 'collider:mission-payload', blockId: null, bodyId: island.bodyId, kind: 'box', payload: true,
            center: sub(loadout.payload.assemblyPosition, state.assemblyCenterOfMass), halfExtents: [...loadout.payload.halfExtents]
          });
        }
        rigidBodies.push({
          bodyId: island.bodyId, role: island.role, anchorBlockId: island.anchorBlockId,
          blockIds: state.sourceParts.map(part => part.blockId).sort(),
          sourceAssemblyCenterOfMass: [...island.sourceAssemblyCenterOfMass],
          assemblyPose: { position: [...state.assemblyCenterOfMass], quaternion: [0, 0, 0, 1] },
          massProperties: state.massProperties, colliders
        });
      }

      const constraints = compiledCraft.mechanicalGraph.constraints.map(source => {
        const bodyA = bodyState.get(source.bodyAId); const bodyB = bodyState.get(source.bodyBId);
        return {
          constraintId: source.constraintId, mechanicalLinkId: source.mechanicalLinkId, kind: source.kind,
          bodyAId: source.bodyAId, bodyBId: source.bodyBId, endpointA: source.endpointA, endpointB: source.endpointB,
          assemblyPivotPosition: [...source.assemblyPivotPosition],
          pivotA: sub(source.assemblyPivotPosition, bodyA.assemblyCenterOfMass),
          pivotB: sub(source.assemblyPivotPosition, bodyB.assemblyCenterOfMass),
          axisA: [...source.axisA], axisB: [...source.axisB],
          collideConnected: source.collideConnected, maxForce: source.maxForce, frictionTorque: source.frictionTorque,
          limits: source.limits ? { ...source.limits } : null,
          control: { mode: 'free', targetSpeed: 0, targetAngle: 0, maxTorque: 30, maxSpeed: 2, positionGain: 4, velocityDamping: 0.5 }
        };
      });
      const bodyIdToConstraintIds = Object.fromEntries(rigidBodies.map(body => [body.bodyId, []]));
      const bodyIdToPartBlockIds = Object.fromEntries(rigidBodies.map(body => [body.bodyId, [...body.blockIds]]));
      for (const constraint of constraints) { bodyIdToConstraintIds[constraint.bodyAId].push(constraint.constraintId); bodyIdToConstraintIds[constraint.bodyBId].push(constraint.constraintId); }
      for (const ids of Object.values(bodyIdToConstraintIds)) ids.sort();

      return deepFreeze({
        format: 'VAW_RUNTIME_ASSEMBLY_PLAN_V2', sourceSignature: compiledCraft.signature,
        sourceRevision: compiledCraft.sourceRevision, rootBodyId: compiledCraft.rootBodyId,
        rigidBodies, constraints, signalLinks: [], parts,
        blockIdToBodyId, blockIdToPartIndex, bodyIdToPartBlockIds, bodyIdToConstraintIds,
        launchLoadout: loadout
      });
    }

    function rootBody(plan) { return plan?.rigidBodies?.find(body => body.bodyId === plan.rootBodyId) || null; }
    function worldBodyPose(spawnTransform, bodyPlan) {
      if (!bodyPlan?.assemblyPose) throw new TypeError('Body plan requires assemblyPose.');
      return TransformMath.composePose(spawnTransform, bodyPlan.assemblyPose);
    }
    function worldBodyPoses(plan, spawnTransform) {
      return Object.freeze(Object.fromEntries(plan.rigidBodies.map(body => [body.bodyId, worldBodyPose(spawnTransform, body)])));
    }

    return Object.freeze({ createPlan, normalizeLoadout, rootBody, worldBodyPose, worldBodyPoses });
  });
})();
