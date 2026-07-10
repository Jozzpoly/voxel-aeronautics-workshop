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
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}`);
}

async function dispatchTouch(cdp, type, touchPoints) {
  await cdp.call('Input.dispatchTouchEvent', { type, touchPoints, modifiers: 0 });
}

function touchPoint(x, y, id) {
  return { x, y, id, radiusX: 4, radiusY: 4, force: 1 };
}

async function loadViewport(cdp, baseUrl, width, height) {
  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.call('Page.navigate', { url: `${baseUrl}/index.html?mobile_workspace=${width}x${height}_${Date.now()}` });
  await waitFor(cdp, `document.readyState === 'complete' && Boolean(window.VAW)`, `${width}x${height} application bootstrap`);
  await waitFor(cdp, `Boolean(window.VAW.require('runtime.mobile-context').workspacePresentation()?.active?.())`, `${width}x${height} mobile workspace activation`);
  await waitFor(cdp, `getComputedStyle(document.documentElement).getPropertyValue('--vaw-mobile-workspace-css-ready').trim() === '1'`, `${width}x${height} mobile stylesheet`);
  await waitFor(cdp, `Boolean(window.VAW.require('runtime.mobile-context').cameraInputBinder()?.bound?.())`, `${width}x${height} mobile camera autobind`);
  await evaluate(cdp, `(() => {
    const start = document.getElementById('start-engineering');
    const help = document.getElementById('help-modal');
    if (start && help && getComputedStyle(help).display !== 'none') start.click();
    return true;
  })()`);
}

async function workspaceState(cdp) {
  return await evaluate(cdp, `(() => {
    const context = window.VAW.require('runtime.mobile-context');
    const controller = context.workspacePresentation();
    const panelNames = ['build','contracts','telemetry','mission','controls'];
    const panels = Object.fromEntries(panelNames.map(name => {
      const ids = { build:'build-panel', contracts:'contract-panel', telemetry:'telemetry-panel', mission:'mission-hud', controls:'controls-panel' };
      const element = document.getElementById(ids[name]);
      const rect = element?.getBoundingClientRect?.();
      return [name, {
        hidden: Boolean(element?.hidden),
        display: element ? getComputedStyle(element).display : null,
        mobileActive: element?.dataset?.vawMobileActive || null,
        rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null
      }];
    }));
    const visibleSheets = Object.entries(panels).filter(([, value]) => value.display !== 'none' && value.rect?.width > 0 && value.rect?.height > 0).map(([name]) => name);
    const toolbarButtons = [...document.querySelectorAll('#workspace-toolbar [data-panel-toggle]')]
      .filter(button => getComputedStyle(button).display !== 'none')
      .map(button => {
        const rect = button.getBoundingClientRect();
        return { name: button.dataset.panelToggle, width: rect.width, height: rect.height, available: button.dataset.vawMobileAvailable };
      });
    const actionButtons = [...document.querySelectorAll('#workspace-layout-actions button')]
      .filter(button => getComputedStyle(button).display !== 'none')
      .map(button => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    const actions = document.getElementById('workspace-layout-actions');
    const toolbar = document.getElementById('workspace-toolbar');
    const parts = document.getElementById('parts-hotbar');
    const partsScroll = parts?.querySelector?.('.parts-hotbar-scroll');
    const partsRect = parts?.getBoundingClientRect?.();
    const canvas = document.querySelector('#canvas-container canvas');
    const canvasRect = canvas?.getBoundingClientRect?.();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      presentation: document.documentElement.dataset.vawPresentation,
      cssReady: getComputedStyle(document.documentElement).getPropertyValue('--vaw-mobile-workspace-css-ready').trim(),
      styleStatus: context.workspaceStyleStatus(),
      snapshot: controller.snapshot(),
      ui: {
        workspace: document.getElementById('ui-layer').dataset.vawMobileWorkspace,
        mode: document.getElementById('ui-layer').dataset.vawMobileMode,
        activePanel: document.getElementById('ui-layer').dataset.vawMobileActivePanel,
        partsOpen: document.getElementById('ui-layer').dataset.vawMobilePartsOpen
      },
      panels,
      visibleSheets,
      toolbarButtons,
      actionButtons,
      toolbar: toolbar ? { clientWidth: toolbar.clientWidth, scrollWidth: toolbar.scrollWidth } : null,
      actions: actions ? { clientWidth: actions.clientWidth, scrollWidth: actions.scrollWidth } : null,
      parts: parts ? {
        hidden: parts.hidden,
        display: getComputedStyle(parts).display,
        mobileOpen: parts.dataset.vawMobileOpen,
        rect: partsRect ? { left: partsRect.left, right: partsRect.right, top: partsRect.top, bottom: partsRect.bottom, width: partsRect.width, height: partsRect.height } : null,
        clientWidth: partsScroll?.clientWidth || 0,
        scrollWidth: partsScroll?.scrollWidth || 0
      } : null,
      documentMetrics: {
        htmlScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth
      },
      canvasRect: canvasRect ? { left: canvasRect.left, right: canvasRect.right, top: canvasRect.top, bottom: canvasRect.bottom, width: canvasRect.width, height: canvasRect.height } : null
    };
  })()`);
}

async function clickPanel(cdp, name) {
  await evaluate(cdp, `document.querySelector('#workspace-toolbar [data-panel-toggle="${name}"]').click()`);
}

async function findCanvasPoint(cdp, maximumX = null) {
  return await evaluate(cdp, `(() => {
    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const rightLimit = ${maximumX == null ? 'rect.right - 20' : `Math.min(rect.right - 20, ${JSON.stringify(maximumX)})`};
    for (let y = rect.top + 40; y < rect.bottom - 40; y += 20) {
      for (let x = rect.left + 20; x < rightLimit; x += 20) {
        if (document.elementFromPoint(x, y) === canvas) return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return null;
  })()`);
}

async function orbitAt(cdp, point) {
  const yawBefore = await evaluate(cdp, `window.VAW.require('game.camera-controller').current().snapshot().yaw`);
  await dispatchTouch(cdp, 'touchStart', [touchPoint(point.x, point.y, 1)]);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'TAP_CANDIDATE'`, 'workspace smoke tap candidate');
  await dispatchTouch(cdp, 'touchMove', [touchPoint(point.x + 36, point.y, 1)]);
  const yawAfter = await waitFor(cdp, `(() => {
    const camera = window.VAW.require('game.camera-controller').current().snapshot();
    const gesture = window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot();
    return gesture.mode === 'ORBIT' && Math.abs(camera.yaw - ${JSON.stringify(yawBefore)}) > 0.05 ? camera.yaw : null;
  })()`, 'workspace smoke camera orbit');
  await dispatchTouch(cdp, 'touchEnd', []);
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').cameraInputBinder().currentRuntime().snapshot().mode === 'IDLE'`, 'workspace smoke orbit release');
  return { yawBefore, yawAfter };
}

function validateShared(state, label) {
  assert(state.presentation === 'mobile', `${label}: presentation is not mobile: ${JSON.stringify(state)}`);
  assert(state.cssReady === '1', `${label}: mobile CSS marker missing: ${JSON.stringify(state)}`);
  assert(state.snapshot.active && state.ui.workspace === 'active', `${label}: workspace controller inactive: ${JSON.stringify(state)}`);
  assert(state.documentMetrics.htmlScrollWidth <= state.documentMetrics.innerWidth + 1, `${label}: html horizontal overflow: ${JSON.stringify(state.documentMetrics)}`);
  assert(state.documentMetrics.bodyScrollWidth <= state.documentMetrics.innerWidth + 1, `${label}: body horizontal overflow: ${JSON.stringify(state.documentMetrics)}`);
  assert(state.visibleSheets.length <= 1, `${label}: more than one large sheet visible: ${JSON.stringify(state.visibleSheets)}`);
  for (const button of [...state.toolbarButtons, ...state.actionButtons]) {
    assert(button.width >= 43.5 && button.height >= 43.5, `${label}: undersized touch target: ${JSON.stringify(button)}`);
  }
}

async function runPortrait(cdp, baseUrl) {
  await loadViewport(cdp, baseUrl, 390, 844);
  const initial = await workspaceState(cdp);
  validateShared(initial, 'portrait initial');
  assert(initial.snapshot.mode === 'BUILD' && initial.snapshot.activePanel === 'build', `portrait: invalid default panel: ${JSON.stringify(initial.snapshot)}`);
  assert(initial.snapshot.partsOpen && initial.parts?.display !== 'none', `portrait: parts tray not open: ${JSON.stringify(initial.parts)}`);
  assert(initial.visibleSheets.length === 1 && initial.visibleSheets[0] === 'build', `portrait: build sheet not uniquely visible: ${JSON.stringify(initial.visibleSheets)}`);
  assert(initial.parts.scrollWidth > initial.parts.clientWidth, `portrait: parts tray is not horizontally scrollable: ${JSON.stringify(initial.parts)}`);
  const hiddenBefore = Object.fromEntries(Object.entries(initial.panels).map(([name, panel]) => [name, panel.hidden]));
  const partsHiddenBefore = initial.parts.hidden;

  await clickPanel(cdp, 'telemetry');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').workspacePresentation().snapshot().activePanel === 'telemetry'`, 'portrait telemetry sheet');
  const telemetry = await workspaceState(cdp);
  validateShared(telemetry, 'portrait telemetry');
  assert(telemetry.visibleSheets.length === 1 && telemetry.visibleSheets[0] === 'telemetry', `portrait: telemetry is not the only sheet: ${JSON.stringify(telemetry.visibleSheets)}`);

  await clickPanel(cdp, 'telemetry');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').workspacePresentation().snapshot().activePanel === null`, 'portrait sheet close');
  const closed = await workspaceState(cdp);
  assert(closed.visibleSheets.length === 0, `portrait: sheet remains visible after second tab tap: ${JSON.stringify(closed.visibleSheets)}`);

  await clickPanel(cdp, 'parts');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').workspacePresentation().snapshot().partsOpen === false`, 'portrait parts close');
  const trayClosed = await workspaceState(cdp);
  validateShared(trayClosed, 'portrait tray closed');
  assert(trayClosed.visibleSheets.length === 0, `portrait: parts toggle reopened a sheet: ${JSON.stringify(trayClosed.visibleSheets)}`);
  assert(trayClosed.parts.display === 'none', `portrait: parts tray remains visible: ${JSON.stringify(trayClosed.parts)}`);

  const hiddenAfter = Object.fromEntries(Object.entries(trayClosed.panels).map(([name, panel]) => [name, panel.hidden]));
  assert(JSON.stringify(hiddenAfter) === JSON.stringify(hiddenBefore), `portrait: desktop panel hidden state mutated: ${JSON.stringify({ hiddenBefore, hiddenAfter })}`);
  assert(trayClosed.parts.hidden === partsHiddenBefore, `portrait: desktop parts hidden state mutated: ${JSON.stringify({ partsHiddenBefore, after: trayClosed.parts.hidden })}`);

  const canvasPoint = await findCanvasPoint(cdp);
  assert(canvasPoint, 'portrait: no hit-testable canvas point remained after closing mobile sheets');
  const orbit = await orbitAt(cdp, canvasPoint);
  return { initial, telemetry, trayClosed, canvasPoint, orbit };
}

async function runLandscape(cdp, baseUrl) {
  await loadViewport(cdp, baseUrl, 844, 390);
  const initial = await workspaceState(cdp);
  validateShared(initial, 'landscape initial');
  assert(initial.snapshot.mode === 'BUILD' && initial.snapshot.activePanel === 'build', `landscape: invalid default panel: ${JSON.stringify(initial.snapshot)}`);
  assert(initial.visibleSheets.length === 1 && initial.visibleSheets[0] === 'build', `landscape: build sheet not uniquely visible: ${JSON.stringify(initial.visibleSheets)}`);
  const sheet = initial.panels.build.rect;
  assert(sheet.width <= Math.min(initial.viewport.width * 0.46, 420) + 2, `landscape: sheet width exceeds policy: ${JSON.stringify(sheet)}`);
  assert(sheet.right >= initial.viewport.width - 2, `landscape: sheet is not right aligned: ${JSON.stringify(sheet)}`);
  assert(initial.parts.display !== 'none' && initial.parts.rect.bottom <= initial.viewport.height + 1, `landscape: parts tray layout invalid: ${JSON.stringify(initial.parts)}`);

  await clickPanel(cdp, 'build');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').workspacePresentation().snapshot().activePanel === null`, 'landscape build sheet close');
  await clickPanel(cdp, 'parts');
  await waitFor(cdp, `window.VAW.require('runtime.mobile-context').workspacePresentation().snapshot().partsOpen === false`, 'landscape parts close');
  const canvasPoint = await findCanvasPoint(cdp, 844 * 0.48);
  assert(canvasPoint && canvasPoint.x < 844 * 0.48, `landscape: left canvas gesture zone unavailable: ${JSON.stringify(canvasPoint)}`);
  const orbit = await orbitAt(cdp, canvasPoint);
  const finalState = await workspaceState(cdp);
  validateShared(finalState, 'landscape final');
  return { initial, finalState, canvasPoint, orbit };
}

async function main() {
  const serverPort = await freePort();
  const debugPort = await freePort();
  const profile = path.join(os.tmpdir(), `vaw-mobile-workspace-smoke-${process.pid}`);
  const browserLogPath = path.join(os.tmpdir(), `vaw-mobile-workspace-smoke-${process.pid}.log`);
  let stage = 'browser-discovery';
  let browserLog = '';
  const diagnostics = { browser: null, browserCandidates: [], browserLogPath, browserLogExcerpt: '', cdpTarget: null, debugPort, serverPort };
  let server = null;
  let browser = null;
  let cdp = null;

  async function snapshotDiagnostics() {
    diagnostics.browserLogExcerpt = excerpt(browserLog);
    try { await fs.writeFile(browserLogPath, browserLog || '(no browser output captured)\n', 'utf8'); } catch (_) {}
    return diagnostics;
  }

  function captureBrowserOutput(label, stream) {
    stream?.on?.('data', chunk => {
      browserLog += `[${label}] ${chunk.toString('utf8')}`;
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

    stage = 'server-start';
    server = await startStaticServer(serverPort);
    const baseUrl = `http://127.0.0.1:${serverPort}`;
    await waitForUrl(`${baseUrl}/index.html`);

    stage = 'cdp-connect';
    browser = spawn(browserProbe.executable, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--metrics-recording-only', '--mute-audio', '--no-first-run', '--no-default-browser-check',
      '--remote-allow-origins=*', '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    captureBrowserOutput('stdout', browser.stdout);
    captureBrowserOutput('stderr', browser.stderr);
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 20000);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) throw new Error('CDP page target is unavailable.');
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
    cdp.on('Log.entryAdded', params => {
      const entry = params.entry || {};
      if (entry.source === 'javascript' || entry.source === 'network') browserMessages.push({ source: entry.source, level: entry.level || 'info', text: entry.text || '' });
    });

    stage = 'portrait';
    const portrait = await runPortrait(cdp, baseUrl);
    stage = 'landscape';
    const landscape = await runLandscape(cdp, baseUrl);
    const errors = browserMessages.filter(message => message.level === 'error');
    assert(errors.length === 0, `Browser console/runtime errors: ${JSON.stringify(errors)}`);

    report('PASS', {
      stage: 'complete',
      baseUrl,
      diagnostics: await snapshotDiagnostics(),
      result: {
        portrait: {
          visibleInitialSheet: portrait.initial.visibleSheets,
          partsScroll: [portrait.initial.parts.clientWidth, portrait.initial.parts.scrollWidth],
          canvasPoint: portrait.canvasPoint,
          orbit: portrait.orbit
        },
        landscape: {
          sheetRect: landscape.initial.panels.build.rect,
          canvasPoint: landscape.canvasPoint,
          orbit: landscape.orbit
        },
        consoleErrors: errors.length
      }
    });
  } catch (error) {
    const text = String(error?.message || error);
    const environmentPattern = /browser-not-found|chromium|chrome\.exe|msedge|cdp|websocket|ECONNREFUSED|Timed out waiting for http:\/\/127\.0\.0\.1/i;
    const isEnvironment = environmentPattern.test(text);
    report(isEnvironment ? 'ENVIRONMENT' : 'PRODUCT', {
      stage,
      reason: text,
      diagnostics: await snapshotDiagnostics(),
      stack: error?.stack || null
    }, isEnvironment ? 2 : 1);
  } finally {
    cdp?.close();
    killBrowser(browser);
    await new Promise(resolve => server?.close(() => resolve()) || resolve());
    try { await fs.rm(profile, { recursive: true, force: true }); } catch (_) {}
  }
}

main();
