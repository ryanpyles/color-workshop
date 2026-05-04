import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { colorPsychology, getSchemeHues, SCHEMES } from './colorUtils.js';
import { createColorWheel } from './colorWheel.js';
import { createEnvironment } from './environment.js';

// ── App state ──────────────────────────────────────────────────────────────
const state = {
  slotColors: [new THREE.Color(0xff2200), new THREE.Color(0x0033ff)],
  activeSlot: 0,
  mixedColor: new THREE.Color(),
  activeScheme: 'none',
  baseHue: null,         // last wheel-clicked hue
  schemeHues: [],        // current scheme hues (may include baseHue + derived)
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
const { wheelGroup, segments } = createColorWheel(scene);
const env = createEnvironment(scene);

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

// ── Action buttons ─────────────────────────────────────────────────────────
document.getElementById('btn-mix').addEventListener('click', () => {
  applyEnvColor(state.mixedColor);
  env.triggerMixEffect(state.mixedColor);
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
  wheelGroup.rotation.y += 0.0015;
  env.update(t);

  // Orbiting lights
  pointA.position.x = -5 + Math.sin(t * 0.4) * 1.5;
  pointA.position.z =  2 + Math.cos(t * 0.3) * 1.5;
  pointB.position.x =  5 + Math.cos(t * 0.35) * 1.5;
  pointB.position.z =  2 + Math.sin(t * 0.4) * 1.5;

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
