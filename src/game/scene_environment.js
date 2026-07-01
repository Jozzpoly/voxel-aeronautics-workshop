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
      const terrainConfig = TEST_RANGE.terrain || {};
      const fogConfig = terrainConfig.fog || {};
      const fogColor = Number.isFinite(fogConfig.color) ? fogConfig.color : 0x0b1220;
      scene.background = new THREE.Color(fogColor);
      scene.fog = new THREE.FogExp2(fogColor, Number.isFinite(fogConfig.density) ? fogConfig.density : 0.0038);

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
      const terrainMaterialCache = new Map();

      function hexStyle(value) {
        const number = Number.isFinite(value) ? value : 0xffffff;
        return `#${number.toString(16).padStart(6, '0').slice(-6)}`;
      }

      function createProceduralTexture(spec) {
        if (!spec || typeof document === 'undefined' || typeof document.createElement !== 'function' || !THREE.CanvasTexture) return null;
        const canvas = document.createElement('canvas');
        if (!canvas?.getContext) return null;
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const colorA = hexStyle(spec.colorA);
        const colorB = hexStyle(spec.colorB);
        ctx.fillStyle = colorA;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (spec.kind === 'stripe') {
          ctx.fillStyle = colorB;
          for (let x = -canvas.width; x < canvas.width * 2; x += 18) {
            ctx.save();
            ctx.translate(x, 0);
            ctx.rotate(-Math.PI / 7);
            ctx.fillRect(0, -canvas.height, 7, canvas.height * 3);
            ctx.restore();
          }
        } else if (spec.kind === 'noise') {
          for (let y = 0; y < canvas.height; y += 8) {
            for (let x = 0; x < canvas.width; x += 8) {
              ctx.fillStyle = ((x * 31 + y * 17) % 5) < 2 ? colorB : colorA;
              ctx.globalAlpha = 0.22 + ((x + y) % 3) * 0.08;
              ctx.fillRect(x, y, 8, 8);
            }
          }
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = colorB;
          const cell = 16;
          for (let y = 0; y < canvas.height; y += cell) {
            for (let x = 0; x < canvas.width; x += cell) {
              if (((x + y) / cell) % 2 === 0) ctx.fillRect(x, y, cell, cell);
            }
          }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        if (texture.repeat?.set) texture.repeat.set(Number(spec.repeat) || 16, Number(spec.repeat) || 16);
        texture.needsUpdate = true;
        return texture;
      }

      function terrainMaterial(materialId, overrides = {}) {
        const materials = terrainConfig.materials || {};
        const fallbackId = terrainConfig.baseMaterial || Object.keys(materials)[0];
        const spec = materials[materialId] || materials[fallbackId] || {};
        const opacity = Number.isFinite(overrides.opacity) ? overrides.opacity : (Number.isFinite(spec.opacity) ? spec.opacity : 1);
        const cacheKey = `${materialId || fallbackId || 'default'}:${opacity}`;
        if (terrainMaterialCache.has(cacheKey)) return terrainMaterialCache.get(cacheKey).clone();
        const map = createProceduralTexture(spec.texture);
        const material = new THREE.MeshStandardMaterial({
          color: Number.isFinite(spec.color) ? spec.color : 0x15283a,
          roughness: Number.isFinite(spec.roughness) ? spec.roughness : 1,
          metalness: Number.isFinite(spec.metalness) ? spec.metalness : 0,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity >= 1,
          map
        });
        terrainMaterialCache.set(cacheKey, material);
        return material.clone();
      }

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

      function addTerrainPatch(patch) {
        if (!patch?.center || !patch?.size) return null;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(patch.size.x, 0.045, patch.size.z),
          terrainMaterial(patch.material, { opacity: patch.opacity })
        );
        mesh.position.set(patch.center.x, -0.505, patch.center.z);
        mesh.rotation.y = Number(patch.rotation) || 0;
        mesh.receiveShadow = true;
        testRangeGroup.add(mesh);
        return mesh;
      }

      function addRangeStrip(from, to, width, materialId, opacity = 0.38) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.hypot(dx, dz);
        if (length <= 0.01) return null;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.05, width),
          terrainMaterial(materialId, { opacity })
        );
        mesh.position.set((from.x + to.x) * 0.5, -0.485, (from.z + to.z) * 0.5);
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
        const rangeSize = TEST_RANGE.bounds * 2 + 80;
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(rangeSize, rangeSize),
          terrainMaterial(terrainConfig.baseMaterial)
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.49;
        ground.receiveShadow = true;
        testRangeGroup.add(ground);

        for (const patch of terrainConfig.patches || []) addTerrainPatch(patch);
        for (const strip of terrainConfig.strips || []) {
          const from = TEST_RANGE.pads?.[strip.fromPad] || TEST_RANGE[strip.fromPad];
          const to = TEST_RANGE.pads?.[strip.toPad] || TEST_RANGE[strip.toPad];
          if (from && to) addRangeStrip(from, to, strip.width || 7, strip.material, strip.opacity);
        }

        addRangeBox({ x: 112, y: 0.12, z: 12 }, { x: 36, y: -0.40, z: 0 }, 0x334155);
        addRangeBox({ x: 108, y: 0.03, z: 0.22 }, { x: 36, y: -0.31, z: 0 }, 0xe2e8f0, 0x334155);
        for (let x = -12; x <= TEST_RANGE.finishPad.x + 4; x += 10) addRangeBox({ x: 4.5, y: 0.035, z: 0.16 }, { x, y: -0.30, z: 0 }, 0xf8fafc);

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
        for (const padId of TEST_RANGE.padIds || Object.keys(TEST_RANGE.pads || {})) {
          const pad = TEST_RANGE.pads?.[padId] || TEST_RANGE[padId];
          if (pad) addRangePad(pad, pad.radius, padColors[padId] || 0x166534);
        }

        for (const obstacle of TEST_RANGE.obstacles || []) {
          addRangeBox(obstacle.size, obstacle.position, obstacle.color || 0x26384d, obstacle.emissive || 0x000000, obstacle.collidable === true);
        }

        const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
        for (const padId of TEST_RANGE.padIds || Object.keys(TEST_RANGE.pads || {})) {
          const pad = TEST_RANGE.pads?.[padId] || TEST_RANGE[padId];
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
