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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge');
  }
  const unique = [...new Set(candidates)];
  for (const candidate of unique) {
    if (await executableExists(candidate)) return { executable: candidate, candidates: unique };
  }
  return { executable: null, candidates: unique };
}

function killBrowser(child) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch (_) {}
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
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}`);
}

async function touch(cdp, type, touchPoints) {
  await cdp.call('Input.dispatchTouchEvent', {
    type,
    touchPoints,
    modifiers: 0
  });
}

function touchPoint(x, y, id) {
  return { x, y, id, radiusX: 4, radiusY: 4, force: 1 };
}

async function findFreeCanvasPoint(cdp) {
  return await evaluate(cdp, `(() => {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const candidates = [center];
    for (let y = rect.top + 80; y < rect.bottom - 40; y += 40) {
      for (let x = rect.left + 20; x < rect.right - 20; x += 30) candidates.push({ x, y });
    }
    for (const point of candidates) {
      const hit = document.elementFromPoint(point.x, point.y);
      if (hit === canvas) return { x: Math.round(point.x), y: Math.round(point.y) };
    }
    return null;
  })()`);
}

async function mobileState(cdp) {
  return await evaluate(cdp, `(() => {
    const mobileContext = window.VAW?.require?.('runtime.mobile-context');
    const cameraModule = window.VAW?.require?.('game.camera-controller');
    const controller = cameraModule?.current?.();
    const binder = mobileContext?.cameraInputBinder?.();
    const canvas = document.querySelector('#canvas-container canvas');
    const blocker = document.getElementById('desktop-required');
    return {
      presentation: document.documentElement.dataset.vawPresentation || null,
      touchCapability: document.documentElement.dataset.vawTouch || null,
      available: Boolean(mobileContext?.available),
      binderBound: Boolean(binder?.bound?.()),
      blockerHidden: Boolean(blocker?.hidden),
      blockerDisplay: blocker ? getComputedStyle(blocker).display : null,
      touchAction: canvas?.style?.touchAction || '',
      camera: controller?.snapshot?.() || null,
      gesture: binder?.currentRuntime?.()?.snapshot?.() || null,
      helpDisplay: document.getElementById('help-modal') ? getComputedStyle(document.getElementById('help-modal')).display : null
    };
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
    if (start && getComputedStyle(document.getElementById('help-modal')).display !== 'none') start.click();
    return true;
  })()`);

  const initial = await mobileState(cdp);
  assert(initial.presentation === 'mobile', `Automatic mobile presentation failed: ${JSON.stringify(initial)}`);
  assert(initial.touchCapability === 'capable', `Touch capability was not detected: ${JSON.stringify(initial)}`);
  assert(initial.available, `Mobile runtime context is unavailable: ${JSON.stringify(initial)}`);
  assert(initial.binderBound, `Mobile camera runtime did not bind: ${JSON.stringify(initial)}`);
  assert(initial.blockerHidden && initial.blockerDisplay === 'none', `Desktop blocker remained visible: ${JSON.stringify(initial)}`);
  assert(initial.touchAction === 'none', `Canvas touch-action was not scoped for gestures: ${JSON.stringify(initial)}`);
  assert(initial.camera && Number.isFinite(initial.camera.yaw) && Number.isFinite(initial.camera.distance), `Camera diagnostics unavailable: ${JSON.stringify(initial)}`);

  const point = await findFreeCanvasPoint(cdp);
  assert(point, 'No unobscured canvas point was available for mobile touch input.');

  setStage('one-finger-orbit');
  const yawBefore = initial.camera.yaw;
  await touch(cdp, 'touchStart', [touchPoint(point.x, point.y, 1)]);
  await touch(cdp, 'touchMove', [touchPoint(point.x + 36, point.y, 1)]);
  await touch(cdp, 'touchEnd', []);
  const orbitState = await waitFor(cdp, `(() => {
    const value = window.VAW.require('game.camera-controller').current().snapshot();
    return Math.abs(value.yaw - ${JSON.stringify(yawBefore)}) > 0.05 ? value : null;
  })()`, 'one-finger camera orbit');
  assert(orbitState.yaw < yawBefore, `Orbit direction is incorrect: ${JSON.stringify({ yawBefore, orbitState })}`);

  setStage('two-finger-pinch');
  const distanceBefore = orbitState.distance;
  const y = Math.min(804, Math.max(100, point.y));
  const leftStart = Math.max(30, point.x - 30);
  const rightStart = Math.min(360, point.x + 30);
  const leftEnd = Math.max(10, leftStart - 20);
  const rightEnd = Math.min(380, rightStart + 20);
  await touch(cdp, 'touchStart', [touchPoint(leftStart, y, 1), touchPoint(rightStart, y, 2)]);
  await touch(cdp, 'touchMove', [touchPoint(leftEnd, y, 1), touchPoint(rightEnd, y, 2)]);
  await touch(cdp, 'touchEnd', []);
  const pinchState = await waitFor(cdp, `(() => {
    const value = window.VAW.require('game.camera-controller').current().snapshot();
    return Math.abs(value.distance - ${JSON.stringify(distanceBefore)}) > 0.2 ? value : null;
  })()`, 'two-finger pinch zoom');
  assert(pinchState.distance < distanceBefore, `Pinch-out should reduce camera distance: ${JSON.stringify({ distanceBefore, pinchState })}`);

  const finalState = await mobileState(cdp);
  assert(finalState.gesture?.mode === 'IDLE', `Gesture state remained active after pointer release: ${JSON.stringify(finalState.gesture)}`);
  const errors = browserMessages.filter(item => item.level === 'error');
  assert(errors.length === 0, `Browser console/runtime errors: ${JSON.stringify(errors)}`);

  return {
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    canvasPoint: point,
    yawBefore,
    yawAfter: orbitState.yaw,
    distanceBefore,
    distanceAfter: pinchState.distance,
    presentation: finalState.presentation,
    touchAction: finalState.touchAction,
    consoleErrors: errors.length
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
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 15000);
    if (browserError) throw browserError;
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) {
      diagnostics.cdpTarget = page || null;
      report('ENVIRONMENT', { stage, reason: 'cdp-page-target-missing', diagnostics: await snapshotDiagnostics() }, 2);
      return;
    }
    diagnostics.cdpTarget = { id: page.id || null, title: page.title || null, type: page.type || null, url: page.url || null };

    const browserMessages = [];
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
    cdp.on('Log.entryAdded', params => browserMessages.push({ source: params.entry?.source || 'log', level: params.entry?.level || 'info', text: params.entry?.text || '' }));

    const result = await runSmoke(cdp, baseUrl, browserMessages, setStage);
    report('PASS', { stage: 'complete', baseUrl, diagnostics: await snapshotDiagnostics(), result });
  } catch (error) {
    const text = String(error?.message || error);
    const environmentPattern = /browser-not-found|chromium|chrome\.exe|msedge|cdp|websocket|ECONNREFUSED|Timed out waiting for http:\/\/127\.0\.0\.1/i;
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
    try { await fs.rm(profile, { recursive: true, force: true }); } catch (_) {}
  }
}

main();
