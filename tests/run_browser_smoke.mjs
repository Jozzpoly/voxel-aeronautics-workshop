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
  const helpVisible = await evaluate(cdp, `(() => {
    const modal = document.getElementById('help-modal');
    return Boolean(modal && getComputedStyle(modal).display !== 'none');
  })()`);
  if (helpVisible) {
    await clickElement(cdp, '#start-engineering');
    await waitFor(cdp, `getComputedStyle(document.getElementById('help-modal')).display === 'none'`, 'help modal closed');
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

  setStage('hit-test');
  await clickElement(cdp, '[data-panel-toggle="contracts"]');
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
    corePanels: panels,
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
