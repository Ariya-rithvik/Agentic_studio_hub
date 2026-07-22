/* ==========================================================================
   AGENTIC STUDIO HUB — UNIFIED ENGINE & INTERACTIVE CONTROLLER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ─── 1. Navigation & Tab Controller ─────────────────────────────────────
  const navTabs = document.querySelectorAll('.nav-tab[data-tab]');
  const viewPanels = document.querySelectorAll('.view-panel');
  const switchBtns = document.querySelectorAll('.switch-tab-btn');

  function switchTab(tabId) {
    navTabs.forEach(tab => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    viewPanels.forEach(panel => {
      if (panel.id === `panel-${tabId}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Resize Three.js viewports when visible
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab) switchTab(tab.dataset.tab);
    });
  });

  switchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) switchTab(target);
    });
  });


  // ─── 2. Hero Dashboard WebGL Viewport ──────────────────────────────────
  let heroScene, heroCamera, heroRenderer, heroMesh;
  let isSpinning = true;

  function initHero3D() {
    const container = document.getElementById('hero-3d-canvas');
    if (!container || typeof THREE === 'undefined') return;

    heroScene = new THREE.Scene();
    heroCamera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    heroRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    heroRenderer.setSize(container.clientWidth, container.clientHeight);
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(heroRenderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(2, 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x7c5cff,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false
    });

    heroMesh = new THREE.Mesh(geometry, material);
    heroScene.add(heroMesh);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    heroScene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0x7c5cff, 2);
    dirLight1.position.set(5, 5, 5);
    heroScene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 1.5);
    dirLight2.position.set(-5, -5, -2);
    heroScene.add(dirLight2);

    heroCamera.position.z = 4.5;

    function animateHero() {
      requestAnimationFrame(animateHero);
      if (isSpinning && heroMesh) {
        heroMesh.rotation.x += 0.005;
        heroMesh.rotation.y += 0.008;
      }
      heroRenderer.render(heroScene, heroCamera);
    }
    animateHero();

    document.getElementById('btn-toggle-spin')?.addEventListener('click', () => {
      isSpinning = !isSpinning;
    });

    document.getElementById('btn-toggle-wire')?.addEventListener('click', () => {
      if (heroMesh) {
        heroMesh.material.wireframe = !heroMesh.material.wireframe;
      }
    });

    document.getElementById('btn-reset-cam')?.addEventListener('click', () => {
      if (heroMesh) {
        heroMesh.rotation.set(0, 0, 0);
        heroCamera.position.set(0, 0, 4.5);
      }
    });
  }


  // ─── 3. Agentic 3D Studio Engine ───────────────────────────────────────
  let studio3DScene, studio3DCamera, studio3DRenderer, studioGroup;
  let current3DPreset = 'orb';

  function initStudio3D() {
    const container = document.getElementById('studio-3d-viewport');
    if (!container || typeof THREE === 'undefined') return;

    studio3DScene = new THREE.Scene();
    studio3DCamera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 1000);
    studio3DRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    studio3DRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(studio3DRenderer.domElement);

    studioGroup = new THREE.Group();
    studio3DScene.add(studioGroup);

    // Default Scene: Energy Orb
    load3DScenePreset('orb');

    const pointLight = new THREE.PointLight(0x7c5cff, 3, 50);
    pointLight.position.set(0, 0, 8);
    studio3DScene.add(pointLight);
    studio3DScene.add(new THREE.AmbientLight(0xffffff, 0.6));

    studio3DCamera.position.z = 5;

    function animateStudio() {
      requestAnimationFrame(animateStudio);
      if (studioGroup) {
        if (current3DPreset === 'orb') {
          studioGroup.rotation.y += 0.01;
        } else if (current3DPreset === 'chart') {
          studioGroup.rotation.y += 0.005;
        } else if (current3DPreset === 'mograph') {
          studioGroup.rotation.z += 0.008;
          studioGroup.rotation.x += 0.004;
        } else {
          studioGroup.rotation.y += 0.012;
        }
      }
      studio3DRenderer.render(studio3DScene, studio3DCamera);
    }
    animateStudio();
  }

  function load3DScenePreset(preset) {
    if (!studioGroup) return;
    studioGroup.clear();
    current3DPreset = preset;

    if (preset === 'orb') {
      // Futuristic Energy Orb
      const sphereGeo = new THREE.SphereGeometry(1.2, 32, 32);
      const sphereMat = new THREE.MeshPhysicalMaterial({
        color: 0x3b82f6,
        emissive: 0x112244,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      studioGroup.add(sphere);

      const torusGeo = new THREE.TorusGeometry(2.2, 0.08, 16, 100);
      const torusMat = new THREE.MeshBasicMaterial({ color: 0x7c5cff, wireframe: true });
      const torus = new THREE.Mesh(torusGeo, torusMat);
      torus.rotation.x = Math.PI / 3;
      studioGroup.add(torus);

    } else if (preset === 'chart') {
      // 3D Tank/Bar Chart Simulation
      const colors = [0x7c5cff, 0x3b82f6, 0x10b981, 0xf59e0b];
      const heights = [2.5, 1.8, 1.2, 2.9];

      for (let i = 0; i < 4; i++) {
        const barGeo = new THREE.CylinderGeometry(0.4, 0.4, heights[i], 32);
        const barMat = new THREE.MeshStandardMaterial({
          color: colors[i],
          metalness: 0.6,
          roughness: 0.2
        });
        const bar = new THREE.Mesh(barGeo, barMat);
        bar.position.set((i - 1.5) * 1.2, heights[i] / 2 - 1.5, 0);
        studioGroup.add(bar);
      }

    } else if (preset === 'mograph') {
      // Mograph Typography / Abstract Rings
      for (let i = 0; i < 5; i++) {
        const ringGeo = new THREE.TorusGeometry(0.8 + i * 0.4, 0.04, 16, 100);
        const ringMat = new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0x7c5cff : 0x06b6d4,
          metalness: 0.8
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = i * 0.4;
        ring.rotation.y = i * 0.2;
        studioGroup.add(ring);
      }

    } else {
      // Geometric Wave Grid
      const gridGeo = new THREE.PlaneGeometry(5, 5, 20, 20);
      const gridMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        wireframe: true
      });
      const grid = new THREE.Mesh(gridGeo, gridMat);
      grid.rotation.x = -Math.PI / 3;
      studioGroup.add(grid);
    }
  }

  // Preset Chips
  document.querySelectorAll('.preset-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptInput = document.getElementById('3d-prompt-input');
      const text = chip.dataset.prompt;
      if (promptInput) promptInput.value = text;

      if (text.includes('Energy')) load3DScenePreset('orb');
      else if (text.includes('chart') || text.includes('Tank')) load3DScenePreset('chart');
      else if (text.includes('Title') || text.includes('mograph')) load3DScenePreset('mograph');
      else load3DScenePreset('wave');
    });
  });

  // Prompt Generator Simulation
  const gen3DBtn = document.getElementById('btn-generate-3d');
  const logBox3D = document.getElementById('3d-log');

  if (gen3DBtn && logBox3D) {
    gen3DBtn.addEventListener('click', () => {
      const promptText = document.getElementById('3d-prompt-input').value || 'Default Scene';

      logBox3D.innerHTML += `<div class="log-line info">[Codex Agent] Parsing prompt: "${promptText}"</div>`;
      logBox3D.scrollTop = logBox3D.scrollHeight;

      setTimeout(() => {
        logBox3D.innerHTML += `<div class="log-line info">[Codex Agent] Compiling mograph.mjs shaders & camera keyframes...</div>`;
        logBox3D.scrollTop = logBox3D.scrollHeight;
      }, 500);

      setTimeout(() => {
        logBox3D.innerHTML += `<div class="log-line success">[Success] 3D scene live in viewport!</div>`;
        logBox3D.scrollTop = logBox3D.scrollHeight;

        if (promptText.toLowerCase().includes('chart') || promptText.toLowerCase().includes('water')) {
          load3DScenePreset('chart');
        } else if (promptText.toLowerCase().includes('mograph') || promptText.toLowerCase().includes('title')) {
          load3DScenePreset('mograph');
        } else if (promptText.toLowerCase().includes('grid') || promptText.toLowerCase().includes('wave')) {
          load3DScenePreset('wave');
        } else {
          load3DScenePreset('orb');
        }
      }, 1200);
    });
  }


  // ─── 4. Agentic Video Editing & Reels Engine ───────────────────────────
  const videoPlayer = document.getElementById('main-video-player');
  const clipCards = document.querySelectorAll('.clip-card');
  const analyzeVideoBtn = document.getElementById('btn-analyze-video');
  const videoLog = document.getElementById('video-log');

  // Clip timestamp seeking
  const clipTimestamps = [4, 75, 160]; // 00:04, 01:15, 02:40

  clipCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      clipCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      if (videoPlayer) {
        videoPlayer.currentTime = clipTimestamps[index] || 0;
        videoPlayer.play().catch(() => {});
      }
    });
  });

  if (analyzeVideoBtn && videoLog) {
    analyzeVideoBtn.addEventListener('click', () => {
      videoLog.innerHTML += `<div class="log-line info">[AI Transcriber] Transcribing video timeline...</div>`;
      videoLog.scrollTop = videoLog.scrollHeight;

      setTimeout(() => {
        videoLog.innerHTML += `<div class="log-line info">[Director AI] Scoring moments: Hook (9.8/10), Value (9.4/10), Trend (9.1/10)...</div>`;
        videoLog.scrollTop = videoLog.scrollHeight;
      }, 600);

      setTimeout(() => {
        videoLog.innerHTML += `<div class="log-line success">[Auto-Cutter] Extracted 3 high-engagement viral clips!</div>`;
        videoLog.scrollTop = videoLog.scrollHeight;
      }, 1300);
    });
  }


  // ─── 5. Agentic Coding & Incident Memory Engine ────────────────────────
  let codingScene, codingCamera, codingRenderer, codingMesh;

  function initCoding3D() {
    const container = document.getElementById('coding-canvas-viewport');
    if (!container || typeof THREE === 'undefined') return;

    codingScene = new THREE.Scene();
    codingCamera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    codingRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    codingRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(codingRenderer.domElement);

    createCodingMesh('torusKnot');

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 4, 5);
    codingScene.add(light);
    codingScene.add(new THREE.AmbientLight(0xffffff, 0.5));

    codingCamera.position.z = 4.5;

    function animateCoding() {
      requestAnimationFrame(animateCoding);
      if (codingMesh) {
        codingMesh.rotation.x += 0.01;
        codingMesh.rotation.y += 0.012;
      }
      codingRenderer.render(codingScene, codingCamera);
    }
    animateCoding();
  }

  function createCodingMesh(type) {
    if (!codingScene) return;
    if (codingMesh) codingScene.remove(codingMesh);

    let geometry;
    if (type === 'sphere') {
      geometry = new THREE.SphereGeometry(1.5, 32, 32);
    } else if (type === 'box') {
      geometry = new THREE.BoxGeometry(2, 2, 2);
    } else {
      geometry = new THREE.TorusKnotGeometry(1.4, 0.4, 100, 16);
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.2,
      metalness: 0.8
    });

    codingMesh = new THREE.Mesh(geometry, material);
    codingScene.add(codingMesh);
  }

  // Code Execution Engine
  const runCodeBtn = document.getElementById('btn-run-code');
  const codeEditor = document.getElementById('code-editor');

  if (runCodeBtn && codeEditor) {
    runCodeBtn.addEventListener('click', () => {
      const code = codeEditor.value.toLowerCase();
      if (code.includes('sphere')) {
        createCodingMesh('sphere');
      } else if (code.includes('box') || code.includes('cube')) {
        createCodingMesh('box');
      } else {
        createCodingMesh('torusKnot');
      }
    });
  }


  // ─── 6. Global Window Resize Listener ──────────────────────────────────
  window.addEventListener('resize', () => {
    const heroCont = document.getElementById('hero-3d-canvas');
    if (heroCont && heroRenderer && heroCamera) {
      heroCamera.aspect = heroCont.clientWidth / heroCont.clientHeight;
      heroCamera.updateProjectionMatrix();
      heroRenderer.setSize(heroCont.clientWidth, heroCont.clientHeight);
    }

    const studioCont = document.getElementById('studio-3d-viewport');
    if (studioCont && studio3DRenderer && studio3DCamera) {
      studio3DCamera.aspect = studioCont.clientWidth / studioCont.clientHeight;
      studio3DCamera.updateProjectionMatrix();
      studio3DRenderer.setSize(studioCont.clientWidth, studioCont.clientHeight);
    }

    const codingCont = document.getElementById('coding-canvas-viewport');
    if (codingCont && codingRenderer && codingCamera) {
      codingCamera.aspect = codingCont.clientWidth / codingCont.clientHeight;
      codingCamera.updateProjectionMatrix();
      codingRenderer.setSize(codingCont.clientWidth, codingCont.clientHeight);
    }
  });


  // Initialize all 3D viewports
  setTimeout(() => {
    initHero3D();
    initStudio3D();
    initCoding3D();
  }, 100);

});
