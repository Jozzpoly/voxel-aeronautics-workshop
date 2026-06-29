(() => {
  'use strict';

  window.VAW.define('game.visual-runtime-adapter', [], () => {
    function create() {
      function isHiddenFallback(object) {
        let current = object;
        while (current) {
          if (current.userData?.vawHiddenByImportedVisual) return true;
          current = current.parent;
        }
        return false;
      }

      function eachMaterial(root, visitor) {
        root?.traverse?.(object => {
          if (isHiddenFallback(object)) return;
          const materials = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
          for (const material of materials) visitor(material, object);
        });
      }

      function findByName(root, name) {
        let found = null;
        root?.traverse?.(object => {
          if (!found && !isHiddenFallback(object) && object?.name === name) found = object;
        });
        return found;
      }

      function pathSegments(binding) {
        if (typeof binding !== 'string' || !binding.trim()) return [];
        return binding.split('/').map(part => part.trim()).filter(Boolean);
      }

      function objectNamePath(object, root) {
        const names = [];
        let current = object;
        while (current) {
          if (current.name) names.unshift(current.name);
          if (current === root) break;
          current = current.parent;
        }
        return names;
      }

      function pathMatchesSuffix(names, segments) {
        if (!segments.length || names.length < segments.length) return false;
        const offset = names.length - segments.length;
        return segments.every((segment, index) => names[offset + index] === segment);
      }

      function findByBinding(root, binding) {
        const segments = pathSegments(binding);
        if (!segments.length) return null;
        if (segments.length === 1) return findByName(root, segments[0]);
        const normalized = `/${segments.join('/')}`;
        let found = null;
        root?.traverse?.(object => {
          if (found || isHiddenFallback(object)) return;
          if (object.userData?.visualAssetOriginalPath === normalized) {
            found = object;
            return;
          }
          if (pathMatchesSuffix(objectNamePath(object, root), segments)) found = object;
        });
        return found || findByName(root, segments[segments.length - 1]);
      }

      function nodeBindings(root) {
        const maps = [];
        if (root?.userData?.visualAssetNodeBindings) maps.push(root.userData.visualAssetNodeBindings);
        root?.traverse?.(object => {
          if (object !== root && object?.userData?.visualAssetNodeBindings) maps.push(object.userData.visualAssetNodeBindings);
        });
        return maps;
      }

      function findByAlias(root, alias, fallbackName = alias) {
        for (const bindings of nodeBindings(root)) {
          const binding = bindings?.[alias];
          if (typeof binding !== 'string' || !binding.trim()) continue;
          const found = findByBinding(root, binding);
          if (found) return found;
        }
        return findByName(root, fallbackName);
      }

      function setGimbal(root, gimbalA = 0, gimbalB = 0, maxAngle = 0) {
        const gimbal = findByAlias(root, 'gimbalAssembly');
        if (!gimbal) return false;
        gimbal.rotation.y = (Number(gimbalB) || 0) * maxAngle;
        gimbal.rotation.z = -(Number(gimbalA) || 0) * maxAngle;
        return true;
      }

      function setThrusterIntensity(root, intensity = 0, { active = true } = {}) {
        const value = Math.max(0, Number(intensity) || 0);
        let changed = 0;
        const targets = [
          ['flame', findByAlias(root, 'flame')],
          ['flameGlow', findByAlias(root, 'flameGlow')]
        ].filter((entry, index, list) => entry[1] && list.findIndex(item => item[1] === entry[1]) === index);
        for (const [alias, object] of targets) {
          const isGlow = alias === 'flameGlow' || object.name === 'flameGlow';
          const baseScale = isGlow ? 1.15 : 0.95;
          const scaleBoost = 0.55 + value * (isGlow ? 0.55 : 0.85);
          object.visible = Boolean(active) && value > 0.01;
          object.scale.setScalar(baseScale * scaleBoost);
          if (object.material && 'opacity' in object.material) {
            object.material.opacity = object.visible ? (isGlow ? 0.16 + value * 0.28 : 0.55 + value * 0.35) : 0;
          }
          changed += 1;
        }
        return changed;
      }

      function setControlDeflection(root, command = 0, maxDeflection = 0) {
        const flap = findByAlias(root, 'controlFlapPivot');
        if (!flap) return false;
        flap.rotation.z = -(Number(command) || 0) * maxDeflection;
        return true;
      }

      function setDamageTint(root, health = 1, { redScale = 0.72, green = 0.02, blue = 0.01, threshold = 0.75 } = {}) {
        const value = Math.max(0, Math.min(1, Number(health)));
        if (!(value < threshold)) return 0;
        let changed = 0;
        eachMaterial(root, material => {
          if (!material || !material.emissive) return;
          if (typeof material.emissive.setRGB === 'function') material.emissive.setRGB((1 - value) * redScale, green, blue);
          else if (typeof material.emissive.setHex === 'function') material.emissive.setHex(0xff0000);
          else return;
          changed += 1;
        });
        return changed;
      }

      return Object.freeze({ findByName, setGimbal, setThrusterIntensity, setControlDeflection, setDamageTint });
    }

    return Object.freeze({ create });
  });
})();
