(() => {
  'use strict';

  window.VAW.define('game.scene-environment', [], () => {
    function requireObject(value, name) {
      if (!value || typeof value !== 'object') throw new TypeError(`${name} is required.`);
      return value;
    }

    function configureRendererColorOutput(renderer, THREE) {
      if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
        renderer.outputEncoding = THREE.sRGBEncoding;
      }
    }

    function create(options = {}) {
      const THREE = requireObject(options.THREE, 'THREE');
      const Physics = requireObject(options.Physics, 'Physics');
      const container = options.container;
      const GRID = requireObject(options.GRID, 'GRID');
      const AEROSTATIC_POLICY = requireObject(options.AEROSTATIC_POLICY, 'AEROSTATIC_POLICY');
      const COLLISION_GROUP = requireObject(options.COLLISION_GROUP, 'COLLISION_GROUP');
      const TEST_RANGE = requireObject(options.TEST_RANGE, 'TEST_RANGE');
      const BLOCKS = requireObject(options.BLOCKS, 'BLOCKS');
      if (!container?.appendChild) throw new TypeError('Scene container is required.');

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1220);
      scene.fog = new THREE.FogExp2(0x0b1220, 0.014);

      const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      configureRendererColorOutput(renderer, THREE);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.66));
      scene.add(new THREE.HemisphereLight(0xcde8ff, 0x152238, 0.62));

      const sun = new THREE.DirectionalLight(0xffffff, 0.95);
      sun.position.set(12, 20, 10);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      scene.add(sun);

      const gridHelper = new THREE.GridHelper(GRID.halfExtent * 2, GRID.halfExtent * 2, 0x3b4b66, 0x1c2940);
      gridHelper.position.y = -0.5;
      scene.add(gridHelper);

      const planeGeometry = new THREE.PlaneGeometry(GRID.halfExtent * 2, GRID.halfExtent * 2);
      planeGeometry.rotateX(-Math.PI / 2);
      const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const basePlane = new THREE.Mesh(planeGeometry, planeMaterial);
      basePlane.position.y = -0.5;
      basePlane.userData.isBuildSurface = true;
      scene.add(basePlane);

      function marker(radius, segments, color) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, segments, segments),
          new THREE.MeshBasicMaterial({ color, depthTest: false })
        );
        mesh.renderOrder = 999;
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      }

      const comSphere = marker(0.26, 16, 0x22c55e);
      const thrustSphere = marker(0.22, 14, 0x3b82f6);
      const liftSphere = marker(0.22, 14, 0x67e8f9);

      const thrustVectorArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x3b82f6, 0.34, 0.22);
      const liftVectorArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x67e8f9, 0.34, 0.22);
      thrustVectorArrow.visible = false;
      liftVectorArrow.visible = false;
      scene.add(thrustVectorArrow, liftVectorArrow);

      const ghost = new THREE.Mesh(
        new THREE.BoxGeometry(1.01, 1.01, 1.01),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55 })
      );
      ghost.visible = false;
      scene.add(ghost);
      const symmetryGhosts = Array.from({ length: 3 }, () => {
        const preview = new THREE.Mesh(
          new THREE.BoxGeometry(1.01, 1.01, 1.01),
          new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 })
        );
        preview.visible = false;
        scene.add(preview);
        return preview;
      });

      const ghostArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.35, 0xfacc15, 0.4, 0.25);
      const ghostNormalArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1.05, 0x67e8f9, 0.32, 0.20);
      ghostArrow.visible = false;
      ghostNormalArrow.visible = false;
      scene.add(ghostArrow, ghostNormalArrow);

      const axesHelper = new THREE.AxesHelper(3);
      axesHelper.position.y = -0.4;
      scene.add(axesHelper);

      const stars = new THREE.Points(
        new THREE.BufferGeometry(),
        new THREE.PointsMaterial({ size: 0.07, color: 0xcbd5e1, transparent: true, opacity: 0.6 })
      );
      const starCount = 180;
      const starPositions = new Float32Array(starCount * 3);
      for (let index = 0; index < starCount; index += 1) {
        const radius = 45 + Math.random() * 55;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        starPositions[index * 3] = Math.cos(theta) * Math.sin(phi) * radius;
        starPositions[index * 3 + 1] = Math.cos(phi) * radius + 18;
        starPositions[index * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
      }
      stars.geometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      scene.add(stars);

      const world = Physics.createWorld({
        gravity: { x: 0, y: -AEROSTATIC_POLICY.gravity, z: 0 },
        broadphase: 'sap',
        solverIterations: 10,
        solverTolerance: 0.0001,
        allowSleep: true
      });

      const groundBody = Physics.createBody({
        mass: 0,
        collisionGroup: COLLISION_GROUP.world,
        collisionMask: COLLISION_GROUP.craft | COLLISION_GROUP.debris,
        position: { x: 0, y: -0.5, z: 0 }
      });
      Physics.addPlaneCollider(groundBody);
      Physics.setBodyTransform(groundBody, { axisAngle: { axis: { x: 1, y: 0, z: 0 }, angle: -Math.PI / 2 } });
      Physics.addBody(world, groundBody);

      const testRangeGroup = new THREE.Group();
      const missionMarkerGroup = new THREE.Group();
      scene.add(testRangeGroup, missionMarkerGroup);
      testRangeGroup.visible = false;
      missionMarkerGroup.visible = false;

      const rangeStaticBodies = [];
      function addRangeBox(size, position, color, emissive = 0x000000, collidable = false) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size.x, size.y, size.z),
          new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.08, emissive, emissiveIntensity: emissive ? 0.14 : 0 })
        );
        mesh.position.set(position.x, position.y, position.z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        testRangeGroup.add(mesh);
        if (collidable) {
          const body = Physics.createBody({
            mass: 0,
            collisionGroup: COLLISION_GROUP.world,
            collisionMask: COLLISION_GROUP.craft | COLLISION_GROUP.debris,
            position,
            userData: { rangeObstacle: true }
          });
          Physics.addBoxCollider(body, { halfExtents: { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 } });
          Physics.addBody(world, body);
          rangeStaticBodies.push(body);
          mesh.userData.rangeObstacle = true;
        }
        return mesh;
      }

      function addRangeStrip(from, to, width, color, opacity = 0.38) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.hypot(dx, dz);
        if (length <= 0.01) return null;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.035, width),
          new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, transparent: true, opacity })
        );
        mesh.position.set((from.x + to.x) * 0.5, -0.32, (from.z + to.z) * 0.5);
        mesh.rotation.y = -Math.atan2(dz, dx);
        mesh.receiveShadow = true;
        testRangeGroup.add(mesh);
        return mesh;
      }

      function addRangePad(position, radius, color) {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, 0.18, 48),
          new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.22, emissive: color, emissiveIntensity: 0.06 })
        );
        pad.position.set(position.x, -0.39, position.z);
        pad.receiveShadow = true;
        testRangeGroup.add(pad);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 0.74, 0.22, 10, 48),
          new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.7 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(position.x, -0.27, position.z);
        testRangeGroup.add(ring);
      }

      function createTestRangeEnvironment() {
        const rangeSize = TEST_RANGE.bounds * 2 + 40;
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(rangeSize, rangeSize),
          new THREE.MeshStandardMaterial({ color: 0x15283a, roughness: 1, metalness: 0 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.49;
        ground.receiveShadow = true;
        testRangeGroup.add(ground);

        const padColors = {
          startPad: 0x155e75,
          finishPad: 0x166534,
          weatherSpirePad: 0x0e7490,
          northPad: 0x1d4ed8,
          ridgePad: 0x7c3aed,
          southPad: 0x92400e,
          towerPad: 0xb45309,
          eastDepot: 0x15803d,
          skyhookPad: 0xbe185d,
          frontierPad: 0x7f1d1d
        };
        const listedPadIds = new Set();
        for (const sector of TEST_RANGE.missionMap?.sectors || []) {
          for (const padId of sector.padIds || []) listedPadIds.add(padId);
        }
        for (const padId of listedPadIds) {
          const pad = TEST_RANGE[padId];
          if (pad) addRangePad(pad, pad.radius, padColors[padId] || 0x166534);
        }

        addRangeStrip(TEST_RANGE.startPad, TEST_RANGE.finishPad, 12, 0x334155, 0.52);
        addRangeStrip(TEST_RANGE.finishPad, TEST_RANGE.northPad, 7, 0x1e3a8a, 0.28);
        addRangeStrip(TEST_RANGE.northPad, TEST_RANGE.ridgePad, 7, 0x4c1d95, 0.30);
        addRangeStrip(TEST_RANGE.startPad, TEST_RANGE.southPad, 7, 0x78350f, 0.28);
        addRangeStrip(TEST_RANGE.southPad, TEST_RANGE.towerPad, 8, 0x92400e, 0.30);
        addRangeStrip(TEST_RANGE.towerPad, TEST_RANGE.skyhookPad, 8, 0x831843, 0.30);
        addRangeStrip(TEST_RANGE.finishPad, TEST_RANGE.weatherSpirePad, 7, 0x0e7490, 0.26);
        addRangeStrip(TEST_RANGE.weatherSpirePad, TEST_RANGE.eastDepot, 9, 0x14532d, 0.30);
        addRangeStrip(TEST_RANGE.weatherSpirePad, TEST_RANGE.frontierPad, 7, 0x7f1d1d, 0.26);

        addRangeBox({ x: 112, y: 0.12, z: 12 }, { x: 36, y: -0.40, z: 0 }, 0x334155);
        addRangeBox({ x: 108, y: 0.03, z: 0.22 }, { x: 36, y: -0.31, z: 0 }, 0xe2e8f0, 0x334155);
        for (let x = -12; x <= 92; x += 10) addRangeBox({ x: 4.5, y: 0.035, z: 0.16 }, { x, y: -0.30, z: 0 }, 0xf8fafc);

        addRangeBox({ x: 15, y: 6, z: 15 }, { x: -16, y: 2.5, z: -18 }, 0x26364c, 0x000000, true);
        addRangeBox({ x: 8, y: 4, z: 9 }, { x: -5, y: 1.5, z: -18 }, 0x374151, 0x000000, true);
        addRangeBox({ x: 20, y: 1, z: 6 }, { x: -12, y: 0, z: 17 }, 0x475569, 0x000000, true);
        addRangeBox({ x: 7, y: 26, z: 7 }, { x: TEST_RANGE.weatherSpirePad.x, y: 12.5, z: TEST_RANGE.weatherSpirePad.z }, 0x0f172a, 0x000000, true);
        addRangeBox({ x: 18, y: 8, z: 18 }, { x: TEST_RANGE.eastDepot.x - 14, y: 3.5, z: TEST_RANGE.eastDepot.z + 18 }, 0x1f2937, 0x000000, true);
        addRangeBox({ x: 10, y: 34, z: 10 }, { x: TEST_RANGE.towerPad.x + 12, y: 16.5, z: TEST_RANGE.towerPad.z - 12 }, 0x431407, 0x000000, true);
        addRangeBox({ x: 12, y: 18, z: 12 }, { x: TEST_RANGE.ridgePad.x - 18, y: 8.5, z: TEST_RANGE.ridgePad.z + 18 }, 0x312e81, 0x000000, true);
        addRangeBox({ x: 9, y: 30, z: 9 }, { x: TEST_RANGE.frontierPad.x - 20, y: 14.5, z: TEST_RANGE.frontierPad.z + 20 }, 0x450a0a, 0x000000, true);

        for (let index = 0; index < 18; index += 1) {
          const side = index % 2 === 0 ? 1 : -1;
          const x = 18 + index * 10;
          const z = side * (34 + (index % 4) * 13);
          const height = 3 + (index % 5) * 1.7;
          addRangeBox({ x: 3 + (index % 2), y: height, z: 3 + ((index + 1) % 3) }, { x, y: height / 2 - 0.45, z }, 0x26384d, 0x000000, true);
        }

        const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
        for (const padId of listedPadIds) {
          const pad = TEST_RANGE[padId];
          if (!pad) continue;
          for (const side of [-1, 1]) {
            const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 8), beaconMaterial.clone());
            beacon.position.set(pad.x + side * pad.radius * 0.75, 3, pad.z);
            testRangeGroup.add(beacon);
          }
        }
      }
      createTestRangeEnvironment();

      const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
      const materials = new Map();
      for (const [name, definition] of Object.entries(BLOCKS)) {
        const emissive =
          name === 'Core' ? new THREE.Color(0x4c1d95) :
          name === 'Thruster' ? new THREE.Color(0x4c1d1d) :
          name === 'VectorThruster' ? new THREE.Color(0x3b1764) :
          name === 'Balloon' ? new THREE.Color(0x0f2f5f) :
          name === 'Wing' ? new THREE.Color(0x123f2b) :
          name === 'ControlSurface' ? new THREE.Color(0x083344) :
          name === 'Gyro' ? new THREE.Color(0x503404) :
          name === 'Fuel' ? new THREE.Color(0x4a3b00) :
          new THREE.Color(0x0b1220);
        materials.set(name, new THREE.MeshStandardMaterial({
          color: definition.color,
          roughness: name === 'Hull' ? 0.9 : (name === 'Frame' ? 0.58 : 0.68),
          metalness: name === 'Frame' ? 0.62 : (name === 'Core' ? 0.2 : 0.1),
          emissive,
          emissiveIntensity: name === 'Core' ? 0.38 : (name === 'Thruster' ? 0.12 : 0.04)
        }));
      }

      function cloneMaterial(type) {
        const material = materials.get(type);
        if (!material) throw new Error(`Unknown material type: ${String(type)}`);
        return material.clone();
      }

      return Object.freeze({
        scene, camera, renderer, gridHelper, basePlane,
        comSphere, thrustSphere, liftSphere, thrustVectorArrow, liftVectorArrow,
        ghost, symmetryGhosts, ghostArrow, ghostNormalArrow, axesHelper, stars,
        world, groundBody, testRangeGroup, missionMarkerGroup, rangeStaticBodies,
        sharedGeometry, materials, cloneMaterial
      });
    }

    return Object.freeze({ create });
  });
})();
