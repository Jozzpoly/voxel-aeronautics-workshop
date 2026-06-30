const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
global.window = global;
global.document = { createElement: () => ({}) };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'tests/browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });

for (const relative of [
  'src/foundation/kernel.js',
  'src/game/visual_runtime_adapter.js'
]) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

const RuntimeAdapter = VAW.require('game.visual-runtime-adapter');
const adapter = RuntimeAdapter.create();

function group(name) {
  const item = new THREE.Group();
  item.name = name;
  return item;
}

function assertNear(value, expected, epsilon = 1e-6) {
  assert(Math.abs(value - expected) <= epsilon, `expected ${value} to be near ${expected}`);
}

{
  const root = group('root');
  const gimbal = group('gimbalAssembly');
  root.add(gimbal);
  assert.strictEqual(adapter.setGimbal(root, 0.5, -0.25, Math.PI / 8), true);
  assertNear(gimbal.rotation.y, -0.25 * Math.PI / 8);
  assertNear(gimbal.rotation.z, -0.5 * Math.PI / 8);
}

{
  const root = group('root');
  root.userData.visualAssetNodeBindings = { gimbalAssembly: '/ImportedRoot/NozzlePivot' };
  root.userData.visualAssetRigBindings = {
    vectorThruster: {
      channels: [
        { input: 'gimbalA', node: 'gimbalAssembly', axis: 'x', direction: 1 },
        { input: 'gimbalB', node: 'gimbalAssembly', axis: 'z', direction: -1 },
        { input: 'roll', node: 'gimbalAssembly', axis: 'y', direction: 1 }
      ]
    }
  };
  const importedRoot = group('ImportedRoot');
  const nozzle = group('NozzlePivot');
  nozzle.rotation.x = 0.1;
  nozzle.rotation.y = 0.2;
  nozzle.rotation.z = 0.3;
  importedRoot.add(nozzle);
  root.add(importedRoot);

  assert.strictEqual(adapter.setGimbal(root, 0.5, -0.25, Math.PI / 4, { roll: 0.75 }), true);
  assertNear(nozzle.rotation.x, 0.1 + 0.5 * Math.PI / 4);
  assertNear(nozzle.rotation.y, 0.2 + 0.75 * Math.PI / 4);
  assertNear(nozzle.rotation.z, 0.3 + 0.25 * Math.PI / 4);

  assert.strictEqual(adapter.setGimbal(root, 0, 0, Math.PI / 4, { roll: 0 }), true);
  assertNear(nozzle.rotation.x, 0.1);
  assertNear(nozzle.rotation.y, 0.2);
  assertNear(nozzle.rotation.z, 0.3);
}

{
  const root = group('root');
  root.userData.visualAssetNodeBindings = { gimbalAssembly: '/Missing' };
  root.userData.visualAssetRigBindings = {
    vectorThruster: {
      channels: [{ input: 'gimbalA', node: 'gimbalAssembly', axis: 'x', direction: 1 }]
    }
  };
  assert.strictEqual(adapter.setGimbal(root, 1, 0, Math.PI / 4), false);
}

{
  const root = group('root');
  const gimbal = group('gimbalAssembly');
  root.add(gimbal);
  root.userData.visualAssetRigBindings = {
    vectorThruster: {
      channels: [{ input: 'gimbalA', node: 'gimbalAssembly', axis: 'yaw', direction: 1 }]
    }
  };
  assert.strictEqual(adapter.setGimbal(root, 1, 0, Math.PI / 4), false);
  assertNear(gimbal.rotation.x, 0);
  assertNear(gimbal.rotation.y, 0);
  assertNear(gimbal.rotation.z, 0);
}

console.log({ visualRuntimeAdapter: 'ok' });
