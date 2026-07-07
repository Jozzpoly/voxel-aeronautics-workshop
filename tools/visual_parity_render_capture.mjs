#!/usr/bin/env node
/**
 * M4L unified visual parity capture orchestrator (m4l-104).
 *
 * Captures Studio and game diagnostic renders per block, compares PNG pairs,
 * and emits visual_parity_render_report.json.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runCapture as runStudioCapture } from './visual_parity_capture_studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PACK = path.join(ROOT, 'assets', 'visual_packs', 'local_working_visuals');
const DEFAULT_BLOCKS = ['Balloon', 'Hull', 'Fuel', 'Thruster', 'VectorThruster'];
const DEFAULT_OUT = path.join(ROOT, '.agent-validation', 'm4l-capture');
const DEFAULT_PROFILE = 'game-studio-parity';
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;
const REPORT_NAME = 'visual_parity_render_report.json';
const THRESHOLDS = Object.freeze({
  ssimMin: 0.92,
  luminanceDeltaMax: 0.08
});

const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gltf', 'model/gltf+json'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.bin', 'application/octet-stream']
]);

const DEPENDENCIES = [
  {
    taskId: 'm4l-102',
    label: 'Game diagnostic render mode',
    paths: [path.join(ROOT, 'src', 'game', 'visual-parity-diagnostic.js')]
  },
  {
    taskId: 'm4l-103',
    label: 'Studio-side capture harness',
    paths: [path.join(ROOT, 'tools', 'visual_parity_capture_studio.mjs')]
  }
];

function parseArgs(argv) {
  const options = {
    pack: DEFAULT_PACK,
    blocks: [...DEFAULT_BLOCKS],
    profile: DEFAULT_PROFILE,
    out: DEFAULT_OUT,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--pack' && argv[index + 1]) {
      options.pack = path.resolve(argv[++index]);
      continue;
    }
    if (token === '--blocks' && argv[index + 1]) {
      options.blocks = argv[++index].split(',').map(item => item.trim()).filter(Boolean);
      continue;
    }
    if (token === '--profile' && argv[index + 1]) {
      options.profile = argv[++index];
      continue;
    }
    if (token === '--out' && argv[index + 1]) {
      options.out = path.resolve(argv[++index]);
      continue;
    }
    if (token === '--width' && argv[index + 1]) {
      options.width = Math.max(64, Number(argv[++index]) || DEFAULT_WIDTH);
      continue;
    }
    if (token === '--height' && argv[index + 1]) {
      options.height = Math.max(64, Number(argv[++index]) || DEFAULT_HEIGHT);
      continue;
    }
    if (token === '--help' || token === '-h') {
      options.help = true;
    }
  }
  return options;
}

function usage() {
  return `Usage: node tools/visual_parity_render_capture.mjs [options]

Options:
  --pack <dir>       Visual pack root (default: assets/visual_packs/local_working_visuals)
  --blocks <list>    Comma-separated block types (default: ${DEFAULT_BLOCKS.join(',')})
  --profile <id>     Renderer profile for game capture (default: ${DEFAULT_PROFILE})
  --out <dir>        Capture output directory (default: .agent-validation/m4l-capture)
  --width <px>       Viewport width for captures (default: ${DEFAULT_WIDTH})
  --height <px>      Viewport height for captures (default: ${DEFAULT_HEIGHT})

Emits: <out>/${REPORT_NAME} when dependencies are satisfied and capture succeeds.
`;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function dependencyReport() {
  const missing = [];
  for (const dependency of DEPENDENCIES) {
    const absent = [];
    for (const candidate of dependency.paths) {
      if (!(await pathExists(candidate))) absent.push(path.relative(ROOT, candidate));
    }
    if (absent.length) {
      missing.push({
        taskId: dependency.taskId,
        label: dependency.label,
        missingPaths: absent
      });
    }
  }
  return missing;
}

function buildBlockedPayload(options, missing) {
  return {
    status: 'blocked',
    reason: 'm4l-104 dependencies not satisfied',
    taskId: 'm4l-104',
    blockedBy: missing.map(item => item.taskId),
    missing,
    planned: {
      pack: options.pack,
      blocks: options.blocks,
      profile: options.profile,
      outDir: options.out,
      reportPath: path.join(options.out, REPORT_NAME),
      steps: [
        'capture studio PNG+JSON per block via tools/visual_parity_capture_studio.mjs',
        'capture game PNG+JSON per block via visual-parity diagnostic page + CDP screenshot',
        'compare pairs with tools/visual_parity_metrics.py',
        'aggregate visual_parity_render_report.json'
      ]
    },
    prepDoc: '.codex/agent_mesh/assignments/m4l-104-prep.json'
  };
}

function studioFileNames(blockType) {
  const slug = String(blockType || 'block').toLowerCase();
  return {
    png: `studio_${slug}.png`,
    json: `studio_${slug}.json`
  };
}

function gameFileNames(blockType) {
  const slug = String(blockType || 'block').toLowerCase();
  return {
    png: `game_${slug}.png`,
    json: `game_${slug}.json`
  };
}

function relativeToOut(outDir, absolutePath) {
  return path.relative(outDir, absolutePath).split(path.sep).join('/');
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
      }, 30000);
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

async function waitFor(cdp, expression, description, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evaluate(cdp, expression);
    if (lastValue) return lastValue;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${description}; last=${JSON.stringify(lastValue)}`);
}

function buildGamePageUrl(baseUrl, blockType, profileId) {
  const query = new URLSearchParams({
    visualParity: '1',
    block: blockType,
    profile: profileId
  });
  return `${baseUrl}/index.html?${query.toString()}`;
}

async function captureGameBlock(options, blockType) {
  const { executable } = await browserCandidates();
  if (!executable) {
    const error = new Error('No Chromium-based browser found for game visual parity capture.');
    error.classification = 'ENVIRONMENT';
    throw error;
  }

  const port = await freePort();
  const debugPort = await freePort();
  const profile = path.join(os.tmpdir(), `vaw-game-parity-capture-${process.pid}-${blockType}`);
  const server = await startStaticServer(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  const pageUrl = buildGamePageUrl(baseUrl, blockType, options.profile);
  const names = gameFileNames(blockType);
  const outputDir = path.join(options.out, 'game');
  const pngPath = path.join(outputDir, names.png);
  const jsonPath = path.join(outputDir, names.json);

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
      `--window-size=${options.width},${options.height}`,
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
    await waitFor(cdp, 'window.__VAW_VISUAL_PARITY_DIAGNOSTIC__?.ready === true', 'game visual parity diagnostic ready', 45000);

    const pageError = await evaluate(cdp, `(() => {
      const alert = document.querySelector('[role="alert"]');
      if (alert && /visual parity diagnostic failed/i.test(alert.textContent || '')) {
        return alert.textContent;
      }
      return null;
    })()`);
    if (pageError) throw new Error(String(pageError));

    await evaluate(cdp, `(() => {
      const state = window.__VAW_VISUAL_PARITY_DIAGNOSTIC__;
      if (!state?.render) return false;
      for (let index = 0; index < 5; index += 1) state.render();
      return true;
    })()`);

    const metadata = await evaluate(cdp, `(() => {
      const state = window.__VAW_VISUAL_PARITY_DIAGNOSTIC__;
      if (!state?.ready) return null;
      const camera = state.camera;
      const renderer = state.renderer;
      const target = state.framing?.center || { x: 0, y: 0, z: 0 };
      return {
        visualParityCapture: 'M4L',
        surface: 'game',
        status: 'ok',
        blockType: state.blockType,
        assetId: state.assetId,
        profileId: state.profileId,
        modelPath: state.modelRoot?.userData?.visualAssetId || null,
        viewport: {
          width: renderer.domElement.width,
          height: renderer.domElement.height,
          pixelRatio: renderer.getPixelRatio()
        },
        camera: {
          fov: camera.fov,
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
          },
          target,
          near: camera.near,
          far: camera.far
        },
        framing: state.framing,
        bootstrap: state.bootstrap,
        capturedAt: new Date().toISOString()
      };
    })()`);
    if (!metadata) throw new Error('Game visual parity metadata extraction failed.');

    const clip = await evaluate(cdp, `(() => {
      const canvas = document.querySelector('#canvas-container canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scale: 1
      };
    })()`);
    if (!clip?.width || !clip?.height) throw new Error('Game canvas clip region is unavailable.');

    const screenshot = await cdp.call('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      clip
    });
    if (!screenshot?.data) throw new Error('Game CDP screenshot returned no image data.');

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(pngPath, Buffer.from(screenshot.data, 'base64'));
    const payload = {
      ...metadata,
      png: names.png,
      json: names.json,
      capturePageUrl: pageUrl
    };
    await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return payload;
  } finally {
    cdp?.close();
    killBrowser(browser);
    await new Promise(resolve => server.close(() => resolve()));
    try {
      await fs.rm(profile, { recursive: true, force: true });
    } catch (_) {}
  }
}

function runMetricsPair(studioPng, gamePng, jsonOut) {
  const runner = path.join(ROOT, 'tools', 'run_with_python_env.js');
  const metricsScript = path.join(ROOT, 'tools', 'visual_parity_metrics.py');
  const result = spawnSync(process.execPath, [
    runner,
    'python',
    metricsScript,
    '--studio', studioPng,
    '--game', gamePng,
    '--json-out', jsonOut,
    '--ssim-min', String(THRESHOLDS.ssimMin),
    '--luminance-delta-max', String(THRESHOLDS.luminanceDeltaMax)
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `visual_parity_metrics.py failed with exit ${result.status}`);
  }
  const payload = JSON.parse(String(result.stdout || '').trim());
  return payload.metrics;
}

function classificationHint(comparisons) {
  if (!comparisons.length) return 'unclassified';
  const within = comparisons.filter(item => item.metrics?.withinThresholds).length;
  if (within === comparisons.length) return 'unclassified';
  const deltas = comparisons
    .map(item => Math.abs(item.metrics?.averageLuminance?.delta ?? 0))
    .filter(Number.isFinite);
  if (!deltas.length) return 'unclassified';
  const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  if (averageDelta > THRESHOLDS.luminanceDeltaMax) return 'environment-policy';
  return 'material-policy';
}

async function captureBlock(options, blockType) {
  const studioDir = path.join(options.out, 'studio');
  const gameDir = path.join(options.out, 'game');
  await fs.mkdir(studioDir, { recursive: true });
  await fs.mkdir(gameDir, { recursive: true });

  const studioPayload = await runStudioCapture({
    pack: options.pack,
    block: blockType,
    manifest: 'VAW_VISUAL_ASSET_PACK_V1.json',
    output: studioDir,
    width: options.width,
    height: options.height,
    quiet: true
  });
  if (studioPayload.status === 'fail' || studioPayload.status === 'static-only') {
    throw new Error(studioPayload.error || `Studio capture failed for ${blockType}`);
  }

  const gamePayload = await captureGameBlock(options, blockType);
  const studioNames = studioFileNames(blockType);
  const gameNames = gameFileNames(blockType);
  const studioPng = path.join(studioDir, studioNames.png);
  const gamePng = path.join(gameDir, gameNames.png);
  const metricsJson = path.join(options.out, 'metrics', `${String(blockType).toLowerCase()}.json`);
  await fs.mkdir(path.dirname(metricsJson), { recursive: true });
  const metrics = runMetricsPair(studioPng, gamePng, metricsJson);

  return {
    blockType,
    assetId: studioPayload.assetId || gamePayload.assetId || null,
    studio: {
      png: relativeToOut(options.out, studioPng),
      metadata: studioPayload
    },
    game: {
      png: relativeToOut(options.out, gamePng),
      metadata: gamePayload
    },
    metrics
  };
}

function buildSuccessReport(options, comparisons, errors) {
  const blocksWithinThresholds = comparisons.filter(item => item.metrics?.withinThresholds).length;
  return {
    visualParityRenderReport: 'M4L',
    status: errors.length ? 'partial' : 'ok',
    taskId: 'm4l-104',
    capturedAt: new Date().toISOString(),
    packRoot: options.pack,
    profileId: options.profile,
    blocks: options.blocks,
    viewport: {
      width: options.width,
      height: options.height
    },
    thresholds: { ...THRESHOLDS },
    comparisons,
    errors,
    summary: {
      blocksRequested: options.blocks.length,
      blocksCaptured: comparisons.length,
      blocksWithinThresholds,
      classificationHint: classificationHint(comparisons)
    },
    reportPath: path.join(options.out, REPORT_NAME)
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const missing = await dependencyReport();
  if (missing.length) {
    const payload = buildBlockedPayload(options, missing);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = 2;
    return;
  }

  await fs.mkdir(options.out, { recursive: true });
  const comparisons = [];
  const errors = [];

  for (const blockType of options.blocks) {
    try {
      comparisons.push(await captureBlock(options, blockType));
    } catch (error) {
      errors.push({
        blockType,
        classification: error.classification || 'PRODUCT',
        message: String(error?.message || error)
      });
      if (error.classification === 'ENVIRONMENT') break;
    }
  }

  const report = buildSuccessReport(options, comparisons, errors);
  const reportPath = path.join(options.out, REPORT_NAME);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (errors.some(item => item.classification === 'ENVIRONMENT')) {
    process.exitCode = 2;
    return;
  }
  if (!comparisons.length || errors.length) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = comparisons.every(item => item.metrics?.withinThresholds) ? 0 : 1;
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'error',
    taskId: 'm4l-104',
    message: String(error?.message || error)
  }, null, 2));
  process.exitCode = 1;
});