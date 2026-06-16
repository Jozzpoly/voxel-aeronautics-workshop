'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

global.window = global;
function load(relative) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), { filename: relative });
}

load('src/foundation/kernel.js');
load('src/foundation/input_profile.js');
window.VAW.define('foundation.flight-control', [], () => ({ keyboardLockCodes: () => [] }));
window.VAW.define('foundation.craft-compiler', [], () => ({
  compile: () => ({ controlFrame: { forward: [0, 0, -1], up: [0, 1, 0], right: [1, 0, 0] } })
}));
window.VAW.define('foundation.control-frame', [], () => ({
  fromCore: () => ({ forward: [0, 0, -1], up: [0, 1, 0], right: [1, 0, 0] })
}));
load('src/game/input_settings_controller.js');

const body = { tagName: 'BODY', parentElement: null };
const document = {
  activeElement: body,
  documentElement: {},
  fullscreenElement: null,
  getElementById: () => null
};
const InputProfile = window.VAW.require('foundation.input-profile');
const state = { input: { profile: InputProfile.createDefault() }, flight: { compiled: null } };
const controller = window.VAW.require('game.input-settings-controller').create({
  state,
  craft: {},
  document,
  navigator: {}
});

function element(tagName, parentElement = null, extra = {}) {
  return { tagName, parentElement, disabled: false, getAttribute: () => null, ...extra };
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const input = element('INPUT');
const textarea = element('TEXTAREA');
const select = element('SELECT');
const button = element('BUTTON');
const editable = element('DIV', null, { isContentEditable: true });
const editableChild = element('SPAN', editable);
const disabledInput = element('INPUT', null, { disabled: true });

assert(controller.isEditableInteractionActive(input, body), 'Input target must suppress hotkeys.');
assert(controller.isEditableInteractionActive(body, textarea), 'Active textarea must suppress hotkeys.');
assert(controller.isEditableInteractionActive(select, body), 'Select interaction must suppress hotkeys.');
assert(controller.isEditableInteractionActive(editableChild, body), 'Contenteditable ancestry must suppress hotkeys.');
assert(!controller.isEditableInteractionActive(button, button), 'Buttons must not become persistent text editors.');
assert(!controller.isEditableInteractionActive(disabledInput, body), 'Disabled inputs must not claim editing focus.');

let blurCount = 0;
select.blur = () => { blurCount += 1; document.activeElement = body; };
document.activeElement = select;
assert(controller.releaseEditableInteraction(), 'Editable focus must be releasable.');
assert(blurCount === 1 && document.activeElement === body, 'Releasing focus must call blur exactly once.');
assert(!controller.releaseEditableInteraction(button), 'Ordinary buttons must not be blurred by the editable-focus helper.');

console.log(JSON.stringify({
  editableTargets: 'ok',
  contentEditableAncestry: 'ok',
  buttonPolicy: 'ok',
  explicitRelease: 'ok'
}, null, 2));
