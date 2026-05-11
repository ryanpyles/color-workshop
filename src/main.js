import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { colorPsychology, getSchemeHues, SCHEMES } from './colorUtils.js';
import { createColorWheel } from './colorWheel.js';
import { createEnvironment } from './environment.js';
import { createPentagonalPrism, MOODS, generateSuggestions } from './paletteMode.js';

// ── App state ──────────────────────────────────────────────────────────────
const state = {
  slotColors: [new THREE.Color(0xff2200), new THREE.Color(0x0033ff)],
  activeSlot: 0,
  mixedColor: new THREE.Color(),
  activeScheme: 'none',
  baseHue: null,
  schemeHues: [],
  exploding: false,
  explodeStart: 0,
};

// ── Palette builder state ──────────────────────────────────────────────────
const palette = {
  active:      false,
  colors:      Array(5).fill(null),  // hex strings or null
  activeSlot:  0,
  activeMood:  null,
  morphT:      0,   // 0 = sphere fully visible, 1 = prism fully visible
  morphDir:    0,   // +1 or -1 while animating
};

// ── Renderer ───────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// ── Scene / Camera ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.035);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.5, 9);

// ── Orbit Controls ─────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.72;
controls.minPolarAngle = Math.PI * 0.2;

// ── Post-processing ────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.6);
composer.addPass(bloom);

// ── Wheel + Environment ────────────────────────────────────────────────────
const { wheelGroup, segments, mixSphere } = createColorWheel(scene);
const env = createEnvironment(scene);

// ── Palette prism (added to wheel group so it inherits tilt + rotation) ───
const { mesh: prismMesh, faceMaterials: prismMats } = createPentagonalPrism(1.1, 2.2);
wheelGroup.add(prismMesh);

// ── Lighting ───────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const pointA = new THREE.PointLight(0xff4444, 3, 20);
pointA.position.set(-5, 4, 2);
scene.add(pointA);

const pointB = new THREE.PointLight(0x4444ff, 3, 20);
pointB.position.set(5, 4, 2);
scene.add(pointB);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
rimLight.position.set(0, 8, -6);
scene.add(rimLight);

// ── Raycasting ─────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function intersectSegment(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(segments, true);
  return hits.length > 0 ? hits[0].object : null;
}

// ── UI refs ────────────────────────────────────────────────────────────────
const swatchA      = document.getElementById('swatch-a');
const swatchB      = document.getElementById('swatch-b');
const resultSwatch = document.getElementById('result-swatch');
const hexDisplay   = document.getElementById('hex-display');
const slotBtns     = document.querySelectorAll('.slot-btn');
const schemeBtns   = document.querySelectorAll('.scheme-btn');
const schemeDesc   = document.getElementById('scheme-desc');
const schemePalEl  = document.getElementById('scheme-palette');
const psychPanel   = document.getElementById('psych-panel');
const psychDot     = document.getElementById('psych-dot');
const psychName    = document.getElementById('psych-name');
const psychCat     = document.getElementById('psych-category');
const psychTraits  = document.getElementById('psych-traits');

function hex(color) { return '#' + color.getHexString(); }

// ── Mix panel update ───────────────────────────────────────────────────────
function updateMixPanel() {
  const [ca, cb] = state.slotColors;
  swatchA.style.background = hex(ca);
  swatchA.style.boxShadow  = `0 0 16px ${hex(ca)}80`;
  swatchB.style.background = hex(cb);
  swatchB.style.boxShadow  = `0 0 16px ${hex(cb)}80`;

  const mix = ca.clone().lerp(cb, 0.5);
  state.mixedColor.copy(mix);
  resultSwatch.style.background = hex(mix);
  resultSwatch.style.boxShadow  = `0 0 20px ${hex(mix)}90`;
  hexDisplay.textContent = hex(mix);

  // Live-update the center orb to show the blend
  if (mixSphere) {
    mixSphere.material.color.copy(mix).multiplyScalar(0.55);
    mixSphere.material.emissive.copy(mix);
    mixSphere.material.emissiveIntensity = 0.45;
  }
}

function updateLights() {
  pointA.color.copy(state.slotColors[0]);
  pointB.color.copy(state.slotColors[1]);
}

function applyEnvColor(color) {
  env.updateBaseColor(color);
  scene.fog.color.copy(color).multiplyScalar(0.15);
  const hsl = {};
  color.getHSL(hsl);
  bloom.strength = 0.4 + hsl.s * 0.8;
}

// ── Psychology panel ───────────────────────────────────────────────────────
function showPsychology(hue, color) {
  const data = colorPsychology(hue);
  psychDot.style.background = hex(color);
  psychDot.style.boxShadow  = `0 0 16px ${hex(color)}90`;
  psychName.textContent = data.name;
  psychCat.textContent  = data.category.charAt(0).toUpperCase() + data.category.slice(1) + ' Color';
  psychCat.className    = data.category;
  psychTraits.innerHTML = data.traits
    .map(t => `<div class="trait">${t}</div>`)
    .join('');
  psychPanel.classList.add('visible');
}

function hidePsychology() {
  psychPanel.classList.remove('visible');
}

// ── Palette builder helpers ────────────────────────────────────────────────
const pbPanel      = document.getElementById('palette-builder');
const pbSlotEls    = document.querySelectorAll('.pb-slot');
const pbMoodBtns   = document.querySelectorAll('.pb-mood-btn');
const pbSuggestBtn = document.getElementById('pb-suggest');
const pbApplyBtn   = document.getElementById('pb-apply');
const pbClearBtn   = document.getElementById('pb-clear');
const pbCloseBtn   = document.getElementById('pb-close');
const pbSuggestEl  = document.getElementById('pb-suggestions');
const btnCreate    = document.getElementById('btn-create-palette');

function updatePrismFaces() {
  palette.colors.forEach((hexStr, i) => {
    const mat = prismMats[i];
    if (hexStr) {
      const c = new THREE.Color(hexStr);
      mat.color.copy(c).multiplyScalar(0.3);
      mat.emissive.copy(c);
      mat.emissiveIntensity = 1.0;
      mat.opacity = 0.92;
    } else {
      mat.color.set(0x0a0028);
      mat.emissive.set(0x060018);
      mat.emissiveIntensity = 0.5;
      mat.opacity = 0.88;
    }
  });
}

function updatePbSlotUI() {
  pbSlotEls.forEach((el, i) => {
    const c = palette.colors[i];
    el.classList.toggle('active', i === palette.activeSlot);
    el.classList.toggle('filled', !!c);
    el.style.background    = c || '';
    el.style.boxShadow     = c ? `0 0 14px ${c}80` : '';
    el.style.borderColor   = c ? `${c}cc` : '';
    const num = el.querySelector('.pb-slot-num');
    if (num) num.style.display = c ? 'none' : '';
  });
}

function renderSuggestionsList(variations) {
  pbSuggestEl.innerHTML = variations.map((v, vi) => `
    <div class="pb-suggestion" data-vi="${vi}">
      <span class="pb-sug-label">${v.label}</span>
      <div class="pb-sug-dots">
        ${v.colors.map(c => `<div class="pb-sug-dot" style="background:${c};box-shadow:0 0 6px ${c}70;"></div>`).join('')}
      </div>
    </div>
  `).join('');

  pbSuggestEl.querySelectorAll('.pb-suggestion').forEach(el => {
    el.addEventListener('click', () => {
      const vi = parseInt(el.dataset.vi);
      palette.colors = [...variations[vi].colors];
      updatePrismFaces();
      updatePbSlotUI();
    });
  });
}

function enterPaletteMode() {
  palette.active   = true;
  palette.morphDir = 1;
  pbPanel.classList.add('open');
  btnCreate.classList.add('palette-active');
  btnCreate.textContent = 'Exit Palette';
  document.getElementById('saved-panel').style.opacity = '0.2';
  document.getElementById('saved-panel').style.pointerEvents = 'none';
  updatePbSlotUI();
}

function exitPaletteMode() {
  palette.active   = false;
  palette.morphDir = -1;
  pbPanel.classList.remove('open');
  btnCreate.classList.remove('palette-active');
  btnCreate.textContent = 'Create Palette';
  document.getElementById('saved-panel').style.opacity = '';
  document.getElementById('saved-panel').style.pointerEvents = '';
}

function applyPaletteToScene() {
  const filled = palette.colors.filter(Boolean);
  if (!filled.length) { showToast('Add colors first!'); return; }
  const blend = new THREE.Color(0, 0, 0);
  filled.forEach(h => blend.add(new THREE.Color(h)));
  blend.multiplyScalar(1 / filled.length);
  applyEnvColor(blend);
  env.triggerMixEffect(blend);
  showToast('Palette applied to scene!');
}

// Slot clicks
pbSlotEls.forEach(el => {
  el.addEventListener('click', () => {
    palette.activeSlot = parseInt(el.dataset.slot);
    updatePbSlotUI();
  });
});

// Mood buttons
pbMoodBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    palette.activeMood = btn.dataset.mood;
    pbMoodBtns.forEach(b => b.classList.toggle('active', b === btn));
  });
});

pbSuggestBtn.addEventListener('click', () => {
  const key = palette.activeMood ?? Object.keys(MOODS)[0];
  renderSuggestionsList(generateSuggestions(key));
  document.getElementById('pb-sug-header').style.display = '';
});

pbApplyBtn.addEventListener('click', applyPaletteToScene);

pbClearBtn.addEventListener('click', () => {
  palette.colors = Array(5).fill(null);
  updatePrismFaces();
  updatePbSlotUI();
  pbSuggestEl.innerHTML = '';
});

pbCloseBtn.addEventListener('click', exitPaletteMode);

btnCreate.addEventListener('click', () => {
  if (palette.active) exitPaletteMode();
  else enterPaletteMode();
});

// ── Scheme palette swatches ────────────────────────────────────────────────
function renderSchemePalette(schemeHues) {
  if (!schemeHues || schemeHues.length === 0) {
    schemePalEl.innerHTML = '';
    return;
  }
  schemePalEl.innerHTML = schemeHues.map((h, i) => {
    const c = new THREE.Color().setHSL(h, 0.9, 0.55);
    const name = colorPsychology(h).name;
    return `<div class="palette-swatch" style="background:${hex(c)};box-shadow:0 0 10px ${hex(c)}70;" title="${name}">
      <span class="palette-label">${name.split(' ')[0]}</span>
    </div>`;
  }).join('');
}

// ── Scheme wheel highlighting ──────────────────────────────────────────────
function applySchemeToWheel(schemeHues) {
  const tolerance = 0.03;
  segments.forEach(seg => {
    const h = seg.userData.hue;
    const inScheme = schemeHues.some(sh => {
      const d = Math.min(Math.abs(h - sh), 1 - Math.abs(h - sh));
      return d < tolerance;
    });
    seg.userData.schemeHighlight = inScheme;
  });
}

function clearSchemeHighlight() {
  segments.forEach(seg => { seg.userData.schemeHighlight = false; });
}

// ── Slot buttons ───────────────────────────────────────────────────────────
slotBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeSlot = parseInt(btn.dataset.slot);
    slotBtns.forEach(b => b.classList.toggle('active', b === btn));
    swatchA.classList.toggle('active', state.activeSlot === 0);
    swatchB.classList.toggle('active', state.activeSlot === 1);
  });
});
swatchA.addEventListener('click', () => slotBtns[0].click());
swatchB.addEventListener('click', () => slotBtns[1].click());

// ── Scheme buttons ─────────────────────────────────────────────────────────
schemeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeScheme = btn.dataset.scheme;
    schemeBtns.forEach(b => b.classList.toggle('active', b === btn));
    schemeDesc.textContent = SCHEMES[state.activeScheme]?.desc ?? '';

    if (state.activeScheme === 'none') {
      clearSchemeHighlight();
      state.schemeHues = [];
      renderSchemePalette([]);
    } else if (state.baseHue !== null) {
      // Recompute scheme from last picked hue
      state.schemeHues = getSchemeHues(state.baseHue, state.activeScheme);
      applySchemeToWheel(state.schemeHues);
      renderSchemePalette(state.schemeHues);
    }
  });
});

// ── Wheel interaction ──────────────────────────────────────────────────────
let isDragging = false;
let mouseDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('mousedown', e => {
  mouseDownPos = { x: e.clientX, y: e.clientY };
  isDragging = false;
});

renderer.domElement.addEventListener('mousemove', e => {
  const dx = e.clientX - mouseDownPos.x, dy = e.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;

  // Reset hover state
  segments.forEach(s => { s.userData.hovered = false; });

  const seg = intersectSegment(e);
  if (seg && seg.userData.isSegment) {
    seg.userData.hovered = true;
    const color = new THREE.Color().setHSL(seg.userData.hue, 0.9, 0.55);
    showPsychology(seg.userData.hue, color);
  } else {
    hidePsychology();
  }
});

renderer.domElement.addEventListener('mouseleave', hidePsychology);

renderer.domElement.addEventListener('click', e => {
  if (isDragging) return;
  const seg = intersectSegment(e);
  if (!seg || !seg.userData.isSegment) return;

  const hue = seg.userData.hue;
  const color = new THREE.Color().setHSL(hue, 0.9, 0.55);

  // ── Palette builder mode ─────────────────────────────────────────────
  if (palette.active) {
    const slot = palette.activeSlot;
    palette.colors[slot] = '#' + color.getHexString();
    updatePrismFaces();
    const next = palette.colors.findIndex((c, i) => i > slot && !c);
    palette.activeSlot = next !== -1 ? next : palette.colors.findIndex(c => !c) ?? slot;
    if (palette.activeSlot === -1) palette.activeSlot = slot;
    updatePbSlotUI();
    const t0 = performance.now();
    const pulse = () => {
      const p = (performance.now() - t0) / 300;
      if (p < 1) { seg.scale.setScalar(1 + 0.2 * Math.sin(p * Math.PI)); requestAnimationFrame(pulse); }
      else seg.scale.set(1, 1, 1);
    };
    pulse();
    showPsychology(hue, color);
    return;
  }

  // Always assign to active slot
  state.slotColors[state.activeSlot].copy(color);
  state.baseHue = hue;

  // Scheme-aware slot B auto-fill
  if (state.activeScheme !== 'none') {
    state.schemeHues = getSchemeHues(hue, state.activeScheme);
    applySchemeToWheel(state.schemeHues);
    renderSchemePalette(state.schemeHues);
    // Fill inactive slot with first non-base scheme hue
    const partner = state.schemeHues.find(h => Math.abs(h - hue) > 0.02);
    if (partner !== undefined) {
      const otherSlot = 1 - state.activeSlot;
      state.slotColors[otherSlot].setHSL(partner, 0.9, 0.55);
    }
  }

  // Segment pulse
  const t0 = performance.now();
  const pulse = () => {
    const p = (performance.now() - t0) / 350;
    if (p < 1) {
      const s = 1 + 0.18 * Math.sin(p * Math.PI);
      seg.scale.set(s, s, s);
      requestAnimationFrame(pulse);
    } else {
      seg.scale.set(1, 1, 1);
    }
  };
  pulse();

  updateMixPanel();
  updateLights();
  applyEnvColor(color);
  showPsychology(hue, color);
});

// Touch support
renderer.domElement.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  renderer.domElement.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });

// ── Saved palettes UI ──────────────────────────────────────────────────────
const savedPalettes = [];
const savedList  = document.getElementById('saved-list');
const savedEmpty = document.getElementById('saved-empty');
const saveToast  = document.getElementById('save-toast');

function showToast(msg = 'Palette saved!') {
  saveToast.textContent = msg;
  saveToast.classList.add('show');
  setTimeout(() => saveToast.classList.remove('show'), 2200);
}

function renderSavedPalettes(palettes) {
  if (!palettes || !palettes.length) {
    savedList.innerHTML = '<div id="saved-empty">None yet — save one below</div>';
    return;
  }
  savedList.innerHTML = palettes.map(p => `
    <div class="saved-palette" data-id="${p.id}"
         data-a="${p.color_a}" data-b="${p.color_b}"
         data-scheme="${p.scheme}" data-base="${p.base_hue ?? ''}">
      <div class="saved-dot" style="background:${p.color_a};box-shadow:0 0 6px ${p.color_a}80;"></div>
      <div class="saved-dot" style="background:${p.color_b};box-shadow:0 0 6px ${p.color_b}80;"></div>
      <div class="saved-dot" style="background:${p.color_mix};box-shadow:0 0 6px ${p.color_mix}80;"></div>
      <span class="saved-scheme">${p.scheme === 'none' ? 'free' : p.scheme}</span>
    </div>`).join('');

  savedList.querySelectorAll('.saved-palette').forEach(el => {
    el.addEventListener('click', () => {
      state.slotColors[0].set(el.dataset.a);
      state.slotColors[1].set(el.dataset.b);
      if (el.dataset.scheme && el.dataset.scheme !== 'none') {
        state.activeScheme = el.dataset.scheme;
        document.querySelectorAll('.scheme-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.scheme === state.activeScheme));
        schemeDesc.textContent = SCHEMES[state.activeScheme]?.desc ?? '';
        if (el.dataset.base) {
          state.baseHue = parseFloat(el.dataset.base);
          state.schemeHues = getSchemeHues(state.baseHue, state.activeScheme);
          applySchemeToWheel(state.schemeHues);
          renderSchemePalette(state.schemeHues);
        }
      }
      updateMixPanel();
      updateLights();
      applyEnvColor(state.slotColors[0]);
    });
  });
}

function refreshSavedPalettes() {
  renderSavedPalettes([]);
}

refreshSavedPalettes();

// ── Action buttons ─────────────────────────────────────────────────────────
document.getElementById('btn-mix').addEventListener('click', () => {
  // Orb explosion — env color change is delayed to sync with the peak
  state.exploding = true;
  state.explodeStart = clock.getElapsedTime();
  const mixSnapshot = state.mixedColor.clone();
  setTimeout(() => {
    applyEnvColor(mixSnapshot);
    env.triggerMixEffect(mixSnapshot);
  }, 380);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  state.slotColors[0].set(0xff2200);
  state.slotColors[1].set(0x0033ff);
  state.activeScheme = 'none';
  state.baseHue = null;
  state.schemeHues = [];
  schemeBtns.forEach(b => b.classList.toggle('active', b.dataset.scheme === 'none'));
  schemeDesc.textContent = SCHEMES.none.desc;
  clearSchemeHighlight();
  renderSchemePalette([]);
  hidePsychology();
  updateMixPanel();
  updateLights();
  applyEnvColor(new THREE.Color(0x220033));
});

document.getElementById('btn-save').addEventListener('click', () => {
  const palette = {
    id: Date.now(),
    color_a:   hex(state.slotColors[0]),
    color_b:   hex(state.slotColors[1]),
    color_mix: hex(state.mixedColor),
    scheme:    state.activeScheme,
    base_hue:  state.baseHue,
  };
  savedPalettes.unshift(palette);
  if (savedPalettes.length > 12) savedPalettes.pop();
  renderSavedPalettes(savedPalettes);
  showToast('Palette saved!');
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  const h1 = Math.random();
  let h2;
  if (state.activeScheme !== 'none') {
    const hues = getSchemeHues(h1, state.activeScheme);
    h2 = hues.find(h => Math.abs(h - h1) > 0.02) ?? (h1 + 0.5) % 1;
    state.baseHue = h1;
    state.schemeHues = hues;
    applySchemeToWheel(hues);
    renderSchemePalette(hues);
  } else {
    h2 = (h1 + 0.3 + Math.random() * 0.4) % 1;
  }
  state.slotColors[0].setHSL(h1, 0.9, 0.55);
  state.slotColors[1].setHSL(h2, 0.9, 0.55);
  updateMixPanel();
  updateLights();
  applyEnvColor(state.slotColors[0]);
});

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ── Init ───────────────────────────────────────────────────────────────────
updateMixPanel();
updateLights();
applyEnvColor(new THREE.Color(0x110022));

// ── Animate ────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const schemeActive = () => state.activeScheme !== 'none' && state.schemeHues.length > 0;

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  controls.update();
  wheelGroup.rotation.y += palette.active ? 0.0004 : 0.0015;
  env.update(t);

  // ── Sphere ↔ prism morph ─────────────────────────────────────────────
  if (palette.morphDir !== 0) {
    palette.morphT = Math.max(0, Math.min(1, palette.morphT + palette.morphDir * 0.045));
    // Ease in-out
    const e = palette.morphT < 0.5
      ? 2 * palette.morphT * palette.morphT
      : 1 - Math.pow(-2 * palette.morphT + 2, 2) / 2;

    mixSphere.material.opacity = 1 - e;
    mixSphere.visible = e < 0.98;

    const prismP = Math.max(0, (e - 0.3) / 0.7);
    prismMesh.visible = prismP > 0.01;
    prismMesh.scale.setScalar(prismP);

    if (palette.morphT >= 1 || palette.morphT <= 0) palette.morphDir = 0;
  }

  // Prism slow spin
  if (prismMesh.visible) prismMesh.rotation.y += 0.006;

  // Orbiting lights
  pointA.position.x = -5 + Math.sin(t * 0.4) * 1.5;
  pointA.position.z =  2 + Math.cos(t * 0.3) * 1.5;
  pointB.position.x =  5 + Math.cos(t * 0.35) * 1.5;
  pointB.position.z =  2 + Math.sin(t * 0.4) * 1.5;

  // ── Orb explosion animation ────────────────────────────────────────
  if (mixSphere && state.exploding) {
    const et = t - state.explodeStart;
    // Phase 1 (0–0.4s): grow + brighten
    const growP  = Math.min(et / 0.4, 1);
    // Phase 2 (0.4–0.75s): rebound back to normal
    const recoilP = Math.max(0, Math.min((et - 0.4) / 0.35, 1));
    const scale = 1 + growP * 0.9 - recoilP * 0.9;
    mixSphere.scale.setScalar(Math.max(0.95, scale));
    const emissive = growP * 2.2 - recoilP * 1.8;
    mixSphere.material.emissiveIntensity = Math.max(0.45, emissive);
    if (et > 0.8) state.exploding = false;
  }

  // ── Segment material animation ─────────────────────────────────────
  const isSchemeOn = schemeActive();
  segments.forEach(seg => {
    const base = seg.userData.baseColor;
    const hovered = seg.userData.hovered;
    const highlighted = seg.userData.schemeHighlight;

    let targetMult = 1.0;
    let targetEmissive = 0;

    if (hovered) {
      targetMult = 1.0;
      targetEmissive = 0.45;
    } else if (isSchemeOn) {
      if (highlighted) {
        targetMult = 1.0;
        targetEmissive = 0.28 + Math.sin(t * 2.8) * 0.12;
      } else {
        targetMult = 0.2;
        targetEmissive = 0;
      }
    }

    // Smooth transitions
    seg.userData.colorMult = (seg.userData.colorMult ?? 1) +
      (targetMult - (seg.userData.colorMult ?? 1)) * 0.07;
    seg.material.color.copy(base).multiplyScalar(seg.userData.colorMult);
    seg.material.emissiveIntensity +=
      (targetEmissive - seg.material.emissiveIntensity) * 0.1;
  });

  composer.render();
}
animate();
