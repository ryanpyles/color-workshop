import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { colorPsychology, getSchemeHues, SCHEMES } from './colorUtils.js';
import { createColorWheel } from './colorWheel.js';
import { createEnvironment } from './environment.js';
import { createStarPrism, MOODS, CINEMATIC, generateSuggestions } from './paletteMode.js';
import {
  contrastRatio, wcagLevel,
  generateBrandScale, generateBrandSystem,
  toHex, toRGB, toHSL, toCMYK,
  exportCSS, exportTailwind, exportSCSS, exportJSON,
} from './colorExport.js';

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
scene.fog = new THREE.FogExp2(0x000000, 0.018);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.5, 9);
if (window.innerWidth <= 600) camera.position.set(0, 1.2, 7);

// ── Orbit Controls ─────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.minDistance = 4;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.72;
controls.minPolarAngle = Math.PI * 0.2;
if (window.innerWidth <= 600) { controls.minDistance = 3; controls.maxDistance = 12; }

// ── Post-processing ────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.30, 0.24, 0.78);
composer.addPass(bloom);

// ── Wheel + Environment ────────────────────────────────────────────────────
const { wheelGroup, segments, mixSphere } = createColorWheel(scene);
const env = createEnvironment(scene);

// ── Palette star (added to wheel group so it inherits tilt + rotation) ────
const { group: starGroup, armMaterials: starArmMats } = createStarPrism(1.25, 0.48, 0.52);
wheelGroup.add(starGroup);

// ── Interaction state indicators ──────────────────────────────────────────
const WRINGS = 48, WOUTER = 3.0;
const ARC_SPAN = (Math.PI * 2) / WRINGS;

// Thin arc that follows the hovered segment
const hoverArc = new THREE.Mesh(
  new THREE.TorusGeometry(WOUTER + 0.06, 0.038, 6, 48, ARC_SPAN),
  new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
);
wheelGroup.add(hoverArc);

// Small glowing spheres anchored to the outer ring showing slot A & B selection
const slotIndicators = [0, 1].map(i => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 12),
    new THREE.MeshStandardMaterial({
      emissive: new THREE.Color(i === 0 ? 0xff2200 : 0x0033ff),
      emissiveIntensity: 1.8,
      roughness: 0.1, metalness: 0.3,
      transparent: true, opacity: 0,
    })
  );
  wheelGroup.add(m);
  return m;
});

// Harmony orbit connector lines drawn between scheme hue positions
const harmonyLines = new THREE.Group();
wheelGroup.add(harmonyLines);

// Camera micro-drift state (triggered by Apply Mix)
const camDrift = { active: false, t: 0, dx: 0, dy: 0 };

// Color-pick flash — briefly floods scene with the selected hue
const colorFlash = { active: false, t: 0 };

function triggerColorReaction(color) {
  colorFlash.active = true;
  colorFlash.t = 0;
  // Immediate environment tint
  env.updateBaseColor(color);
  scene.fog.color.copy(color).multiplyScalar(0.12);
}

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
const critiqueEl   = document.getElementById('mix-critique');
const hexA         = document.getElementById('hex-a');
const hexB         = document.getElementById('hex-b');
const contrastValEl  = document.getElementById('contrast-ratio-val');
const contrastBadgeEl = document.getElementById('contrast-level-badge');

function hex(color) { return '#' + color.getHexString(); }

// ── Clipboard copy util ────────────────────────────────────────────────────
function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select(); document.execCommand('copy');
    document.body.removeChild(el);
  });
  showToast(`Copied ${text}`);
}

// ── Mix panel update ───────────────────────────────────────────────────────
function updateMixPanel() {
  const [ca, cb] = state.slotColors;
  swatchA.style.background = hex(ca);
  swatchA.style.boxShadow  = `0 0 16px ${hex(ca)}80`;
  swatchB.style.background = hex(cb);
  swatchB.style.boxShadow  = `0 0 16px ${hex(cb)}80`;
  if (hexA) hexA.textContent = hex(ca);
  if (hexB) hexB.textContent = hex(cb);

  const mix = ca.clone().lerp(cb, 0.5);
  state.mixedColor.copy(mix);
  resultSwatch.style.background = hex(mix);
  resultSwatch.style.boxShadow  = `0 0 20px ${hex(mix)}90`;
  hexDisplay.textContent = hex(mix);

  // WCAG contrast
  const ratio = contrastRatio(ca, cb);
  const lvl   = wcagLevel(ratio);
  if (contrastValEl) contrastValEl.textContent = ratio.toFixed(1) + ':1';
  if (contrastBadgeEl) {
    contrastBadgeEl.textContent = lvl.label;
    contrastBadgeEl.style.background = lvl.color + '28';
    contrastBadgeEl.style.color      = lvl.color;
    contrastBadgeEl.style.borderColor = lvl.color + '55';
    contrastBadgeEl.style.border     = `1px solid ${lvl.color}55`;
  }

  // Live-update the center orb to show the blend
  if (mixSphere) {
    mixSphere.material.color.copy(mix).multiplyScalar(0.55);
    mixSphere.material.emissive.copy(mix);
    mixSphere.material.emissiveIntensity = 0.45;
  }

  // Update slot ring indicators and palette critique
  updateSlotIndicators();
  if (critiqueEl) critiqueEl.textContent = critiqueMix(ca, cb);
}

function updateLights() {
  pointA.color.copy(state.slotColors[0]);
  pointB.color.copy(state.slotColors[1]);
}

function applyEnvColor(color) {
  env.updateBaseColor(color);
  scene.fog.color.copy(color).multiplyScalar(0.12);
  const hsl = {};
  color.getHSL(hsl);
  bloom.strength = Math.min(0.42, 0.20 + hsl.s * 0.32);
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
    const mat = starArmMats[i];
    if (hexStr) {
      const c = new THREE.Color(hexStr);
      mat.color.copy(c).multiplyScalar(0.3);
      mat.emissive.copy(c);
      mat.emissiveIntensity = 1.2;
      mat.opacity = 0.92;
    } else {
      mat.color.set(0x080020);
      mat.emissive.set(0x040010);
      mat.emissiveIntensity = 0.4;
      mat.opacity = 0.90;
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

// Cinematic palette clicks
document.querySelectorAll('.pb-cinematic-item').forEach(el => {
  el.addEventListener('click', () => {
    const key = el.dataset.key;
    if (CINEMATIC[key]) {
      palette.colors = [...CINEMATIC[key].colors];
      updatePrismFaces();
      updatePbSlotUI();
    }
  });
});

btnCreate.addEventListener('click', () => {
  if (palette.active) exitPaletteMode();
  else enterPaletteMode();
});

// ── 3D indicator helpers ───────────────────────────────────────────────────
function updateSlotIndicators() {
  state.slotColors.forEach((c, i) => {
    const hsl = {};
    c.getHSL(hsl);
    const angle = hsl.h * Math.PI * 2;
    const r = WOUTER + 0.42;
    slotIndicators[i].position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    slotIndicators[i].material.emissive.copy(c);
    slotIndicators[i].material.color.copy(c).multiplyScalar(0.3);
    slotIndicators[i].material.opacity = 1.0;
  });
}

function updateHarmonyLines(schemeHues) {
  harmonyLines.children.forEach(l => { l.geometry.dispose(); l.material.dispose(); });
  harmonyLines.clear();
  if (!schemeHues || schemeHues.length < 2) return;
  const r = 2.3;
  const pts = schemeHues.map(h => {
    const a = h * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
  });
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const curve = new THREE.QuadraticBezierCurve3(pts[i], new THREE.Vector3(0, 0, 0.2), pts[j]);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(schemeHues[i], 0.85, 0.65),
        transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      harmonyLines.add(new THREE.Line(geo, mat));
    }
  }
}

function critiqueMix(colorA, colorB) {
  const ha = {}, hb = {};
  colorA.getHSL(ha);
  colorB.getHSL(hb);
  const diff = Math.min(Math.abs(ha.h - hb.h), 1 - Math.abs(ha.h - hb.h));
  const satAvg = (ha.s + hb.s) / 2;
  const litDiff = Math.abs(ha.l - hb.l);
  if (satAvg < 0.2)                return 'Muted — add saturation for depth';
  if (diff < 0.04 && litDiff < 0.08) return 'Too similar — push contrast';
  if (diff > 0.45 && diff < 0.55)  return 'Complementary tension — strong';
  if (diff < 0.1)                  return 'Analogous — harmonious, low tension';
  if (satAvg > 0.8 && diff > 0.2) return 'High energy — bold composition';
  if (litDiff < 0.04)              return 'Try varying lightness for depth';
  return 'Balanced composition';
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
  const tolerance = 0.015; // tighter for 48-segment wheel
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
const pickerA = document.getElementById('color-picker-a');
const pickerB = document.getElementById('color-picker-b');

function openPicker(picker, color) {
  picker.value = '#' + color.getHexString();
  picker.click();
}

swatchA.addEventListener('click', () => { slotBtns[0].click(); openPicker(pickerA, state.slotColors[0]); });
swatchB.addEventListener('click', () => { slotBtns[1].click(); openPicker(pickerB, state.slotColors[1]); });

function applyPickedColor(hexVal, slot) {
  state.slotColors[slot].set(hexVal);
  const hsl = {};
  state.slotColors[slot].getHSL(hsl);
  state.baseHue = hsl.h;
  updateMixPanel();
  updateLights();
  applyEnvColor(state.slotColors[slot]);
  triggerColorReaction(state.slotColors[slot]);
  if (state.activeScheme !== 'none') {
    state.schemeHues = getSchemeHues(state.baseHue, state.activeScheme);
    applySchemeToWheel(state.schemeHues);
    renderSchemePalette(state.schemeHues);
    updateHarmonyLines(state.schemeHues);
  }
}
pickerA.addEventListener('input', e => { state.activeSlot = 0; applyPickedColor(e.target.value, 0); });
pickerB.addEventListener('input', e => { state.activeSlot = 1; applyPickedColor(e.target.value, 1); });

// Copy hex on click for hex displays
if (hexA) hexA.addEventListener('click', e => { e.stopPropagation(); copyText(hex(state.slotColors[0])); });
if (hexB) hexB.addEventListener('click', e => { e.stopPropagation(); copyText(hex(state.slotColors[1])); });
hexDisplay.addEventListener('click', () => copyText(hex(state.mixedColor)));

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
      updateHarmonyLines([]);
    } else if (state.baseHue !== null) {
      state.schemeHues = getSchemeHues(state.baseHue, state.activeScheme);
      applySchemeToWheel(state.schemeHues);
      renderSchemePalette(state.schemeHues);
      updateHarmonyLines(state.schemeHues);
    }
  });
});

// ── Wheel interaction ──────────────────────────────────────────────────────
let isDragging = false;
let mouseDownPos = { x: 0, y: 0 };

// Wheel-spin drag state — drag on a segment to spin the wheel; environment stays fixed
const wheelDrag = { active: false, startX: 0, startRotY: 0, lastX: 0, velocity: 0 };

renderer.domElement.addEventListener('mousedown', e => {
  mouseDownPos = { x: e.clientX, y: e.clientY };
  isDragging = false;
  const seg = intersectSegment(e);
  if (seg && seg.userData.isSegment) {
    wheelDrag.active   = true;
    wheelDrag.startX   = e.clientX;
    wheelDrag.lastX    = e.clientX;
    wheelDrag.startRotY = wheelGroup.rotation.y;
    wheelDrag.velocity = 0;
    controls.enabled   = false; // freeze camera during wheel spin
  }
});

renderer.domElement.addEventListener('mousemove', e => {
  if (wheelDrag.active) {
    const dx = e.clientX - wheelDrag.startX;
    wheelGroup.rotation.y = wheelDrag.startRotY + dx * 0.009;
    wheelDrag.velocity = (e.clientX - wheelDrag.lastX) * 0.009;
    wheelDrag.lastX = e.clientX;
    isDragging = Math.abs(dx) > 3;
    return; // skip hover update while spinning
  }

  const dx = e.clientX - mouseDownPos.x, dy = e.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;

  segments.forEach(s => { s.userData.hovered = false; });
  const seg = intersectSegment(e);
  if (seg && seg.userData.isSegment) {
    seg.userData.hovered = true;
    hoverArc.rotation.z = (seg.userData.hue * Math.PI * 2) - ARC_SPAN / 2;
    hoverArc.userData.show = true;
    const color = new THREE.Color().setHSL(seg.userData.hue, 0.9, 0.55);
    showPsychology(seg.userData.hue, color);
  } else {
    hoverArc.userData.show = false;
    hidePsychology();
  }
});

renderer.domElement.addEventListener('mouseup', () => {
  if (wheelDrag.active) {
    wheelDrag.active   = false;
    controls.enabled   = true;
    // Impart a gentle residual spin matching release velocity
    state._wheelSpinVelocity = wheelDrag.velocity * 0.5;
  }
});

renderer.domElement.addEventListener('mouseleave', () => {
  if (wheelDrag.active) { wheelDrag.active = false; controls.enabled = true; }
  hoverArc.userData.show = false;
  hidePsychology();
});

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
    updateHarmonyLines(state.schemeHues);
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
  triggerColorReaction(color);
  showPsychology(hue, color);
});

// Touch support — wheel spin on drag, color pick on tap
let touchStartPos = { x: 0, y: 0 };
let touchWheelDrag = { active: false, startX: 0, startRotY: 0, lastX: 0, velocity: 0 };

renderer.domElement.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  touchStartPos = { x: t.clientX, y: t.clientY };
  // Check if touch is on a wheel segment
  const fakeEvt = { clientX: t.clientX, clientY: t.clientY };
  const seg = intersectSegment(fakeEvt);
  if (seg && seg.userData.isSegment) {
    touchWheelDrag.active    = true;
    touchWheelDrag.startX    = t.clientX;
    touchWheelDrag.lastX     = t.clientX;
    touchWheelDrag.startRotY = wheelGroup.rotation.y;
    touchWheelDrag.velocity  = 0;
    controls.enabled = false;
  }
}, { passive: true });

renderer.domElement.addEventListener('touchmove', e => {
  if (!touchWheelDrag.active || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - touchWheelDrag.startX;
  wheelGroup.rotation.y = touchWheelDrag.startRotY + dx * 0.009;
  touchWheelDrag.velocity = (t.clientX - touchWheelDrag.lastX) * 0.009;
  touchWheelDrag.lastX = t.clientX;
  isDragging = Math.abs(dx) > 8;
}, { passive: true });

renderer.domElement.addEventListener('touchend', e => {
  if (touchWheelDrag.active) {
    touchWheelDrag.active = false;
    controls.enabled = true;
    state._wheelSpinVelocity = touchWheelDrag.velocity * 0.5;
  }
  if (e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartPos.x;
  const dy = t.clientY - touchStartPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 12) return; // orbit drag — not a tap
  e.preventDefault();
  isDragging = false;
  renderer.domElement.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
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

// ── Hue quick-pick strip ────────────────────────────────────────────────────
const hueStrip = document.getElementById('hue-strip');
const HUE_DOTS = 12;
const hueDots = [];
for (let i = 0; i < HUE_DOTS; i++) {
  const h = i / HUE_DOTS;
  const c = new THREE.Color().setHSL(h, 0.88, 0.55);
  const hex6 = '#' + c.getHexString();
  const dot = document.createElement('div');
  dot.className = 'hue-dot';
  dot.style.background = hex6;
  dot.style.boxShadow = `0 0 7px ${hex6}55`;
  dot.dataset.hue = h;
  dot.addEventListener('click', () => {
    const color = new THREE.Color().setHSL(h, 0.88, 0.55);
    state.slotColors[state.activeSlot].copy(color);
    state.baseHue = h;
    updateMixPanel();
    updateLights();
    applyEnvColor(color);
    triggerColorReaction(color);
    if (state.activeScheme !== 'none') {
      state.schemeHues = getSchemeHues(h, state.activeScheme);
      applySchemeToWheel(state.schemeHues);
      renderSchemePalette(state.schemeHues);
      updateHarmonyLines(state.schemeHues);
    }
    hueDots.forEach((d, di) => d.classList.toggle('active-hue', di === i));
  });
  hueStrip.appendChild(dot);
  hueDots.push(dot);
}

// ── Scheme panel collapse (mobile) ─────────────────────────────────────────
const schemeToggleBtn = document.getElementById('scheme-toggle-btn');
const schemeCollapsible = document.getElementById('scheme-collapsible');
const schemeActiveDisplay = document.getElementById('scheme-active-display');

// Start collapsed on mobile (CSS rule only applies at ≤600px, so safe to set class)
if (window.innerWidth <= 600 && schemeCollapsible) {
  schemeCollapsible.classList.add('collapsed');
}

if (schemeToggleBtn) {
  schemeToggleBtn.addEventListener('click', () => {
    const isOpen = schemeToggleBtn.classList.contains('open');
    schemeToggleBtn.classList.toggle('open', !isOpen);
    schemeToggleBtn.setAttribute('aria-expanded', String(!isOpen));
    schemeCollapsible.classList.toggle('collapsed', isOpen);
  });
}

// Update active scheme display name when scheme changes
function updateSchemeDisplay(schemeName) {
  if (schemeActiveDisplay) schemeActiveDisplay.textContent = schemeName;
}

// Sync scheme active display name to toggle button
schemeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (schemeActiveDisplay) schemeActiveDisplay.textContent = btn.textContent.trim();
  });
});

// ── Export panel ──────────────────────────────────────────────────────────
const exportPanel = document.getElementById('export-panel');
const epClose     = document.getElementById('ep-close');
const epCopy      = document.getElementById('ep-copy');
const epCode      = document.getElementById('ep-code');
const epBrandStrip = document.getElementById('ep-brand-strip');
const epSemantic  = document.getElementById('ep-semantic');
const epValues    = document.getElementById('ep-values');
const epTabs      = document.querySelectorAll('.ep-tab');
const epSrcs      = document.querySelectorAll('.ep-src');

let epActiveTab = 'css';
let epActiveSrc = 'mix';
let currentBrandScale = null;
let currentBrandSystem = null;

function getExportEntries() {
  if (epActiveSrc === 'brand' && currentBrandSystem) {
    return currentBrandSystem.scale;
  }
  if (epActiveSrc === 'palette') {
    return savedPalettes.slice(0, 1).flatMap((p, pi) => [
      { name: `palette-a`,   varName: `--palette-a`,   hex: p.color_a },
      { name: `palette-b`,   varName: `--palette-b`,   hex: p.color_b },
      { name: `palette-mix`, varName: `--palette-mix`, hex: p.color_mix },
    ]);
  }
  // Default: mix colors
  return [
    { name: 'color-a',   varName: '--color-a',   hex: hex(state.slotColors[0]) },
    { name: 'color-b',   varName: '--color-b',   hex: hex(state.slotColors[1]) },
    { name: 'color-mix', varName: '--color-mix', hex: hex(state.mixedColor)    },
  ];
}

function renderExportCode() {
  const entries = getExportEntries();
  let code = '';
  if (epActiveTab === 'css')      code = exportCSS(entries);
  else if (epActiveTab === 'tailwind') code = exportTailwind(entries, epActiveSrc === 'brand' ? 'primary' : 'brand');
  else if (epActiveTab === 'scss') code = exportSCSS(entries);
  else if (epActiveTab === 'json') code = exportJSON(entries);
  if (epCode) epCode.textContent = code;
}

function renderBrandStrip(system) {
  if (!epBrandStrip) return;
  epBrandStrip.innerHTML = '';
  const visible = epActiveSrc === 'brand' && system;
  epBrandStrip.style.display = visible ? 'flex' : 'none';
  if (!visible) return;
  system.scale.forEach(({ name, hex: h, color }) => {
    const div = document.createElement('div');
    div.className = 'ep-brand-swatch';
    div.style.background = h;
    div.title = `${name}: ${h}`;
    const lbl = document.createElement('div');
    lbl.className = 'ep-brand-label';
    lbl.textContent = name;
    div.appendChild(lbl);
    div.addEventListener('click', () => copyText(h));
    epBrandStrip.appendChild(div);
  });
}

function renderSemanticRow(system) {
  if (!epSemantic) return;
  epSemantic.innerHTML = '';
  const visible = epActiveSrc === 'brand' && system;
  epSemantic.style.display = visible ? 'flex' : 'none';
  if (!visible) return;
  system.semantic.forEach(({ name, hex: h }) => {
    const chip = document.createElement('div');
    chip.className = 'ep-sem-chip';
    chip.style.background = h + '22';
    chip.style.border = `1px solid ${h}44`;
    chip.title = `${name}: ${h}`;
    chip.innerHTML = `<div class="ep-sem-name">${name}</div><div class="ep-sem-hex">${h}</div>`;
    chip.addEventListener('click', () => copyText(h));
    epSemantic.appendChild(chip);
  });
}

function renderValueChips() {
  if (!epValues) return;
  epValues.innerHTML = '';
  const colors = epActiveSrc === 'brand' && currentBrandSystem
    ? [
        { label: 'Primary', c: state.slotColors[0] },
        { label: 'Accent',  c: new THREE.Color(currentBrandSystem.scale.find(s => s.name === '500')?.hex || '#fff') },
      ]
    : [
        { label: 'A',   c: state.slotColors[0] },
        { label: 'B',   c: state.slotColors[1] },
        { label: 'Mix', c: state.mixedColor    },
      ];
  colors.forEach(({ label, c }) => {
    const formats = [
      { fmt: 'HEX', val: toHex(c) },
      { fmt: 'RGB', val: toRGB(c) },
      { fmt: 'HSL', val: toHSL(c) },
      { fmt: 'CMYK',val: toCMYK(c) },
    ];
    formats.forEach(({ fmt, val }) => {
      const chip = document.createElement('div');
      chip.className = 'ep-value-chip';
      chip.title = `Copy ${fmt}`;
      chip.innerHTML = `<div class="ep-chip-swatch" style="background:${toHex(c)};"></div><div class="ep-chip-label">${label} · ${fmt}</div><div class="ep-chip-val">${val}</div>`;
      chip.addEventListener('click', () => copyText(val));
      epValues.appendChild(chip);
    });
  });
}

function openExportPanel() {
  currentBrandSystem = generateBrandSystem(state.slotColors[0]);
  renderBrandStrip(epActiveSrc === 'brand' ? currentBrandSystem : null);
  renderSemanticRow(epActiveSrc === 'brand' ? currentBrandSystem : null);
  renderValueChips();
  renderExportCode();
  exportPanel.classList.add('open');
}

epTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    epActiveTab = tab.dataset.tab;
    epTabs.forEach(t => t.classList.toggle('active', t === tab));
    renderExportCode();
  });
});

epSrcs.forEach(src => {
  src.addEventListener('click', () => {
    epActiveSrc = src.dataset.src;
    epSrcs.forEach(s => s.classList.toggle('active', s === src));
    renderBrandStrip(epActiveSrc === 'brand' ? currentBrandSystem : null);
    renderSemanticRow(epActiveSrc === 'brand' ? currentBrandSystem : null);
    renderValueChips();
    renderExportCode();
  });
});

document.getElementById('btn-export').addEventListener('click', openExportPanel);
epClose.addEventListener('click', () => exportPanel.classList.remove('open'));

epCopy.addEventListener('click', () => {
  const text = epCode.textContent;
  navigator.clipboard?.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select(); document.execCommand('copy');
    document.body.removeChild(el);
  });
  epCopy.textContent = 'Copied!';
  epCopy.classList.add('copied');
  setTimeout(() => { epCopy.textContent = 'Copy'; epCopy.classList.remove('copied'); }, 2000);
});

// ── Action buttons ─────────────────────────────────────────────────────────
document.getElementById('btn-mix').addEventListener('click', () => {
  state.exploding = true;
  state.explodeStart = clock.getElapsedTime();
  const mixSnapshot = state.mixedColor.clone();
  // Camera micro-drift — the world absorbs the color
  camDrift.active = true;
  camDrift.t = 0;
  camDrift.dx = (Math.random() - 0.5) * 0.22;
  camDrift.dy = (Math.random() - 0.5) * 0.11;
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
  updateHarmonyLines([]);
  hidePsychology();
  updateMixPanel();
  updateLights();
  applyEnvColor(new THREE.Color(0x220033));
});

document.getElementById('btn-save').addEventListener('click', () => {
  const entry = {
    id: Date.now(),
    color_a:   hex(state.slotColors[0]),
    color_b:   hex(state.slotColors[1]),
    color_mix: hex(state.mixedColor),
    scheme:    state.activeScheme,
    base_hue:  state.baseHue,
  };
  savedPalettes.unshift(entry);
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
  // Spin velocity (from drag release) decays to gentle auto-rotation
  if (!state._wheelSpinVelocity) state._wheelSpinVelocity = 0;
  state._wheelSpinVelocity *= 0.96; // friction
  const baseSpeed = palette.active ? 0.0002 : 0.0004;
  wheelGroup.rotation.y += !wheelDrag.active && !touchWheelDrag.active
    ? baseSpeed + state._wheelSpinVelocity
    : 0;
  env.update(t);

  // ── Camera micro-drift on Apply Mix ───────────────────────────────────
  if (camDrift.active) {
    camDrift.t = Math.min(1, camDrift.t + 0.010);
    const ease = Math.sin(camDrift.t * Math.PI);
    controls.target.set(camDrift.dx * ease, camDrift.dy * ease, 0);
    if (camDrift.t >= 1) { controls.target.set(0, 0, 0); camDrift.active = false; }
  }

  // ── Color-pick flash — scene absorbs every hue click ─────────────────
  if (colorFlash.active) {
    colorFlash.t = Math.min(1, colorFlash.t + 0.038);
    const ease = Math.pow(1 - colorFlash.t, 1.8);
    pointA.intensity = 3 + ease * 11;
    pointB.intensity = 3 + ease * 11;
    bloom.strength   = Math.min(0.75, bloom.strength + ease * 0.025);
    if (colorFlash.t >= 1) {
      pointA.intensity = 3;
      pointB.intensity = 3;
      colorFlash.active = false;
    }
  }

  // ── Hover arc smooth fade ─────────────────────────────────────────────
  const arcTarget = hoverArc.userData.show ? 0.72 : 0;
  hoverArc.material.opacity += (arcTarget - hoverArc.material.opacity) * 0.18;
  hoverArc.visible = hoverArc.material.opacity > 0.01;

  // ── Sphere ↔ prism morph ─────────────────────────────────────────────
  if (palette.morphDir !== 0) {
    palette.morphT = Math.max(0, Math.min(1, palette.morphT + palette.morphDir * 0.045));
    // Ease in-out
    const e = palette.morphT < 0.5
      ? 2 * palette.morphT * palette.morphT
      : 1 - Math.pow(-2 * palette.morphT + 2, 2) / 2;

    mixSphere.material.opacity = 1 - e;
    mixSphere.visible = e < 0.98;

    const starP = Math.max(0, (e - 0.3) / 0.7);
    starGroup.visible = starP > 0.01;
    starGroup.scale.setScalar(starP);

    if (palette.morphT >= 1 || palette.morphT <= 0) palette.morphDir = 0;
  }

  // Star slow spin
  if (starGroup.visible) starGroup.rotation.y += 0.004;

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
