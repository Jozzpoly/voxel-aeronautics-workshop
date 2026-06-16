#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUTPUT_DIR = path.join(ROOT, 'recovery-artifacts', 'browser');
const TEMP_FILES = [
  '.recovery_browser_three_stub.js',
  '.recovery_browser_game.js',
  '.recovery_browser_source.html',
  '.recovery_browser_dist.html'
].map(name => path.join(ROOT, name));
const POLICY_FILES = [
  '/etc/chromium/policies/managed/000_policy_merge.json',
  '/etc/chromium/policies/managed/.policy_merge/001_base_url_blocklist.json',
  '/etc/chromium/policies/managed/.policy_merge_backup/001_base_url_blocklist.json'
];
const BLUEPRINT = {
  version: 11,
  blocks: [
    { blockId: 'recovery:core', x: 0, y: 0, z: 0, type: 'Core', orientation: 0, controlAxis: 'pitch', controlSign: 0 },
    { blockId: 'recovery:root-frame', x: 1, y: 0, z: 0, type: 'Frame', orientation: 0, controlAxis: 'pitch', controlSign: 0 },
    { blockId: 'recovery:fuel', x: 0, y: 1, z: 0, type: 'Fuel', orientation: 0, controlAxis: 'pitch', controlSign: 0 },
    { blockId: 'recovery:arm', x: 2, y: 0, z: 0, type: 'Frame', orientation: 0, controlAxis: 'pitch', controlSign: 0 },
    { blockId: 'recovery:arm-tip', x: 3, y: 0, z: 0, type: 'Hull', orientation: 0, controlAxis: 'pitch', controlSign: 0 },
    { blockId: 'recovery:sub-thruster', x: 3, y: 1, z: 0, type: 'Thruster', orientation: 0, controlAxis: 'pitch', controlSign: 0 }
  ],
  mechanicalLinks: [{
    mechanicalLinkId: 'mechanical:recovery-arm',
    kind: 'hinge',
    endpointA: { blockId: 'recovery:root-frame', face: 'PX' },
    endpointB: { blockId: 'recovery:arm', face: 'NX' },
    axis: 'PY',
    collideConnected: false,
    maxForce: 1000000,
    frictionTorque: 0,
    limits: null
  }],
  selectedBlock: 'Hull', orientation: 0, symmetry: 'NONE', thrusterPower: 0,
  balloonPower: 0, stabilityAssist: 0, controlAxis: 'pitch', controlSign: 0
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function distance(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0), (a?.z || 0) - (b?.z || 0));
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForUrl(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError || 'no response'}`);
}

function killGroup(child) {
  if (!child || child.killed) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch (_) {}
}

async function temporarilyRemoveUrlBlocklist() {
  const backups = new Map();
  for (const filename of POLICY_FILES) {
    try {
      const content = await fs.readFile(filename, 'utf8');
      backups.set(filename, content);
      const parsed = JSON.parse(content);
      if (Object.prototype.hasOwnProperty.call(parsed, 'URLBlocklist')) {
        delete parsed.URLBlocklist;
        await fs.writeFile(filename, `${JSON.stringify(parsed, null, 2)}\n`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return async () => {
    for (const [filename, content] of backups) await fs.writeFile(filename, content);
  };
}

function injectProbe(gameSource) {
  const stateMarker = "    const WORKSHOP = STATE.workshop;\n";
  assert(gameSource.includes(stateMarker), 'Browser probe state marker is missing.');
  gameSource = gameSource.replace(stateMarker, `${stateMarker}    window.__VAW_RECOVERY_PROBE__ = { state: STATE, craft: CRAFT, workshop: WORKSHOP };\n`);

  const runtimeMarker = "    const debrisRuntime = DebrisRuntime.create({\n";
  assert(gameSource.includes(runtimeMarker), 'Browser probe runtime marker is missing.');
  const probe = String.raw`    const recoveryVector = value => ({ x: Number(value?.x) || 0, y: Number(value?.y) || 0, z: Number(value?.z) || 0 });
    const recoveryQuaternion = value => ({ x: Number(value?.x) || 0, y: Number(value?.y) || 0, z: Number(value?.z) || 0, w: Number(value?.w) || 1 });
    function recoverySnapshot() {
      const active = flightSession.isActive();
      const bodyIds = active ? flightSession.bodyIds() : [];
      const plan = active ? flightSession.getPlan() : null;
      const constraints = new Map((plan?.constraints || []).map(entry => [String(entry.constraintId), entry]));
      const visuals = scene.children.filter(child => child?.userData?.runtimeMechanicalLinkId).map(group => {
        const constraintId = String(group.userData.runtimeMechanicalLinkId);
        const source = [...constraints.values()].find(entry => String(entry.mechanicalLinkId || entry.constraintId) === constraintId) || null;
        const endpointA = group.userData.endpointA ? recoveryVector(group.userData.endpointA) : null;
        const endpointB = group.userData.endpointB ? recoveryVector(group.userData.endpointB) : null;
        const expectedA = source ? recoveryVector(flightSession.pointToWorldFrame(source.bodyAId, { x: source.pivotA[0], y: source.pivotA[1], z: source.pivotA[2] })) : null;
        const expectedB = source ? recoveryVector(flightSession.pointToWorldFrame(source.bodyBId, { x: source.pivotB[0], y: source.pivotB[1], z: source.pivotB[2] })) : null;
        const error = (actual, expected) => actual && expected ? Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z) : null;
        return { constraintId, endpointA, endpointB, expectedA, expectedB, endpointAError: error(endpointA, expectedA), endpointBError: error(endpointB, expectedB) };
      });
      return {
        mode: STATE.mode,
        active,
        primaryBodyId: flightSession.primaryBodyId(),
        bodyIds,
        bodies: bodyIds.map(bodyId => {
          const transform = flightSession.getBodyTransform(bodyId);
          return { bodyId, position: recoveryVector(transform.position), quaternion: recoveryQuaternion(transform.quaternion), velocity: recoveryVector(flightSession.getBodyLinearVelocity(bodyId)) };
        }),
        parts: (STATE.flight.runtimeParts || []).map(part => ({ blockId: part.blockId, type: part.type, bodyId: part.bodyId, attached: Boolean(part.attached), lastCommand: Number(part.lastCommand) || 0 })),
        manager: { active: flightMechanicalVisuals.active, size: flightMechanicalVisuals.size },
        visuals,
        activeElement: document.activeElement?.id || document.activeElement?.tagName || null,
        linkOptions: Array.from(document.getElementById('mechanical-link-list')?.options || []).map(option => option.value)
      };
    }
    function recoveryStep(count = 1, dt = 1 / 120) {
      for (let index = 0; index < count; index += 1) {
        if (STATE.mode !== 'FLIGHT' || !flightSession.isActive()) break;
        stepFlightPhysics(dt);
        Physics.step(world, dt);
        processPendingImpacts();
        syncFlightVisuals();
        updateFlameVisibility();
      }
      return recoverySnapshot();
    }
    Object.assign(window.__VAW_RECOVERY_PROBE__, { flightSession, flightThrusterRouter, flightMechanicalVisuals, scene, world, Physics, snapshot: recoverySnapshot, step: recoveryStep });

`;
  gameSource = gameSource.replace(runtimeMarker, `${probe}${runtimeMarker}`);
  const blueprintMarker = "    } = blueprintController;\n";
  assert(gameSource.includes(blueprintMarker), 'Browser probe blueprint marker is missing.');
  return gameSource.replace(blueprintMarker, `${blueprintMarker}    Object.assign(window.__VAW_RECOVERY_PROBE__, { loadBlueprintData, collectBlueprint });\n`);
}

async function prepareHermeticTargets() {
  const stubSource = await fs.readFile(path.join(ROOT, 'tests', 'browser_stub_libs.js'), 'utf8');
  const cannonStart = stubSource.indexOf('  class CV3');
  assert(cannonStart > 0, 'Could not split Three browser stub from Cannon stub.');
  const threeStub = `${stubSource.slice(0, cannonStart)}`
    .replace("this.name='';} add", "this.name='';} getObjectByName(name){if(this.name===name)return this;for(const child of this.children){const found=child?.getObjectByName?child.getObjectByName(name):(child?.name===name?child:null);if(found)return found;}return undefined;} add") + '})();\n';
  await fs.writeFile(path.join(ROOT, '.recovery_browser_three_stub.js'), threeStub);

  const gameSource = injectProbe(await fs.readFile(path.join(ROOT, 'src', 'game.js'), 'utf8'));
  await fs.writeFile(path.join(ROOT, '.recovery_browser_game.js'), gameSource);

  const rewriteDependencies = html => html
    .replace('<head>', '<head><link rel="icon" href="data:,">')
    .replace('<script src="https://cdn.tailwindcss.com"></script>', '')
    .replace('<script src="https://unpkg.com/three@0.128.0/build/three.min.js"></script>', '<script src=".recovery_browser_three_stub.js"></script>')
    .replace('<script src="https://unpkg.com/cannon@0.6.2/build/cannon.min.js"></script>', '<script src="tests/vendor/cannon-0.6.2/cannon.min.js"></script>');

  let sourceHtml = rewriteDependencies(await fs.readFile(path.join(ROOT, 'index.html'), 'utf8'));
  sourceHtml = sourceHtml.replace("        'src/game.js'", "        '.recovery_browser_game.js'");
  await fs.writeFile(path.join(ROOT, '.recovery_browser_source.html'), sourceHtml);

  const distDir = path.join(ROOT, 'dist');
  const distName = (await fs.readdir(distDir)).find(name => name.endsWith('.html'));
  assert(distName, 'Built distribution HTML is missing.');
  let distHtml = rewriteDependencies(await fs.readFile(path.join(distDir, distName), 'utf8'));
  distHtml = injectProbe(distHtml);
  await fs.writeFile(path.join(ROOT, '.recovery_browser_dist.html'), distHtml);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = null;
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket open timed out.')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', event => { clearTimeout(timer); reject(new Error(`CDP WebSocket error: ${event.message || 'unknown'}`)); }, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
        else pending.resolve(message.result || {});
        return;
      }
      const listeners = this.listeners.get(message.method) || [];
      for (const listener of listeners) listener(message.params || {});
    });
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, 15000);
      this.pending.set(id, {
        method,
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket?.close(); }
}

async function evaluate(cdp, expression) {
  const response = await cdp.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (response.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(response.exceptionDetails)}`);
  return response.result?.value;
}

async function waitFor(cdp, expression, description, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evaluate(cdp, expression);
    if (lastValue) return lastValue;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}`);
}

async function pressKey(cdp, code, key, keyCode) {
  const base = { code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: key.length === 1 ? key : undefined, unmodifiedText: key.length === 1 ? key : undefined });
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

async function keyDown(cdp, code, key, keyCode) {
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, text: key, unmodifiedText: key });
}

async function keyUp(cdp, code, key, keyCode) {
  await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function screenshot(cdp, filename) {
  const { data } = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(OUTPUT_DIR, filename), Buffer.from(data, 'base64'));
}

async function runScenario(cdp, baseUrl, targetName, browserMessages) {
  await cdp.call('Page.navigate', { url: `${baseUrl}/.recovery_browser_${targetName}.html?recovery=${Date.now()}` });
  await waitFor(cdp, 'Boolean(window.__VAW_RECOVERY_PROBE__ && window.__VAW_RECOVERY_PROBE__.snapshot)', `${targetName} app bootstrap`);
  await evaluate(cdp, `(() => { document.getElementById('start-engineering')?.click(); return true; })()`);

  const loaded = await evaluate(cdp, `window.__VAW_RECOVERY_PROBE__.loadBlueprintData(${JSON.stringify(BLUEPRINT)})`);
  assert(loaded === true, `${targetName}: BlueprintController rejected the articulated recovery craft.`);
  await waitFor(cdp, `window.__VAW_RECOVERY_PROBE__.craft.size === 6 && Array.from(document.getElementById('mechanical-link-list').options).some(option => option.value)`, `${targetName} articulated blueprint import`);

  const focusResult = await evaluate(cdp, `(() => {
    const axis = document.getElementById('hinge-axis');
    axis.focus(); axis.value = 'NY'; axis.dispatchEvent(new Event('change', { bubbles: true }));
    const links = document.getElementById('mechanical-link-list');
    links.focus(); links.selectedIndex = Math.min(1, links.options.length - 1); links.dispatchEvent(new Event('change', { bubbles: true }));
    const canvas = document.querySelector('#canvas-container canvas');
    const eventInit = { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 0, pointerId: 1, pointerType: 'mouse' };
    canvas.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    canvas.dispatchEvent(new PointerEvent('pointerup', eventInit));
    return { axis: axis.value, link: links.value, activeElement: document.activeElement?.id || document.activeElement?.tagName };
  })()`);
  assert(focusResult.axis === 'NY', `${targetName}: hinge axis UI change did not stick.`);
  assert(focusResult.link, `${targetName}: mechanical link list did not select a link.`);
  assert(!['hinge-axis', 'mechanical-link-list'].includes(focusResult.activeElement), `${targetName}: canvas did not release editable focus.`);
  await screenshot(cdp, `${targetName}-01-build.png`);

  await pressKey(cdp, 'KeyF', 'f', 70);
  await waitFor(cdp, `window.__VAW_RECOVERY_PROBE__.snapshot().mode === 'FLIGHT'`, `${targetName} first launch`);
  const before = await evaluate(cdp, 'window.__VAW_RECOVERY_PROBE__.snapshot()');
  assert(before.active, `${targetName}: FlightSession is not active after F.`);
  assert(before.bodyIds.length === 2, `${targetName}: expected two runtime bodies, found ${before.bodyIds.length}.`);
  assert(before.manager.size === 1 && before.visuals.length === 1, `${targetName}: expected exactly one runtime hinge visual on first launch.`);
  assert(before.visuals[0].endpointAError < 1e-8 && before.visuals[0].endpointBError < 1e-8, `${targetName}: initial hinge endpoints do not match body transforms.`);
  const subPartBefore = before.parts.find(part => part.blockId === 'recovery:sub-thruster');
  assert(subPartBefore, `${targetName}: sub-body thruster is missing at runtime.`);
  assert(subPartBefore.bodyId !== before.primaryBodyId, `${targetName}: test thruster unexpectedly belongs to root body.`);

  await keyDown(cdp, 'KeyW', 'w', 87);
  const after = await evaluate(cdp, 'window.__VAW_RECOVERY_PROBE__.step(120, 1 / 120)');
  await keyUp(cdp, 'KeyW', 'w', 87);
  const subPartAfter = after.parts.find(part => part.blockId === 'recovery:sub-thruster');
  const beforeBody = before.bodies.find(body => body.bodyId === subPartBefore.bodyId);
  const afterBody = after.bodies.find(body => body.bodyId === subPartAfter.bodyId);
  assert(subPartAfter.lastCommand > 0.01, `${targetName}: sub-body thruster did not receive a manual command.`);
  assert(distance(beforeBody.position, afterBody.position) > 1e-4 || distance(beforeBody.velocity, afterBody.velocity) > 1e-4, `${targetName}: sub-body did not react during manual control.`);
  assert(after.visuals.length === 1 && after.manager.size === 1, `${targetName}: runtime hinge visual disappeared or duplicated during motion.`);
  assert(after.visuals[0].endpointAError < 1e-8 && after.visuals[0].endpointBError < 1e-8, `${targetName}: moving hinge visual does not match current body transforms.`);
  assert(distance(before.visuals[0].endpointB, after.visuals[0].endpointB) > 1e-4, `${targetName}: sub-body hinge endpoint did not move.`);
  await screenshot(cdp, `${targetName}-02-flight-subbody-thrust.png`);

  async function returnToBuild(label) {
    await pressKey(cdp, 'KeyF', 'f', 70);
    await waitFor(cdp, `window.__VAW_RECOVERY_PROBE__.snapshot().mode === 'BUILD' || !document.getElementById('debrief-modal').hidden`, `${targetName} ${label} transition`);
    const debriefVisible = await evaluate(cdp, `!document.getElementById('debrief-modal').hidden`);
    if (debriefVisible) await pressKey(cdp, 'KeyF', 'f', 70);
    await waitFor(cdp, `window.__VAW_RECOVERY_PROBE__.snapshot().mode === 'BUILD'`, `${targetName} ${label}`);
  }

  await returnToBuild('return to build');
  const stopped = await evaluate(cdp, 'window.__VAW_RECOVERY_PROBE__.snapshot()');
  assert(!stopped.active && stopped.manager.size === 0 && stopped.visuals.length === 0, `${targetName}: flight cleanup left runtime hinge visuals behind.`);

  await pressKey(cdp, 'KeyF', 'f', 70);
  await waitFor(cdp, `window.__VAW_RECOVERY_PROBE__.snapshot().mode === 'FLIGHT'`, `${targetName} second launch`);
  const relaunched = await evaluate(cdp, 'window.__VAW_RECOVERY_PROBE__.snapshot()');
  assert(relaunched.manager.size === 1 && relaunched.visuals.length === 1, `${targetName}: stop/start duplicated or lost hinge visuals.`);
  assert(relaunched.visuals[0].endpointAError < 1e-8 && relaunched.visuals[0].endpointBError < 1e-8, `${targetName}: relaunched hinge visual endpoints are stale.`);
  await screenshot(cdp, `${targetName}-03-relaunch-no-duplicates.png`);
  await returnToBuild('final cleanup');

  const relevantErrors = browserMessages.filter(entry => entry.level === 'error' && entry.target === targetName);
  assert(relevantErrors.length === 0, `${targetName}: browser console/runtime errors: ${JSON.stringify(relevantErrors)}`);
  return { target: targetName, focusResult, before, after, stopped, relaunched, consoleErrors: relevantErrors };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await prepareHermeticTargets();
  const serverPort = await freePort();
  const debugPort = await freePort();
  const serverLog = path.join(OUTPUT_DIR, 'server.log');
  const chromiumLog = path.join(OUTPUT_DIR, 'chromium.log');
  const chromiumProfile = path.join('/tmp', `vaw-recovery-chromium-${process.pid}`);
  const serverFd = await fs.open(serverLog, 'w');
  const chromiumFd = await fs.open(chromiumLog, 'w');
  let server = null;
  let chromium = null;
  let cdp = null;
  let restorePolicies = async () => {};
  const browserMessages = [];
  try {
    restorePolicies = await temporarilyRemoveUrlBlocklist();
    server = spawn('python', ['tools/serve.py', '--no-browser', '--port', String(serverPort)], {
      cwd: ROOT, detached: true, stdio: ['ignore', serverFd.fd, serverFd.fd]
    });
    await waitForUrl(`http://127.0.0.1:${serverPort}/index.html`);

    const chromiumBinary = process.env.CHROMIUM || '/usr/bin/chromium';
    chromium = spawn('xvfb-run', ['-a', chromiumBinary,
      '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
      '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--metrics-recording-only', '--mute-audio', '--remote-allow-origins=*',
      '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${chromiumProfile}`, 'about:blank'
    ], { cwd: ROOT, detached: true, stdio: ['ignore', chromiumFd.fd, chromiumFd.fd] });
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page');
    assert(page?.webSocketDebuggerUrl, 'Chromium did not expose a page target.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    let currentTarget = 'bootstrap';
    cdp.on('Runtime.consoleAPICalled', params => {
      const text = (params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ');
      browserMessages.push({ target: currentTarget, source: 'console', level: params.type === 'error' ? 'error' : params.type, text });
    });
    cdp.on('Runtime.exceptionThrown', params => browserMessages.push({ target: currentTarget, source: 'runtime', level: 'error', text: params.exceptionDetails?.text || 'uncaught exception', details: params.exceptionDetails }));
    cdp.on('Log.entryAdded', params => browserMessages.push({ target: currentTarget, source: params.entry?.source || 'log', level: params.entry?.level || 'info', text: params.entry?.text || '' }));

    const baseUrl = `http://127.0.0.1:${serverPort}`;
    currentTarget = 'source';
    const sourceResult = await runScenario(cdp, baseUrl, 'source', browserMessages);
    currentTarget = 'dist';
    const distResult = await runScenario(cdp, baseUrl, 'dist', browserMessages);
    const report = {
      status: 'pass',
      chromium: await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(),
      source: sourceResult,
      dist: distResult,
      browserMessages,
      generatedAt: new Date().toISOString()
    };
    await fs.writeFile(path.join(OUTPUT_DIR, 'browser-recovery-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(path.join(OUTPUT_DIR, 'browser-console.log'), browserMessages.map(entry => JSON.stringify(entry)).join('\n') + (browserMessages.length ? '\n' : ''));
    console.log('Browser recovery scenario passed for source and dist.');
    console.log(JSON.stringify({
      sourceSubBody: sourceResult.after.parts.find(part => part.blockId === 'recovery:sub-thruster'),
      distSubBody: distResult.after.parts.find(part => part.blockId === 'recovery:sub-thruster'),
      sourceVisuals: sourceResult.relaunched.visuals.length,
      distVisuals: distResult.relaunched.visuals.length,
      consoleErrors: browserMessages.filter(entry => entry.level === 'error').length
    }, null, 2));
  } catch (error) {
    const failure = { status: 'fail', error: error.stack || String(error), browserMessages, generatedAt: new Date().toISOString() };
    await fs.writeFile(path.join(OUTPUT_DIR, 'browser-recovery-report.json'), `${JSON.stringify(failure, null, 2)}\n`);
    throw error;
  } finally {
    cdp?.close();
    killGroup(chromium);
    killGroup(server);
    await new Promise(resolve => setTimeout(resolve, 500));
    await restorePolicies();
    await serverFd.close();
    await chromiumFd.close();
    await fs.rm(chromiumProfile, { recursive: true, force: true });
    await fs.rm(serverLog, { force: true });
    await fs.rm(chromiumLog, { force: true });
    for (const filename of TEMP_FILES) await fs.rm(filename, { force: true });
  }
}

await main();
