#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_HTML = path.join(ROOT, 'dist', 'Voxel_Aeronautics_Workshop_Workbench_Foundation.html');
const EVIDENCE_DIR = path.join(ROOT, '.agent-validation', 'mobile-offline-release-smoke');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function report(status, data = {}, exitCode = 0) {
  console.log(JSON.stringify({ status, ...data }, null, 2));
  process.exitCode = exitCode;
}

function excerpt(text, limit = 4000) {
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

async function executableExists(filename) {
  try { await fs.access(filename); return true; }
  catch (_) { return false; }
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
  if (response.exceptionDetails) {
    throw new Error(`Browser evaluation failed: ${response.exceptionDetails.text || JSON.stringify(response.exceptionDetails)}`);
  }
  return response.result?.value;
}

async function waitFor(cdp, expression, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    try { lastValue = await evaluate(cdp, expression); }
    catch (error) { lastValue = { evaluationError: String(error?.message || error) }; }
    if (lastValue && !lastValue.evaluationError) return lastValue;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(lastValue)}`);
}

function killBrowser(child) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch (_) {}
}

async function captureScreenshot(cdp, destination) {
  try {
    const result = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    if (result.data) await fs.writeFile(destination, Buffer.from(result.data, 'base64'));
  } catch (_) {}
}

async function main() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  const debugPort = await freePort();
  const profile = path.join(os.tmpdir(), `vaw-mobile-offline-smoke-${process.pid}`);
  const browserLogPath = path.join(EVIDENCE_DIR, 'browser.log');
  const screenshotPath = path.join(EVIDENCE_DIR, 'screenshot.png');
  const diagnosticsPath = path.join(EVIDENCE_DIR, 'diagnostics.json');
  const releaseUrl = pathToFileURL(RELEASE_HTML).href;
  const navigationUrl = releaseUrl;
  let stage = 'release-discovery';
  let browser = null;
  let cdp = null;
  let browserLog = '';
  const requests = [];
  const browserMessages = [];
  const diagnostics = {
    releaseHtml: RELEASE_HTML,
    transport: 'file-navigation',
    releaseUrl,
    navigationUrl,
    browser: null,
    browserCandidates: [],
    browserLogPath,
    screenshotPath,
    requests,
    browserMessages,
    storageGetterForcedToThrow: true,
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 }
  };

  function setStage(nextStage) { stage = nextStage; }
  function captureBrowserOutput(label, stream) {
    stream?.on?.('data', chunk => {
      browserLog += `[${label}] ${chunk.toString('utf8')}`;
      if (browserLog.length > 30000) browserLog = browserLog.slice(browserLog.length - 30000);
    });
  }
  async function persistDiagnostics(extra = {}) {
    diagnostics.stage = stage;
    diagnostics.browserLogExcerpt = excerpt(browserLog);
    Object.assign(diagnostics, extra);
    await fs.writeFile(browserLogPath, browserLog || '(no browser output captured)\n', 'utf8');
    await fs.writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
    return diagnostics;
  }

  try {
    await fs.access(RELEASE_HTML);
    const browserProbe = await browserCandidates();
    diagnostics.browser = browserProbe.executable;
    diagnostics.browserCandidates = browserProbe.candidates;
    if (!browserProbe.executable) {
      report('ENVIRONMENT', { stage, reason: 'browser-not-found', diagnostics: await persistDiagnostics() }, 2);
      return;
    }

    setStage('browser-start');
    browser = spawn(browserProbe.executable, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--allow-file-access-from-files',
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
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 20000);

    setStage('cdp-connect');
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) throw new Error('CDP page target is unavailable.');
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('Network.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      screenWidth: 390,
      screenHeight: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() { throw new DOMException('Blocked by mobile offline smoke', 'SecurityError'); }
        });
      })();`
    });

    cdp.on('Network.requestWillBeSent', params => {
      requests.push({
        url: params.request?.url || '',
        method: params.request?.method || '',
        type: params.type || null,
        initiatorType: params.initiator?.type || null
      });
    });
    cdp.on('Runtime.consoleAPICalled', params => {
      const text = (params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ');
      browserMessages.push({ source: 'console', level: params.type === 'error' ? 'error' : params.type, text });
    });
    cdp.on('Runtime.exceptionThrown', params => {
      browserMessages.push({ source: 'runtime', level: 'error', text: params.exceptionDetails?.text || 'uncaught exception' });
    });
    cdp.on('Log.entryAdded', params => {
      const entry = params.entry || {};
      if (entry.source === 'javascript' || entry.source === 'network') {
        browserMessages.push({ source: entry.source, level: entry.level || 'info', text: entry.text || '' });
      }
    });

    setStage('file-navigation');
    const navigation = await cdp.call('Page.navigate', { url: navigationUrl });
    if (navigation.errorText === 'net::ERR_BLOCKED_BY_ADMINISTRATOR') {
      diagnostics.transport = 'opaque-document-content';
      setStage('opaque-document-bootstrap');
      const blankNavigation = await cdp.call('Page.navigate', { url: 'about:blank' });
      if (blankNavigation.errorText) throw new Error(`Opaque document navigation failed: ${blankNavigation.errorText}`);
      await waitFor(cdp, `document.readyState === 'complete'`, 'opaque document readiness');
      await evaluate(cdp, `(() => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() { throw new DOMException('Blocked by mobile offline smoke', 'SecurityError'); }
        });
        return true;
      })()`);
      const releaseHtml = await fs.readFile(RELEASE_HTML, 'utf8');
      const frameTree = await cdp.call('Page.getFrameTree');
      const frameId = frameTree.frameTree?.frame?.id;
      if (!frameId) throw new Error('Opaque document frame is unavailable.');
      await cdp.call('Page.setDocumentContent', { frameId, html: releaseHtml });
    } else if (navigation.errorText) {
      throw new Error(`File navigation failed: ${navigation.errorText}`);
    }
    await waitFor(cdp, `document.readyState === 'complete'`, 'release document load');
    await sleep(1500);

    setStage('application-contract');
    const state = await evaluate(cdp, `(() => {
      const inspect = () => window.VAW?.inspect?.() || { defined: [], initialized: [] };
      const safeRequire = id => { try { return window.VAW?.require?.(id) || null; } catch (_) { return null; } };
      const context = safeRequire('runtime.mobile-context');
      const commandPort = safeRequire('game.mobile-command-port');
      const storageCapability = safeRequire('game.storage-capability');
      const playableShell = context?.playableShell?.();
      const flightControls = context?.flightControls?.();
      const fatal = document.getElementById('fatal-error');
      const fatalVisible = Boolean(fatal && !fatal.hidden && getComputedStyle(fatal).display !== 'none');
      return {
        readyState: document.readyState,
        location: document.location.href,
        title: document.title,
        bodyExcerpt: document.body?.innerText?.slice?.(0, 500) || '',
        releaseMode: document.documentElement.dataset.vawReleaseMode || null,
        hasVAW: Boolean(window.VAW),
        inspect: inspect(),
        mobileContextDefined: Boolean(context),
        mobileAvailable: Boolean(context?.available),
        commandPortDefined: Boolean(commandPort),
        commandPortRegistered: Boolean(commandPort?.current?.()),
        playableShellReady: Boolean(playableShell?.snapshot?.().ready),
        flightControlsReady: Boolean(flightControls?.snapshot?.().ready),
        storageCapabilityDefined: Boolean(storageCapability),
        storageKind: storageCapability?.forWindow?.(window)?.kind || null,
        storagePersistent: storageCapability?.forWindow?.(window)?.persistent ?? null,
        fatalVisible,
        fatalText: fatal?.textContent?.trim?.() || '',
        presentation: document.documentElement.dataset.vawPresentation || null
      };
    })()`);
    diagnostics.state = state;

    const unexpectedRequests = requests.filter(request => {
      if (!request.url) return false;
      if (request.url === navigationUrl || request.url === releaseUrl) return false;
      return /^(?:file|https?):/i.test(request.url);
    });
    const pageErrors = browserMessages.filter(message => message.level === 'error');
    diagnostics.unexpectedRequests = unexpectedRequests;
    diagnostics.pageErrors = pageErrors;

    if (!state.hasVAW) throw new Error('Embedded VAW kernel did not initialize.');
    if (state.releaseMode !== 'single-file') throw new Error(`Release mode marker is missing: ${JSON.stringify(state)}`);
    if (!state.mobileContextDefined || !state.commandPortDefined) throw new Error(`Required mobile modules are unavailable: ${JSON.stringify(state)}`);
    if (!state.mobileAvailable) throw new Error(`Mobile runtime is unavailable under throwing localStorage: ${JSON.stringify(state)}`);
    if (!state.commandPortRegistered || !state.playableShellReady || !state.flightControlsReady) {
      throw new Error(`Mobile product composition did not complete: ${JSON.stringify(state)}`);
    }
    if (!state.storageCapabilityDefined || state.storageKind !== 'memory' || state.storagePersistent !== false) {
      throw new Error(`No-origin storage fallback is not explicit memory storage: ${JSON.stringify(state)}`);
    }
    if (state.fatalVisible) throw new Error(`Fatal overlay is visible: ${state.fatalText}`);
    if (unexpectedRequests.length) throw new Error(`Single-file startup emitted network/file requests: ${JSON.stringify(unexpectedRequests)}`);
    if (pageErrors.length) throw new Error(`Browser console/runtime errors: ${JSON.stringify(pageErrors)}`);

    await captureScreenshot(cdp, screenshotPath);
    report('PASS', { stage: 'complete', diagnostics: await persistDiagnostics() });
  } catch (error) {
    await captureScreenshot(cdp, screenshotPath);
    const reason = String(error?.message || error);
    const environmentPattern = /browser-not-found|chromium|chrome\.exe|msedge|cdp|websocket|ECONNREFUSED|Timed out waiting for http:\/\/127\.0\.0\.1|WebGL context|WebGL is not supported/i;
    const productPattern = /localStorage|storage fallback|renderer profiles|required mobile modules|Mobile runtime is unavailable|fatal overlay|network\/file requests/i;
    const isEnvironment = !productPattern.test(reason) && environmentPattern.test(reason);
    report(isEnvironment ? 'ENVIRONMENT' : 'PRODUCT', {
      stage,
      reason,
      stack: error?.stack || null,
      diagnostics: await persistDiagnostics({ failure: reason })
    }, isEnvironment ? 2 : 1);
  } finally {
    cdp?.close();
    killBrowser(browser);
    try { await fs.rm(profile, { recursive: true, force: true }); } catch (_) {}
  }
}

main();
