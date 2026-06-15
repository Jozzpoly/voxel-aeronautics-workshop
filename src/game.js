'use strict';

    const FOUNDATION = window.VAW_RUNTIME;
    if (!FOUNDATION) throw new Error('Foundation runtime was not initialized before game.js.');

    const { Config, Catalog, Orientation, Blueprint, ControlFrame, CraftCompiler, InputProfile, UIWorkspace, FlightControl, State } = FOUNDATION;
    const {
      GRID, SAVE_VERSION, SAVE_KEY, LEGACY_SAVE_KEYS,
      CAREER_SAVE_KEY, CAREER_SAVE_VERSION, UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS,
      NEIGHBOR_DIRECTIONS, COLLISION_GROUP, TEST_RANGE,
      MISSION_PAYLOAD_POSITION, PHYSICS, AXIS_LABELS,
      SYMMETRY_MODES, CONTROL_AXES, CONTROL_SIGNS
    } = Config;
    const { BLOCKS, CONTRACTS } = Catalog;
    const {
      AXES, ORIENTATION_BASES, DEFAULT_ORIENTATION,
      LEGACY_ORIENTATION_MAP, axisLabelForVector, findOrientationId
    } = Orientation;
    const STATE = State.createInitialState();
    const CRAFT = STATE.craft;
    const WORKSHOP = STATE.workshop;

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.FogExp2(0x0b1220, 0.014);

    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.66);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xcde8ff, 0x152238, 0.62);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(12, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    const gridHelper = new THREE.GridHelper(GRID.halfExtent * 2, GRID.halfExtent * 2, 0x3b4b66, 0x1c2940);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    const planeGeometry = new THREE.PlaneGeometry(GRID.halfExtent * 2, GRID.halfExtent * 2);
    planeGeometry.rotateX(-Math.PI / 2);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const basePlane = new THREE.Mesh(planeGeometry, planeMaterial);
    basePlane.position.y = -0.5;
    basePlane.userData.isBuildSurface = true;
    scene.add(basePlane);

    const comSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false })
    );
    comSphere.renderOrder = 999;
    comSphere.visible = false;
    scene.add(comSphere);

    const thrustSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, depthTest: false })
    );
    thrustSphere.renderOrder = 999;
    thrustSphere.visible = false;
    scene.add(thrustSphere);

    const liftSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, depthTest: false })
    );
    liftSphere.renderOrder = 999;
    liftSphere.visible = false;
    scene.add(liftSphere);

    const thrustVectorArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x3b82f6, 0.34, 0.22);
    const liftVectorArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x67e8f9, 0.34, 0.22);
    thrustVectorArrow.visible = false;
    liftVectorArrow.visible = false;
    scene.add(thrustVectorArrow, liftVectorArrow);

    const ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55 })
    );
    ghost.visible = false;
    scene.add(ghost);
    const symmetryGhosts = Array.from({ length: 3 }, () => {
      const preview = new THREE.Mesh(
        new THREE.BoxGeometry(1.01, 1.01, 1.01),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 })
      );
      preview.visible = false;
      scene.add(preview);
      return preview;
    });

    const ghostArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1.35, 0xfacc15, 0.4, 0.25);
    const ghostNormalArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1.05, 0x67e8f9, 0.32, 0.20);
    ghostArrow.visible = false;
    ghostNormalArrow.visible = false;
    scene.add(ghostArrow, ghostNormalArrow);

    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.y = -0.4;
    scene.add(axesHelper);

    const stars = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ size: 0.07, color: 0xcbd5e1, transparent: true, opacity: 0.6 })
    );
    {
      const starCount = 180;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 45 + Math.random() * 55;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.65;
        starPositions[i * 3 + 0] = Math.cos(theta) * Math.sin(phi) * r;
        starPositions[i * 3 + 1] = Math.cos(phi) * r + 18;
        starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
      }
      stars.geometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      scene.add(stars);
    }

    const world = new CANNON.World();
    world.gravity.set(0, -9.81, 0);
    world.broadphase = typeof CANNON.SAPBroadphase === 'function'
      ? new CANNON.SAPBroadphase(world)
      : new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    world.solver.tolerance = 0.0001;
    world.allowSleep = true;

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.collisionFilterGroup = COLLISION_GROUP.world;
    groundBody.collisionFilterMask = COLLISION_GROUP.craft | COLLISION_GROUP.debris;
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.y = -0.5;
    world.addBody(groundBody);

    const testRangeGroup = new THREE.Group();
    const missionMarkerGroup = new THREE.Group();
    scene.add(testRangeGroup, missionMarkerGroup);
    testRangeGroup.visible = false;
    missionMarkerGroup.visible = false;

    const rangeStaticBodies = [];
    function addRangeBox(size, position, color, emissive = 0x000000, collidable = false) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.08, emissive, emissiveIntensity: emissive ? 0.14 : 0 })
      );
      mesh.position.set(position.x, position.y, position.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      testRangeGroup.add(mesh);
      if (collidable) {
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5)));
        body.position.set(position.x, position.y, position.z);
        body.userData = { rangeObstacle: true };
        body.collisionFilterGroup = COLLISION_GROUP.world;
        body.collisionFilterMask = COLLISION_GROUP.craft | COLLISION_GROUP.debris;
        world.addBody(body);
        rangeStaticBodies.push(body);
        mesh.userData.rangeObstacle = true;
      }
      return mesh;
    }

    function addRangePad(position, radius, color) {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.18, 48),
        new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.22, emissive: color, emissiveIntensity: 0.06 })
      );
      pad.position.set(position.x, -0.39, position.z);
      pad.receiveShadow = true;
      testRangeGroup.add(pad);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.74, 0.22, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.7 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(position.x, -0.27, position.z);
      testRangeGroup.add(ring);
    }

    function createTestRangeEnvironment() {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(260, 190),
        new THREE.MeshStandardMaterial({ color: 0x15283a, roughness: 1, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.49;
      ground.receiveShadow = true;
      testRangeGroup.add(ground);

      addRangeBox({ x: 112, y: 0.12, z: 12 }, { x: 36, y: -0.40, z: 0 }, 0x334155);
      addRangeBox({ x: 108, y: 0.03, z: 0.22 }, { x: 36, y: -0.31, z: 0 }, 0xe2e8f0, 0x334155);
      for (let x = -12; x <= 86; x += 10) {
        addRangeBox({ x: 4.5, y: 0.035, z: 0.16 }, { x, y: -0.30, z: 0 }, 0xf8fafc);
      }
      addRangePad(TEST_RANGE.startPad, TEST_RANGE.startPad.radius, 0x155e75);
      addRangePad(TEST_RANGE.finishPad, TEST_RANGE.finishPad.radius, 0x166534);

      addRangeBox({ x: 15, y: 6, z: 15 }, { x: -16, y: 2.5, z: -18 }, 0x26364c, 0x000000, true);
      addRangeBox({ x: 8, y: 4, z: 9 }, { x: -5, y: 1.5, z: -18 }, 0x374151, 0x000000, true);
      addRangeBox({ x: 20, y: 1, z: 6 }, { x: -12, y: 0, z: 17 }, 0x475569, 0x000000, true);
      for (let i = 0; i < 14; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const x = 12 + i * 8;
        const z = side * (24 + (i % 3) * 7);
        const height = 3 + (i % 5) * 1.7;
        addRangeBox({ x: 3 + (i % 2), y: height, z: 3 + ((i + 1) % 3) }, { x, y: height / 2 - 0.45, z }, 0x26384d, 0x000000, true);
      }

      const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
      for (const pad of [TEST_RANGE.startPad, TEST_RANGE.finishPad]) {
        for (const side of [-1, 1]) {
          const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 8), beaconMaterial.clone());
          beacon.position.set(pad.x + side * pad.radius * 0.75, 3, pad.z);
          testRangeGroup.add(beacon);
        }
      }
    }
    createTestRangeEnvironment();

    const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = new Map();
    for (const [name, def] of Object.entries(BLOCKS)) {
      const emissive =
        name === 'Core' ? new THREE.Color(0x4c1d95) :
        name === 'Thruster' ? new THREE.Color(0x4c1d1d) :
        name === 'VectorThruster' ? new THREE.Color(0x3b1764) :
        name === 'Balloon' ? new THREE.Color(0x0f2f5f) :
        name === 'Wing' ? new THREE.Color(0x123f2b) :
        name === 'ControlSurface' ? new THREE.Color(0x083344) :
        name === 'Gyro' ? new THREE.Color(0x503404) :
        name === 'Fuel' ? new THREE.Color(0x4a3b00) :
        new THREE.Color(0x0b1220);

      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: name === 'Hull' ? 0.9 : (name === 'Frame' ? 0.58 : 0.68),
        metalness: name === 'Frame' ? 0.62 : (name === 'Core' ? 0.2 : 0.1),
        emissive,
        emissiveIntensity: name === 'Core' ? 0.38 : (name === 'Thruster' ? 0.12 : 0.04)
      });
      materials.set(name, mat);
    }

    function cloneMaterial(type) { return materials.get(type).clone(); }
    function makeKey(x, y, z) { return Blueprint.makeKey(x, y, z); }
    function snapInt(v) { return Math.round(v); }
    function isOverUI(target) { return !!(target && target.closest && (target.closest('#ui-layer') || target.closest('#help-modal') || target.closest('#debrief-modal'))); }
    function touchPointerCount() { return [...STATE.input.activePointers.values()].filter(p => p.pointerType === 'touch').length; }
    function distance2D(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function isMobileLayout() {
      return window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
    }


    function getContractById(id) { return Catalog.getContractById(id); }

    function isContractUnlocked(contract) {
      return !contract.prerequisite || Boolean(STATE.career.completed[contract.prerequisite]);
    }

    function getSelectedContract() {
      const selected = getContractById(STATE.career.selectedContractId);
      const fallback = CONTRACTS.find(contract => contract.id === 'hover_license') || CONTRACTS[0];
      return isContractUnlocked(selected) ? selected : fallback;
    }

    function knownContractIds() { return Catalog.knownContractIds(); }

    function normalizeCareerData(data) {
      const source = data && typeof data === 'object' ? data : {};
      const validIds = knownContractIds();
      const completed = {};
      const best = {};
      for (const contract of CONTRACTS) {
        if (contract.id === 'sandbox') continue;
        if (source.completed?.[contract.id] === true) completed[contract.id] = true;
        const rawBest = source.best?.[contract.id];
        if (!rawBest || typeof rawBest !== 'object') continue;
        const stars = THREE.MathUtils.clamp(Math.round(Number(rawBest.stars) || 0), 0, 3);
        const time = Math.max(0, Number(rawBest.time) || 0);
        const fuelFraction = THREE.MathUtils.clamp(Number(rawBest.fuelFraction) || 0, 0, 1);
        const integrity = THREE.MathUtils.clamp(Number(rawBest.integrity) || 0, 0, 100);
        if (stars > 0 && Number.isFinite(time)) best[contract.id] = { stars, time, fuelFraction, integrity };
      }
      let selectedContractId = typeof source.selectedContractId === 'string' && validIds.has(source.selectedContractId)
        ? source.selectedContractId
        : 'hover_license';
      const normalized = {
        credits: THREE.MathUtils.clamp(Number(source.credits) || 0, 0, 1_000_000_000),
        selectedContractId,
        completed,
        best,
        totalStars: 0
      };
      const selected = getContractById(selectedContractId);
      if (selected.prerequisite && !completed[selected.prerequisite]) normalized.selectedContractId = 'hover_license';
      normalized.totalStars = Object.values(best).reduce((sum, result) => sum + result.stars, 0);
      return normalized;
    }

    function careerRank() {
      const completedCount = CONTRACTS.filter(contract => contract.id !== 'sandbox' && STATE.career.completed[contract.id] === true).length;
      if (completedCount >= 4) return 'Chief Test Engineer';
      if (completedCount >= 3) return 'Senior Aeronaut';
      if (completedCount >= 2) return 'Flight Engineer';
      if (completedCount >= 1) return 'Licensed Apprentice';
      return 'Apprentice Engineer';
    }

    function recalculateCareerStars() {
      STATE.career.totalStars = CONTRACTS.reduce((sum, contract) => sum + Math.max(0, Number(STATE.career.best[contract.id]?.stars) || 0), 0);
    }

    function loadCareer() {
      try {
        const raw = localStorage.getItem(CAREER_SAVE_KEY);
        if (!raw) return;
        const normalized = normalizeCareerData(JSON.parse(raw));
        Object.assign(STATE.career, normalized);
      } catch (error) {
        console.warn('Career save could not be loaded:', error);
        Object.assign(STATE.career, normalizeCareerData(null));
      }
    }

    function saveCareer() {
      try {
        const normalized = normalizeCareerData(STATE.career);
        Object.assign(STATE.career, normalized);
        localStorage.setItem(CAREER_SAVE_KEY, JSON.stringify({
          version: CAREER_SAVE_VERSION,
          credits: STATE.career.credits,
          selectedContractId: STATE.career.selectedContractId,
          completed: STATE.career.completed,
          best: STATE.career.best
        }));
      } catch (error) {
        console.warn('Career save could not be written:', error);
      }
    }

    function readFirstStoredJSON(primaryKey, legacyKeys = []) {
      for (const key of [primaryKey, ...legacyKeys]) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) return JSON.parse(raw);
        } catch (error) {
          console.warn(`Stored preferences ${key} could not be read:`, error);
        }
      }
      return null;
    }

    function loadUIPreferences() {
      const parsed = readFirstStoredJSON(UI_SAVE_KEY, LEGACY_UI_SAVE_KEYS);
      if (!parsed) return;
      STATE.input.profile = InputProfile.normalize(parsed.inputProfile);
      STATE.uiWorkspace = UIWorkspace.normalize(parsed.workspace);
      if (typeof parsed.contractPanelCollapsed === 'boolean' && !parsed.workspace) {
        STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, 'contracts', { open: !parsed.contractPanelCollapsed });
      }
      STATE.contractPanelCollapsed = !STATE.uiWorkspace.panels.contracts.open;
    }

    function saveUIPreferences() {
      try {
        localStorage.setItem(UI_SAVE_KEY, JSON.stringify({
          version: 2,
          inputProfile: STATE.input.profile,
          workspace: STATE.uiWorkspace,
          contractPanelCollapsed: !STATE.uiWorkspace.panels.contracts.open
        }));
      } catch (error) {
        console.warn('UI preferences could not be written:', error);
      }
    }

    function panelElement(panelId) {
      return document.querySelector(`[data-workspace-panel="${panelId}"]`);
    }

    function panelVisibleInCurrentMode(panelId) {
      if (STATE.uiCollapsed) return false;
      if (panelId === 'build' || panelId === 'contracts') return STATE.mode === 'BUILD';
      return true;
    }

    function resolvePanelLeft(panel, width) {
      return panel.x < 0 ? Math.max(8, width + panel.x) : panel.x;
    }

    function applyWorkspaceLayout() {
      const viewportWidth = Math.max(320, window.innerWidth || 1280);
      const viewportHeight = Math.max(320, window.innerHeight || 720);
      for (const panelId of UIWorkspace.PANEL_IDS) {
        const element = /** @type {HTMLElement|null} */ (panelElement(panelId));
        const panel = STATE.uiWorkspace.panels[panelId];
        if (!element || !panel) continue;
        const visible = panel.open && panelVisibleInCurrentMode(panelId);
        element.hidden = !visible;
        element.classList.toggle('workspace-panel-minimized', panel.minimized);
        if (visible && !isMobileLayout()) {
          const width = Math.min(panel.width, viewportWidth - 16);
          const height = Math.min(panel.height, viewportHeight - 80);
          element.style.width = `${width}px`;
          element.style.height = panel.minimized ? 'auto' : `${height}px`;
          element.style.left = `${Math.min(Math.max(8, resolvePanelLeft(panel, viewportWidth - width)), viewportWidth - width - 8)}px`;
          element.style.top = `${Math.min(Math.max(56, panel.y), viewportHeight - 80)}px`;
        } else {
          element.style.removeProperty('width');
          element.style.removeProperty('height');
          element.style.removeProperty('left');
          element.style.removeProperty('top');
        }
        document.querySelectorAll(`[data-panel-toggle="${panelId}"]`).forEach(button => {
          button.classList.toggle('active', visible);
          button.setAttribute('aria-pressed', String(visible));
        });
      }
      STATE.contractPanelCollapsed = !STATE.uiWorkspace.panels.contracts.open;
      const openButton = document.getElementById('btn-contract-panel-open');
      if (openButton) openButton.hidden = STATE.uiWorkspace.panels.contracts.open || STATE.mode !== 'BUILD' || STATE.uiCollapsed;
    }

    function updateWorkspacePanel(panelId, patch, persist = true) {
      STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, patch);
      applyWorkspaceLayout();
      if (persist) saveUIPreferences();
    }

    function setWorkspacePanelOpen(panelId, open, persist = true) {
      updateWorkspacePanel(panelId, { open: Boolean(open), minimized: false }, persist);
    }

    function syncContractPanelVisibility() {
      applyWorkspaceLayout();
      const label = document.getElementById('ui-contract-trigger-label');
      if (label) {
        const contract = getSelectedContract();
        label.textContent = contract.id === 'sandbox' ? 'SANDBOX' : contract.title.replace(/^\d+\s*•\s*/, '').toUpperCase();
      }
    }

    function setContractPanelCollapsed(collapsed, persist = true) {
      setWorkspacePanelOpen('contracts', !Boolean(collapsed), persist);
    }

    function toggleContractPanel() {
      if (STATE.mode !== 'BUILD' || STATE.uiCollapsed) return;
      setWorkspacePanelOpen('contracts', !STATE.uiWorkspace.panels.contracts.open);
    }

    function resetWorkspaceLayout() {
      STATE.uiWorkspace = UIWorkspace.createDefault();
      applyWorkspaceLayout();
      saveUIPreferences();
      showStatus('WORKSPACE RESET', 1100);
    }

    function bindWorkspacePanels() {
      document.querySelectorAll('[data-panel-toggle]').forEach(button => {
        button.addEventListener('click', () => {
          const panelId = button.getAttribute('data-panel-toggle');
          if (!panelId) return;
          setWorkspacePanelOpen(panelId, !STATE.uiWorkspace.panels[panelId]?.open);
        });
      });
      document.querySelectorAll('[data-panel-close]').forEach(button => {
        button.addEventListener('click', () => setWorkspacePanelOpen(button.getAttribute('data-panel-close'), false));
      });
      document.querySelectorAll('[data-panel-minimize]').forEach(button => {
        button.addEventListener('click', () => {
          const panelId = button.getAttribute('data-panel-minimize');
          updateWorkspacePanel(panelId, { minimized: !STATE.uiWorkspace.panels[panelId]?.minimized });
        });
      });
      document.getElementById('btn-workspace-reset')?.addEventListener('click', resetWorkspaceLayout);

      document.querySelectorAll('.workspace-panel-handle').forEach(handle => {
        const element = /** @type {HTMLElement|null} */ (handle.closest('[data-workspace-panel]'));
        const panelId = element?.getAttribute('data-workspace-panel');
        if (!element || !panelId) return;
        handle.addEventListener('pointerdown', event => {
          if (isMobileLayout() || event.button !== 0 || event.target.closest('button')) return;
          event.preventDefault();
          const startX = event.clientX;
          const startY = event.clientY;
          const rect = element.getBoundingClientRect();
          try { handle.setPointerCapture(event.pointerId); } catch (_) {}
          const move = moveEvent => {
            element.style.left = `${Math.max(8, rect.left + moveEvent.clientX - startX)}px`;
            element.style.top = `${Math.max(56, rect.top + moveEvent.clientY - startY)}px`;
          };
          const end = () => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
            const finalRect = element.getBoundingClientRect();
            updateWorkspacePanel(panelId, { x: finalRect.left, y: finalRect.top, width: finalRect.width, height: finalRect.height });
          };
          handle.addEventListener('pointermove', move);
          handle.addEventListener('pointerup', end);
          handle.addEventListener('pointercancel', end);
        });
      });

      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            const element = entry.target;
            const panelId = element.getAttribute('data-workspace-panel');
            if (!panelId || element.hidden || isMobileLayout() || STATE.uiWorkspace.panels[panelId]?.minimized) continue;
            const rect = element.getBoundingClientRect();
            STATE.uiWorkspace = UIWorkspace.updatePanel(STATE.uiWorkspace, panelId, { width: rect.width, height: rect.height });
          }
        });
        document.querySelectorAll('[data-workspace-panel]').forEach(panel => observer.observe(panel));
      }
      bindInputProfileControls();
    }

    function axisLabelFromArray(vector) {
      const values = Array.isArray(vector) ? vector : [0, 0, 0];
      let best = 0;
      for (let index = 1; index < values.length; index += 1) {
        if (Math.abs(values[index]) > Math.abs(values[best])) best = index;
      }
      const labels = ['X', 'Y', 'Z'];
      return `${values[best] >= 0 ? '+' : '-'}${labels[best]}`;
    }

    function syncControlFrameReadout() {
      const compiled = STATE.flight.compiled || CraftCompiler.compile(CRAFT);
      const frame = compiled.controlFrame || ControlFrame.fromCore(null);
      const readout = document.getElementById('ui-control-frame');
      if (readout) {
        readout.textContent = `Forward ${axisLabelFromArray(frame.forward)} • Up ${axisLabelFromArray(frame.up)} • Right ${axisLabelFromArray(frame.right)}`;
      }
    }

    function syncInputProfileUI() {
      STATE.input.profile = InputProfile.normalize(STATE.input.profile);
      for (const axis of InputProfile.AXES) {
        const settings = STATE.input.profile.axes[axis];
        const invert = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-invert-${axis}`));
        const sensitivity = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-sensitivity-${axis}`));
        const value = document.getElementById(`input-sensitivity-${axis}-value`);
        if (invert) invert.checked = settings.invert;
        if (sensitivity) sensitivity.value = String(Math.round(settings.sensitivity * 100));
        if (value) value.textContent = `${settings.sensitivity.toFixed(2)}×`;
      }
      syncControlFrameReadout();
    }

    function updateInputAxis(axis, patch) {
      STATE.input.profile = InputProfile.updateAxis(STATE.input.profile, axis, patch);
      recomputePilotAxes();
      syncInputProfileUI();
      saveUIPreferences();
    }

    function bindInputProfileControls() {
      for (const axis of InputProfile.AXES) {
        const invert = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-invert-${axis}`));
        const sensitivity = /** @type {HTMLInputElement|null} */ (document.getElementById(`input-sensitivity-${axis}`));
        invert?.addEventListener('change', () => updateInputAxis(axis, { invert: invert.checked }));
        sensitivity?.addEventListener('input', () => updateInputAxis(axis, { sensitivity: Number(sensitivity.value) / 100 }));
      }
      document.getElementById('btn-input-profile-reset')?.addEventListener('click', () => {
        STATE.input.profile = InputProfile.createDefault();
        recomputePilotAxes();
        syncInputProfileUI();
        saveUIPreferences();
        showStatus('CONTROL PROFILE RESET', 1100);
      });
      syncInputProfileUI();
    }

    function formatMissionTime(seconds) {
      const safe = Math.max(0, Math.floor(Number(seconds) || 0));
      const minutes = Math.floor(safe / 60);
      return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
    }

    function contractReadiness(contract, analysis = computeCraftAnalysis()) {
      if (contract.id === 'sandbox') return { level: 'good', text: 'Sandbox ignores mission constraints. Launch whenever the craft is physically valid.' };
      const loadedSnapshot = buildLoadedSnapshot(analysis.snapshot, contract.payloadMass || 0);
      const loadedControls = computeControlMetrics(loadedSnapshot);
      const effectiveWeight = loadedSnapshot.weight;
      const staticRatio = effectiveWeight > 0 ? analysis.staticLift / effectiveWeight : 0;
      const cruiseRatio = effectiveWeight > 0 ? analysis.cruiseLift / effectiveWeight : 0;
      const minimumControl = Math.min(loadedControls.controlRating.pitch, loadedControls.controlRating.yaw, loadedControls.controlRating.roll);
      const messages = [];
      let level = 'good';
      if (analysis.counts.Thruster + analysis.counts.VectorThruster + analysis.counts.Balloon === 0) { messages.push('No powered lift or propulsion.'); level = 'bad'; }
      if (analysis.fuelCapacity <= 0) { messages.push('No fuel reserve.'); level = 'bad'; }
      if (analysis.blockCount > PHYSICS.maxFlightParts) { messages.push(`This prototype flight solver supports up to ${PHYSICS.maxFlightParts} attached modules; this craft has ${analysis.blockCount}.`); level = 'bad'; }
      if (contract.kind === 'hover-return' && staticRatio < 1.02) { messages.push(`Loaded static lift is only ${staticRatio.toFixed(2)}× weight.`); level = staticRatio < 0.75 ? 'bad' : 'warn'; }
      if ((contract.kind === 'gate-course' || contract.kind === 'courier') && analysis.counts.Thruster + analysis.counts.VectorThruster <= 0) { messages.push('The route requires controllable propulsion.'); level = 'bad'; }
      if ((contract.kind === 'gate-course' || contract.kind === 'courier') && minimumControl < 0.12) { messages.push(`Loaded control authority falls to ${Math.round(minimumControl * 100)}% on the weakest axis.`); if (level !== 'bad') level = 'warn'; }
      if ((contract.kind === 'gate-course' || contract.kind === 'courier') && cruiseRatio < 0.75 && staticRatio < 0.9) { messages.push(`Loaded cruise lift is ${cruiseRatio.toFixed(2)}× weight.`); if (level !== 'bad') level = 'warn'; }
      if (contract.minFuelFraction) {
        const usableEndurance = analysis.enduranceSeconds * (1 - contract.minFuelFraction);
        const expectedDuration = contract.parTime || contract.timeLimit * 0.65;
        if (usableEndurance < expectedDuration) { messages.push(`Only ${formatDuration(usableEndurance)} estimated endurance is available before the required reserve.`); if (level !== 'bad') level = 'warn'; }
      }
      if (!messages.length) messages.push(`Loaded mass ${loadedSnapshot.mass.toFixed(1)} kg. Payload-adjusted balance and control appear suitable.`);
      return { level, text: messages.join(' '), loadedSnapshot, loadedControls, staticRatio, cruiseRatio };
    }

    function loadStarterCraft() {
      if (STATE.mode !== 'BUILD') return;
      const previous = collectBlueprint();
      cleanupFlightState();
      const upOrientation = findOrientationId(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
      /** @type {Array<[number, number, number, string, number]>} */
      const blocks = [
        [0,0,0,'Core',DEFAULT_ORIENTATION],
        [1,0,0,'Hull',DEFAULT_ORIENTATION],[-1,0,0,'Hull',DEFAULT_ORIENTATION],
        [0,0,1,'Hull',DEFAULT_ORIENTATION],[0,0,-1,'Hull',DEFAULT_ORIENTATION],
        [2,0,0,'Thruster',upOrientation],[-2,0,0,'Thruster',upOrientation],
        [0,0,2,'Thruster',upOrientation],[0,0,-2,'Thruster',upOrientation],
        [1,1,0,'VectorThruster',upOrientation],[-1,1,0,'VectorThruster',upOrientation],
        [0,1,1,'VectorThruster',upOrientation],[0,1,-1,'VectorThruster',upOrientation],
        [0,1,0,'Fuel',DEFAULT_ORIENTATION],[0,2,0,'Fuel',DEFAULT_ORIENTATION],
        [1,1,1,'Gyro',DEFAULT_ORIENTATION],[-1,1,-1,'Gyro',DEFAULT_ORIENTATION]
      ];
      const replacement = CRAFT.replace(blocks.map(([x, y, z, type, orientation]) => ({
        x, y, z, type, orientation, controlAxis: 'pitch', controlSign: 0
      })), 'load-starter-craft');
      if (!replacement.ok) {
        showStatus(`STARTER LOAD FAILED: ${replacement.reason}`, 1800);
        return;
      }
      STATE.selectedBlock = 'Hull';
      STATE.orientation = DEFAULT_ORIENTATION;
      STATE.symmetry = 'NONE';
      STATE.thrusterPower = 1;
      STATE.balloonPower = 0.7;
      STATE.stabilityAssist = 0.65;
      /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = '100';
      /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = '70';
      /** @type {HTMLInputElement} */ (document.getElementById('stability')).value = '65';
      document.querySelectorAll('.tool-btn').forEach(element => {
        const button = /** @type {HTMLElement} */ (element);
        button.classList.toggle('active', button.dataset.tool === STATE.selectedBlock);
      });
      commitHistory(previous);
      updateTelemetry();
      autoSave(false, true);
      showStatus('STARTER VTOL LOADED', 1200);
    }

    function renderContractPanel() {
      const list = document.getElementById('contract-list');
      if (!list) return;
      list.innerHTML = '';
      for (const contract of CONTRACTS) {
        const unlocked = isContractUnlocked(contract);
        const best = STATE.career.best[contract.id];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `contract-card${STATE.career.selectedContractId === contract.id ? ' active' : ''}${unlocked ? '' : ' locked'}`;
        button.disabled = !unlocked;
        const safeStars = best ? THREE.MathUtils.clamp(Math.round(Number(best.stars) || 0), 0, 3) : 0;
        const stars = best ? `${'★'.repeat(safeStars)}${'☆'.repeat(3 - safeStars)}` : '☆☆☆';
        button.innerHTML = `<div class="contract-card-top"><span class="contract-card-title">${contract.title}</span><span class="contract-stars">${contract.id === 'sandbox' ? 'FREE' : stars}</span></div><div class="contract-card-meta">${unlocked ? contract.short : `Locked • Complete ${getContractById(contract.prerequisite).title}`}</div>`;
        button.addEventListener('click', () => selectContract(contract.id));
        list.appendChild(button);
      }

      const contract = getSelectedContract();
      document.getElementById('ui-credits').textContent = String(Math.round(STATE.career.credits));
      document.getElementById('ui-total-stars').textContent = String(STATE.career.totalStars);
      document.getElementById('ui-career-rank').textContent = careerRank();
      document.getElementById('ui-contract-title').textContent = contract.title;
      document.getElementById('ui-contract-subtitle').textContent = contract.short;
      document.getElementById('ui-contract-reward').textContent = `${contract.reward} cr`;
      document.getElementById('ui-contract-description').textContent = contract.description;
      document.getElementById('ui-contract-time').textContent = contract.timeLimit ? formatMissionTime(contract.timeLimit) : '—';
      document.getElementById('ui-contract-payload').textContent = `${contract.payloadMass || 0} kg`;
      const objectives = document.getElementById('ui-contract-objectives');
      objectives.innerHTML = contract.objectives.map(objective => `<div class="objective-line">${objective}</div>`).join('');
      const readiness = contractReadiness(contract);
      const readinessEl = document.getElementById('ui-contract-readiness');
      readinessEl.className = `contract-readiness mt-3 ${readiness.level}`;
      readinessEl.textContent = readiness.text;
      const flightButton = document.getElementById('btn-flight');
      if (flightButton && STATE.mode === 'BUILD') flightButton.textContent = contract.id === 'sandbox' ? 'Launch Sandbox Test' : `Launch ${contract.title.replace(/^\d+\s*•\s*/, '')}`;
    }

    function selectContract(id) {
      if (STATE.mode !== 'BUILD') return;
      const contract = getContractById(id);
      if (!isContractUnlocked(contract)) return;
      STATE.career.selectedContractId = contract.id;
      saveCareer();
      renderContractPanel();
      updateHUD();
    }

    function clearMissionMarkers() {
      for (const child of [...missionMarkerGroup.children]) {
        missionMarkerGroup.remove(child);
        disposeObjectTree(child);
      }
      STATE.mission.markers = [];
    }

    function createGateMarker(gate, index) {
      const root = new THREE.Group();
      root.position.set(gate.x, gate.y, gate.z);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(gate.radius, 0.28, 12, 56),
        new THREE.MeshBasicMaterial({ color: index === 0 ? 0x38bdf8 : 0x64748b, transparent: true, opacity: index === 0 ? 0.9 : 0.34 })
      );
      ring.rotation.y = Math.PI / 2;
      root.add(ring);
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(gate.radius * 0.72, 0.08, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.24 })
      );
      inner.rotation.y = Math.PI / 2;
      root.add(inner);
      missionMarkerGroup.add(root);
      STATE.mission.markers.push({ type: 'gate', root, ring, index });
    }

    function createLandingMarker(zone, label) {
      const root = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(zone.radius * 0.82, 0.3, 12, 56),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.75 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(zone.x, -0.16, zone.z);
      root.add(ring);
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 18, 8),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.26 })
      );
      beacon.position.set(zone.x, 8.5, zone.z);
      root.add(beacon);
      root.userData.label = label;
      missionMarkerGroup.add(root);
      STATE.mission.markers.push({ type: 'landing', root, ring, index: -1 });
    }

    function prepareMissionMarkers(contract) {
      clearMissionMarkers();
      if (contract.gates) contract.gates.forEach((gate, index) => createGateMarker(gate, index));
      if (contract.kind === 'gate-course' || contract.kind === 'courier') createLandingMarker(TEST_RANGE.finishPad, 'REMOTE PAD');
      if (contract.kind === 'hover-return') createLandingMarker(TEST_RANGE.startPad, 'LAUNCH PAD');
      missionMarkerGroup.visible = STATE.mode === 'FLIGHT';
    }

    function refreshMissionMarkerStates() {
      for (const marker of STATE.mission.markers) {
        if (marker.type !== 'gate') continue;
        const passed = marker.index < STATE.mission.gateIndex;
        const active = marker.index === STATE.mission.gateIndex;
        marker.ring.material.color.setHex(passed ? 0x34d399 : (active ? 0x38bdf8 : 0x64748b));
        marker.ring.material.opacity = passed ? 0.42 : (active ? 0.92 : 0.26);
        marker.root.scale.setScalar(active ? 1 + Math.sin(STATE.mission.elapsed * 3) * 0.035 : 1);
      }
    }

    function isDebriefVisible() {
      const modal = document.getElementById('debrief-modal');
      return Boolean(modal && !modal.hidden);
    }

    function setHelpVisible(visible) {
      const modal = document.getElementById('help-modal');
      modal.style.display = visible ? 'flex' : 'none';
      if (visible && STATE.mode === 'FLIGHT' && STATE.mission.status === 'ACTIVE' && !STATE.mission.paused) {
        STATE.mission.helpPaused = true;
        STATE.mission.paused = true;
        clearControlActions();
      } else if (!visible && STATE.mission.helpPaused) {
        STATE.mission.helpPaused = false;
        if (STATE.mission.status === 'ACTIVE') STATE.mission.paused = false;
      }
    }

    function gateNormalVector(gate) {
      const raw = gate.normal || { x: 1, y: 0, z: 0 };
      const normal = new THREE.Vector3(Number(raw.x) || 0, Number(raw.y) || 0, Number(raw.z) || 0);
      if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);
      return normal.normalize();
    }

    function segmentCrossesGate(previous, current, gate) {
      if (!previous || !current) return false;
      const center = new THREE.Vector3(gate.x, gate.y, gate.z);
      const normal = gateNormalVector(gate);
      const from = new THREE.Vector3(previous.x, previous.y, previous.z);
      const to = new THREE.Vector3(current.x, current.y, current.z);
      const startDistance = from.clone().sub(center).dot(normal);
      const endDistance = to.clone().sub(center).dot(normal);
      if (!(startDistance < 0 && endDistance >= 0)) return false;
      const denominator = startDistance - endDistance;
      if (Math.abs(denominator) < 1e-6) return false;
      const t = THREE.MathUtils.clamp(startDistance / denominator, 0, 1);
      const intersection = from.lerp(to, t);
      const radial = intersection.sub(center);
      radial.sub(normal.clone().multiplyScalar(radial.dot(normal)));
      return radial.length() <= gate.radius;
    }

    function isStableHover(contract) {
      const body = STATE.flight.body;
      if (!body) return false;
      const altitude = currentCraftAltitude();
      const target = Number(contract.targetAltitude) || 0;
      const horizontalSpeed = Math.hypot(body.velocity.x, body.velocity.z);
      return altitude >= target && altitude <= target + 6
        && Math.abs(body.velocity.y) <= 2.4
        && horizontalSpeed <= 5.5
        && craftTiltDegrees(body) <= 42;
    }

    function payloadHealthFraction() {
      const payload = STATE.flight.payload;
      return payload?.attached && payload.maxHealth > 0
        ? THREE.MathUtils.clamp(payload.health / payload.maxHealth, 0, 1)
        : 0;
    }

    function missionObjectiveText(contract) {
      const body = STATE.flight.body;
      if (contract.id === 'sandbox') return 'Free flight • F returns to workshop';
      if (contract.kind === 'hover-return') {
        if (STATE.mission.phase === 0) {
          const target = contract.targetAltitude;
          const altitude = currentCraftAltitude();
          return STATE.mission.holdTime > 0
            ? `Stabilize at ${target}–${target + 6} m • ${Math.max(0, contract.holdSeconds - STATE.mission.holdTime).toFixed(1)} s`
            : `Climb to ${target} m, slow down and level out • now ${altitude.toFixed(1)} m`;
        }
        const distance = body ? Math.hypot(body.position.x - TEST_RANGE.startPad.x, body.position.z - TEST_RANGE.startPad.z) : 0;
        return `Return and settle on the launch pad • ${distance.toFixed(0)} m`;
      }
      if (contract.gates && STATE.mission.gateIndex < contract.gates.length) {
        const gate = contract.gates[STATE.mission.gateIndex];
        const distance = body ? Math.hypot(body.position.x - gate.x, body.position.y - gate.y, body.position.z - gate.z) : 0;
        return `Pass gate ${STATE.mission.gateIndex + 1} of ${contract.gates.length} • ${distance.toFixed(0)} m`;
      }
      const distance = body ? Math.hypot(body.position.x - TEST_RANGE.finishPad.x, body.position.z - TEST_RANGE.finishPad.z) : 0;
      if (contract.kind === 'courier') return `Land remotely • ${distance.toFixed(0)} m • fuel ≥${Math.round(contract.minFuelFraction * 100)}% • cargo ≥${Math.round((contract.minPayloadIntegrity || 0) * 100)}%`;
      return `Land on the remote pad • ${distance.toFixed(0)} m`;
    }

    function missionProgress(contract) {
      if (contract.id === 'sandbox') return 0;
      if (contract.kind === 'hover-return') {
        if (STATE.mission.phase === 0) {
          const altitudeShare = 0.36;
          const holdShare = 0.26;
          const altitudeProgress = contract.targetAltitude > 0 ? THREE.MathUtils.clamp(currentCraftAltitude() / contract.targetAltitude, 0, 1) : 1;
          const holdProgress = contract.holdSeconds > 0 ? THREE.MathUtils.clamp(STATE.mission.holdTime / contract.holdSeconds, 0, 1) : 1;
          return altitudeProgress * altitudeShare + holdProgress * holdShare;
        }
        return 0.62 + Math.min(0.38, STATE.mission.landingHold / 1.6 * 0.38);
      }
      const gateCount = contract.gates?.length || 0;
      const routeShare = gateCount ? 0.72 : 0;
      return gateCount ? Math.min(routeShare, STATE.mission.gateIndex / gateCount * routeShare) + (STATE.mission.gateIndex >= gateCount ? Math.min(0.28, STATE.mission.landingHold / 1.6 * 0.28) : 0) : 0;
    }

    function updateMissionHud() {
      const hud = document.getElementById('mission-hud');
      if (!hud) return;
      const contract = getContractById(STATE.mission.contractId || STATE.career.selectedContractId);
      const visible = STATE.mode === 'FLIGHT' && Boolean(STATE.flight.body);
      hud.hidden = !visible;
      if (!visible) return;
      refreshMissionMarkerStates();
      document.getElementById('mission-hud-title').textContent = contract.title;
      document.getElementById('mission-hud-objective').textContent = missionObjectiveText(contract);
      document.getElementById('mission-hud-timer').textContent = contract.timeLimit
        ? `${formatMissionTime(STATE.mission.elapsed)} / ${formatMissionTime(contract.timeLimit)}`
        : formatMissionTime(STATE.mission.elapsed);
      const gateTotal = contract.gates?.length || 0;
      document.getElementById('mission-hud-progress').textContent = contract.kind === 'hover-return'
        ? (STATE.mission.phase === 0 ? 'ALTITUDE' : 'RECOVERY')
        : (gateTotal ? `${Math.min(STATE.mission.gateIndex, gateTotal)} / ${gateTotal} GATES` : 'FREE');
      document.getElementById('mission-hud-integrity').textContent = `${Math.round(STATE.flight.integrity)}%`;
      const fuelFraction = STATE.flight.fuelMax > 0 ? STATE.flight.fuel / STATE.flight.fuelMax : 0;
      document.getElementById('mission-hud-fuel').textContent = `${Math.round(fuelFraction * 100)}%`;
      document.getElementById('mission-hud-impact').textContent = `${STATE.mission.maxImpact.toFixed(1)} m/s`;
      document.getElementById('mission-hud-lost').textContent = String(STATE.flight.lostParts);
      document.getElementById('mission-hud-leak').textContent = `${STATE.flight.leakingFuelRate.toFixed(2)}/s`;
      const payloadReadout = document.getElementById('mission-hud-payload');
      if (payloadReadout) {
        payloadReadout.textContent = contract.payloadMass > 0
          ? (STATE.flight.payload?.attached ? `${Math.round(payloadHealthFraction() * 100)}%` : 'LOST')
          : '—';
      }
      document.getElementById('mission-progress-fill').style.width = `${Math.round(missionProgress(contract) * 100)}%`;
    }

    function craftTiltDegrees(body) {
      const up = body.vectorToWorldFrame(new CANNON.Vec3(0, 1, 0));
      return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.y / Math.max(0.0001, up.length()), -1, 1)));
    }

    function currentCraftAltitude() {
      const body = STATE.flight.body;
      if (!body) return 0;
      return Math.max(0, body.position.y + STATE.flight.lowestLocalY + 0.5);
    }

    function isCraftSettledAt(zone) {
      const body = STATE.flight.body;
      if (!body) return false;
      const dx = body.position.x - zone.x;
      const dz = body.position.z - zone.z;
      const horizontal = Math.hypot(dx, dz);
      const recentlyTouched = STATE.mission.elapsed - STATE.mission.lastGroundContact < 0.3;
      return horizontal <= zone.radius && recentlyTouched && body.velocity.length() < 2.4 && Math.abs(body.velocity.y) < 1.2 && craftTiltDegrees(body) < 28;
    }

    function startMissionSession() {
      const contract = getSelectedContract();
      STATE.mission.contractId = contract.id;
      STATE.mission.active = contract.id !== 'sandbox';
      STATE.mission.paused = false;
      STATE.mission.status = 'ACTIVE';
      STATE.mission.elapsed = 0;
      STATE.mission.phase = 0;
      STATE.mission.gateIndex = 0;
      STATE.mission.holdTime = 0;
      STATE.mission.landingHold = 0;
      STATE.mission.lastGroundContact = -Infinity;
      STATE.mission.maxAltitude = 0;
      STATE.mission.maxSpeed = 0;
      STATE.mission.maxImpact = 0;
      STATE.mission.startFuel = STATE.flight.fuel;
      STATE.mission.result = null;
      STATE.mission.previousPosition = STATE.flight.body ? STATE.flight.body.position.clone() : null;
      STATE.mission.helpPaused = false;
      prepareMissionMarkers(contract);
      document.getElementById('debrief-modal').hidden = true;
      updateMissionHud();
    }

    function calculateMissionStars(contract, success) {
      if (!success || contract.id === 'sandbox') return 0;
      let stars = 1;
      const fuelFraction = STATE.flight.fuelMax > 0 ? STATE.flight.fuel / STATE.flight.fuelMax : 0;
      const payloadFraction = contract.payloadMass > 0 ? payloadHealthFraction() : 1;
      if (STATE.flight.integrity >= 70 && payloadFraction >= Math.max(contract.minPayloadIntegrity || 0, 0.72) && (!contract.parTime || STATE.mission.elapsed <= contract.parTime * 1.25)) stars += 1;
      if (STATE.flight.integrity >= 92 && payloadFraction >= 0.92 && (!contract.parTime || STATE.mission.elapsed <= contract.parTime) && fuelFraction >= (contract.minFuelFraction || 0.18)) stars += 1;
      return Math.min(3, stars);
    }

    function showDebrief(result) {
      const modal = document.getElementById('debrief-modal');
      modal.hidden = false;
      document.getElementById('debrief-kicker').textContent = result.success ? 'CONTRACT COMPLETE' : 'FLIGHT TERMINATED';
      document.getElementById('debrief-title').textContent = result.title;
      document.getElementById('debrief-summary').textContent = result.summary;
      document.getElementById('debrief-stars').textContent = `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`;
      document.getElementById('debrief-time').textContent = formatMissionTime(result.elapsed);
      document.getElementById('debrief-fuel').textContent = `${Math.round(result.fuelFraction * 100)}%`;
      document.getElementById('debrief-integrity').textContent = `${Math.round(result.integrity)}%`;
      document.getElementById('debrief-impact').textContent = `${result.maxImpact.toFixed(1)} m/s`;
      document.getElementById('debrief-altitude').textContent = `${result.maxAltitude.toFixed(1)} m`;
      document.getElementById('debrief-reward').textContent = `${result.reward} cr`;
      document.getElementById('debrief-lost').textContent = String(result.lostParts);
      const payloadDebrief = document.getElementById('debrief-payload');
      if (payloadDebrief) {
        payloadDebrief.textContent = result.payloadRequired
          ? (result.payloadLost ? 'LOST' : `${Math.round(result.payloadIntegrity * 100)}%`)
          : '—';
      }
      document.getElementById('debrief-failure').textContent = result.firstFailure || 'No structural failure';
      document.getElementById('debrief-notes').textContent = result.notes;
      document.getElementById('btn-debrief-retry').hidden = result.contractId === 'sandbox';
    }

    function finishMission(success, reason = '') {
      if (STATE.mission.paused || STATE.mission.status !== 'ACTIVE') return;
      const contract = getContractById(STATE.mission.contractId);
      const fuelFraction = STATE.flight.fuelMax > 0 ? STATE.flight.fuel / STATE.flight.fuelMax : 0;
      if (success && contract.minFuelFraction && fuelFraction < contract.minFuelFraction) {
        success = false;
        reason = `Delivery reserve missed: ${Math.round(fuelFraction * 100)}% fuel remained.`;
      }
      const deliveredPayloadIntegrity = payloadHealthFraction();
      if (success && contract.payloadMass > 0 && deliveredPayloadIntegrity < (contract.minPayloadIntegrity || 0)) {
        success = false;
        reason = `Cargo integrity was only ${Math.round(deliveredPayloadIntegrity * 100)}%; the contract requires ${Math.round((contract.minPayloadIntegrity || 0) * 100)}%.`;
      }
      const stars = calculateMissionStars(contract, success);
      const firstCompletion = !STATE.career.completed[contract.id];
      const reward = success && contract.id !== 'sandbox' ? Math.round(contract.reward * (firstCompletion ? 1 : 0.25) + stars * 35) : 0;
      if (success && contract.id !== 'sandbox') {
        STATE.career.credits += reward;
        STATE.career.completed[contract.id] = true;
        const previous = STATE.career.best[contract.id];
        if (!previous || stars > previous.stars || (stars === previous.stars && STATE.mission.elapsed < previous.time)) {
          STATE.career.best[contract.id] = { stars, time: STATE.mission.elapsed, fuelFraction, integrity: STATE.flight.integrity };
        }
        recalculateCareerStars();
        saveCareer();
      }
      STATE.mission.status = success ? 'SUCCESS' : 'FAILED';
      STATE.mission.active = false;
      STATE.mission.paused = true;
      STATE.mission.helpPaused = false;
      clearControlActions();
      setStabilize(false);
      if (STATE.flight.body) {
        STATE.flight.body.velocity.set(0, 0, 0);
        STATE.flight.body.angularVelocity.set(0, 0, 0);
      }
      const result = {
        success, contractId: contract.id, stars, reward,
        elapsed: STATE.mission.elapsed,
        fuelFraction,
        integrity: STATE.flight.integrity,
        maxImpact: STATE.mission.maxImpact,
        maxAltitude: STATE.mission.maxAltitude,
        lostParts: STATE.flight.lostParts,
        payloadRequired: contract.payloadMass > 0,
        payloadIntegrity: deliveredPayloadIntegrity,
        payloadLost: contract.payloadMass > 0 && !STATE.flight.payload?.attached,
        firstFailure: STATE.flight.firstFailure,
        title: success ? `${contract.title} complete` : `${contract.title} failed`,
        summary: success ? 'The test objectives were completed and the flight data has been accepted by the workshop.' : (reason || 'The test ended before all objectives were completed.'),
        notes: success
          ? `${firstCompletion ? 'First completion reward awarded.' : 'Repeat-flight reward awarded at reduced rate.'} ${stars === 3 ? 'The machine met the workshop gold standard.' : 'Improve time, fuel reserve and landing quality to earn more stars.'}`
          : `Review the engineering analysis and impact speed before the next attempt.${STATE.flight.firstFailure ? ` First failure: ${STATE.flight.firstFailure}.` : ''}`
      };
      STATE.mission.result = result;
      showDebrief(result);
      renderContractPanel();
      updateMissionHud();
    }

    function updateMission(dt) {
      if (STATE.mission.status !== 'ACTIVE' || STATE.mission.paused || !STATE.flight.body) return;
      const contract = getContractById(STATE.mission.contractId);
      const body = STATE.flight.body;
      const currentPosition = body.position.clone();
      const previousPosition = STATE.mission.previousPosition || currentPosition.clone();
      STATE.mission.elapsed += dt;
      const altitude = currentCraftAltitude();
      const speed = body.velocity.length();
      STATE.mission.maxAltitude = Math.max(STATE.mission.maxAltitude, altitude);
      STATE.mission.maxSpeed = Math.max(STATE.mission.maxSpeed, speed);
      STATE.mission.maxImpact = Math.max(STATE.mission.maxImpact, STATE.flight.maxImpact || 0);

      const finishFrame = () => { STATE.mission.previousPosition = currentPosition; };
      if (Math.abs(body.position.x) > TEST_RANGE.bounds || Math.abs(body.position.z) > TEST_RANGE.bounds || body.position.y > 160) {
        finishFrame(); finishMission(false, 'The craft left the authorized test range.'); return;
      }
      if (STATE.flight.integrity <= 0) {
        finishFrame(); finishMission(false, 'Structural integrity reached zero.'); return;
      }
      if (contract.payloadMass > 0 && !STATE.flight.payload?.attached) {
        finishFrame(); finishMission(false, 'The contract payload was lost.'); return;
      }
      if (contract.timeLimit && STATE.mission.elapsed > contract.timeLimit) {
        finishFrame(); finishMission(false, 'The contract time limit expired.'); return;
      }
      if (contract.id === 'sandbox') { finishFrame(); return; }

      if (contract.kind === 'hover-return') {
        if (STATE.mission.phase === 0) {
          if (isStableHover(contract)) STATE.mission.holdTime += dt;
          else STATE.mission.holdTime = Math.max(0, STATE.mission.holdTime - dt * 1.8);
          if (STATE.mission.holdTime >= contract.holdSeconds) {
            STATE.mission.phase = 1;
            STATE.mission.landingHold = 0;
            showStatus('STABLE HOVER PASSED', 1400);
          }
        } else {
          if (isCraftSettledAt(TEST_RANGE.startPad)) STATE.mission.landingHold += dt;
          else STATE.mission.landingHold = 0;
          if (STATE.mission.landingHold >= 1.6) { finishFrame(); finishMission(true); return; }
        }
      } else {
        const gates = contract.gates || [];
        if (STATE.mission.gateIndex < gates.length) {
          const gate = gates[STATE.mission.gateIndex];
          if (segmentCrossesGate(previousPosition, currentPosition, gate)) {
            STATE.mission.gateIndex += 1;
            showStatus(`GATE ${STATE.mission.gateIndex} PASSED`, 1000);
          }
        } else {
          if (isCraftSettledAt(TEST_RANGE.finishPad)) STATE.mission.landingHold += dt;
          else STATE.mission.landingHold = 0;
          if (STATE.mission.landingHold >= 1.6) { finishFrame(); finishMission(true); return; }
        }
      }
      finishFrame();
    }

    function requestReturnToWorkshop() {
      if (STATE.mode !== 'FLIGHT') return;
      if (STATE.mission.status === 'ACTIVE' && STATE.mission.contractId !== 'sandbox') {
        finishMission(false, 'The test flight was aborted by the pilot.');
      } else {
        setMode('BUILD');
      }
    }

    function returnToWorkshopFromDebrief() {
      document.getElementById('debrief-modal').hidden = true;
      STATE.mission.paused = false;
      STATE.mission.helpPaused = false;
      setMode('BUILD');
    }

    function retryContractFromDebrief() {
      document.getElementById('debrief-modal').hidden = true;
      STATE.mission.paused = false;
      STATE.mission.helpPaused = false;
      setMode('BUILD');
      setMode('FLIGHT');
    }

    function recomputePilotAxes() {
      const intent = FlightControl.pilotFromActions(STATE.input.controlActions, STATE.input.profile);
      Object.assign(STATE.controlIntent, intent);
      const compiled = STATE.flight.compiled || CraftCompiler.compile(CRAFT);
      const bodyPilot = FlightControl.pilotToBodyFrame(intent, compiled.controlFrame);
      STATE.pilot.pitch = bodyPilot.pitch;
      STATE.pilot.yaw = bodyPilot.yaw;
      STATE.pilot.roll = bodyPilot.roll;
      STATE.pilot.surge = bodyPilot.surge;
      STATE.pilot.sway = bodyPilot.sway;
      STATE.pilot.lift = bodyPilot.lift;
      updateFlightFeedback();
    }

    function setControlAction(action, active) {
      if (active) STATE.input.controlActions.add(action);
      else STATE.input.controlActions.delete(action);
      recomputePilotAxes();
    }

    function clearControlActions() {
      STATE.input.controlActions.clear();
      STATE.pilot.pitch = 0;
      STATE.pilot.yaw = 0;
      STATE.pilot.roll = 0;
      STATE.pilot.surge = 0;
      STATE.pilot.lift = 0;
      STATE.pilot.sway = 0;
      for (const axis of InputProfile.AXES) STATE.controlIntent[axis] = 0;
      document.querySelectorAll('.hold-btn.active').forEach(button => button.classList.remove('active'));
      updateFlightFeedback();
    }

    function updateFlightFeedback() {
      const body = STATE.flight.body;
      const speed = body ? Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2 + body.velocity.z ** 2) : 0;
      const pitch = STATE.controlIntent.pitch || 0;
      const yaw = STATE.controlIntent.yaw || 0;
      const roll = STATE.controlIntent.roll || 0;
      const surge = STATE.controlIntent.surge || 0;
      const sway = STATE.controlIntent.sway || 0;
      const liftCommand = STATE.controlIntent.lift || 0;

      let tiltDegrees = 0;
      if (body) {
        const attitude = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        const worldUp = new THREE.Vector3(0, 1, 0);
        const craftUp = worldUp.clone().applyQuaternion(attitude).normalize();
        tiltDegrees = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(craftUp.dot(worldUp), -1, 1)));
      }

      const setBar = (id, value) => {
        const bar = document.getElementById(id);
        if (!bar) return;
        const normalized = THREE.MathUtils.clamp(value, -1, 1);
        const positive = normalized >= 0;
        const abs = Math.abs(normalized);
        bar.style.left = positive ? '50%' : `${50 - abs * 50}%`;
        bar.style.width = `${abs * 50}%`;
      };

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };

      setText('ui-speed', `${speed.toFixed(1)} m/s`);
      setText('ui-altitude', body ? `${currentCraftAltitude().toFixed(1)} m` : '0.0 m');
      setText('ui-vertical-speed', body ? `${body.velocity.y >= 0 ? '+' : ''}${body.velocity.y.toFixed(1)} m/s` : '0.0 m/s');
      const loads = STATE.flight.lastLoads || { lift: 0, drag: 0, thrust: 0, impact: 0 };
      setText('ui-loads', `${Math.round(loads.thrust)} / ${Math.round(loads.lift)} / ${Math.round(loads.drag)} N`);
      const payloadText = STATE.flight.payload?.attached ? ` • cargo ${Math.round(payloadHealthFraction() * 100)}%` : (STATE.flight.payload ? ' • cargo lost' : '');
      setText('ui-damage-status', STATE.mode === 'FLIGHT' ? `${STATE.flight.lostParts} lost • ${STATE.flight.leakingFuelRate.toFixed(2)}/s leak${payloadText}` : 'No active damage');
      if (body && STATE.mode === 'FLIGHT') {
        setText('ui-fuel', `${Math.max(0, Math.round(STATE.flight.fuel))} / ${Math.max(0, Math.round(STATE.flight.fuelMax))}`);
      }
      setText('ui-pitch-value', `${Math.round(pitch * 100)}%`);
      setText('ui-yaw-value', `${Math.round(yaw * 100)}%`);
      setText('ui-roll-value', `${Math.round(roll * 100)}%`);
      setText('ui-surge-value', `${Math.round(surge * 100)}%`);
      setText('ui-lift-command-value', `${Math.round(liftCommand * 100)}%`);
      setText('ui-sway-value', `${Math.round(sway * 100)}%`);
      setText('ui-pitch-readout', Math.round(pitch * 100));
      setText('ui-yaw-readout', Math.round(yaw * 100));
      setText('ui-roll-readout', Math.round(roll * 100));
      setText('ui-surge-readout', Math.round(surge * 100));
      setText('ui-lift-command-readout', Math.round(liftCommand * 100));
      setText('ui-sway-readout', Math.round(sway * 100));
      setText('ui-angle-readout', `${Math.round(tiltDegrees)}°`);

      setBar('ui-pitch-bar', pitch);
      setBar('ui-yaw-bar', yaw);
      setBar('ui-roll-bar', roll);
      setBar('ui-surge-bar', surge);
      setBar('ui-lift-command-bar', liftCommand);
      setBar('ui-sway-bar', sway);

      const stabBtn = document.getElementById('btn-stabilize');
      if (stabBtn) stabBtn.classList.toggle('active', STATE.pilot.stabilize);

      const flightPanel = document.getElementById('mobile-flight-controls');
      const buildPanel = document.getElementById('mobile-build-controls');
      if (flightPanel && buildPanel) {
        const mobile = isMobileLayout();
        flightPanel.style.display = mobile && STATE.mode === 'FLIGHT' ? 'flex' : 'none';
        buildPanel.style.display = mobile && STATE.mode === 'BUILD' ? 'flex' : 'none';
      }
      updateMissionHud();
    }

    function clearPilotAxes() {
      clearControlActions();
    }

    function setStabilize(enabled) {
      STATE.pilot.stabilize = !!enabled;
      updateFlightFeedback();
    }

    let statusToastToken = 0;
    function showStatus(text, duration = 1000) {
      const token = ++statusToastToken;
      const previous = STATE.statusText;
      STATE.statusText = text;
      updateHUD();
      if (duration > 0) {
        setTimeout(() => {
          if (token !== statusToastToken || STATE.statusText !== text) return;
          STATE.statusText = previous || (STATE.mode === 'BUILD' ? 'DRYDOCK' : 'IN FLIGHT');
          updateHUD();
        }, duration);
      }
    }

    function cancelStatusToast() {
      statusToastToken += 1;
    }

    function updateHUD() {
      const modeChip = document.getElementById('ui-mode');
      modeChip.textContent = STATE.mode;
      modeChip.className = STATE.mode === 'BUILD' ? 'chip text-amber-300' : 'chip text-emerald-300';

      const statusEl = document.getElementById('ui-status');
      const defaultStatus = STATE.mode === 'BUILD' ? 'DRYDOCK' : 'IN FLIGHT';
      const statusText = STATE.statusText || defaultStatus;
      statusEl.textContent = statusText;
      statusEl.className = statusText.includes('INVALID') || statusText.includes('ERROR') || statusText.includes('CRITICAL') || statusText.includes('SEVERE') || statusText.includes('OUT OF FUEL')
        ? 'font-bold text-rose-400'
        : (statusText.includes('WARNING') || statusText.includes('HARD')
          ? 'font-bold text-amber-300'
          : (STATE.mode === 'BUILD' ? 'font-bold text-yellow-500' : 'font-bold text-emerald-400'));
      const orientationRelevant = partUsesOrientation(STATE.selectedBlock);
      document.getElementById('ui-orientation').textContent = orientationRelevant ? axisLabelForVector(getOrientationVector(STATE.orientation)) : 'N/A';
      const rollRelevant = partUsesRoll(STATE.selectedBlock);
      const rollReadout = document.getElementById('ui-roll-orientation');
      if (rollReadout) rollReadout.textContent = rollRelevant ? axisLabelForVector(getOrientationUpVector(STATE.orientation)) : 'N/A';
      document.getElementById('ui-symmetry').textContent = STATE.symmetry;
      document.getElementById('ui-thruster-power').textContent = `${Math.round(STATE.thrusterPower * 100)}%`;
      document.getElementById('ui-balloon-power').textContent = `${Math.round(STATE.balloonPower * 100)}%`;
      document.getElementById('ui-stability').textContent = `${Math.round(STATE.stabilityAssist * 100)}%`;
      document.getElementById('ui-touch-action').textContent = STATE.input.touchAction.toUpperCase();

      const buildButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-build'));
      const flightButton = /** @type {HTMLButtonElement} */ (document.getElementById('btn-flight'));
      buildButton.disabled = STATE.mode === 'BUILD';
      flightButton.disabled = STATE.mode === 'FLIGHT';
      buildButton.textContent = STATE.mission.status === 'ACTIVE' && STATE.mission.contractId !== 'sandbox' ? 'Abort Contract' : 'Return to Drydock';
      if (STATE.mode === 'BUILD') {
        const contract = getSelectedContract();
        flightButton.textContent = contract.id === 'sandbox' ? 'Launch Sandbox Test' : `Launch ${contract.title.replace(/^\d+\s*•\s*/, '')}`;
      }
      document.getElementById('btn-symmetry').textContent = `SYMMETRY: ${STATE.symmetry}`;

      const touchPlace = document.getElementById('btn-touch-place');
      const touchRemove = document.getElementById('btn-touch-remove');
      if (touchPlace && touchRemove) {
        touchPlace.classList.toggle('ring-2', STATE.input.touchAction === 'place');
        touchPlace.classList.toggle('ring-blue-300', STATE.input.touchAction === 'place');
        touchRemove.classList.toggle('ring-2', STATE.input.touchAction === 'remove');
        touchRemove.classList.toggle('ring-rose-300', STATE.input.touchAction === 'remove');
      }

      const selectedForward = getOrientationVector(STATE.orientation);
      const directionButtons = document.querySelectorAll('.axis-btn');
      directionButtons.forEach(element => {
        const btn = /** @type {HTMLButtonElement} */ (element);
        const axisIndex = Number(btn.dataset.axisIndex);
        btn.classList.toggle('active', orientationRelevant && selectedForward.dot(AXES[axisIndex]) > 0.999);
        btn.disabled = !orientationRelevant;
      });
      const rollLeft = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-roll-orientation-left'));
      const rollRight = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-roll-orientation-right'));
      if (rollLeft) rollLeft.disabled = !rollRelevant;
      if (rollRight) rollRight.disabled = !rollRelevant;
      const touchRotate = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-touch-rotate'));
      if (touchRotate) touchRotate.disabled = !rollRelevant;
      updateFlightFeedback();
    }

    function syncHudVisibility() {
      document.getElementById('ui-layer').classList.toggle('hud-collapsed', STATE.uiCollapsed);
      document.getElementById('btn-ui-toggle').textContent = STATE.uiCollapsed ? 'SHOW UI' : 'HIDE UI';
      syncContractPanelVisibility();
      updateFlightFeedback();
    }


    function updateResponsivePanels() {
      const mobileControls = document.getElementById('mobile-controls');
      if (!mobileControls) return;
      if (isMobileLayout()) {
        mobileControls.style.display = STATE.uiCollapsed ? 'none' : 'flex';
      } else {
        mobileControls.style.display = 'none';
      }
    }

    function addRootMesh(mesh) {
      if (!WORKSHOP.rootMeshes.includes(mesh)) WORKSHOP.rootMeshes.push(mesh);
    }

    function removeRootMesh(mesh) {
      const idx = WORKSHOP.rootMeshes.indexOf(mesh);
      if (idx >= 0) WORKSHOP.rootMeshes.splice(idx, 1);
    }

    function makeNonRaycastableChildren(root) {
      root.traverse(obj => { if (obj !== root) obj.raycast = () => {}; });
    }

    function axisColor(orientation) {
      const axis = getOrientationVector(orientation);
      if (Math.abs(axis.y) > 0.5) return 0x34d399;
      if (Math.abs(axis.z) > 0.5) return 0x60a5fa;
      return 0xff6b6b;
    }

    function normalizeOrientationId(index) { return Orientation.normalizeOrientationId(index); }

    function partUsesOrientation(type) {
      return !!BLOCKS[type] && BLOCKS[type].orientationMode !== 'none';
    }

    function partUsesRoll(type) {
      return !!BLOCKS[type] && BLOCKS[type].orientationMode === 'basis';
    }

    function getModuleBasis(index = STATE.orientation) {
      const basis = ORIENTATION_BASES[normalizeOrientationId(index)];
      return {
        chord: basis.forward.clone(),
        normal: basis.up.clone(),
        span: basis.span.clone(),
        quaternion: basis.quaternion.clone()
      };
    }

    function getOrientationVector(index = STATE.orientation) {
      return getModuleBasis(index).chord;
    }

    function getOrientationUpVector(index = STATE.orientation) {
      return getModuleBasis(index).normal;
    }

    function getOrientationLabel(index = STATE.orientation) {
      const basis = getModuleBasis(index);
      return `${axisLabelForVector(basis.chord)} / UP ${axisLabelForVector(basis.normal)}`;
    }

    function normalizeControlAxis(value) { return Blueprint.normalizeControlAxis(value); }

    function normalizeControlSign(value) { return Blueprint.normalizeControlSign(value); }

    function controlAxisVector(axis) {
      if (axis === 'roll') return new THREE.Vector3(1, 0, 0);
      if (axis === 'yaw') return new THREE.Vector3(0, 1, 0);
      return new THREE.Vector3(0, 0, 1);
    }

    function controlSignLabel(sign) {
      return sign === 1 ? 'POSITIVE' : (sign === -1 ? 'NEGATIVE' : 'AUTO');
    }

    function cycleControlAxis() {
      if (STATE.mode !== 'BUILD') return;
      const index = CONTROL_AXES.indexOf(STATE.controlAxis);
      STATE.controlAxis = CONTROL_AXES[(index + 1) % CONTROL_AXES.length];
      updateControlConfigurationUI();
      updateGhost();
      autoSave(false);
    }

    function cycleControlSign() {
      if (STATE.mode !== 'BUILD') return;
      const index = CONTROL_SIGNS.indexOf(STATE.controlSign);
      STATE.controlSign = CONTROL_SIGNS[(index + 1) % CONTROL_SIGNS.length];
      updateControlConfigurationUI();
      updateGhost();
      autoSave(false);
    }

    function updateControlConfigurationUI() {
      const panel = document.getElementById('control-config-panel');
      if (panel) panel.hidden = STATE.selectedBlock !== 'ControlSurface';
      const axisButton = document.getElementById('btn-control-axis');
      const signButton = document.getElementById('btn-control-sign');
      if (axisButton) axisButton.textContent = `AXIS: ${STATE.controlAxis.toUpperCase()}`;
      if (signButton) signButton.textContent = `SIGN: ${controlSignLabel(STATE.controlSign)}`;
    }

    function setOrientation(index) {
      if (STATE.mode !== 'BUILD') return;
      STATE.orientation = normalizeOrientationId(index);
      updateHUD();
      updateGhost();
      autoSave(false);
    }

    function setOrientationByVector(vec) {
      let desiredForward = AXES[0];
      let desiredDot = -Infinity;
      for (const axis of AXES) {
        const dot = vec.dot(axis);
        if (dot > desiredDot) { desiredDot = dot; desiredForward = axis; }
      }
      const currentUp = getOrientationUpVector(STATE.orientation);
      let best = DEFAULT_ORIENTATION;
      let bestDot = -Infinity;
      for (let i = 0; i < ORIENTATION_BASES.length; i++) {
        const basis = ORIENTATION_BASES[i];
        if (basis.forward.dot(desiredForward) < 0.999) continue;
        const score = basis.up.dot(currentUp);
        if (score > bestDot) { bestDot = score; best = i; }
      }
      setOrientation(best);
    }

    function rotateOrientationRoll(step = 1) {
      const basis = getModuleBasis(STATE.orientation);
      const rotation = new THREE.Quaternion().setFromAxisAngle(basis.chord, step * Math.PI / 2);
      const rotatedUp = basis.normal.clone().applyQuaternion(rotation).round();
      setOrientation(findOrientationId(basis.chord, rotatedUp));
    }

    function normalizeSavedOrientation(rawOrientation, version, type = 'Wing') { return Orientation.normalizeSavedOrientation(rawOrientation, version, type); }

    function formatDuration(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return '—';
      if (seconds < 60) return `${Math.round(seconds)} s`;
      const minutes = Math.floor(seconds / 60);
      const remainder = Math.round(seconds % 60);
      return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
    }

    function vectorComponent(vector, axis) {
      return axis === 'x' ? vector.x : (axis === 'y' ? vector.y : vector.z);
    }

    function computeWingCoefficients(chordSpeed, normalSpeed) {
      const effectiveSpeed = Math.abs(chordSpeed);
      if (effectiveSpeed < 0.25) {
        return { effectiveSpeed, angleOfAttack: 0, stallFactor: 1, liftCoefficient: 0, dragCoefficient: 0.04 };
      }
      const angleOfAttack = Math.atan2(-normalSpeed, effectiveSpeed + 0.15);
      const absoluteAoA = Math.abs(angleOfAttack);
      let stallFactor = 1;
      if (absoluteAoA > PHYSICS.wingStallStart) {
        stallFactor = 1 - (absoluteAoA - PHYSICS.wingStallStart) / (PHYSICS.wingStallEnd - PHYSICS.wingStallStart);
        stallFactor = THREE.MathUtils.clamp(stallFactor, 0.10, 1);
      }
      const liftCoefficient = THREE.MathUtils.clamp(
        (PHYSICS.wingBaseLiftCoefficient + angleOfAttack * PHYSICS.wingLiftSlope) * stallFactor,
        -1.45,
        1.60
      );
      const dragCoefficient = 0.035 + 0.09 * liftCoefficient * liftCoefficient + (1 - stallFactor) * 0.28;
      return { effectiveSpeed, angleOfAttack, stallFactor, liftCoefficient, dragCoefficient };
    }

    function evaluateWingAtVelocityThree(part, velocity) {
      const speed = velocity.length();
      const zero = new THREE.Vector3();
      if (speed < 0.25) return { force: zero, lift: 0, drag: 0, angleOfAttack: 0, stallFactor: 1 };

      const velocityDirection = velocity.clone().divideScalar(speed);
      const chordSpeed = velocity.dot(part.basis.chord);
      const normalSpeed = velocity.dot(part.basis.normal);
      const spanSpeed = velocity.dot(part.basis.span);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
      const dynamicPressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
      const isControlSurface = part.type === 'ControlSurface';
      const liftCoefficient = coefficients.liftCoefficient * (isControlSurface ? 0.45 : 1);
      const dragCoefficient = isControlSurface
        ? 0.045 + 0.12 * liftCoefficient * liftCoefficient
        : coefficients.dragCoefficient;
      const liftMagnitude = dynamicPressure * part.def.wingArea * liftCoefficient;
      const mainDrag = dynamicPressure * part.def.wingArea * dragCoefficient;
      const crossflowSpeedSq = normalSpeed * normalSpeed + spanSpeed * spanSpeed;
      const crossflowDrag = 0.5 * PHYSICS.airDensity * crossflowSpeedSq * part.def.wingArea * PHYSICS.crossflowDragCoefficient;

      const liftDirection = part.basis.normal.clone().sub(
        velocityDirection.clone().multiplyScalar(part.basis.normal.dot(velocityDirection))
      );
      if (liftDirection.lengthSq() > 0.0001) liftDirection.normalize();
      else liftDirection.set(0, 0, 0);

      const dragMagnitude = mainDrag + crossflowDrag;
      const force = liftDirection.multiplyScalar(liftMagnitude)
        .add(velocityDirection.clone().multiplyScalar(-dragMagnitude));
      return {
        force,
        lift: Math.abs(liftMagnitude),
        drag: Math.abs(dragMagnitude),
        angleOfAttack: coefficients.angleOfAttack,
        stallFactor: coefficients.stallFactor
      };
    }

    function buildCraftSnapshot() {
      const compiled = CraftCompiler.compile(CRAFT);
      const snapshot = {
        compiled,
        ready: compiled.ready,
        errors: [...compiled.errors],
        mass: compiled.mass,
        weight: compiled.weight,
        fuelCapacity: compiled.fuelCapacity,
        dragArea: compiled.dragArea,
        com: new THREE.Vector3(...compiled.com),
        inertia: new THREE.Vector3(...compiled.inertia),
        counts: { ...compiled.counts },
        coreKey: compiled.coreKey,
        corePosition: compiled.corePosition ? new THREE.Vector3(...compiled.corePosition) : null,
        parts: compiled.parts.map(part => {
          const def = BLOCKS[part.type];
          const position = new THREE.Vector3(...part.grid);
          const offset = new THREE.Vector3(...part.offset);
          const basis = {
            chord: new THREE.Vector3(...part.basis.forward),
            normal: new THREE.Vector3(...part.basis.up),
            span: new THREE.Vector3(...part.basis.span)
          };
          const fullForce = new THREE.Vector3(...part.fullForce);
          const localTorque = new THREE.Vector3(...part.localTorque);
          return {
            index: part.index,
            key: part.key,
            type: part.type,
            position,
            offset,
            orientation: part.orientation,
            basis,
            def,
            controlAxis: part.controlAxis,
            controlSign: part.controlSign,
            fullForce,
            localTorque,
            neighbors: [...part.neighbors]
          };
        })
      };
      return snapshot;
    }


    function computeMixerCommandFromTorque(localTorque, pilot, basePower, torqueMax) {
      const base = THREE.MathUtils.clamp(Number(basePower) || 0, 0, 1);
      let score = 0;
      let activeAxes = 0;
      if (Math.abs(pilot.roll) > 0.0001 && torqueMax.x > 0.0001) {
        score += pilot.roll * localTorque.x / torqueMax.x;
        activeAxes += 1;
      }
      if (Math.abs(pilot.yaw) > 0.0001 && torqueMax.y > 0.0001) {
        score += pilot.yaw * localTorque.y / torqueMax.y;
        activeAxes += 1;
      }
      if (Math.abs(pilot.pitch) > 0.0001 && torqueMax.z > 0.0001) {
        score += pilot.pitch * localTorque.z / torqueMax.z;
        activeAxes += 1;
      }
      if (activeAxes > 1) score /= Math.sqrt(activeAxes);
      score = THREE.MathUtils.clamp(score, -1, 1);
      const headroom = score >= 0 ? (1 - base) : base;
      return THREE.MathUtils.clamp(base + score * headroom * PHYSICS.thrusterControlGain, 0, 1);
    }

    function controlSurfaceAutoSign(part) {
      const target = controlAxisVector(part.controlAxis);
      const positiveTorque = part.offset.clone().cross(part.basis.normal);
      const projection = positiveTorque.dot(target);
      return Math.abs(projection) < 0.0001 ? 1 : Math.sign(projection);
    }

    function computeControlSurfaceTorqueThree(part, pilot, speed = PHYSICS.cruiseReferenceSpeed) {
      if (part.type !== 'ControlSurface') return new THREE.Vector3();
      const command = Number(pilot[part.controlAxis]) || 0;
      if (Math.abs(command) < 0.0001) return new THREE.Vector3();
      const referenceVelocity = new THREE.Vector3(speed, 0, 0);
      const referenceSpeed = referenceVelocity.length();
      if (referenceSpeed < 0.25) return new THREE.Vector3();
      const chordSpeed = referenceVelocity.dot(part.basis.chord);
      const normalSpeed = referenceVelocity.dot(part.basis.normal);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
      if (coefficients.effectiveSpeed < 0.25) return new THREE.Vector3();
      const sign = part.controlSign || controlSurfaceAutoSign(part);
      const pressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
      const forceMagnitude = pressure * (part.def.wingArea || 0.5) * PHYSICS.controlSurfaceLiftGain * command * sign;
      const velocityDirection = referenceVelocity.divideScalar(referenceSpeed);
      const forceDirection = part.basis.normal.clone().sub(
        velocityDirection.clone().multiplyScalar(part.basis.normal.dot(velocityDirection))
      );
      if (forceDirection.lengthSq() < 0.0001) return new THREE.Vector3();
      forceDirection.normalize();
      return part.offset.clone().cross(forceDirection.multiplyScalar(forceMagnitude));
    }

    function computeGimbalForceThree(part, pilot, command = 0) {
      if (part.type !== 'VectorThruster') return part.basis.chord.clone().multiplyScalar((part.def.force || 0) * command);
      const desired = new THREE.Vector3(pilot.roll || 0, pilot.yaw || 0, pilot.pitch || 0);
      const baseForce = (part.def.force || 0) * command;
      if (desired.lengthSq() < 0.0001 || baseForce <= 0) return part.basis.chord.clone().multiplyScalar(baseForce);
      const lateral = baseForce * Math.sin(PHYSICS.gimbalAngle);
      const torqueNormal = part.offset.clone().cross(part.basis.normal.clone().multiplyScalar(lateral));
      const torqueSpan = part.offset.clone().cross(part.basis.span.clone().multiplyScalar(lateral));
      const desiredAmplitude = THREE.MathUtils.clamp(desired.length(), 0, 1);
      const normalization = Math.max(0.0001, desired.length());
      let a = torqueNormal.lengthSq() > 0.0001 ? desired.dot(torqueNormal) / (normalization * torqueNormal.length()) * desiredAmplitude : 0;
      let b = torqueSpan.lengthSq() > 0.0001 ? desired.dot(torqueSpan) / (normalization * torqueSpan.length()) * desiredAmplitude : 0;
      const length = Math.hypot(a, b);
      if (length > 1) { a /= length; b /= length; }
      const forwardScale = Math.cos(PHYSICS.gimbalAngle * Math.min(1, Math.hypot(a, b)));
      return part.basis.chord.clone().multiplyScalar(baseForce * forwardScale)
        .add(part.basis.normal.clone().multiplyScalar(lateral * a))
        .add(part.basis.span.clone().multiplyScalar(lateral * b));
    }

    function computeAuxiliaryControlTorque(snapshot, pilot, torqueMax = computeSnapshotTorqueMax(snapshot)) {
      const torque = new THREE.Vector3();
      for (const part of snapshot.parts) {
        if (part.type === 'ControlSurface') torque.add(computeControlSurfaceTorqueThree(part, pilot));
        if (part.type === 'VectorThruster') {
          const command = computeMixerCommandFromTorque(
            part.localTorque, pilot,
            FlightControl.neutralCommand([part.basis.chord.x, part.basis.chord.y, part.basis.chord.z], STATE.thrusterPower),
            torqueMax
          );
          const base = part.basis.chord.clone().multiplyScalar((part.def.force || 0) * command);
          const deflected = computeGimbalForceThree(part, pilot, command);
          torque.add(part.offset.clone().cross(deflected.sub(base)));
        }
      }
      return torque;
    }

    function computeSnapshotTorqueMax(snapshot) {
      const max = new THREE.Vector3();
      for (const part of snapshot.parts) {
        if (part.type !== 'Thruster' && part.type !== 'VectorThruster') continue;
        max.x = Math.max(max.x, Math.abs(part.localTorque.x));
        max.y = Math.max(max.y, Math.abs(part.localTorque.y));
        max.z = Math.max(max.z, Math.abs(part.localTorque.z));
      }
      return max;
    }

    function computeThrusterTorqueForPilot(snapshot, pilot, torqueMax) {
      const torque = new THREE.Vector3();
      for (const part of snapshot.parts) {
        if (part.type !== 'Thruster' && part.type !== 'VectorThruster') continue;
        const command = computeMixerCommandFromTorque(
            part.localTorque, pilot,
            FlightControl.neutralCommand([part.basis.chord.x, part.basis.chord.y, part.basis.chord.z], STATE.thrusterPower),
            torqueMax
          );
        torque.add(part.localTorque.clone().multiplyScalar(command));
      }
      return torque;
    }

    function missionPayloadPositionVector(snapshot = null) {
      const anchor = snapshot?.corePosition ? snapshot.corePosition.clone() : new THREE.Vector3();
      return anchor.add(new THREE.Vector3(MISSION_PAYLOAD_POSITION.x, MISSION_PAYLOAD_POSITION.y, MISSION_PAYLOAD_POSITION.z));
    }

    function buildLoadedSnapshot(baseSnapshot, payloadMass = 0) {
      const safePayloadMass = Math.max(0, Number(payloadMass) || 0);
      if (safePayloadMass <= 0 || baseSnapshot.mass <= 0) return baseSnapshot;
      const payloadPosition = missionPayloadPositionVector(baseSnapshot);
      const runtimeMass = baseSnapshot.mass + safePayloadMass;
      const runtimeCom = baseSnapshot.com.clone().multiplyScalar(baseSnapshot.mass)
        .add(payloadPosition.clone().multiplyScalar(safePayloadMass))
        .divideScalar(runtimeMass);
      const inertia = new THREE.Vector3();
      const parts = baseSnapshot.parts.map(part => {
        const offset = part.position.clone().sub(runtimeCom);
        const fullForce = (part.type === 'Thruster' || part.type === 'VectorThruster')
          ? part.basis.chord.clone().multiplyScalar(part.def.force || 0)
          : new THREE.Vector3();
        const mass = part.def.mass || 0;
        const cubeInertia = mass / 6;
        inertia.x += mass * (offset.y ** 2 + offset.z ** 2) + cubeInertia;
        inertia.y += mass * (offset.x ** 2 + offset.z ** 2) + cubeInertia;
        inertia.z += mass * (offset.x ** 2 + offset.y ** 2) + cubeInertia;
        return { ...part, offset, fullForce, localTorque: offset.clone().cross(fullForce) };
      });
      const payloadOffset = payloadPosition.clone().sub(runtimeCom);
      const payloadCubeInertia = safePayloadMass * (0.84 ** 2) / 6;
      inertia.x += safePayloadMass * (payloadOffset.y ** 2 + payloadOffset.z ** 2) + payloadCubeInertia;
      inertia.y += safePayloadMass * (payloadOffset.x ** 2 + payloadOffset.z ** 2) + payloadCubeInertia;
      inertia.z += safePayloadMass * (payloadOffset.x ** 2 + payloadOffset.y ** 2) + payloadCubeInertia;
      return {
        ...baseSnapshot,
        mass: runtimeMass,
        weight: runtimeMass * 9.81,
        dragArea: baseSnapshot.dragArea + 0.2,
        com: runtimeCom,
        inertia,
        parts,
        payloadMass: safePayloadMass,
        payloadPosition,
        payloadOffset
      };
    }

    function computeControlMetrics(snapshot) {
      const torqueMax = computeSnapshotTorqueMax(snapshot);
      const baselineTorque = computeThrusterTorqueForPilot(snapshot, { roll: 0, yaw: 0, pitch: 0 }, torqueMax);
      const controlTorque = new THREE.Vector3();
      const controlRating = { pitch: 0, yaw: 0, roll: 0 };
      const controlCoupling = { pitch: 0, yaw: 0, roll: 0 };
      const axisDefinitions = [
        { control: 'roll', component: 'x', inertia: snapshot.inertia.x },
        { control: 'yaw', component: 'y', inertia: snapshot.inertia.y },
        { control: 'pitch', component: 'z', inertia: snapshot.inertia.z }
      ];
      const gyroAuthority = snapshot.counts.Gyro * PHYSICS.gyroManualTorque;
      for (const axis of axisDefinitions) {
        const positivePilot = { roll: 0, yaw: 0, pitch: 0, [axis.control]: 1 };
        const negativePilot = { roll: 0, yaw: 0, pitch: 0, [axis.control]: -1 };
        const positiveDelta = computeThrusterTorqueForPilot(snapshot, positivePilot, torqueMax).sub(baselineTorque).add(computeAuxiliaryControlTorque(snapshot, positivePilot, torqueMax));
        const negativeDelta = computeThrusterTorqueForPilot(snapshot, negativePilot, torqueMax).sub(baselineTorque).add(computeAuxiliaryControlTorque(snapshot, negativePilot, torqueMax));
        const positiveAuthority = Math.max(0, vectorComponent(positiveDelta, axis.component));
        const negativeAuthority = Math.max(0, -vectorComponent(negativeDelta, axis.component));
        const bidirectional = Math.min(positiveAuthority, negativeAuthority) + gyroAuthority;
        const requiredTorque = Math.max(1, axis.inertia * PHYSICS.targetAngularAcceleration);
        controlTorque[axis.component] = bidirectional;
        controlRating[axis.control] = THREE.MathUtils.clamp(bidirectional / requiredTorque, 0, 1);
        const offAxis = axis.component === 'x'
          ? Math.hypot(positiveDelta.y, positiveDelta.z, negativeDelta.y, negativeDelta.z)
          : (axis.component === 'y'
            ? Math.hypot(positiveDelta.x, positiveDelta.z, negativeDelta.x, negativeDelta.z)
            : Math.hypot(positiveDelta.x, positiveDelta.y, negativeDelta.x, negativeDelta.y));
        const primary = positiveAuthority + negativeAuthority + 0.001;
        controlCoupling[axis.control] = THREE.MathUtils.clamp(offAxis / primary, 0, 4);
      }
      return { torqueMax, baselineTorque, controlTorque, controlRating, controlCoupling };
    }

    function computeCraftAnalysis() {
      const snapshot = buildCraftSnapshot();
      const analysis = {
        snapshot,
        mass: snapshot.mass,
        weight: snapshot.weight,
        blockCount: snapshot.parts.length,
        fuelCapacity: snapshot.fuelCapacity,
        com: snapshot.com.clone(),
        counts: { ...snapshot.counts },
        netThrust: new THREE.Vector3(),
        centerThrust: new THREE.Vector3(),
        centerLift: new THREE.Vector3(),
        staticLift: 0,
        cruiseLift: 0,
        cruiseDrag: 0,
        staticLiftRatio: 0,
        cruiseLiftRatio: 0,
        trimTorque: new THREE.Vector3(),
        trimTorqueMagnitude: 0,
        controlTorque: new THREE.Vector3(),
        controlRating: { pitch: 0, yaw: 0, roll: 0 },
        controlCoupling: { pitch: 0, yaw: 0, roll: 0 },
        enduranceSeconds: 0,
        totalDurability: 0,
        structuralReserve: 0,
        weakLinks: 0,
        exposedFuel: 0,
        warnings: [],
        grade: 'UNTESTED'
      };
      const warn = (level, text) => analysis.warnings.push({ level, text });
      const compileMessages = {
        'empty-craft': 'The workshop is empty. Place any first module, then add exactly one Command Core before launch.',
        'missing-core': 'No Command Core is installed. The craft may be edited and saved, but cannot launch.',
        'multiple-cores': 'Only one Command Core may be installed.',
        'disconnected': 'The craft contains disconnected structural islands.',
        'block-limit': `The blueprint exceeds the ${GRID.maxBlocks}-module editor limit.`,
        'invalid-block': 'The blueprint contains an invalid module record.',
        'duplicate-position': 'Two modules occupy the same grid position.'
      };
      for (const error of snapshot.errors || []) warn('critical', compileMessages[error] || `Craft compilation failed: ${error}.`);
      if (snapshot.mass <= 0) {
        analysis.grade = 'DANGEROUS';
        return analysis;
      }

      const craftKeys = new Set(snapshot.parts.map(part => part.key));
      const neighborDirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      for (const part of snapshot.parts) {
        analysis.totalDurability += part.def.durability || 0;
        const neighbors = neighborDirs.reduce((count, [dx,dy,dz]) => count + (craftKeys.has(makeKey(part.position.x+dx, part.position.y+dy, part.position.z+dz)) ? 1 : 0), 0);
        if (part.type !== 'Core' && neighbors <= 1) analysis.weakLinks += 1;
        if (part.type === 'Fuel' && neighbors <= 2) analysis.exposedFuel += 1;
      }
      analysis.structuralReserve = analysis.mass > 0 ? analysis.totalDurability / Math.max(1, analysis.mass * 5.5) : 0;

      let thrustWeight = 0;
      let liftWeight = 0;
      let nominalFuelRate = 0;
      const cruiseVelocity = new THREE.Vector3(PHYSICS.cruiseReferenceSpeed, 0, 0);

      for (const part of snapshot.parts) {
        if (part.type === 'Thruster' || part.type === 'VectorThruster') {
          const command = FlightControl.neutralCommand(
            [part.basis.chord.x, part.basis.chord.y, part.basis.chord.z],
            STATE.thrusterPower
          );
          const force = part.fullForce.clone().multiplyScalar(command);
          const torque = part.offset.clone().cross(force);
          analysis.netThrust.add(force);
          analysis.trimTorque.add(torque);
          analysis.staticLift += force.y;
          const magnitude = force.length();
          if (magnitude > 0) {
            analysis.centerThrust.add(part.position.clone().multiplyScalar(magnitude));
            thrustWeight += magnitude;
          }
          nominalFuelRate += part.def.fuelRate * command;
        } else if (part.type === 'Balloon') {
          const liftMagnitude = part.def.force * STATE.balloonPower;
          const force = new THREE.Vector3(0, liftMagnitude, 0);
          analysis.trimTorque.add(part.offset.clone().cross(force));
          analysis.staticLift += liftMagnitude;
          if (liftMagnitude > 0) {
            analysis.centerLift.add(part.position.clone().multiplyScalar(liftMagnitude));
            liftWeight += liftMagnitude;
          }
          nominalFuelRate += part.def.fuelRate * STATE.balloonPower;
        } else if (part.type === 'Wing' || part.type === 'ControlSurface') {
          const loads = evaluateWingAtVelocityThree(part, cruiseVelocity);
          analysis.cruiseLift += loads.force.y;
          analysis.cruiseDrag += loads.drag;
          const liftWeightForCenter = Math.max(0, loads.force.y);
          if (liftWeightForCenter > 0) {
            analysis.centerLift.add(part.position.clone().multiplyScalar(liftWeightForCenter));
            liftWeight += liftWeightForCenter;
          }
        }
      }

      analysis.cruiseLift += analysis.staticLift;
      analysis.staticLiftRatio = analysis.weight > 0 ? analysis.staticLift / analysis.weight : 0;
      analysis.cruiseLiftRatio = analysis.weight > 0 ? analysis.cruiseLift / analysis.weight : 0;
      analysis.trimTorqueMagnitude = analysis.trimTorque.length();
      if (thrustWeight > 0) analysis.centerThrust.divideScalar(thrustWeight);
      else analysis.centerThrust.copy(analysis.com);
      if (liftWeight > 0) analysis.centerLift.divideScalar(liftWeight);
      else analysis.centerLift.copy(analysis.com);

      const controls = computeControlMetrics(snapshot);
      analysis.controlTorque.copy(controls.controlTorque);
      analysis.controlRating = controls.controlRating;
      analysis.controlCoupling = controls.controlCoupling;

      analysis.enduranceSeconds = nominalFuelRate > 0 ? analysis.fuelCapacity / nominalFuelRate : Infinity;
      if (snapshot.parts.length === 1) warn('info', 'The craft currently contains a single module.');
      if (snapshot.counts.Thruster + snapshot.counts.VectorThruster + snapshot.counts.Balloon === 0) warn('critical', 'No propulsion or powered lift is installed.');
      if (nominalFuelRate > 0 && analysis.fuelCapacity <= 0) warn('critical', 'Powered modules have no fuel tank.');
      if (snapshot.counts.Wing + snapshot.counts.ControlSurface === 0 && analysis.staticLiftRatio < 0.95) warn('warn', 'Current power cannot support a vertical take-off.');
      if (snapshot.counts.Wing + snapshot.counts.ControlSurface > 0 && analysis.cruiseLiftRatio < 0.9) warn('warn', `Estimated lift at ${PHYSICS.cruiseReferenceSpeed} m/s is below craft weight.`);
      if (snapshot.counts.Wing + snapshot.counts.ControlSurface > 0 && analysis.cruiseLift <= analysis.staticLift + 0.1) warn('warn', 'Installed wings do not create useful upward lift in the +X cruise test.');
      if (analysis.controlRating.pitch < 0.12) warn('warn', 'Almost no bidirectional pitch authority.');
      if (analysis.controlRating.yaw < 0.12) warn('warn', 'Almost no bidirectional yaw authority.');
      if (analysis.controlRating.roll < 0.12) warn('warn', 'Almost no bidirectional roll authority.');
      if (analysis.controlCoupling.pitch > 1.1 || analysis.controlCoupling.yaw > 1.1 || analysis.controlCoupling.roll > 1.1) warn('info', 'Engine steering has strong cross-axis coupling.');
      const controlMagnitude = analysis.controlTorque.length();
      if (analysis.trimTorqueMagnitude > Math.max(5, controlMagnitude * 1.2)) warn('warn', 'Current power creates a strong unbalanced turning moment.');
      if (snapshot.counts.Gyro === 0) warn('info', 'No gyro: stabilization depends entirely on engine layout and aerodynamic surfaces.');
      if (snapshot.counts.ControlSurface > 0) warn('info', 'Control surfaces require airflow; authority fades during hover and stall.');
      if (analysis.fuelCapacity > 0 && analysis.enduranceSeconds < 20) warn('info', 'Estimated fuel endurance at current power is very short.');
      if (analysis.weakLinks > 0) warn(analysis.weakLinks > 4 ? 'warn' : 'info', `${analysis.weakLinks} part${analysis.weakLinks === 1 ? '' : 's'} depend on a single structural connection.`);
      if (analysis.exposedFuel > 0) warn('info', `${analysis.exposedFuel} fuel tank${analysis.exposedFuel === 1 ? ' is' : 's are'} weakly protected and vulnerable to impact leaks.`);
      if (analysis.structuralReserve < 0.75 && snapshot.parts.length > 8) warn('warn', 'Low durability-to-mass reserve; reinforce long branches with Frame modules.');
      if (snapshot.parts.length > PHYSICS.maxFlightParts) warn('critical', `Flight is limited to ${PHYSICS.maxFlightParts} attached modules until collider merging is implemented.`);
      else if (snapshot.parts.length > PHYSICS.maxFlightParts * 0.8) warn('info', 'The craft is approaching the current flight-solver module limit.');

      const criticalCount = analysis.warnings.filter(item => item.level === 'critical').length;
      const warningCount = analysis.warnings.filter(item => item.level === 'warn').length;
      analysis.grade = criticalCount ? 'DANGEROUS' : (warningCount >= 3 ? 'EXPERIMENTAL' : (warningCount ? 'FLY WITH CARE' : 'READY'));
      return analysis;
    }

    function setHorizontalBar(id, value) {
      const bar = document.getElementById(id);
      if (!bar) return;
      bar.style.left = '0%';
      bar.style.width = `${Math.round(THREE.MathUtils.clamp(value, 0, 1) * 100)}%`;
    }

    function updateEngineeringAnalysisUI(analysis) {
      const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      };
      setText('ui-static-lift', `${analysis.staticLiftRatio.toFixed(2)}×`);
      setText('ui-cruise-lift', `${analysis.cruiseLiftRatio.toFixed(2)}×`);
      setText('ui-endurance', formatDuration(analysis.enduranceSeconds));
      setText('ui-trim-torque', analysis.trimTorqueMagnitude.toFixed(1));
      setText('ui-structural-reserve', `${analysis.structuralReserve.toFixed(2)}×`);
      setText('ui-weak-links', String(analysis.weakLinks));
      setText('ui-control-pitch', `${Math.round(analysis.controlRating.pitch * 100)}%`);
      setText('ui-control-yaw', `${Math.round(analysis.controlRating.yaw * 100)}%`);
      setText('ui-control-roll', `${Math.round(analysis.controlRating.roll * 100)}%`);
      setHorizontalBar('ui-control-pitch-bar', analysis.controlRating.pitch);
      setHorizontalBar('ui-control-yaw-bar', analysis.controlRating.yaw);
      setHorizontalBar('ui-control-roll-bar', analysis.controlRating.roll);

      const grade = document.getElementById('ui-flight-grade');
      if (grade) {
        grade.textContent = analysis.grade;
        grade.className = analysis.grade === 'READY'
          ? 'font-bold text-emerald-300'
          : (analysis.grade === 'DANGEROUS' ? 'font-bold text-rose-300' : 'font-bold text-amber-300');
      }

      const launchButton = document.getElementById('btn-flight');
      if (launchButton && STATE.mode === 'BUILD') {
        launchButton.textContent = analysis.grade === 'DANGEROUS'
          ? 'Launch Dangerous Test'
          : (analysis.grade === 'EXPERIMENTAL' ? 'Launch Experimental Test' : 'Launch Test Flight');
      }

      const warningList = document.getElementById('ui-analysis-warnings');
      if (warningList) {
        const visibleWarnings = analysis.warnings.slice(0, 4);
        warningList.innerHTML = visibleWarnings.length
          ? visibleWarnings.map(item => {
              const tone = item.level === 'critical' ? 'text-rose-300' : (item.level === 'warn' ? 'text-amber-200' : 'text-slate-400');
              const icon = item.level === 'critical' ? '●' : (item.level === 'warn' ? '▲' : '•');
              return `<div class="${tone}">${icon} ${item.text}</div>`;
            }).join('')
          : '<div class="text-emerald-300">● No major engineering warnings.</div>';
        if (analysis.warnings.length > visibleWarnings.length) {
          warningList.innerHTML += `<div class="text-slate-500">+${analysis.warnings.length - visibleWarnings.length} more observations</div>`;
        }
      }
    }

    function updateAnalysisVisuals(analysis) {
      const visible = STATE.mode === 'BUILD' && analysis.mass > 0;
      thrustSphere.visible = visible && analysis.counts.Thruster + analysis.counts.VectorThruster > 0;
      liftSphere.visible = visible && analysis.counts.Balloon + analysis.counts.Wing + analysis.counts.ControlSurface > 0;
      if (thrustSphere.visible) thrustSphere.position.copy(analysis.centerThrust);
      if (liftSphere.visible) liftSphere.position.copy(analysis.centerLift);

      const thrustMagnitude = analysis.netThrust.length();
      thrustVectorArrow.visible = visible && thrustMagnitude > 0.01;
      if (thrustVectorArrow.visible) {
        thrustVectorArrow.position.copy(analysis.centerThrust);
        thrustVectorArrow.setDirection(analysis.netThrust.clone().normalize());
        thrustVectorArrow.setLength(0.8 + Math.min(4.2, thrustMagnitude / 30), 0.35, 0.22);
      }

      liftVectorArrow.visible = visible && analysis.cruiseLift > 0.01;
      if (liftVectorArrow.visible) {
        liftVectorArrow.position.copy(analysis.centerLift);
        liftVectorArrow.setDirection(new THREE.Vector3(0, 1, 0));
        liftVectorArrow.setLength(0.8 + Math.min(4.2, analysis.cruiseLiftRatio * 1.8), 0.35, 0.22);
      }
    }

    function createModuleVisual(type, orientation, ghostMode = false) {
      const root = new THREE.Mesh(sharedGeometry, cloneMaterial(type));
      root.castShadow = true;
      root.receiveShadow = true;
      root.userData.isVoxelRoot = true;
      root.userData.type = type;
      root.userData.orientation = normalizeOrientationId(orientation);
      root.scale.set(0.96, 0.96, 0.96);
      if (partUsesOrientation(type)) {
        root.quaternion.copy(getModuleBasis(orientation).quaternion);
      } else {
        root.quaternion.identity();
      }

      if (ghostMode) {
        root.material.transparent = true;
        root.material.opacity = 0.52;
      }

      if (type === 'Core') {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 14, 14),
          new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: ghostMode ? 0.22 : 0.5 })
        );
        root.add(glow);

        const inner = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16, 0),
          new THREE.MeshStandardMaterial({ color: 0xf5d0fe, roughness: 0.35, metalness: 0.1, emissive: 0x4c1d95, emissiveIntensity: 0.18, transparent: ghostMode, opacity: ghostMode ? 0.72 : 1 })
        );
        root.add(inner);

        const nose = new THREE.Mesh(
          new THREE.ConeGeometry(0.13, 0.42, 8),
          new THREE.MeshStandardMaterial({ color: 0xf0abfc, roughness: 0.38, metalness: 0.22, emissive: 0x581c87, emissiveIntensity: 0.2, transparent: ghostMode, opacity: ghostMode ? 0.65 : 1 })
        );
        nose.rotation.z = -Math.PI / 2;
        nose.position.x = 0.58;
        root.add(nose);

        const topMarker = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.08, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.4, metalness: 0.28, emissive: 0x164e63, emissiveIntensity: 0.18, transparent: ghostMode, opacity: ghostMode ? 0.62 : 1 })
        );
        topMarker.position.set(0, 0.51, 0);
        root.add(topMarker);
      }

      if (type === 'Thruster') {
        const nozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.34, 0.62, 10),
          new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.82, metalness: 0.38, transparent: ghostMode, opacity: ghostMode ? 0.4 : 1 })
        );
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.x = -0.48;
        root.add(nozzle);

        const nozzleCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.12, 0.22, 8),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.72, transparent: ghostMode, opacity: ghostMode ? 0.45 : 1 })
        );
        nozzleCap.rotation.z = Math.PI / 2;
        nozzleCap.position.x = -0.73;
        root.add(nozzleCap);

        const flameCore = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.52, 12),
          new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: ghostMode ? 0.18 : 0.9 })
        );
        flameCore.rotation.z = -Math.PI / 2;
        flameCore.position.x = -0.98;
        flameCore.name = 'flame';
        root.add(flameCore);

        const flameGlow = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.85, 12),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: ghostMode ? 0.12 : 0.4 })
        );
        flameGlow.rotation.z = -Math.PI / 2;
        flameGlow.position.x = -1.03;
        flameGlow.name = 'flameGlow';
        root.add(flameGlow);
      }

      if (type === 'VectorThruster') {
        const gimbal = new THREE.Group();
        gimbal.name = 'gimbalAssembly';
        gimbal.position.x = -0.30;
        root.add(gimbal);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.31, 0.07, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.42, metalness: 0.58, transparent: ghostMode, opacity: ghostMode ? 0.42 : 1 })
        );
        ring.rotation.y = Math.PI / 2;
        gimbal.add(ring);
        const nozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.31, 0.68, 10),
          new THREE.MeshStandardMaterial({ color: 0x29213a, roughness: 0.7, metalness: 0.52, transparent: ghostMode, opacity: ghostMode ? 0.42 : 1 })
        );
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.x = -0.36;
        gimbal.add(nozzle);
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.72, 12),
          new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: ghostMode ? 0.16 : 0.85 })
        );
        flame.rotation.z = -Math.PI / 2;
        flame.position.x = -0.93;
        flame.name = 'flame';
        gimbal.add(flame);
        const glow = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 1.0, 12),
          new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: ghostMode ? 0.10 : 0.34 })
        );
        glow.rotation.z = -Math.PI / 2;
        glow.position.x = -1.02;
        glow.name = 'flameGlow';
        gimbal.add(glow);
      }

      if (type === 'Balloon') {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.45, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x7cc4ff, roughness: 0.42, metalness: 0.05, transparent: true, opacity: ghostMode ? 0.5 : 0.96 })
        );
        dome.position.y = 0.52;
        root.add(dome);

        const knot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6),
          new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.75, metalness: 0.02, transparent: ghostMode, opacity: ghostMode ? 0.45 : 1 })
        );
        knot.position.y = 0.02;
        root.add(knot);

        const basket = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.16, 0.26),
          new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.88, metalness: 0.02, transparent: ghostMode, opacity: ghostMode ? 0.55 : 1 })
        );
        basket.position.set(0, -0.54, 0);
        root.add(basket);
      }

      if (type === 'Wing') {
        const wing = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 0.1, 0.54),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.56, metalness: 0.1, transparent: ghostMode, opacity: ghostMode ? 0.5 : 1 })
        );
        wing.position.set(0.03, -0.16, 0);
        root.add(wing);

        const tip = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.14, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.5, metalness: 0.08, transparent: ghostMode, opacity: ghostMode ? 0.46 : 1 })
        );
        tip.position.set(0.46, 0.03, 0);
        root.add(tip);
      }

      if (type === 'ControlSurface') {
        const fixed = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.10, 0.68),
          new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.52, metalness: 0.12, transparent: ghostMode, opacity: ghostMode ? 0.48 : 1 })
        );
        fixed.position.x = -0.22;
        root.add(fixed);
        const flapPivot = new THREE.Group();
        flapPivot.name = 'controlFlapPivot';
        flapPivot.position.x = 0.22;
        root.add(flapPivot);
        const flap = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.08, 0.68),
          new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.42, metalness: 0.10, transparent: ghostMode, opacity: ghostMode ? 0.52 : 1 })
        );
        flap.position.x = 0.27;
        flapPivot.add(flap);
      }

      if (type === 'Gyro') {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.34, 0.08, 8, 18),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.3, transparent: ghostMode, opacity: ghostMode ? 0.5 : 1 })
        );
        ring.rotation.x = Math.PI / 2;
        root.add(ring);

        const hub = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.34, metalness: 0.18, emissive: 0x7c2d12, emissiveIntensity: 0.06, transparent: ghostMode, opacity: ghostMode ? 0.62 : 1 })
        );
        root.add(hub);
      }

      if (type === 'Fuel') {
        const canister = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.24, 0.62, 10),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.18, transparent: ghostMode, opacity: ghostMode ? 0.52 : 1 })
        );
        canister.rotation.z = Math.PI / 2;
        root.add(canister);

        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.14, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82, metalness: 0.04, transparent: ghostMode, opacity: ghostMode ? 0.5 : 1 })
        );
        cap.position.x = 0.38;
        root.add(cap);
      }

      makeNonRaycastableChildren(root);
      return root;
    }

    function mirrorOrientation(orientation, mirrorX, mirrorZ, type = STATE.selectedBlock) {
      if (!partUsesOrientation(type)) return DEFAULT_ORIENTATION;
      const basis = getModuleBasis(orientation);
      if (mirrorX) {
        basis.chord.x *= -1;
        basis.normal.x *= -1;
      }
      if (mirrorZ) {
        basis.chord.z *= -1;
        basis.normal.z *= -1;
      }
      return findOrientationId(basis.chord, basis.normal);
    }

    function symmetryOffsets(x, z) {
      const pairs = [];
      const add = (px, pz, mirrorX = false, mirrorZ = false) => {
        const key = `${px},${pz}`;
        if (!pairs.some(item => item.key === key)) {
          pairs.push({ key, x: px, z: pz, mirrorX, mirrorZ });
        }
      };

      add(x, z, false, false);
      const sx = STATE.symmetry.includes('X');
      const sz = STATE.symmetry.includes('Z');
      if (sx) add(-x, z, true, false);
      if (sz) add(x, -z, false, true);
      if (sx && sz) add(-x, -z, true, true);
      return pairs;
    }

    function isWithinGrid(x, y, z) { return Blueprint.isWithinGrid(x, y, z); }

    function buildPlacementPlan(x, y, z, type, orientation, allowMirror) {
      const placements = allowMirror
        ? symmetryOffsets(x, z)
        : [{ key: `${x},${z}`, x, z, mirrorX: false, mirrorZ: false }];

      return placements.map(p => ({
        x: p.x,
        y,
        z: p.z,
        type,
        orientation: mirrorOrientation(orientation, p.mirrorX, p.mirrorZ, type),
        controlAxis: type === 'ControlSurface' ? STATE.controlAxis : 'pitch',
        controlSign: type === 'ControlSurface' ? STATE.controlSign : 0
      }));
    }

    function canPlacePlan(plan) {
      return CRAFT.validateAddMany(plan).ok;
    }

    function isStructureContiguous() {
      return CRAFT.isContiguous();
    }

    function refreshRaycastList() {
      WORKSHOP.rootMeshes.length = 0;
      for (const mesh of WORKSHOP.meshesByKey.values()) addRootMesh(mesh);
    }

    function addWorkshopVisual(block) {
      if (!block || WORKSHOP.meshesByKey.has(block.key)) return WORKSHOP.meshesByKey.get(block?.key) || null;
      const mesh = createModuleVisual(block.type, block.orientation);
      mesh.position.set(block.x, block.y, block.z);
      mesh.userData.blockKey = block.key;
      scene.add(mesh);
      WORKSHOP.meshesByKey.set(block.key, mesh);
      addRootMesh(mesh);
      return mesh;
    }

    function removeWorkshopVisual(blockOrKey) {
      const key = typeof blockOrKey === 'string' ? blockOrKey : blockOrKey?.key;
      if (!key) return false;
      const mesh = WORKSHOP.meshesByKey.get(key);
      if (!mesh) return false;
      scene.remove(mesh);
      removeRootMesh(mesh);
      WORKSHOP.meshesByKey.delete(key);
      disposeObjectTree(mesh);
      return true;
    }

    function rebuildWorkshopView() {
      for (const mesh of WORKSHOP.meshesByKey.values()) {
        scene.remove(mesh);
        disposeObjectTree(mesh);
      }
      WORKSHOP.meshesByKey.clear();
      WORKSHOP.rootMeshes.length = 0;
      for (const block of CRAFT.values()) addWorkshopVisual(block);
      refreshRaycastList();
    }

    function assertWorkshopViewConsistency() {
      if (WORKSHOP.meshesByKey.size !== CRAFT.size) {
        throw new Error(`Workshop view/model size mismatch: ${WORKSHOP.meshesByKey.size} != ${CRAFT.size}`);
      }
      for (const block of CRAFT.values()) {
        const mesh = WORKSHOP.meshesByKey.get(block.key);
        if (!mesh || mesh.userData.blockKey !== block.key || mesh.userData.type !== block.type) {
          throw new Error(`Workshop view is missing or stale for block ${block.key}.`);
        }
      }
      return true;
    }

    function handleCraftModelChange(event) {
      try {
        for (const block of event.removed) removeWorkshopVisual(block);
        for (const change of event.updated) removeWorkshopVisual(change.before);
        for (const block of event.added) addWorkshopVisual(block);
        for (const change of event.updated) addWorkshopVisual(change.after);
        refreshRaycastList();
        assertWorkshopViewConsistency();
      } catch (error) {
        console.error('Incremental workshop view update failed; rebuilding from CraftModel.', error);
        rebuildWorkshopView();
        assertWorkshopViewConsistency();
      }
    }

    CRAFT.subscribe(handleCraftModelChange);

    function updateTelemetry() {
      syncControlFrameReadout();
      const analysis = computeCraftAnalysis();
      STATE.flight.analysis = analysis;
      STATE.flight.compiled = analysis.snapshot.compiled;

      if (analysis.mass > 0) {
        comSphere.position.copy(analysis.com);
        comSphere.visible = STATE.mode === 'BUILD';
      } else {
        comSphere.visible = false;
      }

      document.getElementById('ui-mass').textContent = `${analysis.mass.toFixed(1)} kg`;
      document.getElementById('ui-blocks').textContent = String(CRAFT.size);

      if (STATE.mode === 'BUILD') {
        document.getElementById('ui-fuel').textContent = `${Math.round(analysis.fuelCapacity)} reserve`;
      } else {
        document.getElementById('ui-fuel').textContent = `${Math.max(0, Math.round(STATE.flight.fuel))} / ${Math.max(0, Math.round(STATE.flight.fuelMax))}`;
      }

      updateEngineeringAnalysisUI(analysis);
      updateAnalysisVisuals(analysis);
      renderContractPanel();
      updateHUD();
      updateResponsivePanels();
    }

    function applyBuildRotation(step = 1) {
      if (STATE.mode !== 'BUILD' || !partUsesRoll(STATE.selectedBlock)) return;
      rotateOrientationRoll(step);
    }

    function setSelectedTool(tool) {
      if (STATE.mode !== 'BUILD' || !BLOCKS[tool]) return;
      STATE.selectedBlock = tool;
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      const active = Array.from(document.querySelectorAll('.tool-btn')).find(element => /** @type {HTMLElement} */ (element).dataset.tool === tool);
      if (active) active.classList.add('active');
      updateControlConfigurationUI();
      updateTelemetry();
      updateGhost();
      updateFlightFeedback();
      autoSave(false);
    }

    function disposeObjectTree(root) {
      if (!root) return;
      root.traverse(obj => {
        if (obj.geometry && obj.geometry !== sharedGeometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        const objectMaterials = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        objectMaterials.forEach(material => {
          if (material && typeof material.dispose === 'function') material.dispose();
        });
      });
    }

    function cleanupFlightState() {
      if (STATE.flight.body) {
        world.removeBody(STATE.flight.body);
        STATE.flight.body = null;
      }
      if (STATE.flight.group) {
        scene.remove(STATE.flight.group);
        disposeObjectTree(STATE.flight.group);
        STATE.flight.group = null;
      }
      STATE.flight.functionalBlocks = [];
      STATE.flight.fuel = 0;
      STATE.flight.fuelMax = 0;
      STATE.flight.analysis = null;
      STATE.flight.compiled = null;
      STATE.flight.thrusterTorqueMax.set(0, 0, 0);
      STATE.flight.gyroCount = 0;
      STATE.flight.blockCount = 0;
      STATE.flight.dragArea = 0;
      STATE.flight.lastLoads = { lift: 0, drag: 0, thrust: 0, impact: 0 };
      STATE.flight.outOfFuel = false;
      STATE.flight.severeImpact = false;
      STATE.flight.integrity = 100;
      STATE.flight.maxImpact = 0;
      STATE.flight.runtimeMass = 0;
      STATE.flight.payloadMass = 0;
      STATE.flight.lastImpactAt = -Infinity;
      for (const debris of STATE.flight.debris) {
        if (debris.body) world.removeBody(debris.body);
        if (debris.visual) { scene.remove(debris.visual); disposeObjectTree(debris.visual); }
      }
      STATE.flight.runtimeParts = [];
      STATE.flight.debris = [];
      STATE.flight.lostParts = 0;
      STATE.flight.leakingFuelRate = 0;
      STATE.flight.firstFailure = '';
      STATE.flight.structuralFailures = 0;
      STATE.flight.initialHealth = 0;
      STATE.flight.gyroAuthority = 0;
      STATE.flight.payloadLocalPos = null;
      STATE.flight.payload = null;
      STATE.flight.pendingImpacts = [];
      STATE.flight.structuralAccumulator = 0;
      STATE.flight.runtimePartByKey = new Map();
      STATE.flight.metricsDirty = true;
      thrustSphere.visible = false;
      liftSphere.visible = false;
      thrustVectorArrow.visible = false;
      liftVectorArrow.visible = false;
      for (const mesh of WORKSHOP.meshesByKey.values()) mesh.visible = true;
      clearPilotAxes();
      setStabilize(false);
    }


    function resetToEmptyCraft(persist = true) {
      cleanupFlightState();
      STATE.mode = 'BUILD';
      STATE.statusText = 'DRYDOCK';
      const cleared = CRAFT.clear('new-empty-craft');
      if (!cleared.ok) throw new Error(`Unable to clear craft: ${cleared.reason}`);
      updateTelemetry();
      updateGhost();
      if (persist) autoSave(false);
    }



    function addBlock(x, y, z, type, orientation = STATE.orientation, allowMirror = true) {
      if (STATE.mode !== 'BUILD') return false;
      x = snapInt(x); y = snapInt(y); z = snapInt(z);
      const safeOrientation = partUsesOrientation(type) ? normalizeOrientationId(orientation) : DEFAULT_ORIENTATION;
      const plan = buildPlacementPlan(x, y, z, type, safeOrientation, allowMirror);
      const validation = CRAFT.validateAddMany(plan);
      if (!validation.ok) return false;
      const historyBefore = collectBlueprint();
      const placed = CRAFT.addMany(plan, 'place-blocks');
      if (!placed.ok) return false;

      commitHistory(historyBefore);
      STATE.statusText = 'DRYDOCK';
      updateTelemetry();
      updateGhost();
      autoSave(false);
      return true;
    }

    function flashInvalid(mesh) {
      if (!mesh || !mesh.material || !mesh.material.emissive) return;
      const original = mesh.material.emissive.getHex();
      mesh.material.emissive.setHex(0xff0000);
      setTimeout(() => {
        if (mesh.material && mesh.material.emissive) mesh.material.emissive.setHex(original);
      }, 160);
    }

    function removeBlock(x, y, z) {
      if (STATE.mode !== 'BUILD') return false;
      x = snapInt(x); y = snapInt(y); z = snapInt(z);
      const key = makeKey(x, y, z);
      const block = CRAFT.get(key);
      if (!block) return false;
      const mesh = WORKSHOP.meshesByKey.get(key);
      const historyBefore = collectBlueprint();
      const removed = CRAFT.remove(key, 'remove-block');
      if (!removed.ok) {
        if (removed.reason === 'disconnected') flashInvalid(mesh);
        updateTelemetry();
        return false;
      }

      commitHistory(historyBefore);
      STATE.statusText = 'DRYDOCK';
      updateTelemetry();
      updateGhost();
      autoSave(false);
      return true;
    }

    function getRootVoxelFromHit(obj) {
      let current = obj;
      while (current && !current.userData.isVoxelRoot && current.parent) current = current.parent;
      return current && current.userData.isVoxelRoot ? current : null;
    }

    const raycaster = new THREE.Raycaster();
    function raycastBuildTarget(ndc) {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([basePlane, ...WORKSHOP.rootMeshes], true);
      if (!hits.length) return null;

      const hit = hits[0];
      if (hit.object === basePlane || hit.object.userData.isBuildSurface) {
        return {
          kind: 'surface',
          position: new THREE.Vector3(snapInt(hit.point.x), 0, snapInt(hit.point.z)),
          root: null,
          normal: new THREE.Vector3(0, 1, 0)
        };
      }

      const root = getRootVoxelFromHit(hit.object);
      if (!root || !hit.face) return null;

      const normal = hit.face.normal.clone().round();
      const position = root.position.clone().add(normal);
      position.set(snapInt(position.x), snapInt(position.y), snapInt(position.z));
      if (position.y < GRID.minY) position.y = GRID.minY;
      return { kind: 'voxel', position, root, normal };
    }

    function hideSymmetryGhosts() {
      symmetryGhosts.forEach(preview => { preview.visible = false; });
    }

    function updateSymmetryGhosts(plan, valid) {
      hideSymmetryGhosts();
      plan.slice(1, 4).forEach((item, index) => {
        const preview = symmetryGhosts[index];
        preview.visible = true;
        preview.position.set(item.x, item.y, item.z);
        preview.material.color.setHex(BLOCKS[item.type].color);
        preview.material.opacity = valid ? 0.45 : 0.16;
      });
    }

    function updateGhost() {
      if (STATE.mode !== 'BUILD' || !STATE.input.pointerInside) {
        ghost.visible = false;
        ghostArrow.visible = false;
        ghostNormalArrow.visible = false;
        hideSymmetryGhosts();
        STATE.hovered.valid = false;
        document.getElementById('ui-adj').textContent = '—';
        return;
      }

      const target = raycastBuildTarget(STATE.input.pointerNDC);
      STATE.hovered.valid = !!target;
      STATE.hovered.kind = target ? target.kind : null;
      STATE.hovered.pos = target ? target.position.clone() : new THREE.Vector3();
      STATE.hovered.normal = target ? target.normal.clone() : new THREE.Vector3(0, 1, 0);
      STATE.hovered.root = target ? target.root : null;

      if (!target) {
        ghost.visible = false;
        ghostArrow.visible = false;
        ghostNormalArrow.visible = false;
        hideSymmetryGhosts();
        document.getElementById('ui-adj').textContent = '—';
        return;
      }

      ghost.visible = true;
      ghost.position.copy(target.position);
      ghost.material.color.setHex(BLOCKS[STATE.selectedBlock].color);
      const plan = buildPlacementPlan(
        target.position.x,
        target.position.y,
        target.position.z,
        STATE.selectedBlock,
        STATE.orientation,
        true
      );
      const valid = canPlacePlan(plan);
      ghost.material.opacity = valid ? 0.55 : 0.2;
      updateSymmetryGhosts(plan, valid);
      document.getElementById('ui-adj').textContent = valid ? `OK ×${plan.length}` : 'NO';

      const showArrow = partUsesOrientation(STATE.selectedBlock);
      ghostArrow.visible = showArrow;
      ghostNormalArrow.visible = STATE.selectedBlock === 'Wing' || STATE.selectedBlock === 'ControlSurface' || STATE.selectedBlock === 'VectorThruster';
      if (showArrow) {
        const basis = getModuleBasis(STATE.orientation);
        ghostArrow.position.copy(target.position);
        ghostArrow.setDirection(basis.chord);
        ghostArrow.setLength(1.35, 0.32, 0.22);
        ghostArrow.setColor(new THREE.Color(axisColor(STATE.orientation)));
        if (STATE.selectedBlock === 'Wing' || STATE.selectedBlock === 'ControlSurface' || STATE.selectedBlock === 'VectorThruster') {
          ghostNormalArrow.position.copy(target.position);
          ghostNormalArrow.setDirection(basis.normal);
          ghostNormalArrow.setLength(1.05, 0.28, 0.18);
        }
      }
    }

    function rayToNDC(clientX, clientY) {
      STATE.input.pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
      STATE.input.pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    }

    function runtimePartHealthFraction(part) {
      return part && part.maxHealth > 0 ? THREE.MathUtils.clamp(part.health / part.maxHealth, 0, 1) : 0;
    }

    function updateRuntimePartVisual(part) {
      if (!part?.visual) return;
      const health = runtimePartHealthFraction(part);
      part.visual.traverse(object => {
        const mats = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
        for (const material of mats) {
          if (!material || !material.emissive) continue;
          if (health < 0.75) material.emissive.setRGB((1 - health) * 0.72, 0.02, 0.01);
        }
      });
    }

    function markFlightMetricsDirty() {
      STATE.flight.metricsDirty = true;
    }

    function getRuntimeCore() {
      return STATE.flight.runtimeParts.find(part => part.type === 'Core') || null;
    }

    function recomputeFlightIntegrity(force = false) {
      if (!force && !STATE.flight.metricsDirty) return;
      const attached = STATE.flight.runtimeParts.filter(part => part.attached);
      const health = attached.reduce((sum, part) => sum + Math.max(0, part.health), 0);
      const core = getRuntimeCore();
      const coreOperational = Boolean(core?.attached && core.health > 0);
      STATE.flight.integrity = coreOperational && STATE.flight.initialHealth > 0
        ? THREE.MathUtils.clamp(health / STATE.flight.initialHealth * 100, 0, 100)
        : 0;
      STATE.flight.dragArea = attached.reduce((sum, part) => sum + (part.def.dragArea || 0) * Math.max(0.15, runtimePartHealthFraction(part)), 0)
        + (STATE.flight.payload?.attached ? 0.2 : 0);
      STATE.flight.gyroAuthority = attached.filter(part => part.type === 'Gyro').reduce((sum, part) => sum + runtimePartHealthFraction(part), 0);
      STATE.flight.gyroCount = STATE.flight.gyroAuthority;
      STATE.flight.leakingFuelRate = attached.filter(part => part.type === 'Fuel').reduce((sum, part) => {
        const health = runtimePartHealthFraction(part);
        return sum + (part.def.leakRate || 0) * Math.max(0, (0.82 - health) / 0.82);
      }, 0);
      STATE.flight.metricsDirty = false;
    }

    function removeShapeFromBody(body, shape) {
      if (!body || !shape) return;
      if (typeof body.removeShape === 'function') body.removeShape(shape);
      else {
        const index = body.shapes.indexOf(shape);
        if (index >= 0) {
          body.shapes.splice(index, 1);
          body.shapeOffsets.splice(index, 1);
          body.shapeOrientations.splice(index, 1);
        }
      }
      if (typeof body.updateBoundingRadius === 'function') body.updateBoundingRadius();
      body.aabbNeedsUpdate = true;
    }

    function createDebrisFromVisual(visual, mass, localPos) {
      const craftBody = STATE.flight.body;
      const group = STATE.flight.group;
      if (!craftBody || !group || !visual) return;
      const worldPosition = craftBody.pointToWorldFrame(localPos);
      const worldVelocity = pointVelocityWorld(craftBody, localPos);
      const craftQuaternion = new THREE.Quaternion(craftBody.quaternion.x, craftBody.quaternion.y, craftBody.quaternion.z, craftBody.quaternion.w);
      const worldQuaternion = craftQuaternion.multiply(visual.quaternion.clone());
      group.remove(visual);
      if (STATE.flight.debris.length >= PHYSICS.maxPhysicalDebris) {
        disposeObjectTree(visual);
        return;
      }
      scene.add(visual);
      visual.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
      visual.quaternion.copy(worldQuaternion);
      const debrisBody = new CANNON.Body({ mass: Math.max(0.15, mass), linearDamping: 0.025, angularDamping: 0.04, allowSleep: true });
      debrisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.47, 0.47, 0.47)));
      debrisBody.position.copy(worldPosition);
      debrisBody.quaternion.set(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w);
      debrisBody.velocity.copy(worldVelocity);
      debrisBody.angularVelocity.copy(craftBody.angularVelocity);
      debrisBody.angularVelocity.x += (Math.random() - 0.5) * 2.5;
      debrisBody.angularVelocity.y += (Math.random() - 0.5) * 2.5;
      debrisBody.angularVelocity.z += (Math.random() - 0.5) * 2.5;
      debrisBody.collisionFilterGroup = COLLISION_GROUP.debris;
      debrisBody.collisionFilterMask = COLLISION_GROUP.world | COLLISION_GROUP.craft;
      debrisBody.userData = { debris: true };
      world.addBody(debrisBody);
      STATE.flight.debris.push({ body: debrisBody, visual, age: 0 });
    }

    function createDetachedDebris(part) {
      if (!part?.visual) return;
      createDebrisFromVisual(part.visual, part.mass, part.localPos);
      part.visual = null;
    }

    function recomputeThrusterTorqueEnvelope() {
      const max = new THREE.Vector3();
      for (const part of STATE.flight.runtimeParts) {
        if (!part.attached || (part.type !== 'Thruster' && part.type !== 'VectorThruster')) continue;
        const force = new CANNON.Vec3(part.localAxis.x * part.force, part.localAxis.y * part.force, part.localAxis.z * part.force);
        const torque = new CANNON.Vec3();
        part.localPos.cross(force, torque);
        part.localTorque.copy(torque);
        max.x = Math.max(max.x, Math.abs(torque.x));
        max.y = Math.max(max.y, Math.abs(torque.y));
        max.z = Math.max(max.z, Math.abs(torque.z));
      }
      STATE.flight.thrusterTorqueMax.copy(max);
    }

    function recenterCraftBody() {
      const body = STATE.flight.body;
      const group = STATE.flight.group;
      if (!body || !group) return;
      const attached = STATE.flight.runtimeParts.filter(part => part.attached);
      const payload = STATE.flight.payload?.attached ? STATE.flight.payload : null;
      let totalMass = payload ? payload.mass : 0;
      const shift = new CANNON.Vec3();
      for (const part of attached) {
        totalMass += part.mass;
        shift.x += part.localPos.x * part.mass;
        shift.y += part.localPos.y * part.mass;
        shift.z += part.localPos.z * part.mass;
      }
      if (payload) {
        shift.x += payload.localPos.x * payload.mass;
        shift.y += payload.localPos.y * payload.mass;
        shift.z += payload.localPos.z * payload.mass;
      }
      if (totalMass <= 0) return;
      shift.scale(1 / totalMass, shift);
      if (shift.lengthSquared() >= 1e-8) {
        const newWorldPosition = body.pointToWorldFrame(shift);
        const newVelocity = pointVelocityWorld(body, shift);
        for (const offset of body.shapeOffsets) {
          offset.x -= shift.x; offset.y -= shift.y; offset.z -= shift.z;
        }
        for (const part of attached) {
          part.localPos.x -= shift.x; part.localPos.y -= shift.y; part.localPos.z -= shift.z;
        }
        if (payload) {
          payload.localPos.x -= shift.x; payload.localPos.y -= shift.y; payload.localPos.z -= shift.z;
          STATE.flight.payloadLocalPos = payload.localPos;
        }
        for (const child of group.children) {
          child.position.x -= shift.x; child.position.y -= shift.y; child.position.z -= shift.z;
        }
        body.position.copy(newWorldPosition);
        body.velocity.copy(newVelocity);
      }
      body.mass = totalMass;
      body.updateMassProperties();
      if (typeof body.updateBoundingRadius === 'function') body.updateBoundingRadius();
      body.aabbNeedsUpdate = true;
      STATE.flight.runtimeMass = totalMass;
      STATE.flight.payloadMass = payload ? payload.mass : 0;
      STATE.flight.lowestLocalY = Math.min(
        ...attached.map(part => part.localPos.y - 0.5),
        payload ? payload.localPos.y - 0.42 : Infinity
      );
      recomputeThrusterTorqueEnvelope();
      markFlightMetricsDirty();
    }

    function collectDisconnectedRuntimeParts() {
      const byKey = STATE.flight.runtimePartByKey;
      const core = getRuntimeCore();
      if (!core?.attached) return STATE.flight.runtimeParts.filter(part => part.attached && part.type !== 'Core');
      const visited = new Set([core.key]);
      const queue = [core.key];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [x,y,z] = queue[cursor].split(',').map(Number);
        for (const [dx,dy,dz] of NEIGHBOR_DIRECTIONS) {
          const key = makeKey(x+dx,y+dy,z+dz);
          const neighbor = byKey.get(key);
          if (neighbor?.attached && !visited.has(key)) { visited.add(key); queue.push(key); }
        }
      }
      return STATE.flight.runtimeParts.filter(part => part.attached && part.type !== 'Core' && !visited.has(part.key));
    }


    function detachRuntimeParts(entries, cascade = true) {
      const pending = new Map();
      for (const entry of entries || []) {
        const part = entry?.part || entry;
        if (part?.attached) pending.set(part, entry?.reason || 'structural failure');
      }
      if (!pending.size) return 0;
      let detachedCount = 0;
      let fuelCapacityLost = 0;
      let coreFailed = false;
      const detachOne = (part, reason) => {
        if (!part?.attached) return;
        if (part.type === 'Core') {
          part.health = 0;
          coreFailed = true;
          STATE.flight.integrity = 0;
          STATE.flight.firstFailure = `Command core failed: ${reason}`;
          return;
        }
        part.attached = false;
        part.health = 0;
        removeShapeFromBody(STATE.flight.body, part.shape);
        createDetachedDebris(part);
        detachedCount += 1;
        STATE.flight.lostParts += 1;
        STATE.flight.structuralFailures += 1;
        if (!STATE.flight.firstFailure) STATE.flight.firstFailure = `${part.type} detached: ${reason}`;
        if (part.type === 'Fuel') fuelCapacityLost += part.def.fuelCapacity || 0;
      };
      for (const [part, reason] of pending) detachOne(part, reason);
      if (cascade && !coreFailed) {
        for (const part of collectDisconnectedRuntimeParts()) detachOne(part, 'connection to core was severed');
      }
      if (fuelCapacityLost > 0) {
        STATE.flight.fuelMax = Math.max(0, STATE.flight.fuelMax - fuelCapacityLost);
        STATE.flight.fuel = Math.min(STATE.flight.fuel, STATE.flight.fuelMax);
      }
      if (detachedCount > 0) {
        STATE.flight.blockCount = Math.max(1, STATE.flight.blockCount - detachedCount);
        recenterCraftBody();
      }
      markFlightMetricsDirty();
      recomputeFlightIntegrity(true);
      if (detachedCount > 0) showStatus(detachedCount === 1 ? 'MODULE LOST' : `${detachedCount} MODULES LOST`, 1100);
      return detachedCount;
    }

    function detachRuntimePart(part, reason = 'structural failure', cascade = true) {
      return detachRuntimeParts([{ part, reason }], cascade) > 0;
    }

    function detachDisconnectedRuntimeParts() {
      const disconnected = collectDisconnectedRuntimeParts();
      return detachRuntimeParts(disconnected.map(part => ({ part, reason: 'connection to core was severed' })), false);
    }

    function applyDamageOnly(part, amount, reason = 'impact') {
      if (!part?.attached || amount <= 0) return false;
      const absorbed = Math.max(0.25, part.def.structural || 1);
      part.health = Math.max(0, part.health - amount / absorbed);
      if (!STATE.flight.firstFailure && runtimePartHealthFraction(part) < 0.55) STATE.flight.firstFailure = `${part.type} critically damaged by ${reason}`;
      updateRuntimePartVisual(part);
      markFlightMetricsDirty();
      return part.health <= 0;
    }

    function damageRuntimePart(part, amount, reason = 'impact') {
      if (applyDamageOnly(part, amount, reason)) detachRuntimeParts([{ part, reason }], true);
      else recomputeFlightIntegrity();
    }

    function updatePayloadVisual() {
      const payload = STATE.flight.payload;
      if (!payload?.visual?.material?.emissive) return;
      const health = payloadHealthFraction();
      payload.visual.material.emissive.setRGB((1 - health) * 0.8, 0.03, 0.01);
    }

    function detachPayload(reason = 'payload mount failure') {
      const payload = STATE.flight.payload;
      if (!payload?.attached) return false;
      payload.attached = false;
      payload.health = 0;
      removeShapeFromBody(STATE.flight.body, payload.shape);
      if (payload.coupler) {
        STATE.flight.group?.remove(payload.coupler);
        disposeObjectTree(payload.coupler);
        payload.coupler = null;
      }
      if (payload.visual) {
        createDebrisFromVisual(payload.visual, payload.mass, payload.localPos);
        payload.visual = null;
      }
      STATE.flight.payloadMass = 0;
      STATE.flight.payloadLocalPos = null;
      if (!STATE.flight.firstFailure) STATE.flight.firstFailure = `Payload lost: ${reason}`;
      recenterCraftBody();
      recomputeFlightIntegrity(true);
      showStatus('PAYLOAD LOST', 1500);
      return true;
    }

    function damagePayload(amount, reason = 'impact') {
      const payload = STATE.flight.payload;
      if (!payload?.attached || amount <= 0) return false;
      payload.health = Math.max(0, payload.health - amount);
      updatePayloadVisual();
      if (payload.health <= 0) return detachPayload(reason);
      return false;
    }

    function applyImpactDamage(localImpact, impact, collisionKind = 'ground') {
      const candidates = STATE.flight.runtimeParts.filter(part => part.attached);
      if (!candidates.length) return;
      let nearest = candidates[0];
      let nearestDistance = Infinity;
      for (const part of candidates) {
        const dx = part.localPos.x - localImpact.x;
        const dy = part.localPos.y - localImpact.y;
        const dz = part.localPos.z - localImpact.z;
        const distance = dx*dx + dy*dy + dz*dz;
        if (distance < nearestDistance) { nearestDistance = distance; nearest = part; }
      }
      const payload = STATE.flight.payload;
      let payloadNearest = false;
      if (payload?.attached) {
        const dx = payload.localPos.x - localImpact.x;
        const dy = payload.localPos.y - localImpact.y;
        const dz = payload.localPos.z - localImpact.z;
        payloadNearest = dx*dx + dy*dy + dz*dz < nearestDistance;
      }
      const multiplier = collisionKind === 'obstacle' ? 4.4 : (collisionKind === 'debris' ? 3.7 : 3.2);
      const energyDamage = Math.max(0, (impact - 3.5) ** 2 * multiplier);
      if (energyDamage <= 0) return;
      const reason = collisionKind === 'obstacle' ? 'collision with range obstacle' : (collisionKind === 'debris' ? 'collision with debris' : 'hard landing');
      const failures = [];
      if (payloadNearest) {
        damagePayload(energyDamage * 0.72, reason);
        const core = getRuntimeCore();
        if (core && applyDamageOnly(core, energyDamage * 0.18, 'payload mount transferred impact')) failures.push({ part: core, reason: 'payload mount transferred impact' });
      } else {
        if (applyDamageOnly(nearest, energyDamage, reason)) failures.push({ part: nearest, reason });
        for (const [dx,dy,dz] of NEIGHBOR_DIRECTIONS) {
          const neighbor = STATE.flight.runtimePartByKey.get(makeKey(nearest.grid.x+dx, nearest.grid.y+dy, nearest.grid.z+dz));
          if (neighbor?.attached && applyDamageOnly(neighbor, energyDamage * PHYSICS.damagePropagation, 'load propagated through connection')) {
            failures.push({ part: neighbor, reason: 'load propagated through connection' });
          }
        }
      }
      if (failures.length) detachRuntimeParts(failures, true);
      recomputeFlightIntegrity(true);
    }

    function runtimeNeighborCount(part) {
      let count = 0;
      for (const [dx,dy,dz] of NEIGHBOR_DIRECTIONS) {
        const neighbor = STATE.flight.runtimePartByKey.get(makeKey(part.grid.x+dx, part.grid.y+dy, part.grid.z+dz));
        if (neighbor?.attached) count += 1;
      }
      return count;
    }

    function applyStructuralLoadDamage(dt, totalThrust, totalLift, totalDrag) {
      const body = STATE.flight.body;
      if (!body || body.mass <= 0) return;
      const loadAcceleration = (Math.abs(totalThrust) + Math.abs(totalLift) + Math.abs(totalDrag)) / Math.max(1, body.mass);
      const spin = body.angularVelocity.length();
      const failures = [];
      const candidates = STATE.flight.runtimeParts.filter(part => part.attached && part.type !== 'Core');
      for (const part of candidates) {
        const support = runtimeNeighborCount(part);
        const lever = part.localPos.length();
        const structural = Math.max(0.2, part.def.structural || 1);
        const supportFactor = 0.72 + support * 0.42;
        const translationalStress = loadAcceleration * (0.24 + lever * 0.12);
        const rotationalStress = spin * spin * lever * 1.55;
        const stress = (translationalStress + rotationalStress) / (structural * supportFactor);
        if (stress > 42 && applyDamageOnly(part, (stress - 42) * dt * 1.7, 'flight-load overstress')) failures.push({ part, reason: 'flight-load overstress' });
      }
      if (failures.length) detachRuntimeParts(failures, true);
      recomputeFlightIntegrity();
    }

    function processPendingImpacts() {
      if (!STATE.flight.body || !STATE.flight.pendingImpacts.length) return;
      const impacts = STATE.flight.pendingImpacts.splice(0);
      for (const entry of impacts) {
        if (!STATE.flight.body) break;
        applyImpactDamage(entry.localImpact, entry.impact, entry.collisionKind);
        if (entry.impact >= PHYSICS.severeImpactSpeed && !STATE.flight.severeImpact) {
          STATE.flight.severeImpact = true;
          showStatus(entry.collisionKind === 'obstacle' ? 'SEVERE COLLISION' : (entry.collisionKind === 'debris' ? 'DEBRIS IMPACT' : 'SEVERE IMPACT'), 1800);
        } else if (entry.impact >= PHYSICS.hardImpactSpeed) {
          showStatus(entry.collisionKind === 'obstacle' ? 'OBSTACLE COLLISION' : (entry.collisionKind === 'debris' ? 'DEBRIS IMPACT' : 'HARD LANDING'), 1100);
        }
      }
    }

    function syncDebris(dt) {
      for (let index = STATE.flight.debris.length - 1; index >= 0; index--) {
        const debris = STATE.flight.debris[index];
        debris.age += dt;
        debris.visual.position.copy(debris.body.position);
        debris.visual.quaternion.copy(debris.body.quaternion);
        if (debris.age > PHYSICS.debrisLifetime || debris.body.position.y < -20) {
          world.removeBody(debris.body);
          scene.remove(debris.visual);
          disposeObjectTree(debris.visual);
          STATE.flight.debris.splice(index, 1);
        }
      }
    }

    function buildFlightBody() {
      cleanupFlightState();

      const analysis = computeCraftAnalysis();
      if (!analysis.snapshot.ready || analysis.mass <= 0 || !isStructureContiguous()) {
        const reason = analysis.snapshot.errors?.[0] || 'invalid-craft';
        showStatus(`CANNOT LAUNCH: ${String(reason).replaceAll('-', ' ').toUpperCase()}`, 2200);
        return false;
      }
      const contract = getSelectedContract();
      const payloadMass = Math.max(0, contract.payloadMass || 0);
      const snapshot = buildLoadedSnapshot(analysis.snapshot, payloadMass);
      const payloadPosition = snapshot.payloadPosition || missionPayloadPositionVector(snapshot);
      const runtimeMass = snapshot.mass;
      const runtimeCom = snapshot.com;
      STATE.flight.com.copy(runtimeCom);

      const body = new CANNON.Body({
        mass: runtimeMass,
        linearDamping: 0.005,
        angularDamping: 0.012,
        allowSleep: false
      });
      body.collisionFilterGroup = COLLISION_GROUP.craft;
      body.collisionFilterMask = COLLISION_GROUP.world | COLLISION_GROUP.debris;
      const group = new THREE.Group();
      scene.add(group);

      const functionalBlocks = [];
      const runtimeParts = [];
      STATE.flight.payloadLocalPos = null;
      STATE.flight.payload = null;
      const thrusterTorqueMax = new THREE.Vector3();
      let gyroCount = 0;
      let lowestLocalY = Infinity;

      for (const part of snapshot.parts) {
        const offsetThree = part.offset;
        const localOffset = new CANNON.Vec3(offsetThree.x, offsetThree.y, offsetThree.z);
        lowestLocalY = Math.min(lowestLocalY, localOffset.y - 0.5);
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        body.addShape(shape, localOffset);

        const visual = createModuleVisual(part.type, part.orientation, false);
        visual.position.set(localOffset.x, localOffset.y, localOffset.z);
        group.add(visual);
        const key = part.key;
        const sourceMesh = WORKSHOP.meshesByKey.get(key);
        if (sourceMesh) sourceMesh.visible = false;

        const fullForce = (part.type === 'Thruster' || part.type === 'VectorThruster') ? part.basis.chord.clone().multiplyScalar(part.def.force || 0) : new THREE.Vector3();
        const torqueThree = offsetThree.clone().cross(fullForce);
        const localTorque = new CANNON.Vec3(torqueThree.x, torqueThree.y, torqueThree.z);
        const runtimePart = {
          key, grid: { x: part.position.x, y: part.position.y, z: part.position.z }, type: part.type, def: part.def,
          visual, shape, localPos: localOffset.clone(), orientation: part.orientation,
          localAxis: new CANNON.Vec3(part.basis.chord.x, part.basis.chord.y, part.basis.chord.z),
          localNormal: new CANNON.Vec3(part.basis.normal.x, part.basis.normal.y, part.basis.normal.z),
          localSpan: new CANNON.Vec3(part.basis.span.x, part.basis.span.y, part.basis.span.z),
          localTorque, force: part.def.force || 0, wingArea: part.def.wingArea || 0, fuelRate: part.def.fuelRate || 0,
          controlAxis: normalizeControlAxis(part.controlAxis), controlSign: normalizeControlSign(part.controlSign),
          mass: part.def.mass || 0, maxHealth: part.def.durability || 60, health: part.def.durability || 60,
          attached: true, lastCommand: 0, gimbalA: 0, gimbalB: 0, controlDeflection: 0
        };
        runtimeParts.push(runtimePart);
        if (part.type === 'Thruster' || part.type === 'VectorThruster') {
          thrusterTorqueMax.x = Math.max(thrusterTorqueMax.x, Math.abs(localTorque.x));
          thrusterTorqueMax.y = Math.max(thrusterTorqueMax.y, Math.abs(localTorque.y));
          thrusterTorqueMax.z = Math.max(thrusterTorqueMax.z, Math.abs(localTorque.z));
        }
        if (part.type === 'Gyro') gyroCount += 1;
        if (['Thruster','VectorThruster','Balloon','Wing','ControlSurface','Gyro','Fuel'].includes(part.type)) functionalBlocks.push(runtimePart);
      }

      if (payloadMass > 0) {
        const payloadOffsetThree = snapshot.payloadOffset || payloadPosition.clone().sub(runtimeCom);
        const payloadOffset = new CANNON.Vec3(payloadOffsetThree.x, payloadOffsetThree.y, payloadOffsetThree.z);
        lowestLocalY = Math.min(lowestLocalY, payloadOffset.y - 0.42);
        const payloadShape = new CANNON.Box(new CANNON.Vec3(0.42, 0.42, 0.42));
        body.addShape(payloadShape, payloadOffset);
        STATE.flight.payloadLocalPos = payloadOffset.clone();
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.84, 0.84, 0.84),
          new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.72, metalness: 0.18, emissive: 0x082f49, emissiveIntensity: 0.16 })
        );
        crate.position.set(payloadOffset.x, payloadOffset.y, payloadOffset.z);
        crate.castShadow = true;
        crate.receiveShadow = true;
        crate.userData.isMissionPayload = true;
        group.add(crate);
        let coupler = null;
        const corePart = snapshot.parts.find(part => part.type === 'Core');
        if (corePart) {
          coupler = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.24, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.48, metalness: 0.45, emissive: 0x0c4a6e, emissiveIntensity: 0.12 })
          );
          coupler.position.copy(payloadOffsetThree.clone().add(corePart.offset).multiplyScalar(0.5));
          coupler.castShadow = true;
          group.add(coupler);
        }
        const payloadMaxHealth = 80 + payloadMass * 2.5;
        STATE.flight.payload = { mass: payloadMass, localPos: payloadOffset, shape: payloadShape, visual: crate, coupler, health: payloadMaxHealth, maxHealth: payloadMaxHealth, attached: true };
      }

      body.position.set(TEST_RANGE.spawn.x + runtimeCom.x, -0.45 - lowestLocalY, TEST_RANGE.spawn.z + runtimeCom.z);
      body.quaternion.set(0, 0, 0, 1);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.updateMassProperties();
      body.aabbNeedsUpdate = true;
      body.addEventListener('collide', event => {
        if (!STATE.flight.body || STATE.flight.body !== body) return;
        let impact = Math.abs(body.velocity.y);
        if (event.contact && typeof event.contact.getImpactVelocityAlongNormal === 'function') impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
        STATE.flight.lastLoads.impact = Math.max(STATE.flight.lastLoads.impact || 0, impact);
        STATE.flight.maxImpact = Math.max(STATE.flight.maxImpact, impact);
        const otherBody = event.body || null;
        if (otherBody === groundBody) STATE.mission.lastGroundContact = STATE.mission.elapsed;
        const damageNow = STATE.mission.elapsed;
        const collisionKind = otherBody?.userData?.rangeObstacle ? 'obstacle' : (otherBody?.userData?.debris ? 'debris' : 'ground');
        if (impact > 3.5 && damageNow - STATE.flight.lastImpactAt > 0.25) {
          let localImpact = new CANNON.Vec3(0, STATE.flight.lowestLocalY, 0);
          const contact = event.contact;
          if (contact) {
            const worldRelative = contact.bi === body ? contact.ri : contact.rj;
            if (worldRelative) localImpact = body.vectorToLocalFrame(worldRelative);
          }
          STATE.flight.pendingImpacts.push({
            localImpact: localImpact.clone(),
            impact,
            collisionKind,
            timestamp: damageNow
          });
          STATE.flight.lastImpactAt = damageNow;
        }
      });
      world.addBody(body);

      STATE.flight.body = body;
      STATE.flight.group = group;
      STATE.flight.functionalBlocks = functionalBlocks;
      STATE.flight.runtimeParts = runtimeParts;
      STATE.flight.runtimePartByKey = new Map(runtimeParts.map(part => [part.key, part]));
      STATE.flight.fuelMax = Math.max(0, analysis.fuelCapacity);
      STATE.flight.fuel = STATE.flight.fuelMax;
      STATE.flight.analysis = analysis;
      STATE.flight.compiled = snapshot.compiled;
      STATE.flight.thrusterTorqueMax.copy(thrusterTorqueMax);
      STATE.flight.gyroCount = gyroCount;
      STATE.flight.blockCount = snapshot.parts.length;
      STATE.flight.dragArea = snapshot.dragArea;
      STATE.flight.lastLoads = { lift: 0, drag: 0, thrust: 0, impact: 0 };
      STATE.flight.outOfFuel = false;
      STATE.flight.severeImpact = false;
      STATE.flight.integrity = 100;
      STATE.flight.maxImpact = 0;
      STATE.flight.lowestLocalY = Number.isFinite(lowestLocalY) ? lowestLocalY : -0.5;
      STATE.flight.runtimeMass = runtimeMass;
      STATE.flight.payloadMass = payloadMass;
      STATE.flight.lastImpactAt = -Infinity;
      STATE.flight.lostParts = 0;
      STATE.flight.leakingFuelRate = 0;
      STATE.flight.firstFailure = '';
      STATE.flight.structuralFailures = 0;
      STATE.flight.initialHealth = runtimeParts.reduce((sum, part) => sum + part.maxHealth, 0);
      STATE.flight.gyroAuthority = gyroCount;
      STATE.flight.pendingImpacts = [];
      STATE.flight.metricsDirty = true;
      recomputeFlightIntegrity(true);

      STATE.camera.target.copy(body.position);
      camera.position.set(body.position.x + 13, body.position.y + 7, body.position.z + 13);
      return true;
    }

    function setMode(mode) {
      if (mode !== 'BUILD' && mode !== 'FLIGHT') return;
      cancelStatusToast();
      if (mode === STATE.mode) return;

      if (mode === 'BUILD') {
        cleanupFlightState();
        STATE.mode = 'BUILD';
        for (const mesh of WORKSHOP.meshesByKey.values()) mesh.visible = true;
        comSphere.visible = CRAFT.size > 0;
        axesHelper.visible = true;
        gridHelper.visible = true;
        basePlane.visible = true;
        STATE.statusText = 'DRYDOCK';
        testRangeGroup.visible = false;
        missionMarkerGroup.visible = false;
        document.getElementById('mission-hud').hidden = true;
        STATE.mission.status = 'IDLE';
        STATE.mission.active = false;
        STATE.mission.contractId = null;
        STATE.mission.previousPosition = null;
        STATE.mission.helpPaused = false;
      } else {
        const compiled = CraftCompiler.compile(CRAFT);
        if (compiled.blockCount > PHYSICS.maxFlightParts) {
          STATE.statusText = 'CRAFT TOO LARGE';
          showStatus(`FLIGHT LIMIT: ${PHYSICS.maxFlightParts} MODULES`, 2200);
          updateTelemetry();
          updateResponsivePanels();
          updateHistoryButtons();
          return;
        }
        const ok = buildFlightBody();
        if (!ok) {
          STATE.mode = 'BUILD';
          STATE.statusText = 'INVALID CRAFT';
          updateTelemetry();
          updateResponsivePanels();
          updateHistoryButtons();
          return;
        }
        STATE.mode = 'FLIGHT';
        ghost.visible = false;
        ghostArrow.visible = false;
        ghostNormalArrow.visible = false;
        hideSymmetryGhosts();
        comSphere.visible = false;
        thrustSphere.visible = false;
        liftSphere.visible = false;
        thrustVectorArrow.visible = false;
        liftVectorArrow.visible = false;
        axesHelper.visible = false;
        gridHelper.visible = false;
        basePlane.visible = false;
        const criticalCount = STATE.flight.analysis.warnings.filter(item => item.level === 'critical').length;
        const warningCount = STATE.flight.analysis.warnings.filter(item => item.level === 'warn').length;
        STATE.statusText = criticalCount
          ? `TEST • ${criticalCount} CRITICAL`
          : (warningCount ? `TEST • ${warningCount} WARNINGS` : 'STABLE TEST');
        testRangeGroup.visible = true;
        startMissionSession();
      }

      applyWorkspaceLayout();
      syncContractPanelVisibility();
      updateTelemetry();
      updateGhost();
      updateFlightFeedback();
      updateResponsivePanels();
      updateHistoryButtons();
      autoSave(false);
    }



    function syncFlightVisuals() {
      if (!STATE.flight.body || !STATE.flight.group) return;
      STATE.flight.group.position.copy(STATE.flight.body.position);
      STATE.flight.group.quaternion.copy(STATE.flight.body.quaternion);
    }


    function applyCameraOrbit() {
      const pitch = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, STATE.camera.pitch));
      const r = STATE.camera.distance;
      const x = STATE.camera.target.x + r * Math.cos(pitch) * Math.cos(STATE.camera.yaw);
      const z = STATE.camera.target.z + r * Math.cos(pitch) * Math.sin(STATE.camera.yaw);
      const y = STATE.camera.target.y + r * Math.sin(pitch);
      camera.position.set(x, y, z);
      camera.lookAt(STATE.camera.target);
    }

    function performBuildAction(button) {
      if (STATE.mode !== 'BUILD') return;
      const target = raycastBuildTarget(STATE.input.pointerNDC);
      if (!target) return;
      if (button === 0) {
        addBlock(target.position.x, target.position.y, target.position.z, STATE.selectedBlock, STATE.orientation, true);
      } else if (button === 2 && target.kind === 'voxel') {
        removeBlock(target.root.position.x, target.root.position.y, target.root.position.z);
      }
    }

    function performTouchAction() {
      const target = raycastBuildTarget(STATE.input.pointerNDC);
      if (!target || STATE.mode !== 'BUILD') return;
      if (STATE.input.touchAction === 'remove') {
        if (target.kind === 'voxel') removeBlock(target.root.position.x, target.root.position.y, target.root.position.z);
      } else {
        addBlock(target.position.x, target.position.y, target.position.z, STATE.selectedBlock, STATE.orientation, true);
      }
    }

    function resetCamera() {
      STATE.camera.target.copy(STATE.camera.defaultTarget);
      STATE.camera.yaw = STATE.camera.defaultYaw;
      STATE.camera.pitch = STATE.camera.defaultPitch;
      STATE.camera.distance = STATE.camera.defaultDistance;
      if (STATE.mode === 'FLIGHT' && STATE.flight.body) {
        STATE.camera.target.copy(STATE.flight.body.position);
      }
      applyCameraOrbit();
    }

    function toggleSymmetry() {
      if (STATE.mode !== 'BUILD') return;
      const idx = SYMMETRY_MODES.indexOf(STATE.symmetry);
      STATE.symmetry = SYMMETRY_MODES[(idx + 1) % SYMMETRY_MODES.length];
      updateHUD();
      updateGhost();
      autoSave(false);
    }

    function collectBlueprint() {
      return CRAFT.toDocument({
        selectedBlock: STATE.selectedBlock,
        selectedOrientation: STATE.orientation,
        symmetry: STATE.symmetry,
        thrusterPower: STATE.thrusterPower,
        balloonPower: STATE.balloonPower,
        stabilityAssist: STATE.stabilityAssist,
        controlAxis: STATE.controlAxis,
        controlSign: STATE.controlSign
      });
    }

    function cloneBlueprint(data = collectBlueprint()) { return Blueprint.clone(data); }

    function blueprintSignature(data) { return Blueprint.signature(data); }

    function updateHistoryButtons() {
      const undoButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-undo'));
      const redoButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-redo'));
      if (undoButton) undoButton.disabled = !STATE.history.canUndo || STATE.mode !== 'BUILD';
      if (redoButton) redoButton.disabled = !STATE.history.canRedo || STATE.mode !== 'BUILD';
    }

    function commitHistory(previousBlueprint) {
      if (!previousBlueprint) return;
      const committed = STATE.history.commit(previousBlueprint, collectBlueprint());
      if (!committed) return;
      updateHistoryButtons();
      updateControlConfigurationUI();
    }

    function restoreHistoryBlueprint(blueprint) {
      const restored = loadBlueprintData(blueprint);
      if (restored) autoSave(false, true);
      updateHistoryButtons();
      return restored;
    }

    function undoBlueprint() {
      if (STATE.mode !== 'BUILD' || !STATE.history.canUndo) return;
      const current = cloneBlueprint();
      const target = STATE.history.undo(current);
      if (!target) return;
      if (restoreHistoryBlueprint(target)) {
        showStatus('UNDO', 650);
      } else {
        STATE.history.rollbackUndo(current, target);
        updateHistoryButtons();
      }
    }

    function redoBlueprint() {
      if (STATE.mode !== 'BUILD' || !STATE.history.canRedo) return;
      const current = cloneBlueprint();
      const target = STATE.history.redo(current);
      if (!target) return;
      if (restoreHistoryBlueprint(target)) {
        showStatus('REDO', 650);
      } else {
        STATE.history.rollbackRedo(current, target);
        updateHistoryButtons();
      }
    }

    function normalizeBlueprintData(data) { return Blueprint.normalize(data); }

    function loadBlueprintData(data) {
      const normalized = normalizeBlueprintData(data);
      if (!normalized) return false;

      cleanupFlightState();
      STATE.mode = 'BUILD';
      STATE.statusText = 'DRYDOCK';
      STATE.selectedBlock = normalized.selectedBlock;
      STATE.orientation = normalized.orientation;
      STATE.symmetry = normalized.symmetry;
      STATE.thrusterPower = normalized.thrusterPower;
      STATE.balloonPower = normalized.balloonPower;
      STATE.stabilityAssist = normalized.stabilityAssist;
      STATE.controlAxis = normalized.controlAxis;
      STATE.controlSign = normalized.controlSign;

      /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = String(Math.round(STATE.thrusterPower * 100));
      /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = String(Math.round(STATE.balloonPower * 100));
      /** @type {HTMLInputElement} */ (document.getElementById('stability')).value = String(Math.round(STATE.stabilityAssist * 100));

      const replacement = CRAFT.replace(normalized.blocks, 'load-blueprint');
      if (!replacement.ok) {
        console.error('CraftModel rejected a normalized blueprint:', replacement.reason);
        const fallback = CRAFT.clear('load-fallback-empty');
        if (!fallback.ok) throw new Error(`Unable to restore empty workshop: ${fallback.reason}`);
        updateTelemetry();
        return false;
      }

      document.querySelectorAll('.tool-btn').forEach(element => {
        const btn = /** @type {HTMLElement} */ (element);
        btn.classList.toggle('active', btn.dataset.tool === STATE.selectedBlock);
      });
      comSphere.visible = CRAFT.size > 0;
      axesHelper.visible = true;
      updateTelemetry();
      updateGhost();
      updateControlConfigurationUI();
      syncHudVisibility();
      return true;
    }

    let autosaveTimer = null;
    function persistBlueprint(showToast = false) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(collectBlueprint()));
        if (showToast) showStatus('SAVED', 800);
        return true;
      } catch (error) {
        console.error('Blueprint save failed:', error);
        showStatus('SAVE ERROR', 1400);
        return false;
      }
    }

    function saveBlueprint() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      persistBlueprint(true);
    }

    function autoSave(showToast = false, immediate = false) {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      if (immediate) {
        autosaveTimer = null;
        persistBlueprint(showToast);
        return;
      }
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        persistBlueprint(showToast);
      }, 220);
    }

    function loadBlueprint(recordHistory = false) {
      const previous = recordHistory ? collectBlueprint() : null;
      const keys = [SAVE_KEY, ...LEGACY_SAVE_KEYS];
      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (!loadBlueprintData(parsed)) continue;
          if (recordHistory) commitHistory(previous);
          if (key !== SAVE_KEY || parsed.version !== SAVE_VERSION) autoSave(false, true);
          if (recordHistory) showStatus('LOADED', 800);
          return true;
        } catch (error) {
          console.warn(`Blueprint load failed for ${key}:`, error);
        }
      }
      return false;
    }

    function newBlueprint() {
      const historyBefore = collectBlueprint();
      STATE.selectedBlock = 'Hull';
      STATE.orientation = DEFAULT_ORIENTATION;
      STATE.symmetry = 'NONE';
      STATE.thrusterPower = 0.7;
      STATE.balloonPower = 0.7;
      STATE.stabilityAssist = 0.18;
      /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = '70';
      /** @type {HTMLInputElement} */ (document.getElementById('balloon-power')).value = '70';
      /** @type {HTMLInputElement} */ (document.getElementById('stability')).value = '18';
      resetToEmptyCraft(false);
      document.querySelectorAll('.tool-btn').forEach(element => {
        const btn = /** @type {HTMLElement} */ (element);
        btn.classList.toggle('active', btn.dataset.tool === STATE.selectedBlock);
      });
      commitHistory(historyBefore);
      updateHUD();
      updateGhost();
      autoSave(false);
      showStatus('NEW BLUEPRINT', 800);
    }

    function exportBlueprint() {
      try {
        const payload = JSON.stringify(collectBlueprint(), null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `voxel-aeronautics-blueprint-v${SAVE_VERSION}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        showStatus('EXPORTED', 800);
      } catch (error) {
        console.error('Blueprint export failed:', error);
        showStatus('EXPORT ERROR', 1400);
      }
    }

    function importBlueprintFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const historyBefore = collectBlueprint();
          if (!loadBlueprintData(parsed)) throw new Error('Blueprint validation failed');
          commitHistory(historyBefore);
          autoSave(false, true);
          showStatus('IMPORTED', 900);
        } catch (error) {
          console.error('Blueprint import failed:', error);
          showStatus('INVALID BLUEPRINT', 1600);
        }
      };
      reader.onerror = () => showStatus('IMPORT ERROR', 1400);
      reader.readAsText(file);
    }

    const directionContainer = document.getElementById('direction-container');
    AXES.forEach((axis, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.axisIndex = String(index);
      btn.className = 'axis-btn';
      const label = AXIS_LABELS[index];
      const tone = Math.abs(axis.y) > 0.5 ? 'text-emerald-300' : (Math.abs(axis.z) > 0.5 ? 'text-sky-300' : 'text-rose-300');
      btn.innerHTML = `<span class="block text-sm ${tone}">${label}</span><span class="block text-[10px] text-gray-400">set direction</span>`;
      btn.addEventListener('click', () => setOrientationByVector(axis));
      directionContainer.appendChild(btn);
    });
    document.getElementById('btn-roll-orientation-left')?.addEventListener('click', () => applyBuildRotation(-1));
    document.getElementById('btn-roll-orientation-right')?.addEventListener('click', () => applyBuildRotation(1));

    const toolContainer = document.getElementById('tool-container');
    Object.keys(BLOCKS).forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tool = name;
      btn.className = `tool-btn ${name === STATE.selectedBlock ? 'active' : ''}`;
      const colorHex = `#${BLOCKS[name].color.toString(16).padStart(6, '0')}`;
      const displayName = name.replace(/([a-z])([A-Z])/g, '$1 $2');
      const shortcutIndex = name === 'Core' ? 0 : Object.keys(BLOCKS).filter(type => type !== 'Core').indexOf(name) + 1;
      btn.innerHTML = `
        <div class="w-6 h-6 rounded border border-white/30 shrink-0" style="background:${colorHex}"></div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-white leading-tight">${displayName}</div>
          <div class="text-[10px] text-gray-400">${BLOCKS[name].desc}</div>
        </div>
        <div class="text-[10px] font-mono text-slate-500">${shortcutIndex <= 9 ? shortcutIndex : ''}</div>
      `;
      btn.addEventListener('click', () => setSelectedTool(name));
      toolContainer.appendChild(btn);
    });

    renderer.domElement.addEventListener('pointerenter', () => {
      STATE.input.pointerInside = true;
      updateGhost();
    });

    renderer.domElement.addEventListener('pointerleave', () => {
      STATE.input.pointerInside = false;
      STATE.hovered.valid = false;
      updateGhost();
    });

    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (isOverUI(e.target)) return;
      rayToNDC(e.clientX, e.clientY);
      STATE.input.activePointers.set(e.pointerId, {
        pointerType: e.pointerType || 'mouse',
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
        button: e.button
      });
      STATE.input.downButton = e.button;
      STATE.input.downMoved = false;
      STATE.input.dragStartX = e.clientX;
      STATE.input.dragStartY = e.clientY;

      if (e.pointerType === 'touch') {
        STATE.input.pointerInside = true;
        renderer.domElement.setPointerCapture(e.pointerId);
        const touchCount = touchPointerCount();
        if (touchCount >= 2) {
          const touches = [...STATE.input.activePointers.values()].filter(p => p.pointerType === 'touch');
          const a = { x: touches[0].x, y: touches[0].y };
          const b = { x: touches[1].x, y: touches[1].y };
          STATE.input.pinchStartDistance = distance2D(a, b);
          STATE.input.pinchStartCameraDistance = STATE.camera.distance;
          STATE.input.pinchStartCenterX = (a.x + b.x) / 2;
          STATE.input.pinchStartCenterY = (a.y + b.y) / 2;
        }
        e.preventDefault();
        return;
      }

      const orbitAllowed = e.altKey || e.button === 1;
      if (orbitAllowed) {
        STATE.input.orbitDrag = true;
        renderer.domElement.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
      if (isOverUI(e.target)) return;
      rayToNDC(e.clientX, e.clientY);

      const pointer = STATE.input.activePointers.get(e.pointerId);
      const previousX = pointer ? pointer.x : e.clientX;
      const previousY = pointer ? pointer.y : e.clientY;
      if (pointer) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }

      const isTouch = e.pointerType === 'touch';
      const touchCount = touchPointerCount();

      if (isTouch && touchCount >= 2) {
        const touches = [...STATE.input.activePointers.values()].filter(p => p.pointerType === 'touch');
        if (touches.length >= 2) {
          const a = { x: touches[0].x, y: touches[0].y };
          const b = { x: touches[1].x, y: touches[1].y };
          const currentDistance = Math.max(40, distance2D(a, b));
          const zoomRatio = STATE.input.pinchStartDistance / currentDistance;
          STATE.camera.distance = THREE.MathUtils.clamp(STATE.input.pinchStartCameraDistance * zoomRatio, 6, 55);

          const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const dx = center.x - STATE.input.pinchStartCenterX;
          const dy = center.y - STATE.input.pinchStartCenterY;
          STATE.input.pinchStartCenterX = center.x;
          STATE.input.pinchStartCenterY = center.y;
          STATE.camera.yaw -= dx * 0.006;
          STATE.camera.pitch -= dy * 0.006;
          STATE.input.orbitDrag = true;
          updateGhost();
          return;
        }
      }

      if (isTouch && touchCount === 1) {
        const p = [...STATE.input.activePointers.values()].find(v => v.pointerType === 'touch');
        if (!p) return;
        const dx = e.clientX - previousX;
        const dy = e.clientY - previousY;
        const totalMoved = Math.abs(e.clientX - p.startX) + Math.abs(e.clientY - p.startY);
        if (totalMoved > 7) {
          STATE.camera.yaw -= dx * 0.008;
          STATE.camera.pitch -= dy * 0.008;
          STATE.input.orbitDrag = true;
          STATE.input.downMoved = true;
          updateGhost();
        }
        return;
      }

      if (STATE.input.orbitDrag && !isTouch) {
        const dx = e.clientX - STATE.input.dragStartX;
        const dy = e.clientY - STATE.input.dragStartY;
        STATE.input.dragStartX = e.clientX;
        STATE.input.dragStartY = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          STATE.camera.yaw -= dx * 0.008;
          STATE.camera.pitch -= dy * 0.008;
          STATE.input.downMoved = true;
        }
      }

      if (STATE.mode === 'BUILD') updateGhost();
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      if (isOverUI(e.target)) return;
      rayToNDC(e.clientX, e.clientY);
      const pointer = STATE.input.activePointers.get(e.pointerId);
      const startTime = pointer ? pointer.startTime : performance.now();
      const moved = pointer ? Math.abs(e.clientX - pointer.startX) + Math.abs(e.clientY - pointer.startY) : 999;
      const isTouch = e.pointerType === 'touch';
      const orbitWasActive = STATE.input.orbitDrag;

      STATE.input.activePointers.delete(e.pointerId);

      if (isTouch) {
        const remainingTouches = touchPointerCount();
        if (remainingTouches < 2) {
          STATE.input.pinchStartCenterX = 0;
          STATE.input.pinchStartCenterY = 0;
        }
        const tapDuration = performance.now() - startTime;
        const wasTap = tapDuration < 280 && moved < 12 && !orbitWasActive;
        STATE.input.orbitDrag = remainingTouches > 0 && STATE.input.orbitDrag;
        if (remainingTouches === 0) STATE.input.pointerInside = false;
        if (wasTap) performTouchAction();
        updateGhost();
        return;
      }

      STATE.input.orbitDrag = false;
      if (orbitWasActive) {
        STATE.input.downButton = -1;
        updateGhost();
        return;
      }

      if (STATE.mode === 'BUILD' && !STATE.input.downMoved) {
        if (e.button === 0 || e.button === 2) performBuildAction(e.button);
      }
      STATE.input.downButton = -1;
    });

    renderer.domElement.addEventListener('pointercancel', (e) => {
      STATE.input.activePointers.delete(e.pointerId);
      STATE.input.orbitDrag = touchPointerCount() > 0 && STATE.input.orbitDrag;
      if (touchPointerCount() === 0 && e.pointerType === 'touch') STATE.input.pointerInside = false;
    });

    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    renderer.domElement.addEventListener('wheel', (e) => {
      if (isOverUI(e.target)) return;
      STATE.camera.distance = THREE.MathUtils.clamp(STATE.camera.distance + e.deltaY * 0.01, 6, 55);
      updateGhost();
      e.preventDefault();
    }, { passive: false });

    document.getElementById('thruster-power').addEventListener('input', (e) => {
      STATE.thrusterPower = Number(/** @type {HTMLInputElement} */ (e.target).value) / 100;
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    });

    document.getElementById('balloon-power').addEventListener('input', (e) => {
      STATE.balloonPower = Number(/** @type {HTMLInputElement} */ (e.target).value) / 100;
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    });

    document.getElementById('stability').addEventListener('input', (e) => {
      STATE.stabilityAssist = Number(/** @type {HTMLInputElement} */ (e.target).value) / 100;
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    });

    bindWorkspacePanels();
    applyWorkspaceLayout();
    document.getElementById('btn-flight').addEventListener('click', () => setMode('FLIGHT'));
    document.getElementById('btn-contract-panel-open')?.addEventListener('click', () => setWorkspacePanelOpen('contracts', true));
    document.getElementById('btn-build').addEventListener('click', requestReturnToWorkshop);
    document.getElementById('btn-help').addEventListener('click', () => setHelpVisible(true));
    document.getElementById('btn-ui-toggle').addEventListener('click', () => {
      STATE.uiCollapsed = !STATE.uiCollapsed;
      syncHudVisibility();
    });
    document.getElementById('btn-ui-build').addEventListener('click', () => {
      if (STATE.mode === 'FLIGHT') requestReturnToWorkshop();
      else setMode('BUILD');
      STATE.uiCollapsed = false;
      syncHudVisibility();
    });
    document.getElementById('btn-ui-flight').addEventListener('click', () => {
      setMode('FLIGHT');
      STATE.uiCollapsed = false;
      syncHudVisibility();
    });
    document.getElementById('btn-ui-save').addEventListener('click', () => saveBlueprint());
    document.getElementById('btn-ui-help').addEventListener('click', () => setHelpVisible(true));
    document.getElementById('close-help').addEventListener('click', () => setHelpVisible(false));
    document.getElementById('start-engineering').addEventListener('click', () => setHelpVisible(false));
    document.getElementById('btn-debrief-workshop').addEventListener('click', returnToWorkshopFromDebrief);
    document.getElementById('btn-debrief-retry').addEventListener('click', retryContractFromDebrief);
    document.getElementById('btn-starter-craft').addEventListener('click', loadStarterCraft);
    document.getElementById('btn-control-axis')?.addEventListener('click', cycleControlAxis);
    document.getElementById('btn-control-sign')?.addEventListener('click', cycleControlSign);
    document.getElementById('btn-symmetry').addEventListener('click', toggleSymmetry);
    document.getElementById('btn-save').addEventListener('click', () => saveBlueprint());
    document.getElementById('btn-load').addEventListener('click', () => {
      if (!loadBlueprint(true)) showStatus('LOAD ERROR', 1400);
    });
    document.getElementById('btn-clear').addEventListener('click', () => newBlueprint());
    document.getElementById('btn-undo')?.addEventListener('click', undoBlueprint);
    document.getElementById('btn-redo')?.addEventListener('click', redoBlueprint);
    document.getElementById('btn-export')?.addEventListener('click', exportBlueprint);
    document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('blueprint-file')?.click());
    document.getElementById('blueprint-file')?.addEventListener('change', event => {
      const input = /** @type {HTMLInputElement} */ (event.target);
      importBlueprintFile(input.files?.[0]);
      input.value = '';
    });

    const touchPlace = document.getElementById('btn-touch-place');
    const touchRemove = document.getElementById('btn-touch-remove');
    const touchRotate = document.getElementById('btn-touch-rotate');
    const touchReset = document.getElementById('btn-touch-reset');

    touchPlace?.addEventListener('click', () => {
      STATE.input.touchAction = 'place';
      updateHUD();
    });
    touchRemove?.addEventListener('click', () => {
      STATE.input.touchAction = 'remove';
      updateHUD();
    });
    touchRotate?.addEventListener('click', () => {
      applyBuildRotation();
    });
    touchReset?.addEventListener('click', () => {
      resetCamera();
    });


    const touchSymmetry = document.getElementById('btn-touch-symmetry');
    const touchSave = document.getElementById('btn-touch-save');
    touchSymmetry?.addEventListener('click', () => toggleSymmetry());
    touchSave?.addEventListener('click', () => saveBlueprint());

    function bindHoldButton(id, action) {
      const el = document.getElementById(id);
      if (!el) return;
      const start = ev => {
        ev.preventDefault();
        try { el.setPointerCapture(ev.pointerId); } catch (_) {}
        setControlAction(action, true);
        el.classList.add('active');
      };
      const end = () => {
        setControlAction(action, false);
        el.classList.remove('active');
      };
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
      el.addEventListener('contextmenu', event => event.preventDefault());
    }

    bindHoldButton('btn-pitch-up', 'pitch+');
    bindHoldButton('btn-pitch-down', 'pitch-');
    bindHoldButton('btn-yaw-left', 'yaw+');
    bindHoldButton('btn-yaw-right', 'yaw-');
    bindHoldButton('btn-roll-left', 'roll-');
    bindHoldButton('btn-roll-right', 'roll+');
    bindHoldButton('btn-surge-back', 'surge-');
    bindHoldButton('btn-surge-forward', 'surge+');
    bindHoldButton('btn-lift-down', 'lift-');
    bindHoldButton('btn-lift-up', 'lift+');
    bindHoldButton('btn-sway-left', 'sway-');
    bindHoldButton('btn-sway-right', 'sway+');

    const btnCenterControls = document.getElementById('btn-center-controls');
    btnCenterControls?.addEventListener('click', () => clearPilotAxes());

    const btnStabilize = document.getElementById('btn-stabilize');
    btnStabilize?.addEventListener('click', () => {
      setStabilize(!STATE.pilot.stabilize);
    });

    function adjustThrusterPower(delta) {
      STATE.thrusterPower = THREE.MathUtils.clamp(STATE.thrusterPower + delta, 0, 1);
      /** @type {HTMLInputElement} */ (document.getElementById('thruster-power')).value = String(Math.round(STATE.thrusterPower * 100));
      if (STATE.mode === 'BUILD') updateTelemetry(); else updateFlightFeedback();
      autoSave(false);
    }

    const btnThrottleDown = document.getElementById('btn-throttle-down');
    btnThrottleDown?.addEventListener('click', () => adjustThrusterPower(-0.05));
    const btnThrottleUp = document.getElementById('btn-throttle-up');
    btnThrottleUp?.addEventListener('click', () => adjustThrusterPower(0.05));

    function controlActionForEvent(event) {
      return FlightControl.actionForInput(event.key, event.code);
    }


    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (isDebriefVisible()) {
        if (event.key === 'Escape' || key === 'f') returnToWorkshopFromDebrief();
        return;
      }
      const helpVisible = document.getElementById('help-modal').style.display !== 'none';
      if (helpVisible) {
        if (event.key === 'Escape') setHelpVisible(false);
        return;
      }
      // Flight controls take priority over editor shortcuts so combinations such as
      // Left Ctrl + S can command down + reverse at the same time.
      if (STATE.mode === 'FLIGHT') {
        const action = controlActionForEvent(event);
        if (action) {
          event.preventDefault();
          setControlAction(action, true);
          return;
        }
        if (event.repeat) return;
        if (event.key === '-' || event.key === '_') {
          adjustThrusterPower(-0.05);
        } else if (event.key === '+' || event.key === '=') {
          adjustThrusterPower(0.05);
        } else if (key === 'g') {
          setStabilize(!STATE.pilot.stabilize);
        } else if (key === 'f') {
          requestReturnToWorkshop();
        } else if (event.key === 'Escape') {
          setHelpVisible(false);
        }
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && key === 's') {
        event.preventDefault();
        saveBlueprint();
        return;
      }
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoBlueprint();
        else undoBlueprint();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        redoBlueprint();
        return;
      }

      if (event.repeat) return;
      if (key === 'c') {
        toggleContractPanel();
      } else if (key === 'r') {
        applyBuildRotation(event.shiftKey ? -1 : 1);
      } else if (event.key === 'Escape') {
        if (!STATE.contractPanelCollapsed) setContractPanelCollapsed(true);
        else setHelpVisible(false);
      } else if (key === 'f') {
        setMode('FLIGHT');
      } else if (key === 's') {
        saveBlueprint();
      } else if (key === 'x') {
        toggleSymmetry();
      } else if (event.key === '0') {
        setSelectedTool('Core');
      } else if (event.key === '1') {
        setSelectedTool('Hull');
      } else if (event.key === '2') {
        setSelectedTool('Frame');
      } else if (event.key === '3') {
        setSelectedTool('Thruster');
      } else if (event.key === '4') {
        setSelectedTool('Balloon');
      } else if (event.key === '5') {
        setSelectedTool('Wing');
      } else if (event.key === '6') {
        setSelectedTool('Gyro');
      } else if (event.key === '7') {
        setSelectedTool('Fuel');
      } else if (event.key === '8') {
        setSelectedTool('ControlSurface');
      } else if (event.key === '9') {
        setSelectedTool('VectorThruster');
      }
    });

    window.addEventListener('keyup', event => {
      const action = controlActionForEvent(event);
      if (action) setControlAction(action, false);
    });
    window.addEventListener('blur', clearControlActions);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearControlActions();
    });
    window.addEventListener('pagehide', () => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      persistBlueprint(false);
      saveCareer();
      saveUIPreferences();
    });

    function clamp01(value) {
      return Math.max(0, Math.min(1, value));
    }

    function cannonDot(a, b) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    function pointVelocityWorld(body, localPoint) {
      const worldOffset = body.vectorToWorldFrame(localPoint);
      const rotational = new CANNON.Vec3();
      body.angularVelocity.cross(worldOffset, rotational);
      return body.velocity.vadd(rotational);
    }

    function updateFlameVisibility() {
      for (const mod of STATE.flight.functionalBlocks) {
        if ((mod.type !== 'Thruster' && mod.type !== 'VectorThruster') || !mod.visual || !mod.attached) continue;
        const intensity = Math.max(0, mod.lastCommand || 0);
        const gimbal = mod.visual.getObjectByName('gimbalAssembly');
        if (gimbal) { gimbal.rotation.y = (mod.gimbalB || 0) * PHYSICS.gimbalAngle; gimbal.rotation.z = -(mod.gimbalA || 0) * PHYSICS.gimbalAngle; }
        mod.visual.traverse(obj => {
          if (!obj || (obj.name !== 'flame' && obj.name !== 'flameGlow')) return;
          const isGlow = obj.name === 'flameGlow';
          const baseScale = isGlow ? 1.15 : 0.95;
          const scaleBoost = 0.55 + intensity * (isGlow ? 0.55 : 0.85);
          obj.visible = STATE.mode === 'FLIGHT' && intensity > 0.01;
          obj.scale.setScalar(baseScale * scaleBoost);
          if (obj.material && 'opacity' in obj.material) {
            obj.material.opacity = obj.visible ? (isGlow ? 0.16 + intensity * 0.28 : 0.55 + intensity * 0.35) : 0;
          }
        });
      }
    }

    function computeThrusterCommand(mod, pilot) {
      const localAxis = [mod.localAxis.x, mod.localAxis.y, mod.localAxis.z];
      const neutralCommand = FlightControl.neutralCommand(localAxis, STATE.thrusterPower);
      const rotationalCommand = computeMixerCommandFromTorque(
        mod.localTorque,
        pilot,
        neutralCommand,
        STATE.flight.thrusterTorqueMax
      );
      return FlightControl.applyTranslationMix(
        localAxis,
        pilot,
        rotationalCommand,
        1
      );
    }

    function applyWingAerodynamics(body, mod) {
      const pointVelocity = pointVelocityWorld(body, mod.localPos);
      const speed = pointVelocity.length();
      if (speed < 0.25) return { lift: 0, drag: 0 };

      const chordWorld = body.vectorToWorldFrame(mod.localAxis).unit();
      const normalWorld = body.vectorToWorldFrame(mod.localNormal).unit();
      const spanWorld = body.vectorToWorldFrame(mod.localSpan).unit();
      const velocityDirection = pointVelocity.scale(1 / speed);
      const chordSpeed = cannonDot(pointVelocity, chordWorld);
      const normalSpeed = cannonDot(pointVelocity, normalWorld);
      const spanSpeed = cannonDot(pointVelocity, spanWorld);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);

      const dynamicPressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
      const health = runtimePartHealthFraction(mod);
      const liftMagnitude = dynamicPressure * mod.wingArea * coefficients.liftCoefficient * health;
      const mainDrag = dynamicPressure * mod.wingArea * coefficients.dragCoefficient * Math.max(0.25, health);
      const crossflowSpeedSq = normalSpeed * normalSpeed + spanSpeed * spanSpeed;
      const crossflowDrag = 0.5 * PHYSICS.airDensity * crossflowSpeedSq * mod.wingArea * PHYSICS.crossflowDragCoefficient;
      const dragMagnitude = mainDrag + crossflowDrag;

      const liftDirection = normalWorld.vsub(velocityDirection.scale(cannonDot(normalWorld, velocityDirection)));
      if (liftDirection.lengthSquared() < 0.0001) return { lift: 0, drag: Math.abs(dragMagnitude) };
      liftDirection.normalize();
      const worldPoint = body.pointToWorldFrame(mod.localPos);
      body.applyForce(liftDirection.scale(liftMagnitude), worldPoint);
      body.applyForce(velocityDirection.scale(-dragMagnitude), worldPoint);
      return { lift: Math.abs(liftMagnitude), drag: Math.abs(dragMagnitude) };
    }

    function applyControlSurfaceAerodynamics(body, mod) {
      if (!mod.attached) return { lift: 0, drag: 0 };
      const pointVelocity = pointVelocityWorld(body, mod.localPos);
      const speed = pointVelocity.length();
      const commandRaw = Number(STATE.pilot[mod.controlAxis]) || 0;
      if (speed < 0.35) {
        mod.controlDeflection = commandRaw * runtimePartHealthFraction(mod);
        const flap = mod.visual?.getObjectByName('controlFlapPivot');
        if (flap) flap.rotation.z = -mod.controlDeflection * PHYSICS.controlSurfaceMaxDeflection;
        return { lift: 0, drag: 0 };
      }
      const chordWorld = body.vectorToWorldFrame(mod.localAxis).unit();
      const normalWorld = body.vectorToWorldFrame(mod.localNormal).unit();
      const spanWorld = body.vectorToWorldFrame(mod.localSpan).unit();
      const velocityDirection = pointVelocity.scale(1 / speed);
      const chordSpeed = cannonDot(pointVelocity, chordWorld);
      const normalSpeed = cannonDot(pointVelocity, normalWorld);
      const spanSpeed = cannonDot(pointVelocity, spanWorld);
      const coefficients = computeWingCoefficients(chordSpeed, normalSpeed);
      const targetAxis = controlAxisVector(mod.controlAxis);
      const torqueVector = new THREE.Vector3(mod.localPos.x, mod.localPos.y, mod.localPos.z).cross(new THREE.Vector3(mod.localNormal.x, mod.localNormal.y, mod.localNormal.z));
      const autoSign = Math.sign(torqueVector.dot(targetAxis)) || 1;
      const sign = mod.controlSign || autoSign;
      const health = runtimePartHealthFraction(mod);
      const command = commandRaw * sign * health;
      mod.controlDeflection = command;
      const dynamicPressure = 0.5 * PHYSICS.airDensity * coefficients.effectiveSpeed ** 2;
      const liftCoefficient = coefficients.liftCoefficient * 0.45 * health + command * PHYSICS.controlSurfaceLiftGain;
      const liftMagnitude = dynamicPressure * mod.wingArea * liftCoefficient;
      const dragMagnitude = dynamicPressure * mod.wingArea * (0.045 + 0.12 * liftCoefficient * liftCoefficient + Math.abs(command) * 0.08)
        + 0.5 * PHYSICS.airDensity * (normalSpeed*normalSpeed + spanSpeed*spanSpeed) * mod.wingArea * PHYSICS.crossflowDragCoefficient;
      const liftDirection = normalWorld.vsub(velocityDirection.scale(cannonDot(normalWorld, velocityDirection)));
      if (liftDirection.lengthSquared() < 0.0001) return { lift: 0, drag: Math.abs(dragMagnitude) };
      liftDirection.normalize();
      const worldPoint = body.pointToWorldFrame(mod.localPos);
      body.applyForce(liftDirection.scale(liftMagnitude), worldPoint);
      body.applyForce(velocityDirection.scale(-dragMagnitude), worldPoint);
      const flap = mod.visual?.getObjectByName('controlFlapPivot');
      if (flap) flap.rotation.z = -command * PHYSICS.controlSurfaceMaxDeflection;
      return { lift: Math.abs(liftMagnitude), drag: Math.abs(dragMagnitude) };
    }

    function computeVectorThrusterForceCannon(mod, pilot, command) {
      const baseForce = mod.force * command * runtimePartHealthFraction(mod);
      const forward = mod.localAxis;
      if (baseForce <= 0) return forward.scale(0);
      const desired = new CANNON.Vec3(pilot.roll || 0, pilot.yaw || 0, pilot.pitch || 0);
      const lateral = baseForce * Math.sin(PHYSICS.gimbalAngle);
      const torqueNormal = new CANNON.Vec3();
      mod.localPos.cross(mod.localNormal.scale(lateral), torqueNormal);
      const torqueSpan = new CANNON.Vec3();
      mod.localPos.cross(mod.localSpan.scale(lateral), torqueSpan);
      const desiredLength = THREE.MathUtils.clamp(desired.length(), 0, 1);
      const normalization = Math.max(0.0001, desired.length());
      let a = torqueNormal.lengthSquared() > 0.0001 ? cannonDot(desired, torqueNormal) / (normalization * torqueNormal.length()) * desiredLength : 0;
      let b = torqueSpan.lengthSquared() > 0.0001 ? cannonDot(desired, torqueSpan) / (normalization * torqueSpan.length()) * desiredLength : 0;
      const magnitude = Math.hypot(a, b);
      if (magnitude > 1) { a /= magnitude; b /= magnitude; }
      mod.gimbalA = a; mod.gimbalB = b;
      const forwardScale = Math.cos(PHYSICS.gimbalAngle * Math.min(1, Math.hypot(a,b)));
      return forward.scale(baseForce * forwardScale).vadd(mod.localNormal.scale(lateral*a)).vadd(mod.localSpan.scale(lateral*b));
    }

    function applyGyroControl(body) {
      const gyroCount = STATE.flight.gyroAuthority;
      if (gyroCount <= 0) return;

      const pilot = STATE.pilot;
      const manualTorque = gyroCount * PHYSICS.gyroManualTorque;
      const localAngularVelocity = body.vectorToLocalFrame(body.angularVelocity);
      const dampingStrength = gyroCount * (0.7 + STATE.stabilityAssist * 5.5 + (pilot.stabilize ? 6 : 0));
      const localTorque = new CANNON.Vec3(
        pilot.roll * manualTorque - localAngularVelocity.x * dampingStrength,
        pilot.yaw * manualTorque - localAngularVelocity.y * dampingStrength,
        pilot.pitch * manualTorque - localAngularVelocity.z * dampingStrength
      );

      if (STATE.stabilityAssist > 0.001 || pilot.stabilize) {
        const craftUp = body.vectorToWorldFrame(new CANNON.Vec3(0, 1, 0)).unit();
        const worldUp = new CANNON.Vec3(0, 1, 0);
        const levelErrorWorld = new CANNON.Vec3();
        craftUp.cross(worldUp, levelErrorWorld);
        const levelErrorLocal = body.vectorToLocalFrame(levelErrorWorld);
        const levelStrength = gyroCount * (STATE.stabilityAssist * 10 + (pilot.stabilize ? 18 : 0));
        localTorque.x += levelErrorLocal.x * levelStrength;
        localTorque.y += levelErrorLocal.y * levelStrength * 0.35;
        localTorque.z += levelErrorLocal.z * levelStrength;
      }

      const maxTorque = gyroCount * PHYSICS.gyroManualTorque * 3.2;
      const torqueLength = localTorque.length();
      if (torqueLength > maxTorque) localTorque.scale(maxTorque / torqueLength, localTorque);
      const worldTorque = body.vectorToWorldFrame(localTorque);
      body.torque.vadd(worldTorque, body.torque);
    }

    function stepFlightPhysics(dt) {
      const body = STATE.flight.body;
      if (!body) return;

      const speed = body.velocity.length();
      let totalDrag = 0;
      if (speed > 0.001) {
        const dragMagnitude = 0.5 * PHYSICS.airDensity * PHYSICS.bodyDragCoefficient * STATE.flight.dragArea * speed * speed;
        const drag = body.velocity.scale(-dragMagnitude / speed);
        body.applyForce(drag, body.position);
        totalDrag += dragMagnitude;
      }

      const pilot = STATE.pilot;
      recomputeFlightIntegrity();
      const fuelBeforeLeak = STATE.flight.fuel;
      if (STATE.flight.leakingFuelRate > 0) STATE.flight.fuel = Math.max(0, STATE.flight.fuel - STATE.flight.leakingFuelRate * dt);
      if (fuelBeforeLeak > 0.000001 && STATE.flight.fuel <= 0.000001 && STATE.flight.leakingFuelRate > 0 && !STATE.flight.outOfFuel) {
        STATE.flight.outOfFuel = true;
        showStatus('FUEL LOST TO LEAK', 1800);
      }
      const thrusterJobs = [];
      const balloonJobs = [];
      let requestedFuel = 0;

      for (const mod of STATE.flight.functionalBlocks) {
        if (!mod.attached) continue;
        if (mod.type === 'Thruster' || mod.type === 'VectorThruster') {
          const command = computeThrusterCommand(mod, pilot);
          mod.lastCommand = command;
          const fuelNeed = mod.fuelRate * command * dt;
          requestedFuel += fuelNeed;
          thrusterJobs.push({ mod, command, fuelNeed });
        } else if (mod.type === 'Balloon') {
          const command = clamp01(STATE.balloonPower);
          mod.lastCommand = command;
          const fuelNeed = mod.fuelRate * command * dt;
          requestedFuel += fuelNeed;
          balloonJobs.push({ mod, command, fuelNeed });
        }
      }

      const hadFuel = STATE.flight.fuel > 0.000001;
      const fuelScale = requestedFuel > 0 ? Math.min(1, STATE.flight.fuel / requestedFuel) : 1;
      STATE.flight.fuel = Math.max(0, STATE.flight.fuel - requestedFuel * fuelScale);
      if (hadFuel && STATE.flight.fuel <= 0.000001 && requestedFuel > 0 && !STATE.flight.outOfFuel) {
        STATE.flight.outOfFuel = true;
        showStatus('OUT OF FUEL', 1800);
      }

      let totalThrust = 0;
      let totalLift = 0;
      for (const job of thrusterJobs) {
        if (!job.mod.attached) continue;
        const health = runtimePartHealthFraction(job.mod);
        const effectiveCommand = job.command * fuelScale;
        job.mod.lastCommand = effectiveCommand * health;
        const localForce = job.mod.type === 'VectorThruster'
          ? computeVectorThrusterForceCannon(job.mod, pilot, effectiveCommand)
          : job.mod.localAxis.scale(job.mod.force * effectiveCommand * health);
        const forceMagnitude = localForce.length();
        if (forceMagnitude <= 0) continue;
        const worldForce = body.vectorToWorldFrame(localForce);
        const worldPoint = body.pointToWorldFrame(job.mod.localPos);
        body.applyForce(worldForce, worldPoint);
        totalThrust += forceMagnitude;
      }

      for (const job of balloonJobs) {
        const liftMagnitude = job.mod.force * job.command * fuelScale * runtimePartHealthFraction(job.mod);
        job.mod.lastCommand = job.command * fuelScale;
        if (liftMagnitude <= 0) continue;
        const worldPoint = body.pointToWorldFrame(job.mod.localPos);
        body.applyForce(new CANNON.Vec3(0, liftMagnitude, 0), worldPoint);
        totalLift += liftMagnitude;
      }

      for (const mod of STATE.flight.functionalBlocks) {
        if (!mod.attached || (mod.type !== 'Wing' && mod.type !== 'ControlSurface')) continue;
        const loads = mod.type === 'ControlSurface' ? applyControlSurfaceAerodynamics(body, mod) : applyWingAerodynamics(body, mod);
        totalLift += loads.lift;
        totalDrag += loads.drag;
      }

      applyGyroControl(body);
      STATE.flight.structuralAccumulator += dt;
      if (STATE.flight.structuralAccumulator >= PHYSICS.structuralCheckInterval) {
        applyStructuralLoadDamage(STATE.flight.structuralAccumulator, totalThrust, totalLift, totalDrag);
        STATE.flight.structuralAccumulator = 0;
      }
      const impact = STATE.flight.lastLoads.impact || 0;
      STATE.flight.lastLoads = { lift: totalLift, drag: totalDrag, thrust: totalThrust, impact };
    }


    function fitCameraToFlightTarget() {
      if (STATE.mode === 'FLIGHT' && STATE.flight.body) {
        STATE.camera.target.lerp(STATE.flight.body.position, 0.08);
      } else {
        STATE.camera.target.lerp(STATE.camera.defaultTarget, 0.04);
      }
    }

    let physicsAccumulator = 0;
    let hudAccumulator = 0;
    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.08);

      if (STATE.mode === 'FLIGHT' && STATE.flight.body) {
        if (!STATE.mission.paused) {
          physicsAccumulator = Math.min(physicsAccumulator + delta, PHYSICS.fixedDt * PHYSICS.maxSubSteps);
          let subSteps = 0;
          while (physicsAccumulator >= PHYSICS.fixedDt && subSteps < PHYSICS.maxSubSteps && !STATE.mission.paused) {
            stepFlightPhysics(PHYSICS.fixedDt);
            world.step(PHYSICS.fixedDt);
            processPendingImpacts();
            updateMission(PHYSICS.fixedDt);
            physicsAccumulator -= PHYSICS.fixedDt;
            subSteps += 1;
          }
        }
        syncFlightVisuals();
        syncDebris(delta);
        updateFlameVisibility();
        hudAccumulator += delta;
        if (hudAccumulator >= PHYSICS.hudRefreshInterval) {
          hudAccumulator = 0;
          updateFlightFeedback();
        }
      } else {
        physicsAccumulator = 0;
        hudAccumulator = 0;
      }

      fitCameraToFlightTarget();
      applyCameraOrbit();
      updateGhost();
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      applyWorkspaceLayout();
      updateResponsivePanels();
      updateFlightFeedback();
    });

    function loadDefaultsOrSave() {
      loadCareer();
      loadUIPreferences();
      const loaded = loadBlueprint();
      if (!loaded) {
        resetToEmptyCraft(false);
      }
      refreshRaycastList();
      updateTelemetry();
      syncInputProfileUI();
      applyWorkspaceLayout();
      updateHUD();
      syncHudVisibility();
      syncContractPanelVisibility();
      updateResponsivePanels();
      updateFlightFeedback();
      applyCameraOrbit();
      updateGhost();
      updateHistoryButtons();
    }

    const clock = new THREE.Clock();
    STATE.uiCollapsed = isMobileLayout();
    syncHudVisibility();
    loadDefaultsOrSave();
    animate();
