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
const DEFAULT_PACK = path.join(ROOT, 'assets/visual_packs/local_working_visuals');
const DEFAULT_MANIFEST = 'VAW_VISUAL_ASSET_PACK_V1.json';
const CAPTURE_PAGE = '/tools/blockbench_import_studio/visual_parity_capture.html';
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gltf', 'model/gltf+json'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.bin', 'application/octet-stream']
]);

function parseArgs(argv) {
  const options = {
    pack: DEFAULT_PACK,
    block: 'Balloon',
    manifest: DEFAULT_MANIFEST,
    output: path.join(ROOT, '.agent-validation/m4l-103-studio-capture'),
    width: 640,
    height: 480,
    quiet: false,
    staticOnly: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--static-only') options.staticOnly = true;
    else if (arg === '--pack') options.pack = path.resolve(argv[++index]);
    else if (arg === '--block') options.block = String(argv[++index] || '').trim();
    else if (arg === '--manifest') options.manifest = String(argv[++index] || '').trim();
    else if (arg === '--output' || arg === '--out') options.output = path.resolve(argv[++index]);
    else if (arg === '--width') options.width = Math.max(64, Number(argv[++index]) || 640);
    else if (arg === '--height') options.height = Math.max(64, Number(argv[++index]) || 480);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    'Usage: node tools/visual_parity_capture_studio.mjs [options]',
    '',
    'Options:',
    '  --pack <dir>       Visual pack root (default: assets/visual_packs/local_working_visuals)',
    '  --block <type>     Block type to capture (default: Balloon)',
    '  --manifest <file>  Manifest filename inside pack (default: VAW_VISUAL_ASSET_PACK_V1.json)',
    '  --output <dir>     Output directory for PNG+JSON',
    '  --width <px>       Viewport width (default: 640)',
    '  --height <px>      Viewport height (default: 480)',
    '  --static-only      Resolve pack asset only; skip browser capture',
    '  --quiet            Suppress JSON report on stdout',
    '  --help             Show this help'
  ].join('\n');
}

function log(options, message) {
  if (!options.quiet) console.error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function findAsset(manifest, blockType) {
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  return assets.find(asset => (asset?.bindings?.blockTypes || []).includes(blockType)) || null;
}

export function resolveCaptureTarget({ packRoot, manifestName, blockType }) {
  const resolvedPackRoot = path.resolve(packRoot);
  const manifestPath = path.join(resolvedPackRoot, manifestName);
  const assetsRoot = path.join(ROOT, 'assets/visual_packs');
  const relativePack = path.relative(assetsRoot, resolvedPackRoot).split(path.sep).join('/');
  if (!relativePack || relativePack.startsWith('..') || path.isAbsolute(relativePack)) {
    throw new Error(`Pack root must live under assets/visual_packs: ${resolvedPackRoot}`);
  }
  return {
    packRoot: resolvedPackRoot,
    manifestPath,
    manifestName,
    blockType,
    manifestUrl: `/assets/visual_packs/${relativePack}/${manifestName}`
  };
}

export async function resolvePackAsset(options) {
  const packRoot = path.resolve(options.pack);
  const manifestPath = path.join(packRoot, options.manifest);
  const manifest = await readJson(manifestPath);
  const asset = findAsset(manifest, options.block);
  if (!asset) throw new Error(`No asset bound to block type ${options.block} in ${manifestPath}`);
  if (!asset.model?.path) throw new Error(`Asset ${asset.assetId || '(unknown)'} is missing model.path`);
  const modelPath = path.join(packRoot, asset.model.path);
  await fs.access(modelPath);
  return { packRoot, manifestPath, manifest, asset, modelPath };
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

  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, 20000);
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
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || JSON.stringify(response.exceptionDetails));
  }
  return response.result?.value;
}

async function waitFor(cdp, expression, description, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evaluate(cdp, expression);
    if (lastValue) return lastValue;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${description}; last=${JSON.stringify(lastValue)}`);
}

function pngFileName(blockType) {
  return `studio_${String(blockType || 'block').toLowerCase()}.png`;
}

function jsonFileName(blockType) {
  return `studio_${String(blockType || 'block').toLowerCase()}.json`;
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error('capture returned invalid PNG data URL');
  return Buffer.from(match[1], 'base64');
}

async function captureInBrowser(options, target) {
  const { executable } = await browserCandidates();
  if (!executable) {
    const error = new Error('No Chromium-based browser found for Studio capture.');
    error.classification = 'ENVIRONMENT';
    throw error;
  }

  const port = await freePort();
  const debugPort = await freePort();
  const profile = path.join(os.tmpdir(), `vaw-studio-capture-${process.pid}`);
  const server = await startStaticServer(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  const query = new URLSearchParams({
    manifest: target.manifestUrl,
    block: options.block,
    width: String(options.width),
    height: String(options.height)
  });
  const pageUrl = `${baseUrl}${CAPTURE_PAGE}?${query.toString()}`;

  let browser = null;
  let cdp = null;
  try {
    await waitForUrl(`${baseUrl}/index.html`);
    browser = spawn(executable, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
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
      '--window-size=900,700',
      'about:blank'
    ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });

    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 15000);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl) || targets.find(item => item.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) throw new Error('CDP page target missing.');

    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.call('Page.navigate', { url: pageUrl });
    await waitFor(cdp, 'window.__VAW_STUDIO_CAPTURE__?.ready === true', 'studio capture ready');
    const pageError = await evaluate(cdp, 'window.__VAW_STUDIO_CAPTURE__?.error || null');
    if (pageError) throw new Error(String(pageError));

    const report = await evaluate(cdp, 'window.__VAW_STUDIO_CAPTURE__.report');
    const dataUrl = await evaluate(cdp, 'window.__VAW_STUDIO_CAPTURE__.capturePngDataUrl()');
    const pngBuffer = decodeDataUrl(dataUrl);
    return { report, pngBuffer, pageUrl };
  } finally {
    cdp?.close();
    killBrowser(browser);
    await new Promise(resolve => server.close(() => resolve()));
  }
}

export async function runCapture(options) {
  const resolved = await resolvePackAsset(options);
  const target = resolveCaptureTarget({
    packRoot: resolved.packRoot,
    manifestName: options.manifest,
    blockType: options.block
  });

  if (options.staticOnly) {
    return {
      visualParityCapture: 'M4L',
      surface: 'studio',
      status: 'static-only',
      classification: 'HARNESS',
      blockType: options.block,
      assetId: resolved.asset.assetId || null,
      packRoot: resolved.packRoot,
      manifestPath: resolved.manifestPath,
      modelPath: resolved.asset.model.path,
      rendererProfile: { id: 'studio-preview' }
    };
  }

  const { report, pngBuffer, pageUrl } = await captureInBrowser(options, target);
  await fs.mkdir(options.output, { recursive: true });
  const pngName = pngFileName(options.block);
  const jsonName = jsonFileName(options.block);
  const pngPath = path.join(options.output, pngName);
  const jsonPath = path.join(options.output, jsonName);
  const payload = {
    ...report,
    packRoot: resolved.packRoot,
    manifestPath: resolved.manifestPath,
    png: pngName,
    json: jsonName,
    capturePageUrl: pageUrl
  };
  await fs.writeFile(pngPath, pngBuffer);
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.block) throw new Error('--block is required');

  try {
    const payload = await runCapture(options);
    console.log(JSON.stringify(payload, null, 2));
    if (payload.status === 'static-only') process.exitCode = 0;
  } catch (error) {
    const payload = {
      visualParityCapture: 'M4L',
      surface: 'studio',
      status: 'fail',
      classification: error.classification || 'PRODUCT',
      blockType: options.block,
      error: String(error?.message || error)
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = error.classification === 'ENVIRONMENT' ? 2 : 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}