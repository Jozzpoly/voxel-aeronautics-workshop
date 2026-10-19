#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gltf', 'model/gltf+json'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png']
]);

function report(status, data = {}, exitCode = 0) {
  console.log(JSON.stringify({ status, ...data }, null, 2));
  process.exitCode = exitCode;
}

function excerpt(text, limit = 3000) {
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  return value.slice(value.length - limit);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(ROOT, relative);
  if (!candidate.startsWith(ROOT + path.sep) && candidate !== ROOT) return null;
  return candidate;
}

async function startStaticServer(port) {
  const server = createServer(async (request, response) => {
    try {
      const requestedPath = (request.url || '/').split('?')[0];
      if (requestedPath === '/favicon.ico') {
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
      const filename = safePath(request.url);
      if (!filename) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const data = await fs.readFile(filename);
      response.writeHead(200, {
        'Content-Type': MIME.get(path.extname(filename).toLowerCase()) || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      response.end(data);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : String(error?.message || error));
    }
  });
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

async function waitForUrl(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError || 'no response'}`);
}

async function executableExists(filename) {
  try {
    await fs.access(filename);
    return true;
  } catch (_) {
    return false;
  }
}

async function browserCandidates() {
  const explicit = ['VAW_BROWSER', 'CHROME', 'CHROMIUM', 'BROWSER']
    .map(name => process.env[name])
    .filter(Boolean);
  const candidates = [...explicit];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
    for (const root of programFiles) {
      candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    if (local) {
      candidates.push(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/microsoft-edge');
  }
  const unique = [...new Set(candidates)];
  for (const candidate of unique) {
    if (await executableExists(candidate)) return { executable: candidate, candidates: unique };
  }
  return { executable: null, candidates: unique };
}

function killBrowser(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch (_) {}
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
    if (typeof WebSocket !== 'function') throw new Error('Node WebSocket global is unavailable.');
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket open timed out.')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', event => { clearTimeout(timer); reject(new Error(`CDP WebSocket error: ${event.message || 'unknown'}`)); }, { once: true });
    });
    this.socket.addEventListener('message', async event => {
      const raw = typeof event.data === 'string'
        ? event.data
        : (event.data?.text ? await event.data.text() : Buffer.from(event.data || '').toString('utf8'));
      const message = JSON.parse(raw);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
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

  close() {
    try {
      this.socket?.close();
    } catch (_) {}
  }
}

async function evaluate(cdp, expression) {
  const response = await cdp.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  });
  if (response.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(response.exceptionDetails)}`);
  return response.result?.value;
}

async function waitFor(cdp, expression, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evaluate(cdp, expression);
    if (lastValue) return lastValue;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}`);
}

async function clickElement(cdp, selector) {
  const point = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      hit: hit === element || element.contains(hit),
      hitId: hit?.id || '',
      hitTag: hit?.tagName || '',
      hitClass: typeof hit?.className === 'string' ? hit.className : '',
      targetId: element.id || '',
      targetClass: typeof element.className === 'string' ? element.className : '',
      targetRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    };
  })()`);
  assert(point?.hit, `Physical click target ${selector} is obscured by ${JSON.stringify(point)}.`);
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function runSmoke(cdp, baseUrl, browserMessages, setStage) {
  setStage('app-bootstrap');
  await cdp.call('Page.navigate', { url: `${baseUrl}/index.html?m3_smoke=${Date.now()}` });
  await waitFor(cdp, `document.readyState === 'complete' && Boolean(window.VAW)`, 'application bootstrap');
  const terrainState = await evaluate(cdp, `(() => {
    const preset = window.__VAW_TERRAIN_PRESET__ || null;
    const TerrainAuthoring = window.VAW.require('foundation.terrain-authoring');
    const Config = window.VAW.require('foundation.config');
    const merged = TerrainAuthoring.mergeTestRangeTerrain(Config.TEST_RANGE, preset);
    return {
      presetFormat: preset?.format || null,
      presetMaterials: Object.keys(preset?.terrain?.materials || {}).length,
      mergedFogDensity: merged?.terrain?.fog?.density ?? null,
      mergedPatches: merged?.terrain?.patches?.length ?? null,
      mergedStrips: merged?.terrain?.strips?.length ?? null
    };
  })()`);
  assert(terrainState.presetFormat === 'VAW_TERRAIN_AUTHORING_V1', `Local terrain preset did not load: ${JSON.stringify(terrainState)}`);
  assert(terrainState.presetMaterials >= 1, `Local terrain preset has no materials: ${JSON.stringify(terrainState)}`);
  assert(terrainState.mergedPatches >= 1 && terrainState.mergedStrips >= 1, `Local terrain preset did not merge into TEST_RANGE: ${JSON.stringify(terrainState)}`);
  const helpVisible = await evaluate(cdp, `(() => {
    const modal = document.getElementById('help-modal');
    return Boolean(modal && getComputedStyle(modal).display !== 'none');
  })()`);
  if (helpVisible) {
    const intro = await evaluate(cdp, `(() => {
      const start = document.getElementById('start-engineering');
      const rect = start.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return { buttonVisible: y > 0 && y < innerHeight && document.elementFromPoint(x, y) === start,
        detailedGuideInitiallyCollapsed: !document.getElementById('workshop-guide-details').open };
    })()`);
    assert(intro.buttonVisible, 'Enter Workshop is not reachable without scrolling the onboarding modal.');
    assert(intro.detailedGuideInitiallyCollapsed, 'Full controls must not block first play by default.');
    await clickElement(cdp, '#start-engineering');
    await waitFor(cdp, `getComputedStyle(document.getElementById('help-modal')).display === 'none'`, 'help modal closed');
    assert(await evaluate(cdp, `localStorage.getItem('vaw:workshop-welcome-seen-v1') === '1'`),
      'Dismissed welcome guide must not block later Jaskinia game launches.');
  }
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '0'`, 'empty workshop');

  const panels = await evaluate(cdp, `(() => ({
    build: Boolean(document.getElementById('build-panel')),
    telemetry: Boolean(document.getElementById('telemetry-panel')),
    parts: Boolean(document.getElementById('parts-hotbar')),
    flightFocusButtons: document.querySelectorAll('[data-flight-focus-toggle]').length
  }))()`);
  assert(panels.build && panels.telemetry && panels.parts, 'Core UI panels are missing.');
  assert(panels.flightFocusButtons >= 2, 'Flight Focus path must expose controls and launcher buttons.');

  setStage('empty-workshop-manual-build');
  // Exercise the actual UI and pointer path. Older smokes skipped free build entirely
  // by loading a starter preset or injecting a Blueprint into the application.
  await clickElement(cdp, '#parts-hotbar-list [data-tool="Core"]');
  const coreButton = await evaluate(cdp, `document.querySelector('#parts-hotbar-list [data-tool="Core"]')?.classList.contains('active')`);
  assert(coreButton === true, 'Selecting Core in the parts hotbar did not activate the build tool.');

  let placementPoint = null;
  const canvasCandidates = [[720, 530], [730, 600], [800, 520], [660, 580], [800, 680]];
  for (const [x, y] of canvasCandidates) {
    await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    const probe = await evaluate(cdp, `(() => {
      const at = document.elementFromPoint(${x}, ${y});
      return { canvas: at?.tagName === 'CANVAS', preview: document.getElementById('ui-adj')?.textContent };
    })()`);
    if (probe?.canvas && /^OK x1$/.test(probe.preview || '')) {
      placementPoint = { x, y };
      break;
    }
  }
  assert(placementPoint, 'No unobscured, valid first-block canvas target in normal workshop viewport.');
  // Drag beyond the click slop and return to the original target. This used to
  // create a Core despite the player never performing a stationary click.
  setStage('left-drag-must-not-build');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: placementPoint.x + 30, y: placementPoint.y + 20, button: 'left', buttons: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint, button: 'left', buttons: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'left', clickCount: 1 });
  assert(await evaluate(cdp, `document.getElementById('ui-blocks')?.textContent === '0'`),
    'Left-drag in BUILD must not place a block even when the pointer returns to the start.');

  setStage('empty-workshop-manual-build');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'left', clickCount: 1 });
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '1'`, 'manual first-block placement');
  const firstBlock = await evaluate(cdp, `({
    undoEnabled: !document.getElementById('btn-undo').disabled,
    currentTool: document.querySelector('#parts-hotbar-list [data-tool="Core"].active')?.dataset.tool,
    count: document.getElementById('ui-blocks').textContent
  })`);
  assert(firstBlock.undoEnabled && firstBlock.currentTool === 'Core', 'Manual first block lacks undo or correct tool selection.');

  // Right-button movements must not delete a part, either. Confirm that
  // the same stationary right-click still deletes, then undo it.
  setStage('right-drag-must-not-delete');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'right', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: placementPoint.x + 30, y: placementPoint.y + 20, button: 'right', buttons: 2 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint, button: 'right', buttons: 2 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'right', clickCount: 1 });
  assert(await evaluate(cdp, `document.getElementById('ui-blocks')?.textContent === '1'`),
    'Right-drag in BUILD must not delete a block even when the pointer returns.');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'right', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'right', clickCount: 1 });
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '0'`, 'stationary right-click deletes normally');
  await clickElement(cdp, '#btn-undo');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '1'`, 'undo restores right-click removal');

  setStage('select-mode-does-not-place');
  await clickElement(cdp, '#parts-hotbar-list [data-tool="Select"]');
  const selectActive = await evaluate(cdp, `document.querySelector('#parts-hotbar-list [data-tool="Select"]')?.getAttribute('aria-pressed')`);
  assert(selectActive === 'true', 'Select / Inspect mode must activate visibly and accessibly.');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'left', clickCount: 1 });
  const selectResult = await evaluate(cdp, `({
    count: document.getElementById('ui-blocks')?.textContent,
    selected: document.getElementById('ui-selected-part-title')?.textContent,
    selectActive: document.querySelector('#parts-hotbar-list [data-tool="Select"]')?.classList.contains('active')
  })`);
  assert(selectResult.count === '1' && selectResult.selected?.startsWith('Core •') && selectResult.selectActive,
    `Ordinary click in Select mode must inspect without changing craft: ${JSON.stringify(selectResult)}`);
  setStage('selected-part-planar-drag');
  const dragBefore = await evaluate(cdp, `({
    title: document.getElementById('ui-selected-part-title')?.textContent,
    position: document.getElementById('ui-selected-part-meta')?.textContent
  })`);
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: placementPoint.x - 120, y: placementPoint.y, button: 'left', buttons: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: placementPoint.x - 120, y: placementPoint.y, button: 'left', clickCount: 1 });
  const dragAfter = await evaluate(cdp, `({
    title: document.getElementById('ui-selected-part-title')?.textContent,
    position: document.getElementById('ui-selected-part-meta')?.textContent,
    count: document.getElementById('ui-blocks')?.textContent
  })`);
  assert(dragAfter.title === dragBefore.title && dragAfter.position !== dragBefore.position && dragAfter.count === '1',
    `Select drag must move the same authored block, not build another: ${JSON.stringify({ dragBefore, dragAfter })}`);
  await clickElement(cdp, '#btn-undo');
  await waitFor(cdp, `document.getElementById('ui-selected-part-meta')?.textContent === ${JSON.stringify(dragBefore.position)}`, 'drag undo restores original block position');
  setStage('select-mode-new-blueprint-consistency');
  await clickElement(cdp, '#btn-clear');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '0'`, 'New Blueprint after Select');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint });
  const afterNew = await evaluate(cdp, `({
    hullVisible: document.querySelector('#parts-hotbar-list [data-tool="Hull"]')?.classList.contains('active'),
    hullPressed: document.querySelector('#parts-hotbar-list [data-tool="Hull"]')?.getAttribute('aria-pressed'),
    selectVisible: document.querySelector('#parts-hotbar-list [data-tool="Select"]')?.classList.contains('active'),
    selectPressed: document.querySelector('#parts-hotbar-list [data-tool="Select"]')?.getAttribute('aria-pressed'),
    placement: document.getElementById('ui-adj')?.textContent
  })`);
  assert(afterNew.hullVisible && afterNew.hullPressed === 'true' && !afterNew.selectVisible
    && afterNew.selectPressed === 'false' && /^OK x1$/.test(afterNew.placement || ''),
    `After New Blueprint, active tool display and real click intent diverge: ${JSON.stringify(afterNew)}`);
  await clickElement(cdp, '#parts-hotbar-list [data-tool="Core"]');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'left', clickCount: 1 });
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '1'`, 'build resumed after new blueprint');

  await clickElement(cdp, '#parts-hotbar-list [data-tool="Core"]');
  const buildResumed = await evaluate(cdp, `({
    selectActive: document.querySelector('#parts-hotbar-list [data-tool="Select"]')?.classList.contains('active'),
    coreActive: document.querySelector('#parts-hotbar-list [data-tool="Core"]')?.classList.contains('active')
  })`);
  assert(!buildResumed.selectActive && buildResumed.coreActive, 'Choosing a part must resume ordinary Build mode.');

  setStage('manual-selected-part-move');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...placementPoint });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...placementPoint, button: 'left', modifiers: 8, clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...placementPoint, button: 'left', modifiers: 8, clickCount: 1 });
  const originalSelection = await evaluate(cdp, `({
    name: document.getElementById('ui-selected-part-title')?.textContent,
    position: document.getElementById('ui-selected-part-meta')?.textContent,
    nudgeEnabled: !document.querySelector('[data-selected-nudge="1,0,0"]')?.disabled
  })`);
  assert(originalSelection.name?.startsWith('Core •') && originalSelection.nudgeEnabled,
    `Cannot select/nudge the originally built block: ${JSON.stringify(originalSelection)}`);
  await clickElement(cdp, '[data-selected-nudge="1,0,0"]');
  const movedSelection = await evaluate(cdp, `({
    name: document.getElementById('ui-selected-part-title')?.textContent,
    position: document.getElementById('ui-selected-part-meta')?.textContent,
    count: document.getElementById('ui-blocks')?.textContent
  })`);
  assert(movedSelection.name === originalSelection.name && movedSelection.position !== originalSelection.position
    && movedSelection.count === '1', `Selected-part move lost identity or failed: ${JSON.stringify({ originalSelection, movedSelection })}`);
  await clickElement(cdp, '#btn-undo');
  await waitFor(cdp, `document.getElementById('ui-selected-part-meta')?.textContent === ${JSON.stringify(originalSelection.position)}`, 'single-block move undo restored position');

  await clickElement(cdp, '#btn-undo');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '0'`, 'manual placement undo');
  await clickElement(cdp, '#btn-redo');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '1'`, 'manual placement redo');
  // From a genuinely placed Core, attach a second part through the visible
  // viewport. This was previously untested even when all CI was green.
  setStage('manual-second-part');
  await clickElement(cdp, '#parts-hotbar-list [data-tool="Hull"]');
  const offsets = [0, 16, -16, 32, -32, 48, -48, 64, -64, 80, -80, 104, -104];
  let secondPoint = null;
  const placementProbes = [];
  for (const dy of offsets) {
    if (secondPoint) break;
    for (const dx of offsets) {
      const x = placementPoint.x + dx, y = placementPoint.y + dy;
      if (x < 0 || y < 0 || x >= 1440 || y >= 1000) continue;
      await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      const probe = await evaluate(cdp, `(() => {
        const hit = document.elementFromPoint(${x}, ${y});
        return { canvas: hit?.tagName === 'CANVAS', feedback: document.getElementById('ui-adj')?.textContent };
      })()`);
      if (placementProbes.length < 20) placementProbes.push({ dx, dy, ...probe });
      if (probe?.canvas && /^OK x1$/.test(probe.feedback || '')) {
        secondPoint = { x, y };
        break;
      }
    }
  }
  assert(secondPoint, `Cannot find a legal second-block face in a normal visible workshop. Probes: ${JSON.stringify(placementProbes)}`);
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...secondPoint, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...secondPoint, button: 'left', clickCount: 1 });
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '2'`, 'manual adjacent second part');

  setStage('manual-part-selection');
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...secondPoint });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...secondPoint, button: 'left', clickCount: 1, modifiers: 8 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...secondPoint, button: 'left', clickCount: 1, modifiers: 8 });
  const selected = await evaluate(cdp, `({
    title: document.getElementById('ui-selected-part-title')?.textContent,
    clearEnabled: !document.getElementById('btn-clear-selected-part')?.disabled,
    count: document.getElementById('ui-blocks')?.textContent
  })`);
  assert(selected.clearEnabled && selected.title && !selected.title.startsWith('No part selected'),
    `Shift+click did not select the physically built part: ${JSON.stringify(selected)}`);
  assert(selected.count === '2', 'Shift+click part selection accidentally altered the craft.');
  await clickElement(cdp, '#btn-undo');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '1'`, 'manual second-part undo');
  await clickElement(cdp, '#btn-redo');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '2'`, 'manual second-part redo');

  setStage('frame-selected-part');
  const frameEnabled = await evaluate(cdp, `!document.getElementById('btn-frame-selected-part')?.disabled`);
  assert(frameEnabled, 'Selected part should expose an explicit framing action.');
  await clickElement(cdp, '#btn-frame-selected-part');

  // Fly this actual player-built two-part craft, not a generated preset.
  // A craft that cannot thrust is still a legitimate sandbox physics test.
  setStage('self-built-craft-sandbox');
  const contractsClosed = await evaluate(cdp, `document.getElementById('contract-panel')?.hidden`);
  if (contractsClosed) await clickElement(cdp, '[data-panel-toggle="contracts"]');
  await waitFor(cdp, `document.getElementById('contract-panel') && !document.getElementById('contract-panel').hidden`, 'contracts open to choose sandbox');
  await clickElement(cdp, '#contract-list .contract-card:first-child');
  await waitFor(cdp, `document.getElementById('btn-flight')?.textContent === 'Launch Sandbox Test'`, 'sandbox selected for custom craft');
  await clickElement(cdp, '#btn-flight');
  await waitFor(cdp, `document.getElementById('ui-mode')?.textContent === 'FLIGHT'`, 'custom craft physical test flight');
  const inFlight = await evaluate(cdp, `({
    mode: document.getElementById('ui-mode')?.textContent,
    count: document.getElementById('ui-blocks')?.textContent,
    returnEnabled: !document.getElementById('btn-build')?.disabled
  })`);
  assert(inFlight.returnEnabled, `Custom craft launched but return to workshop was disabled: ${JSON.stringify(inFlight)}`);
  await clickElement(cdp, '#btn-build');
  await waitFor(cdp, `document.getElementById('ui-mode')?.textContent === 'BUILD'`, 'custom craft return to workshop');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '2'`, 'custom blueprint persisted after simulated flight');

  // A simulated foreign tab changes the same-origin storage between saves.
  // This checks the real, rendered rescue picker and export path rather than
  // relying only on the controller's isolated storage fixture. The browser
  // profile is disposable and never uses the Owner's actual saved blueprints.
  setStage('rescue-export-browser');
  await clickElement(cdp, '#btn-save');
  const foreignSave = await evaluate(cdp, `(() => {
    const { SAVE_KEY } = window.VAW.require('foundation.config');
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const other = JSON.parse(raw);
    other.selectedBlock = other.selectedBlock === 'Wing' ? 'Core' : 'Wing';
    const encoded = JSON.stringify(other);
    localStorage.setItem(SAVE_KEY, encoded);
    return encoded;
  })()`);
  assert(foreignSave, 'Cannot establish simulated other-tab save in browser storage.');
  await clickElement(cdp, '#btn-save');
  await waitFor(cdp, `document.getElementById('rescue-controls')?.style.display === 'flex'`,
    'a stale save exposes local rescue controls');
  const rescue = await evaluate(cdp, `(() => {
    const { SAVE_KEY } = window.VAW.require('foundation.config');
    const primary = localStorage.getItem(SAVE_KEY);
    const selector = document.getElementById('rescue-copy-select');
    const copy = selector?.value ? localStorage.getItem(selector.value) : null;
    return {
      primary, rescueBlocks: copy ? JSON.parse(copy).blocks.length : -1,
      exportedKey: selector?.value || null,
      canExport: !document.getElementById('btn-export-rescue')?.disabled
    };
  })()`);
  assert(rescue.primary === foreignSave && rescue.exportedKey && rescue.rescueBlocks === 2 && rescue.canExport,
    `The other tab's craft was overwritten or the current craft cannot be rescued: ${JSON.stringify(rescue)}`);
  await clickElement(cdp, '#btn-export-rescue');
  assert(await evaluate(cdp, `localStorage.getItem(document.getElementById('rescue-copy-select').value) !== null`),
    'Export of a rescue copy should never delete that copy.');

  await clickElement(cdp, '#btn-clear');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '0'`, 'new blueprint clears manual probe');

  setStage('hit-test');
  const contractsHidden = await evaluate(cdp, `document.getElementById('contract-panel')?.hidden`);
  if (contractsHidden) await clickElement(cdp, '[data-panel-toggle="contracts"]');
  await waitFor(cdp, `document.getElementById('contract-panel') && !document.getElementById('contract-panel').hidden`, 'contract panel visible');
  await clickElement(cdp, '#btn-starter-craft');
  await waitFor(cdp, `document.getElementById('ui-blocks')?.textContent === '17'`, 'starter craft visible');
  await clickElement(cdp, '#btn-launcher-flight-focus');
  setStage('launch');
  await clickElement(cdp, '#btn-flight');
  await waitFor(cdp, `document.getElementById('ui-mode')?.textContent === 'FLIGHT'`, 'starter craft launch');

  const errors = browserMessages.filter(item => item.level === 'error');
  assert(errors.length === 0, `Browser console/runtime errors: ${JSON.stringify(errors)}`);
  return {
    starterBlocks: 17,
    manualBuild: { firstBlock: 'Core', dragSlopProtected: true, clickSelectMode: true, stableIdMove: true, secondBlock: 'Hull', selection: true, undo: true, redo: true, sandbox: true, returnToWorkshop: true, newBlueprint: true, rescueExport: true, frameSelectedPart: true, planarDrag: true },
    corePanels: panels,
    terrain: terrainState,
    flightMode: true,
    consoleErrors: errors.length
  };
}

async function main() {
  const serverPort = await freePort();
  const debugPort = await freePort();
  const profile = path.join(os.tmpdir(), `vaw-m3-browser-smoke-${process.pid}`);
  const browserLogPath = path.join(os.tmpdir(), `vaw-m3-browser-smoke-${process.pid}.log`);
  let stage = 'browser-discovery';
  let browserLog = '';
  const diagnostics = {
    browser: null,
    browserCandidates: [],
    browserLogPath,
    browserLogExcerpt: '',
    cdpTarget: null,
    debugPort,
    serverPort
  };
  let server = null;
  let browser = null;
  let cdp = null;

  function setStage(nextStage) {
    stage = nextStage;
  }

  async function snapshotDiagnostics() {
    diagnostics.browserLogExcerpt = excerpt(browserLog);
    try {
      await fs.writeFile(browserLogPath, browserLog || '(no browser output captured)\n', 'utf8');
    } catch (_) {}
    return diagnostics;
  }

  function captureBrowserOutput(label, stream) {
    stream?.on?.('data', chunk => {
      const line = `[${label}] ${chunk.toString('utf8')}`;
      browserLog += line;
      if (browserLog.length > 20000) browserLog = browserLog.slice(browserLog.length - 20000);
    });
  }

  try {
    setStage('browser-discovery');
    const browserProbe = await browserCandidates();
    diagnostics.browser = browserProbe.executable;
    diagnostics.browserCandidates = browserProbe.candidates;
    if (!browserProbe.executable) {
      report('ENVIRONMENT', {
        stage,
        reason: 'browser-not-found',
        diagnostics: await snapshotDiagnostics()
      }, 2);
      return;
    }

    setStage('server-start');
    server = await startStaticServer(serverPort);
    const baseUrl = `http://127.0.0.1:${serverPort}`;
    await waitForUrl(`${baseUrl}/index.html`);

    setStage('cdp-connect');
    browser = spawn(browserProbe.executable, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-allow-origins=*',
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      'about:blank'
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    captureBrowserOutput('stdout', browser.stdout);
    captureBrowserOutput('stderr', browser.stderr);

    let browserError = null;
    browser.on('error', error => {
      browserError = error;
    });
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 15000);
    if (browserError) throw browserError;
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) {
      diagnostics.cdpTarget = page || null;
      report('ENVIRONMENT', {
        stage,
        reason: 'cdp-page-target-missing',
        diagnostics: await snapshotDiagnostics()
      }, 2);
      return;
    }
    diagnostics.cdpTarget = {
      id: page.id || null,
      title: page.title || null,
      type: page.type || null,
      url: page.url || null
    };

    const browserMessages = [];
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    setStage('page-enable');
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    cdp.on('Runtime.consoleAPICalled', params => {
      const text = (params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ');
      browserMessages.push({ source: 'console', level: params.type === 'error' ? 'error' : params.type, text });
    });
    cdp.on('Runtime.exceptionThrown', params => browserMessages.push({ source: 'runtime', level: 'error', text: params.exceptionDetails?.text || 'uncaught exception' }));
    cdp.on('Log.entryAdded', params => browserMessages.push({ source: params.entry?.source || 'log', level: params.entry?.level || 'info', text: params.entry?.text || '' }));

    const result = await runSmoke(cdp, baseUrl, browserMessages, setStage);
    report('PASS', {
      stage: 'complete',
      baseUrl,
      diagnostics: await snapshotDiagnostics(),
      result
    });
  } catch (error) {
    const text = String(error?.message || error);
    const environmentPattern = /browser-not-found|chromium|chrome\.exe|msedge|cdp|websocket|Page\.enable timed out|Runtime\.enable timed out|Log\.enable timed out|ECONNREFUSED|Timed out waiting for http:\/\/127\.0\.0\.1/i;
    report(environmentPattern.test(text) ? 'ENVIRONMENT' : 'PRODUCT', {
      stage,
      reason: text,
      diagnostics: await snapshotDiagnostics(),
      stack: error?.stack || null
    }, environmentPattern.test(text) ? 2 : 1);
  } finally {
    cdp?.close();
    killBrowser(browser);
    await new Promise(resolve => server?.close(() => resolve()) || resolve());
    try {
      await fs.rm(profile, { recursive: true, force: true });
    } catch (_) {}
  }
}

main();
