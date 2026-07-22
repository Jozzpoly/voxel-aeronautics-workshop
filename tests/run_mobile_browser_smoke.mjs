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
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const SMOKE_TIMEOUT_MS = Math.max(30000, Number(process.env.VAW_MOBILE_SMOKE_TIMEOUT_MS) || 180000);
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gltf', 'model/gltf+json'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png']
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function report(status, data = {}, exitCode = 0) {
  console.log(JSON.stringify({ status, ...data }, null, 2));
  process.exitCode = exitCode;
}

function excerpt(text, limit = 3000) {
  const value = String(text || '').trim();
  return value.length <= limit ? value : value.slice(value.length - limit);
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

async function waitForUrl(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
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
    candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge');
  }
  const unique = [...new Set(candidates)];
  for (const candidate of unique) {
    if (await executableExists(candidate)) return { executable: candidate, candidates: unique };
  }
  return { executable: null, candidates: unique };
}

function withTimeout(promise, timeoutMs, describe) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${describe()} timed out after ${timeoutMs} ms.`)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

async function terminateBrowser(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  try { child.kill('SIGTERM'); } catch (_) {}
  await Promise.race([exited, sleep(3000)]);
  if (child.exitCode === null && !child.signalCode) {
    try { child.kill('SIGKILL'); } catch (_) {}
    await Promise.race([exited, sleep(3000)]);
  }
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
      this.socket.addEventListener('error', event => {
        clearTimeout(timer);
        reject(new Error(`CDP WebSocket error: ${event.message || 'unknown'}`));
      }, { once: true });
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
    try { this.socket?.close(); } catch (_) {}
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
    await sleep(100);
  }
  let flightControls = null;
  try {
    flightControls = await evaluate(cdp, `(() => {
      try { return window.VAW?.require?.('runtime.mobile-context')?.flightControls?.()?.snapshot?.() || null; }
      catch (_) { return null; }
    })()`);
  } catch (_) {}
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}; flight controls: ${JSON.stringify(flightControls)}`);
}

async function dispatchTouch(cdp, type, touchPoints) {
  await cdp.call('Input.dispatchTouchEvent', { type, touchPoints, modifiers: 0 });
}

function touchPoint(x, y, id) {
  return { x, y, id, radiusX: 4, radiusY: 4, force: 1 };
}

async function shellButtonPoint(cdp, label) {
  return await evaluate(cdp, `(() => {
    const root = document.getElementById('vaw-mobile-playable-shell');
    const button = [...(root?.querySelectorAll?.('button') || [])]
      .find(candidate => candidate.textContent.trim() === ${JSON.stringify(label)} && getComputedStyle(candidate).display !== 'none' && !candidate.disabled);
    if (!button) return null;
    button.scrollIntoView({ block: 'nearest', inline: 'center' });
    const rect = button.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    return hit && (hit === button || button.contains(hit)) ? { x, y } : null;
  })()`);
}

async function touchShellButton(cdp, label, pointerId) {
  const point = await shellButtonPoint(cdp, label);
  assert(point, `Mobile shell button ${label} is missing or not hit-testable.`);
  await dispatchTouch(cdp, 'touchStart', [touchPoint(point.x, point.y, pointerId)]);
  await dispatchTouch(cdp, 'touchEnd', []);
  await evaluate(cdp, 'true');
  return point;
}

async function flightControlGeometry(cdp, attribute, value) {
  return await evaluate(cdp, `(() => {
    const root = document.getElementById('vaw-mobile-flight-input');
    const selector = '[' + ${JSON.stringify(attribute)} + '=' + JSON.stringify(${JSON.stringify(value)}) + ']';
    const element = root?.querySelector?.(selector);
    if (!element || root.hidden || getComputedStyle(element).display === 'none') return null;
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== element && !element.contains(hit))) return null;
    return {
      x, y,
      left: rect.left, top: rect.top,
      width: rect.width, height: rect.height,
      radius: Math.min(rect.width, rect.height) / 2
    };
  })()`);
}

async function canvasTapCandidates(cdp) {
  return await evaluate(cdp, `(() => {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) return [];
    const rect = canvas.getBoundingClientRect();
    const points = [];
    for (let y = rect.top + 110; y < rect.bottom - 210; y += 32) {
      for (let x = rect.left + 36; x < rect.right - 36; x += 32) {
        if (document.elementFromPoint(x, y) === canvas) points.push({ x: Math.round(x), y: Math.round(y) });
      }
    }
    return points;
  })()`);
}

async function touchCanvasTap(cdp, point, pointerId) {
  await dispatchTouch(cdp, 'touchStart', [touchPoint(point.x, point.y, pointerId)]);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'TAP_CANDIDATE'`, 'canvas tap candidate', 3000);
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'IDLE'`, 'canvas tap release', 3000);
  return await evaluate(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot()`);
}

async function findCraftChangingTap(cdp, points, startingSize, direction, pointerIdStart) {
  let pointerId = pointerIdStart;
  for (const point of points) {
    const snapshot = await touchCanvasTap(cdp, point, pointerId++);
    const changed = direction === 'increase'
      ? snapshot.craftSize > startingSize
      : snapshot.craftSize < startingSize;
    if (changed) return { point, snapshot, nextPointerId: pointerId };
  }
  return null;
}

async function mobileState(cdp) {
  return await evaluate(cdp, `(() => {
    const context = window.VAW?.require?.('runtime.mobile-context');
    const binder = context?.cameraInputBinder?.();
    const runtime = binder?.currentRuntime?.();
    const camera = window.VAW?.require?.('game.camera-controller')?.current?.();
    const commandPort = window.VAW?.require?.('game.mobile-command-port');
    const playableShell = context?.playableShell?.();
    const flightControls = context?.flightControls?.();
    const canvas = document.querySelector('#canvas-container canvas');
    const blocker = document.getElementById('desktop-required');
    const playableRoot = document.getElementById('vaw-mobile-playable-shell');
    const flightRoot = document.getElementById('vaw-mobile-flight-input');
    const uiLayer = document.getElementById('ui-layer');
    return {
      presentation: document.documentElement.dataset.vawPresentation || null,
      touchCapability: document.documentElement.dataset.vawTouch || null,
      available: Boolean(context?.available),
      binderBound: Boolean(binder?.bound?.()),
      runtimeEnabled: Boolean(runtime?.enabled?.()),
      blockerHidden: Boolean(blocker?.hidden),
      blockerDisplay: blocker ? getComputedStyle(blocker).display : null,
      touchAction: canvas?.style?.touchAction || '',
      camera: camera?.snapshot?.() || null,
      gesture: runtime?.snapshot?.() || null,
      commandRegistered: Boolean(commandPort?.current?.()),
      playable: playableShell?.snapshot?.() || null,
      playableRootVisible: Boolean(playableRoot && !playableRoot.hidden && getComputedStyle(playableRoot).display !== 'none'),
      flightControls: flightControls?.snapshot?.() || null,
      flightRootVisible: Boolean(flightRoot && !flightRoot.hidden && getComputedStyle(flightRoot).display !== 'none'),
      desktopUiDisplay: uiLayer ? getComputedStyle(uiLayer).display : null,
      partButtonCount: playableRoot?.querySelectorAll?.('[data-part-id]')?.length || 0,
      trace: window.__VAW_MOBILE_SMOKE_TRACE__ || []
    };
  })()`);
}

async function findGesturePlan(cdp) {
  return await evaluate(cdp, `(() => {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const owns = point => document.elementFromPoint(point.x, point.y) === canvas;
    for (let y = rect.top + 80; y < rect.bottom - 50; y += 20) {
      for (let centerX = rect.left + 70; centerX < rect.right - 70; centerX += 20) {
        const orbitStart = { x: centerX - 36, y };
        const orbitEnd = { x: centerX, y };
        const pinchStart = [{ x: centerX - 30, y }, { x: centerX + 30, y }];
        const pinchEnd = [{ x: centerX - 50, y }, { x: centerX + 50, y }];
        const points = [orbitStart, orbitEnd, ...pinchStart, ...pinchEnd];
        if (points.every(owns)) {
          return {
            orbitStart: { x: Math.round(orbitStart.x), y: Math.round(orbitStart.y) },
            orbitEnd: { x: Math.round(orbitEnd.x), y: Math.round(orbitEnd.y) },
            pinchStart: pinchStart.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) })),
            pinchEnd: pinchEnd.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) }))
          };
        }
      }
    }
    return null;
  })()`);
}

async function installTrace(cdp) {
  await evaluate(cdp, `(() => {
    window.__VAW_MOBILE_SMOKE_TRACE__ = [];
    const record = event => {
      let flightControls = null;
      try { flightControls = window.VAW?.require?.('runtime.mobile-context')?.flightControls?.()?.snapshot?.() || null; }
      catch (_) {}
      window.__VAW_MOBILE_SMOKE_TRACE__.push({
        type: event.type,
        pointerType: event.pointerType || null,
        pointerId: event.pointerId ?? null,
        clientX: event.clientX ?? null,
        clientY: event.clientY ?? null,
        target: event.target?.id || event.target?.dataset?.control || event.target?.dataset?.action || event.target?.tagName || null,
        touches: event.touches?.length ?? null,
        activeActions: flightControls?.activeActions || [],
        leftPointerId: flightControls?.leftPointerId ?? null,
        rightPointerId: flightControls?.rightPointerId ?? null
      });
    };
    for (const type of ['touchstart','touchmove','touchend','touchcancel','pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture']) {
      document.addEventListener(type, record, true);
    }
    return true;
  })()`);
}

async function runSmoke(cdp, baseUrl, browserMessages, setStage) {
  setStage('mobile-emulation');
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  setStage('app-bootstrap');
  await cdp.call('Page.navigate', { url: `${baseUrl}/index.html?mobile_touch_smoke=${Date.now()}` });
  await waitFor(cdp, `document.readyState === 'complete' && Boolean(window.VAW)`, 'application bootstrap');
  await waitFor(cdp, `Boolean(window.VAW.require('game.camera-controller').current())`, 'camera controller creation');
  await waitFor(cdp, `Boolean(window.VAW.require('runtime.mobile-context').cameraInputBinder()?.bound?.())`, 'mobile camera autobind');
  await evaluate(cdp, `(() => {
    const start = document.getElementById('start-engineering');
    const help = document.getElementById('help-modal');
    if (start && help && getComputedStyle(help).display !== 'none') start.click();
    return true;
  })()`);
  await installTrace(cdp);

  const initial = await mobileState(cdp);
  assert(initial.presentation === 'mobile', `Automatic mobile presentation failed: ${JSON.stringify(initial)}`);
  assert(initial.touchCapability === 'capable', `Touch capability was not detected: ${JSON.stringify(initial)}`);
  assert(initial.available, `Mobile runtime context is unavailable: ${JSON.stringify(initial)}`);
  assert(initial.binderBound && initial.runtimeEnabled, `Mobile camera runtime is not active: ${JSON.stringify(initial)}`);
  assert(initial.blockerHidden && initial.blockerDisplay === 'none', `Desktop blocker remained visible: ${JSON.stringify(initial)}`);
  assert(initial.touchAction === 'none', `Canvas touch-action was not scoped for gestures: ${JSON.stringify(initial)}`);
  assert(initial.camera && initial.gesture?.mode === 'IDLE', `Initial camera/gesture diagnostics are invalid: ${JSON.stringify(initial)}`);
  await waitFor(cdp, `(() => {
    const context = window.VAW.require('runtime.mobile-context');
    const shell = context.playableShell?.();
    const port = window.VAW.require('game.mobile-command-port');
    return shell?.snapshot?.().ready && port.current?.() ? true : false;
  })()`, 'mobile playable shell and command port');

  setStage('playable-build-loop');
  let pointerId = 20;
  const playableInitial = await mobileState(cdp);
  assert(playableInitial.commandRegistered, `Mobile command port is not registered: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.playable?.active && playableInitial.playable?.ready, `Playable shell is not active: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.playableRootVisible, `Playable shell root is not visible: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.desktopUiDisplay === 'none', `Desktop workspace was not replaced by the dedicated mobile shell: ${JSON.stringify(playableInitial)}`);
  assert(playableInitial.partButtonCount >= 2, `Part carousel is incomplete: ${JSON.stringify(playableInitial)}`);

  await touchShellButton(cdp, 'Wing', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().selectedPart === 'Wing'`, 'Wing selection through mobile carousel');
  const canvasPoints = await canvasTapCandidates(cdp);
  assert(canvasPoints.length > 0, 'No hit-testable canvas points are available between the mobile bars.');
  const wingStart = await evaluate(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot()`);
  const wingPlacement = await findCraftChangingTap(cdp, canvasPoints, wingStart.craftSize, 'increase', pointerId);
  assert(wingPlacement, `No real canvas tap placed the selected Wing from ${canvasPoints.length} candidates.`);
  pointerId = wingPlacement.nextPointerId;
  assert(wingPlacement.snapshot.selectedPart === 'Wing', `Placed part selection changed unexpectedly: ${JSON.stringify(wingPlacement)}`);

  await touchShellButton(cdp, 'REMOVE', pointerId++);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().snapshot().interactionMode === 'remove'`, 'explicit remove mode');
  const removalPoints = [
    wingPlacement.point,
    { x: wingPlacement.point.x - 10, y: wingPlacement.point.y },
    { x: wingPlacement.point.x + 10, y: wingPlacement.point.y },
    { x: wingPlacement.point.x, y: wingPlacement.point.y - 10 },
    { x: wingPlacement.point.x, y: wingPlacement.point.y + 10 }
  ];
  const removal = await findCraftChangingTap(cdp, removalPoints, wingPlacement.snapshot.craftSize, 'decrease', pointerId);
  assert(removal, `Explicit REMOVE mode did not remove the touch-placed Wing: ${JSON.stringify({ wingPlacement, removalPoints })}`);
  pointerId = removal.nextPointerId;

  await touchShellButton(cdp, 'PLACE', pointerId++);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().snapshot().interactionMode === 'place'`, 'explicit place mode');
  await touchShellButton(cdp, 'Core', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().selectedPart === 'Core'`, 'Core selection through mobile carousel');
  const coreStart = await evaluate(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot()`);
  const corePlacement = await findCraftChangingTap(cdp, canvasPoints, coreStart.craftSize, 'increase', pointerId);
  assert(corePlacement, 'No real canvas tap placed the Core required for launch.');
  pointerId = corePlacement.nextPointerId;

  await touchShellButton(cdp, 'LAUNCH', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().mode === 'FLIGHT'`, 'mobile launch command');
  const flightShell = await mobileState(cdp);
  assert(flightShell.playable?.session?.mode === 'FLIGHT', `Playable shell did not enter FLIGHT: ${JSON.stringify(flightShell)}`);
  assert(!flightShell.playable?.interactionMode || flightShell.playable.session.mode === 'FLIGHT', `Invalid flight shell state: ${JSON.stringify(flightShell)}`);

  setStage('playable-flight-controls');
  await waitFor(cdp, `(() => {
    const controls = window.VAW.require('runtime.mobile-context').flightControls?.();
    const root = document.getElementById('vaw-mobile-flight-input');
    return controls?.snapshot?.().active && root && !root.hidden ? true : false;
  })()`, 'mobile flight controls activation');

  const leftStick = await flightControlGeometry(cdp, 'data-control', 'left-stick');
  const rightStick = await flightControlGeometry(cdp, 'data-control', 'right-stick');
  assert(leftStick && rightStick, `Flight sticks are not visible and hit-testable: ${JSON.stringify({ leftStick, rightStick })}`);
  const leftId = pointerId++;
  const rightId = pointerId++;
  const leftStart = touchPoint(leftStick.x, leftStick.y, leftId);
  const rightStart = touchPoint(rightStick.x, rightStick.y, rightId);
  await dispatchTouch(cdp, 'touchStart', [leftStart, rightStart]);
  const ownedPointers = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.leftPointerId !== null && snapshot.rightPointerId !== null ? snapshot : null;
  })()`, 'dual flight-stick pointer ownership');

  const leftDelta = leftStick.radius * 0.72;
  const rightDelta = rightStick.radius * 0.72;
  const leftPositive = touchPoint(leftStick.x + leftDelta, leftStick.y - leftDelta, leftId);
  const rightPositive = touchPoint(rightStick.x - rightDelta, rightStick.y - rightDelta, rightId);
  await dispatchTouch(cdp, 'touchMove', [leftPositive, rightPositive]);
  const positiveAxisEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.activeActions.join(',') === 'pitch+,surge+,sway+,yaw+' ? snapshot : null;
  })()`, 'positive dual-stick named flight actions');

  const leftCenterPoint = touchPoint(leftStick.x, leftStick.y, leftId);
  const rightCenterPoint = touchPoint(rightStick.x, rightStick.y, rightId);
  await dispatchTouch(cdp, 'touchMove', [leftCenterPoint, rightCenterPoint]);
  const neutralCrossingEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.activeActions.length === 0 ? snapshot : null;
  })()`, 'dual-stick neutral crossing');

  const leftNegative = touchPoint(leftStick.x - leftDelta, leftStick.y + leftDelta, leftId);
  const rightNegative = touchPoint(rightStick.x + rightDelta, rightStick.y + rightDelta, rightId);
  await dispatchTouch(cdp, 'touchMove', [leftNegative, rightNegative]);
  const negativeAxisEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.activeActions.join(',') === 'pitch-,surge-,sway-,yaw-' ? snapshot : null;
  })()`, 'negative dual-stick axes after neutral crossing');

  // CDP cannot express a partial touchEnd because touchEnd must carry an empty
  // touch-point list. Inject a browser PointerEvent for the one-thumb release
  // while retaining CDP for native multi-touch start, movement and final release.
  const partialRelease = await evaluate(cdp, `(() => {
    const controls = window.VAW.require('runtime.mobile-context').flightControls();
    const snapshot = controls.snapshot();
    const left = document.querySelector('#vaw-mobile-flight-input [data-control="left-stick"]');
    const pointerId = snapshot.leftPointerId;
    if (!left || pointerId === null) return { dispatched: false, pointerId };
    const event = new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId,
      pointerType: 'touch',
      clientX: ${JSON.stringify(leftNegative.x)},
      clientY: ${JSON.stringify(leftNegative.y)},
      buttons: 0,
      pressure: 0
    });
    left.dispatchEvent(event);
    return { dispatched: true, pointerId, defaultPrevented: event.defaultPrevented };
  })()`);
  assert(partialRelease?.dispatched, `Left-stick pointerup lifecycle event was not dispatched: ${JSON.stringify({ partialRelease, ownedPointers })}`);
  const partialReleaseEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.leftPointerId === null && snapshot.rightPointerId !== null && snapshot.activeActions.join(',') === 'pitch-,yaw-'
      ? snapshot : null;
  })()`, 'independent left-stick pointerup lifecycle');
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length === 0`, 'remaining stick neutral release');

  const liftButton = await flightControlGeometry(cdp, 'data-action', 'heave+');
  const rollLeftButton = await flightControlGeometry(cdp, 'data-action', 'roll-');
  assert(liftButton && rollLeftButton, `Lift/roll controls are not visible and hit-testable: ${JSON.stringify({ liftButton, rollLeftButton })}`);
  await dispatchTouch(cdp, 'touchStart', [
    touchPoint(liftButton.x, liftButton.y, pointerId++),
    touchPoint(rollLeftButton.x, rollLeftButton.y, pointerId++)
  ]);
  const positiveHoldEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.activeActions.join(',') === 'heave+,roll-' ? snapshot : null;
  })()`, 'simultaneous lift and roll-left actions');
  await dispatchTouch(cdp, 'touchCancel', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length === 0`, 'hold pointer cancellation');

  const descendButton = await flightControlGeometry(cdp, 'data-action', 'heave-');
  const rollRightButton = await flightControlGeometry(cdp, 'data-action', 'roll+');
  assert(descendButton && rollRightButton, `Descend/roll-right controls are not visible and hit-testable: ${JSON.stringify({ descendButton, rollRightButton })}`);
  await dispatchTouch(cdp, 'touchStart', [
    touchPoint(descendButton.x, descendButton.y, pointerId++),
    touchPoint(rollRightButton.x, rollRightButton.y, pointerId++)
  ]);
  const negativeHoldEvidence = await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return snapshot.activeActions.join(',') === 'heave-,roll+' ? snapshot : null;
  })()`, 'simultaneous descend and roll-right actions');
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length === 0`, 'negative hold neutral release');

  const orientationPointerId = pointerId++;
  await dispatchTouch(cdp, 'touchStart', [touchPoint(leftStick.x + leftDelta, leftStick.y - leftDelta, orientationPointerId)]);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length > 0`, 'orientation safety input');
  await evaluate(cdp, `window.dispatchEvent(new Event('orientationchange'))`);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').flightControls().snapshot().activeActions.length === 0`, 'orientation-change neutralization');
  await dispatchTouch(cdp, 'touchCancel', []);

  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 844, height: 390, screenWidth: 844, screenHeight: 390,
    deviceScaleFactor: 2, mobile: true
  });
  await waitFor(cdp, `document.documentElement.dataset.vawPresentation === 'mobile' && window.VAW.require('runtime.mobile-context').flightControls().snapshot().active`, 'landscape mobile controls');
  const landscapeLeft = await flightControlGeometry(cdp, 'data-control', 'left-stick');
  const landscapeRight = await flightControlGeometry(cdp, 'data-control', 'right-stick');
  assert(landscapeLeft && landscapeRight, `Flight controls became inaccessible in landscape: ${JSON.stringify({ landscapeLeft, landscapeRight })}`);
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, screenWidth: 390, screenHeight: 844,
    deviceScaleFactor: 2, mobile: true
  });
  await waitFor(cdp, `window.innerWidth <= 390 && window.VAW.require('runtime.mobile-context').flightControls().snapshot().active`, 'portrait mobile controls restore');

  await touchShellButton(cdp, 'RETURN TO WORKSHOP', pointerId++);
  await waitFor(cdp, `window.VAW.require('game.mobile-command-port').session.snapshot().mode === 'BUILD'`, 'return to workshop command');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').playableShell().tapEnabled() === true`, 'build tap reactivation after return');
  await waitFor(cdp, `(() => {
    const snapshot = window.VAW.require('runtime.mobile-context').flightControls().snapshot();
    return !snapshot.active && snapshot.activeActions.length === 0 ? true : false;
  })()`, 'flight controls deactivation after workshop return');

  const plan = await findGesturePlan(cdp);
  assert(plan, 'No unobscured canvas region supported the complete orbit and pinch gesture plan.');

  setStage('one-finger-orbit');
  const yawBefore = initial.camera.yaw;
  await dispatchTouch(cdp, 'touchStart', [touchPoint(plan.orbitStart.x, plan.orbitStart.y, 1)]);
  const afterOrbitStart = await waitFor(cdp, `(() => {
    const value = window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot();
    return value.mode === 'TAP_CANDIDATE' ? value : null;
  })()`, 'one-finger tap candidate');
  assert(afterOrbitStart.activeCanvasPointerCount === 1, `One-finger ownership is invalid: ${JSON.stringify(afterOrbitStart)}`);

  await dispatchTouch(cdp, 'touchMove', [touchPoint(plan.orbitEnd.x, plan.orbitEnd.y, 1)]);
  const orbitState = await waitFor(cdp, `(() => {
    const camera = window.VAW.require('game.camera-controller').current().snapshot();
    const gesture = window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot();
    return gesture.mode === 'ORBIT' && Math.abs(camera.yaw - ${JSON.stringify(yawBefore)}) > 0.05
      ? { camera, gesture }
      : null;
  })()`, 'one-finger camera orbit');
  assert(orbitState.camera.yaw < yawBefore, `Orbit direction is incorrect: ${JSON.stringify({ yawBefore, orbitState })}`);

  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'IDLE'`, 'one-finger gesture release');

  setStage('two-finger-pinch');
  const distanceBefore = orbitState.camera.distance;
  await dispatchTouch(cdp, 'touchStart', [
    touchPoint(plan.pinchStart[0].x, plan.pinchStart[0].y, 1),
    touchPoint(plan.pinchStart[1].x, plan.pinchStart[1].y, 2)
  ]);
  const afterPinchStart = await waitFor(cdp, `(() => {
    const value = window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot();
    return value.mode === 'MULTI' && value.activeCanvasPointerCount === 2 ? value : null;
  })()`, 'two-finger multi gesture');
  assert(afterPinchStart.multiGestureLatched, `Multi gesture was not latched: ${JSON.stringify(afterPinchStart)}`);

  await dispatchTouch(cdp, 'touchMove', [
    touchPoint(plan.pinchEnd[0].x, plan.pinchEnd[0].y, 1),
    touchPoint(plan.pinchEnd[1].x, plan.pinchEnd[1].y, 2)
  ]);
  const pinchState = await waitFor(cdp, `(() => {
    const camera = window.VAW.require('game.camera-controller').current().snapshot();
    const gesture = window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot();
    return gesture.mode === 'MULTI' && Math.abs(camera.distance - ${JSON.stringify(distanceBefore)}) > 0.2
      ? { camera, gesture }
      : null;
  })()`, 'two-finger pinch zoom');
  assert(pinchState.camera.distance < distanceBefore, `Pinch-out should reduce camera distance: ${JSON.stringify({ distanceBefore, pinchState })}`);

  await dispatchTouch(cdp, 'touchEnd', []);
  const finalState = await waitFor(cdp, `(() => {
    const context = window.VAW.require('runtime.mobile-context');
    const gesture = context.cameraInputBinder().currentRuntime().snapshot();
    return gesture.mode === 'IDLE' ? true : false;
  })()`, 'two-finger gesture release');
  assert(finalState, 'Final gesture state did not return to IDLE.');

  const finalDiagnostics = await mobileState(cdp);
  const pageErrors = browserMessages.filter(item => item.level === 'error');
  assert(pageErrors.length === 0, `Browser console/runtime errors: ${JSON.stringify(pageErrors)}`);
  assert(finalDiagnostics.trace.some(event => event.type === 'pointerdown' && event.pointerType === 'touch'), `Native pointerdown was not observed: ${JSON.stringify(finalDiagnostics.trace)}`);
  assert(finalDiagnostics.trace.some(event => event.type === 'pointermove' && event.pointerType === 'touch'), `Native pointermove was not observed: ${JSON.stringify(finalDiagnostics.trace)}`);
  assert(finalDiagnostics.trace.some(event => event.type === 'pointerup' && event.pointerType === 'touch'), `Native pointerup was not observed: ${JSON.stringify(finalDiagnostics.trace)}`);

  return {
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    gesturePlan: plan,
    yawBefore,
    yawAfter: orbitState.camera.yaw,
    distanceBefore,
    distanceAfter: pinchState.camera.distance,
    nativeEventCount: finalDiagnostics.trace.length,
    presentation: finalDiagnostics.presentation,
    touchAction: finalDiagnostics.touchAction,
    playable: {
      selectedWing: true,
      placedWing: wingPlacement.snapshot.craftSize,
      removedWing: removal.snapshot.craftSize,
      launchedCore: corePlacement.snapshot.craftSize,
      returnedToWorkshop: finalDiagnostics.playable?.session?.mode === 'BUILD'
    },
    flightControls: {
      positiveAxisActions: positiveAxisEvidence.activeActions,
      neutralCrossingActions: neutralCrossingEvidence.activeActions,
      negativeAxisActions: negativeAxisEvidence.activeActions,
      partialReleaseActions: partialReleaseEvidence.activeActions,
      positiveHoldActions: positiveHoldEvidence.activeActions,
      negativeHoldActions: negativeHoldEvidence.activeActions,
      neutralAfterRelease: finalDiagnostics.flightControls?.activeActions?.length === 0,
      inactiveAfterReturn: finalDiagnostics.flightControls?.active === false,
      landscapeHitTestable: Boolean(landscapeLeft && landscapeRight)
    },
    consoleErrors: pageErrors.length
  };
}

async function main() {
  const serverPort = await freePort();
  const debugPort = await freePort();
  const profile = path.join(os.tmpdir(), `vaw-mobile-browser-smoke-${process.pid}`);
  const browserLogPath = path.join(os.tmpdir(), `vaw-mobile-browser-smoke-${process.pid}.log`);
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
  const browserMessages = [];

  function setStage(nextStage) {
    stage = nextStage;
  }

  async function snapshotDiagnostics() {
    diagnostics.browserLogExcerpt = excerpt(browserLog);
    try { await fs.writeFile(browserLogPath, browserLog || '(no browser output captured)\n', 'utf8'); } catch (_) {}
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
    const browserProbe = await browserCandidates();
    diagnostics.browser = browserProbe.executable;
    diagnostics.browserCandidates = browserProbe.candidates;
    if (!browserProbe.executable) {
      report('ENVIRONMENT', { stage, reason: 'browser-not-found', diagnostics: await snapshotDiagnostics() }, 2);
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
    browser.on('error', error => { browserError = error; });
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 20000);
    if (browserError) throw browserError;
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) {
      diagnostics.cdpTarget = page || null;
      report('ENVIRONMENT', { stage, reason: 'cdp-page-target-missing', diagnostics: await snapshotDiagnostics() }, 2);
      return;
    }
    diagnostics.cdpTarget = { id: page.id || null, title: page.title || null, type: page.type || null, url: page.url || null };

    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    cdp.on('Runtime.consoleAPICalled', params => {
      const text = (params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ');
      browserMessages.push({ source: 'console', level: params.type === 'error' ? 'error' : params.type, text });
    });
    cdp.on('Runtime.exceptionThrown', params => browserMessages.push({ source: 'runtime', level: 'error', text: params.exceptionDetails?.text || 'uncaught exception' }));
    cdp.on('Log.entryAdded', params => {
      const entry = params.entry || {};
      if (entry.source === 'javascript' || entry.source === 'network') {
        browserMessages.push({ source: entry.source, level: entry.level || 'info', text: entry.text || '' });
      }
    });

    const result = await withTimeout(
      runSmoke(cdp, baseUrl, browserMessages, setStage),
      SMOKE_TIMEOUT_MS,
      () => `Mobile browser smoke at stage ${stage}`
    );
    report('PASS', { stage: 'complete', baseUrl, diagnostics: await snapshotDiagnostics(), result });
  } catch (error) {
    diagnostics.browserMessages = browserMessages;
    if (cdp) {
      try {
        diagnostics.pageState = await evaluate(cdp, `(() => ({
          href: location.href,
          readyState: document.readyState,
          title: document.title,
          hasVAW: Boolean(window.VAW),
          fatalText: document.getElementById('fatal-error')?.textContent?.trim?.() || '',
          bodyExcerpt: document.body?.innerText?.slice?.(0, 1200) || ''
        }))()`);
      } catch (diagnosticError) {
        diagnostics.pageStateError = String(diagnosticError?.message || diagnosticError);
      }
    }
    const text = String(error?.message || error);
    const environmentEvidence = `${text}
${JSON.stringify(diagnostics.pageState || {})}`;
    const environmentPattern = /browser-not-found|chromium|chrome\.exe|msedge|cdp|websocket|ECONNREFUSED|Timed out waiting for http:\/\/127\.0\.0\.1|ERR_BLOCKED_BY_ADMINISTRATOR|chrome-error:\/\/|organization doesn.t allow|127\.0\.0\.1 is blocked/i;
    const isEnvironment = environmentPattern.test(environmentEvidence);
    report(isEnvironment ? 'ENVIRONMENT' : 'PRODUCT', {
      stage,
      reason: text,
      diagnostics: await snapshotDiagnostics(),
      stack: error?.stack || null
    }, isEnvironment ? 2 : 1);
  } finally {
    cdp?.close();
    await terminateBrowser(browser);
    if (server) {
      try { server.closeAllConnections?.(); } catch (_) {}
      await new Promise(resolve => server.close(() => resolve()));
    }
    try { await fs.rm(profile, { recursive: true, force: true }); } catch (_) {}
  }
}

main();
