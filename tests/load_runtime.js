const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FOUNDATION_SOURCES = [
  'src/foundation/kernel.js',
  'src/foundation/config.js',
  'src/foundation/catalog.js',
  'src/foundation/orientation.js',
  'src/foundation/blueprint.js',
  'src/foundation/diagnostics.js',
  'src/foundation/transform_math.js',
  'src/foundation/assembly_spaces.js',
  'src/foundation/craft_model.js',
  'src/foundation/craft_history.js',
  'src/foundation/control_frame.js',
  'src/foundation/mass_properties.js',
  'src/foundation/structural_graph_compiler.js',
  'src/foundation/mechanical_authoring_resolver.js',
  'src/foundation/rigid_island_compiler.js',
  'src/foundation/mechanical_graph_compiler.js',
  'src/foundation/craft_compiler.js',
  'src/foundation/runtime_assembly.js',
  'src/foundation/fixed_step_scheduler.js'
];
const RUNTIME_SOURCES = [
  'src/runtime/physics_port.js',
  'src/runtime/cannon_physics_backend.js',
  'src/runtime/headless_physics_backend.js',
  'src/runtime/assembly_builder.js'
];

function load(sources, { stubs = false } = {}) {
  global.window = global;
  if (stubs && !global.THREE) {
    global.document = global.document || { createElement: () => ({}) };
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'browser_stub_libs.js'), 'utf8'), { filename: 'stub-libs.js' });
  }
  for (const relative of sources) {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
  }
  return global.VAW;
}

module.exports = { ROOT, FOUNDATION_SOURCES, RUNTIME_SOURCES, load };
