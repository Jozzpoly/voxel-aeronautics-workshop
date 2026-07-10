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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  const relative = decodeURIComponent((urlPath || '/').split('?')[0]) === '/'
    ? 'index.html'
    : decodeURIComponent((urlPath || '/').split('?')[0]).replace(/^\/+/, '');
  const candidate = path.resolve(ROOT, relative);
  return candidate.startsWith(ROOT + path.sep) || candidate === ROOT ? candidate : null;
}

async function startStaticServer(port) {
  const server = createServer(async (request, response) => {
    try {
      if ((request.url || '').split('?')[0] === '/favicon.ico') {
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
      const extension = path.extname(filename).toLowerCase();
      const type = extension === '.html' ? 'text/html; charset=utf-8'
        : extension === '.js' ? 'text/javascript; charset=utf-8'
          : extension === '.css' ? 'text/css; charset=utf-8'
            : extension === '.json' ? 'application/json; charset=utf-8'
              : 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      response.end(data);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(String(error?.message || error));
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
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 0;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP open timed out')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP socket error')); }, { once: true });
    });
    this.socket.addEventListener('message', async event => {
      const raw = typeof event.data === 'string' ? event.data : await event.data.text();
      const message = JSON.parse(raw);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
      else pending.resolve(message.result || {});
    });
  }

  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.socket?.close(); } catch (_) {}
  }
}

async function evaluate(cdp, expression) {
  const response = await cdp.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result?.value;
}

async function waitFor(cdp, expression, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, expression);
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function snapshot(cdp) {
  return await evaluate(cdp, `(() => {
    const context = window.VAW.require('runtime.mobile-context');
    const binder = context.cameraInputBinder();
    const runtime = binder?.currentRuntime?.();
    const camera = window.VAW.require('game.camera-controller').current();
    return {
      profile: context.currentProfile(),
      binderBound: binder?.bound?.() || false,
      runtimeEnabled: runtime?.enabled?.() || false,
      gesture: runtime?.snapshot?.() || null,
      camera: camera?.snapshot?.() || null,
      trace: window.__VAW_POINTER_PROBE__ || []
    };
  })()`);
}

async function dispatchTouch(cdp, type, points) {
  await cdp.call('Input.dispatchTouchEvent', { type, touchPoints: points, modifiers: 0 });
}

async function main() {
  const serverPort = await freePort();
  const debugPort = await freePort();
  const profileDir = path.join(os.tmpdir(), `vaw-mobile-pointer-probe-${process.pid}`);
  let server = null;
  let browser = null;
  let cdp = null;
  try {
    server = await startStaticServer(serverPort);
    browser = spawn('/usr/bin/chromium', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
      '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`, 'about:blank'
    ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(target => target.type === 'page') || targets[0];
    if (!page?.webSocketDebuggerUrl) throw new Error('Missing CDP page target');

    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, screenWidth: 390, screenHeight: 844,
      deviceScaleFactor: 2, mobile: true
    });
    await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/index.html?pointer_probe=${Date.now()}` });
    await waitFor(cdp, `document.readyState === 'complete' && Boolean(window.VAW)`, 'app bootstrap');
    await waitFor(cdp, `Boolean(window.VAW.require('runtime.mobile-context').cameraInputBinder()?.bound?.())`, 'mobile binder');
    await evaluate(cdp, `(() => {
      document.getElementById('start-engineering')?.click();
      const canvas = document.querySelector('#canvas-container canvas');
      window.__VAW_POINTER_PROBE__ = [];
      const record = event => window.__VAW_POINTER_PROBE__.push({
        type: event.type,
        pointerType: event.pointerType || null,
        pointerId: event.pointerId ?? null,
        clientX: event.clientX ?? null,
        clientY: event.clientY ?? null,
        target: event.target?.tagName || null,
        touches: event.touches?.length ?? null
      });
      for (const type of ['touchstart','touchmove','touchend','touchcancel','pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture']) {
        canvas.addEventListener(type, record, true);
      }
      return true;
    })()`);
    const point = await evaluate(cdp, `(() => {
      const canvas = document.querySelector('#canvas-container canvas');
      const rect = canvas.getBoundingClientRect();
      for (let y = rect.top + 80; y < rect.bottom - 40; y += 30) {
        for (let x = rect.left + 20; x < rect.right - 20; x += 20) {
          if (document.elementFromPoint(x, y) === canvas) return { x: Math.round(x), y: Math.round(y) };
        }
      }
      return null;
    })()`);
    if (!point) throw new Error('No unobscured canvas point');

    const before = await snapshot(cdp);
    await dispatchTouch(cdp, 'touchStart', [{ x: point.x, y: point.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]);
    await sleep(150);
    const afterStart = await snapshot(cdp);
    await dispatchTouch(cdp, 'touchMove', [{ x: point.x + 36, y: point.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]);
    await sleep(250);
    const afterMove = await snapshot(cdp);
    await dispatchTouch(cdp, 'touchEnd', []);
    await sleep(150);
    const afterEnd = await snapshot(cdp);

    console.log(JSON.stringify({ status: 'PROBE', point, before, afterStart, afterMove, afterEnd }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'PROBE_ERROR', reason: error?.message || String(error), stack: error?.stack || null }, null, 2));
    process.exitCode = 1;
  } finally {
    cdp?.close();
    try { browser?.kill('SIGTERM'); } catch (_) {}
    await new Promise(resolve => server?.close(() => resolve()) || resolve());
    try { await fs.rm(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main();
