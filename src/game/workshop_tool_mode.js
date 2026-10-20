(() => {
  'use strict';
  window.VAW.define('game.workshop-tool-mode', [], () => {
    function create({ state, blocks, document, renderer, callbacks = {} } = {}) {
      const { onChanged = () => {}, onPartChanged = () => {}, hitBlock = () => null,
        onSelect = () => {}, onClear = () => {}, onHover = () => {},
        hidePlacementPreview = () => {} } = callbacks;
      let selecting = false;
      function syncButtons() {
        document.querySelectorAll('.tool-btn').forEach(button => {
          const active = selecting ? button.dataset.tool === 'Select' : button.dataset.tool === state.selectedBlock;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
      }
      function toggle(enabled = !selecting) {
        if (state.mode !== 'BUILD') return false;
        selecting = Boolean(enabled);
        syncButtons();
        onChanged();
        return true;
      }
      function setSelectedTool(tool) {
        if (state.mode !== 'BUILD' || !blocks[tool]) return;
        selecting = false;
        state.selectedBlock = tool;
        syncButtons();
        renderer.domElement.style.cursor = '';
        onPartChanged();
      }
      function renderHover(ndc) {
        if (!selecting) return false;
        hidePlacementPreview();
        const hit = hitBlock(ndc);
        onHover(hit);
        renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
        const feedback = document.getElementById('ui-adj');
        if (feedback) feedback.textContent = hit ? 'SELECT • ' + hit.block.type : 'SELECT • CLICK A PART';
        return true;
      }
      function interceptClick(button, ndc) {
        if (!selecting) return false;
        if (button === 0) {
          const hit = hitBlock(ndc);
          if (hit && hit.block && hit.block.blockId) onSelect(hit.block.blockId);
          else onClear();
        }
        return true;
      }
      function installButtons(container, hotbar) {
        const append = (button, action) => {
          button.addEventListener('click', action);
          container.appendChild(button);
          if (!hotbar) return;
          const twin = button.cloneNode(true);
          twin.classList.add('hotbar-tool-btn');
          twin.addEventListener('click', action);
          hotbar.appendChild(twin);
        };
        const select = document.createElement('button');
        select.type = 'button';
        select.dataset.tool = 'Select';
        select.classList.add('tool-btn');
        select.innerHTML = '<div class="w-6 h-6 rounded border border-sky-400/60 shrink-0 flex items-center justify-center text-sky-300">⌖</div>'
          + '<div class="min-w-0 flex-1"><div class="font-bold text-white leading-tight">Select / Inspect</div>'
          + '<div class="tool-description text-[10px] text-gray-400">Click to inspect; drag in its plane to move. No building or deleting.</div></div>'
          + '<div class="tool-shortcut text-[10px] font-mono text-slate-500">V</div>';
        append(select, () => toggle());
        const types = Object.keys(blocks);
        for (const name of types) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.tool = name;
          button.classList.add('tool-btn');
          const colorHex = '#' + blocks[name].color.toString(16).padStart(6, '0');
          const displayName = name.replace(/([a-z])([A-Z])/g, '$1 $2');
          const shortcut = name === 'Core' ? 0 : types.filter(type => type !== 'Core').indexOf(name) + 1;
          button.innerHTML = '<div class="w-6 h-6 rounded border border-white/30 shrink-0" style="background:' + colorHex + '"></div>'
            + '<div class="min-w-0 flex-1"><div class="font-bold text-white leading-tight">' + displayName + '</div>'
            + '<div class="tool-description text-[10px] text-gray-400">' + blocks[name].desc + '</div></div>'
            + '<div class="tool-shortcut text-[10px] font-mono text-slate-500">' + (shortcut <= 9 ? shortcut : '') + '</div>';
          append(button, () => setSelectedTool(name));
        }
        syncButtons();
      }
      return Object.freeze({ toggle, isSelecting: () => selecting, setSelectedTool, renderHover, interceptClick, installButtons });
    }
    return Object.freeze({ create });
  });
})();
