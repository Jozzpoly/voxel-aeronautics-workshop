'use strict';

(function registerMobileTouchController(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (!root?.VAW) throw new Error('Foundation kernel was not initialized before mobile-touch-controller.js.');
  root.VAW.define('game.mobile-touch-controller', [], factory);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMobileTouchControllerModule() {
  const MODES = Object.freeze({
    IDLE: 'IDLE',
    TAP_CANDIDATE: 'TAP_CANDIDATE',
    ORBIT: 'ORBIT',
    MULTI: 'MULTI'
  });
  const OWNERS = new Set(['canvas', 'ui']);

  function finiteNumber(value, name) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new TypeError(`${name} must be a finite number.`);
    return numeric;
  }

  function normalizeSample(sample = {}, requireOwner = false) {
    const pointerId = finiteNumber(sample.pointerId, 'pointerId');
    const x = finiteNumber(sample.x, 'x');
    const y = finiteNumber(sample.y, 'y');
    const owner = requireOwner ? String(sample.owner || '') : undefined;
    if (requireOwner && !OWNERS.has(owner)) throw new TypeError('owner must be "canvas" or "ui".');
    return { pointerId, x, y, owner };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function centroid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function create(options = {}) {
    const movementThreshold = finiteNumber(options.movementThreshold ?? 8, 'movementThreshold');
    if (movementThreshold < 0) throw new RangeError('movementThreshold must be non-negative.');
    const thresholdSq = movementThreshold * movementThreshold;
    const callbacks = {
      onOrbit: typeof options.onOrbit === 'function' ? options.onOrbit : () => {},
      onPan: typeof options.onPan === 'function' ? options.onPan : () => {},
      onZoom: typeof options.onZoom === 'function' ? options.onZoom : () => {},
      onTap: typeof options.onTap === 'function' ? options.onTap : () => {},
      onCancel: typeof options.onCancel === 'function' ? options.onCancel : () => {},
      onStateChanged: typeof options.onStateChanged === 'function' ? options.onStateChanged : () => {}
    };

    const pointers = new Map();
    let mode = MODES.IDLE;
    let multiGestureLatched = false;
    let previousMulti = null;

    function canvasPointers() {
      return [...pointers.values()].filter(pointer => pointer.owner === 'canvas').sort((a, b) => a.pointerId - b.pointerId);
    }

    function snapshot() {
      const pointerIds = Object.freeze([...pointers.keys()].sort((a, b) => a - b));
      return Object.freeze({ mode, pointerIds, activePointerCount: pointers.size, multiGestureLatched });
    }

    function emitState() {
      callbacks.onStateChanged(snapshot());
    }

    function setMode(nextMode) {
      if (mode === nextMode) return;
      mode = nextMode;
      emitState();
    }

    function establishMultiBaseline() {
      const active = canvasPointers();
      if (active.length < 2) {
        previousMulti = null;
        return;
      }
      const [first, second] = active;
      previousMulti = {
        centroid: centroid(first, second),
        distance: distance(first, second)
      };
    }

    function promoteToMulti() {
      multiGestureLatched = true;
      establishMultiBaseline();
      setMode(MODES.MULTI);
    }

    function pointerDown(sample) {
      const normalized = normalizeSample(sample, true);
      if (pointers.has(normalized.pointerId)) return false;
      pointers.set(normalized.pointerId, {
        pointerId: normalized.pointerId,
        owner: normalized.owner,
        startX: normalized.x,
        startY: normalized.y,
        x: normalized.x,
        y: normalized.y,
        previousX: normalized.x,
        previousY: normalized.y
      });

      const activeCanvas = canvasPointers();
      if (normalized.owner === 'canvas') {
        if (activeCanvas.length >= 2) promoteToMulti();
        else if (!multiGestureLatched) setMode(MODES.TAP_CANDIDATE);
      }
      emitState();
      return true;
    }

    function pointerMove(sample) {
      const normalized = normalizeSample(sample, false);
      const pointer = pointers.get(normalized.pointerId);
      if (!pointer) return false;

      const dx = normalized.x - pointer.x;
      const dy = normalized.y - pointer.y;
      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
      pointer.x = normalized.x;
      pointer.y = normalized.y;

      if (pointer.owner !== 'canvas') return true;

      const activeCanvas = canvasPointers();
      if (multiGestureLatched || activeCanvas.length >= 2) {
        if (!multiGestureLatched) promoteToMulti();
        if (activeCanvas.length >= 2) {
          const [first, second] = activeCanvas;
          const currentCentroid = centroid(first, second);
          const currentDistance = distance(first, second);
          if (previousMulti) {
            const panDx = currentCentroid.x - previousMulti.centroid.x;
            const panDy = currentCentroid.y - previousMulti.centroid.y;
            if (panDx !== 0 || panDy !== 0) {
              callbacks.onPan({ dx: panDx, dy: panDy, pointerIds: [first.pointerId, second.pointerId] });
            }
            const zoomDelta = currentDistance - previousMulti.distance;
            if (zoomDelta !== 0) {
              callbacks.onZoom({
                delta: zoomDelta,
                scale: previousMulti.distance > 0 ? currentDistance / previousMulti.distance : 1,
                pointerIds: [first.pointerId, second.pointerId]
              });
            }
          }
          previousMulti = { centroid: currentCentroid, distance: currentDistance };
        }
        return true;
      }

      if (mode === MODES.TAP_CANDIDATE) {
        const totalDx = pointer.x - pointer.startX;
        const totalDy = pointer.y - pointer.startY;
        if (totalDx * totalDx + totalDy * totalDy > thresholdSq) setMode(MODES.ORBIT);
      }
      if (mode === MODES.ORBIT && (dx !== 0 || dy !== 0)) {
        callbacks.onOrbit({ dx, dy, pointerIds: [pointer.pointerId] });
      }
      return true;
    }

    function pointerUp(sample) {
      const normalized = normalizeSample(sample, false);
      const pointer = pointers.get(normalized.pointerId);
      if (!pointer) return false;

      pointer.previousX = pointer.x;
      pointer.previousY = pointer.y;
      pointer.x = normalized.x;
      pointer.y = normalized.y;

      const shouldTap = pointer.owner === 'canvas' && mode === MODES.TAP_CANDIDATE && !multiGestureLatched;
      pointers.delete(normalized.pointerId);

      const remainingCanvas = canvasPointers();
      if (multiGestureLatched) {
        previousMulti = null;
        if (remainingCanvas.length === 0) {
          multiGestureLatched = false;
          setMode(MODES.IDLE);
        } else {
          setMode(MODES.MULTI);
        }
      } else if (remainingCanvas.length === 0) {
        setMode(MODES.IDLE);
      }

      if (shouldTap) callbacks.onTap({ x: normalized.x, y: normalized.y, pointerId: normalized.pointerId });
      emitState();
      return true;
    }

    function cancelAll(reason = 'cancel') {
      if (pointers.size === 0 && mode === MODES.IDLE) return false;
      const pointerIds = [...pointers.keys()].sort((a, b) => a - b);
      pointers.clear();
      previousMulti = null;
      multiGestureLatched = false;
      mode = MODES.IDLE;
      callbacks.onCancel({ reason: String(reason || 'cancel'), pointerIds });
      emitState();
      return true;
    }

    return Object.freeze({
      pointerDown,
      pointerMove,
      pointerUp,
      cancelAll,
      snapshot
    });
  }

  return Object.freeze({ create, MODES });
});
