const assert = require('assert');
const { load } = require('./load_runtime');
load(['src/foundation/kernel.js', 'src/foundation/fixed_step_scheduler.js']);

const Scheduler = VAW.require('foundation.fixed-step-scheduler');
assert.throws(() => Scheduler.create({ fixedDt: 0, maxSubSteps: 1 }), /positive finite/);
assert.throws(() => Scheduler.create({ fixedDt: 1 / 60, maxSubSteps: 1.5 }), /positive integer/);

const scheduler = Scheduler.create({ fixedDt: 0.01, maxSubSteps: 4, maxFrameDelta: 0.05 });
const calls = [];
let result = scheduler.advance(0.025, dt => calls.push(dt));
assert.strictEqual(result.steps, 2);
assert(Math.abs(result.accumulator - 0.005) < 1e-12);
assert.deepStrictEqual(calls, [0.01, 0.01]);

result = scheduler.advance(0.2, dt => calls.push(dt));
assert.strictEqual(result.steps, 4);
assert.strictEqual(result.overloaded, true);
assert(Math.abs(result.droppedSeconds - 0.165) < 1e-12, result.droppedSeconds);
let metrics = scheduler.snapshot();
assert.strictEqual(metrics.overloadFrames, 1);
assert.strictEqual(metrics.totalSteps, 6);
assert.strictEqual(metrics.totalFrames, 2);
assert(Math.abs(metrics.frameClampDroppedSeconds - 0.15) < 1e-12);
assert(Math.abs(metrics.capacityDroppedSeconds - 0.015) < 1e-12);
assert(Math.abs(metrics.accumulator) < 1e-12);

const pausedBefore = scheduler.snapshot();
result = scheduler.advance(0.03, () => { throw new Error('paused callback ran'); }, { paused: true });
assert.strictEqual(result.steps, 0);
assert.strictEqual(scheduler.snapshot().totalSteps, pausedBefore.totalSteps);
assert.strictEqual(scheduler.snapshot().totalFrames, pausedBefore.totalFrames + 1);

scheduler.reset();
assert.strictEqual(scheduler.snapshot().accumulator, 0);
assert.strictEqual(scheduler.snapshot().overloadFrames, 1);
scheduler.reset({ resetMetrics: true });
metrics = scheduler.snapshot();
assert.strictEqual(metrics.totalFrames, 0);
assert.strictEqual(metrics.totalSteps, 0);
assert.strictEqual(metrics.droppedSeconds, 0);

assert.throws(() => scheduler.advance(-1, () => {}), /non-negative finite/);
assert.throws(() => scheduler.advance(0.01, null), /step callback/);

console.log({ fixedStepScheduler: 'ok', overloadDiagnostics: 'ok', pauseSemantics: 'ok' });
