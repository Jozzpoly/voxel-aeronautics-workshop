(() => {
  'use strict';

  window.VAW.define('game.module-visual-factory', ['game.orientation-service'], OrientationService => {
    function create(options = {}) {
      const { THREE = window.THREE, sharedGeometry, cloneMaterial, visualAssetRegistry = null } = options;
      if (!THREE?.Mesh || !THREE?.Group || !sharedGeometry || typeof cloneMaterial !== 'function') {
        throw new TypeError('Module visual factory requires THREE, shared geometry, and cloneMaterial.');
      }
      const orientation = OrientationService.create({ THREE });
      const { normalizeOrientationId, partUsesOrientation, getModuleBasis } = orientation;

      function makeNonRaycastableChildren(root, raycastableProxy) {
        root.traverse(object => {
          if (object !== raycastableProxy) object.raycast = () => {};
        });
      }

      function createModuleVisual(type, orientation, ghostMode = false) {
        const visualAsset = visualAssetRegistry?.assetForBlockType?.(type) || null;
        const root = new THREE.Group();
        const proxy = new THREE.Mesh(sharedGeometry, cloneMaterial(type));
        proxy.name = 'vawHitProxy';
        proxy.castShadow = true;
        proxy.receiveShadow = true;
        proxy.userData.isVoxelHitProxy = true;
        root.add(proxy);
        root.userData.isVoxelRoot = true;
        root.userData.type = type;
        root.userData.orientation = normalizeOrientationId(orientation);
        root.userData.visualAssetId = visualAsset?.assetId || null;
        root.userData.visualAssetStatus = visualAsset ? 'registered-fallback' : 'procedural-fallback';
        root.scale.set(0.96, 0.96, 0.96);
        if (partUsesOrientation(type)) {
          root.quaternion.copy(getModuleBasis(orientation).quaternion);
        } else {
          root.quaternion.identity();
        }

        if (ghostMode) {
          proxy.material.transparent = true;
          proxy.material.opacity = 0.52;
        }

        if (type === 'Core') {
          const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 14, 14),
            new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: ghostMode ? 0.22 : 0.5 })
          );
          root.add(glow);

          const inner = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16, 0),
            new THREE.MeshStandardMaterial({ color: 0xf5d0fe, roughness: 0.35, metalness: 0.1, emissive: 0x4c1d95, emissiveIntensity: 0.18, transparent: ghostMode, opacity: ghostMode ? 0.72 : 1 })
          );
          root.add(inner);

          const nose = new THREE.Mesh(
            new THREE.ConeGeometry(0.13, 0.42, 8),
            new THREE.MeshStandardMaterial({ color: 0xf0abfc, roughness: 0.38, metalness: 0.22, emissive: 0x581c87, emissiveIntensity: 0.2, transparent: ghostMode, opacity: ghostMode ? 0.65 : 1 })
          );
          nose.rotation.z = -Math.PI / 2;
          nose.position.x = 0.58;
          root.add(nose);

          const topMarker = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.08, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.4, metalness: 0.28, emissive: 0x164e63, emissiveIntensity: 0.18, transparent: ghostMode, opacity: ghostMode ? 0.62 : 1 })
          );
          topMarker.position.set(0, 0.51, 0);
          root.add(topMarker);
        }

        if (type === 'Thruster') {
          const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.34, 0.62, 10),
            new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.82, metalness: 0.38, transparent: ghostMode, opacity: ghostMode ? 0.4 : 1 })
          );
          nozzle.rotation.z = Math.PI / 2;
          nozzle.position.x = -0.48;
          root.add(nozzle);

          const nozzleCap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 0.22, 8),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.72, transparent: ghostMode, opacity: ghostMode ? 0.45 : 1 })
          );
          nozzleCap.rotation.z = Math.PI / 2;
          nozzleCap.position.x = -0.73;
          root.add(nozzleCap);

          const flameCore = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.52, 12),
            new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: ghostMode ? 0.18 : 0.9 })
          );
          flameCore.rotation.z = -Math.PI / 2;
          flameCore.position.x = -0.98;
          flameCore.name = 'flame';
          root.add(flameCore);

          const flameGlow = new THREE.Mesh(
            new THREE.ConeGeometry(0.18, 0.85, 12),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: ghostMode ? 0.12 : 0.4 })
          );
          flameGlow.rotation.z = -Math.PI / 2;
          flameGlow.position.x = -1.03;
          flameGlow.name = 'flameGlow';
          root.add(flameGlow);
        }

        if (type === 'VectorThruster') {
          const gimbal = new THREE.Group();
          gimbal.name = 'gimbalAssembly';
          gimbal.position.x = -0.30;
          root.add(gimbal);
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.31, 0.07, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.42, metalness: 0.58, transparent: ghostMode, opacity: ghostMode ? 0.42 : 1 })
          );
          ring.rotation.y = Math.PI / 2;
          gimbal.add(ring);
          const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.31, 0.68, 10),
            new THREE.MeshStandardMaterial({ color: 0x29213a, roughness: 0.7, metalness: 0.52, transparent: ghostMode, opacity: ghostMode ? 0.42 : 1 })
          );
          nozzle.rotation.z = Math.PI / 2;
          nozzle.position.x = -0.36;
          gimbal.add(nozzle);
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.72, 12),
            new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: ghostMode ? 0.16 : 0.85 })
          );
          flame.rotation.z = -Math.PI / 2;
          flame.position.x = -0.93;
          flame.name = 'flame';
          gimbal.add(flame);
          const glow = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 1.0, 12),
            new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: ghostMode ? 0.10 : 0.34 })
          );
          glow.rotation.z = -Math.PI / 2;
          glow.position.x = -1.02;
          glow.name = 'flameGlow';
          gimbal.add(glow);
        }

        if (type === 'Balloon') {
          const dome = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x7cc4ff, roughness: 0.42, metalness: 0.05, transparent: true, opacity: ghostMode ? 0.5 : 0.96 })
          );
          dome.position.y = 0.52;
          root.add(dome);

          const knot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6),
            new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.75, metalness: 0.02, transparent: ghostMode, opacity: ghostMode ? 0.45 : 1 })
          );
          knot.position.y = 0.02;
          root.add(knot);

          const basket = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.16, 0.26),
            new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.88, metalness: 0.02, transparent: ghostMode, opacity: ghostMode ? 0.55 : 1 })
          );
          basket.position.set(0, -0.54, 0);
          root.add(basket);
        }

        if (type === 'Wing') {
          const wing = new THREE.Mesh(
            new THREE.BoxGeometry(1.25, 0.1, 0.54),
            new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.56, metalness: 0.1, transparent: ghostMode, opacity: ghostMode ? 0.5 : 1 })
          );
          wing.position.set(0.03, -0.16, 0);
          root.add(wing);

          const tip = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.14, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.5, metalness: 0.08, transparent: ghostMode, opacity: ghostMode ? 0.46 : 1 })
          );
          tip.position.set(0.46, 0.03, 0);
          root.add(tip);
        }

        if (type === 'ControlSurface') {
          const fixed = new THREE.Mesh(
            new THREE.BoxGeometry(0.68, 0.10, 0.68),
            new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.52, metalness: 0.12, transparent: ghostMode, opacity: ghostMode ? 0.48 : 1 })
          );
          fixed.position.x = -0.22;
          root.add(fixed);
          const flapPivot = new THREE.Group();
          flapPivot.name = 'controlFlapPivot';
          flapPivot.position.x = 0.22;
          root.add(flapPivot);
          const flap = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.08, 0.68),
            new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.42, metalness: 0.10, transparent: ghostMode, opacity: ghostMode ? 0.52 : 1 })
          );
          flap.position.x = 0.27;
          flapPivot.add(flap);
        }

        if (type === 'Gyro') {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.08, 8, 18),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.3, transparent: ghostMode, opacity: ghostMode ? 0.5 : 1 })
          );
          ring.rotation.x = Math.PI / 2;
          root.add(ring);

          const hub = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.34, metalness: 0.18, emissive: 0x7c2d12, emissiveIntensity: 0.06, transparent: ghostMode, opacity: ghostMode ? 0.62 : 1 })
          );
          root.add(hub);
        }

        if (type === 'Fuel') {
          const canister = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.24, 0.62, 10),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.18, transparent: ghostMode, opacity: ghostMode ? 0.52 : 1 })
          );
          canister.rotation.z = Math.PI / 2;
          root.add(canister);

          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.14, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82, metalness: 0.04, transparent: ghostMode, opacity: ghostMode ? 0.5 : 1 })
          );
          cap.position.x = 0.38;
          root.add(cap);
        }

        makeNonRaycastableChildren(root, proxy);
        return root;
      }

      return Object.freeze({ createModuleVisual });
    }

    return Object.freeze({ create });
  });
})();
