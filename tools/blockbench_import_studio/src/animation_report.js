(function (global, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.VAW_ANIMATION_REPORT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function collectNodeNames(gltfJson = {}) {
    return (gltfJson.nodes || []).map((node, index) => node.name || `node_${index}`);
  }

  function targetPathForChannel(gltfJson, channel = {}) {
    const target = channel.target || {};
    const node = Number.isInteger(target.node) ? (gltfJson.nodes || [])[target.node] : null;
    return {
      nodeIndex: Number.isInteger(target.node) ? target.node : null,
      nodeName: node ? (node.name || `node_${target.node}`) : null,
      property: target.path || 'unknown',
    };
  }

  function analyzeAnimations({ gltfJson = {}, runtimeClips = [] } = {}) {
    const nodeNames = collectNodeNames(gltfJson);
    const gltfAnimations = gltfJson.animations || [];
    const runtimeByName = new Map((runtimeClips || []).map((clip, index) => [clip.name || `clip_${index}`, clip]));
    const rows = gltfAnimations.map((animation, index) => {
      const name = animation.name || `clip_${index}`;
      const channels = animation.channels || [];
      const samplers = animation.samplers || [];
      const targets = channels.map(channel => targetPathForChannel(gltfJson, channel));
      const properties = [...new Set(targets.map(target => target.property))];
      const nodeSet = [...new Set(targets.map(target => target.nodeName).filter(Boolean))];
      const missingTargetChannels = targets.filter(target => target.nodeIndex !== null && !nodeNames[target.nodeIndex]).length;
      const runtimeClip = runtimeByName.get(name) || runtimeClips[index] || null;
      const trackCount = runtimeClip && runtimeClip.tracks ? runtimeClip.tracks.length : channels.length;
      const duration = runtimeClip && Number.isFinite(runtimeClip.duration) ? runtimeClip.duration : null;
      return {
        index,
        name,
        source: 'gltf+runtime',
        duration,
        channels: channels.length,
        samplers: samplers.length,
        trackCount,
        animatedNodes: nodeSet,
        animatedProperties: properties,
        missingTargetChannels,
        status: missingTargetChannels ? 'warning' : 'ok',
      };
    });

    if (!rows.length && runtimeClips && runtimeClips.length) {
      for (const [index, clip] of runtimeClips.entries()) {
        rows.push({
          index,
          name: clip.name || `clip_${index}`,
          source: 'runtime-only',
          duration: Number.isFinite(clip.duration) ? clip.duration : null,
          channels: 0,
          samplers: 0,
          trackCount: clip.tracks ? clip.tracks.length : 0,
          animatedNodes: [],
          animatedProperties: [],
          missingTargetChannels: 0,
          status: 'ok',
        });
      }
    }

    const unnamed = rows.filter(row => /^clip_\d+$/.test(row.name)).length;
    const warnings = [];
    if (unnamed) warnings.push({ severity: 'warning', code: 'animation.unnamedClips', message: `${unnamed} clip(s) do not have explicit names.` });
    for (const row of rows) {
      if (row.missingTargetChannels) warnings.push({ severity: 'warning', code: 'animation.missingTargets', message: `${row.name}: ${row.missingTargetChannels} channel target(s) do not resolve to glTF nodes.` });
    }

    return {
      schemaVersion: 1,
      summary: {
        clipCount: rows.length,
        totalChannels: rows.reduce((sum, row) => sum + row.channels, 0),
        totalTracks: rows.reduce((sum, row) => sum + row.trackCount, 0),
        warningCount: warnings.length,
      },
      clips: rows,
      warnings,
    };
  }

  return Object.freeze({ analyzeAnimations, collectNodeNames, targetPathForChannel });
});
