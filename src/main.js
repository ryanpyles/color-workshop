import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { colorNames } from './colorUtils.js';
import { createColorWheel } from './colorWheel.js';
import { createEnvironment } from './environment.js';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  slotColors: [
    new THREE.Color(0xff2200),
    new THREE.Color(0x0033ff),
  ],
  activeSlot: 0,
  mixedColor: new THREE.Color(0x7f00ff),
  environmentColor: new THREE.Color(0x0a000f),
};

// ── Renderer ───────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6, 0.4, 0.6
);
composer.addPass(bloom);

// ── Color Wheel ────────────────────────────────────────────────────────────
const { wheelGroup, segments } = createColorWheel(scene);

// ── Environment ────────────────────────────────────────────────────────────
const env = createEnvironment(scene);

// ── Lighting ───────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

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

function getIntersectedSegment(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(segments, true);
  return hits.length > 0 ? hits[0] : null;
}

// ── UI references ──────────────────────────────────────────────────────────
const swatchA = document.getElementById('swatch-a');
const swatchB = document.getElementById('swatch-b');
const resultSwatch = document.getElementById('result-swatch');
const hexDisplay = document.getElementById('hex-display');
const colorNameEl = document.getElementById('color-name');
const slotBtns = document.querySelectorAll('.slot-btn');

function hexStr(color) {
  return '#' + color.getHexString();
}

function updateSwatches() {
  swatchA.style.background = hexStr(state.slotColors[0]);
  swatchB.style.background = hexStr(state.slotColors[1]);
  swatchA.style.boxShadow = `0 0 18px ${hexStr(state.slotColors[0])}88`;
  swatchB.style.boxShadow = `0 0 18px ${hexStr(state.slotColors[1])}88`;

  const mix = state.slotColors[0].clone().lerp(state.slotColors[1], 0.5);
  state.mixedColor.copy(mix);
  resultSwatch.style.background = hexStr(mix);
  resultSwatch.style.boxShadow = `0 0 22px ${hexStr(mix)}99`;
  hexDisplay.textContent = hexStr(mix);
}

function updateLights() {
  pointA.color.copy(state.slotColors[0]);
  pointB.color.copy(state.slotColors[1]);
}

function applyEnvironmentColor(color) {
  state.environmentColor.copy(color);
  env.updateBaseColor(color);
  scene.fog.color.copy(color).multiplyScalar(0.15);

  const hsl = {};
  color.getHSL(hsl);
  bloom.strength = 0.4 + hsl.s * 0.8;
}

// ── Slot selection ─────────────────────────────────────────────────────────
slotBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeSlot = parseInt(btn.dataset.slot);
    slotBtns.forEach(b => b.classList.toggle('active', b === btn));
    swatchA.classList.toggle('active', state.activeSlot === 0);
    swatchB.classList.toggle('active', state.activeSlot === 1);
  });
});

swatchA.addEventListener('click', () => { state.activeSlot = 0; slotBtns[0].click(); });
swatchB.addEventListener('click', () => { state.activeSlot = 1; slotBtns[1].click(); });

// ── Wheel interaction ──────────────────────────────────────────────────────
let isDragging = false;
let mouseDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('mousedown', e => {
  mouseDownPos = { x: e.clientX, y: e.clientY };
  isDragging = false;
});

renderer.domElement.addEventListener('mousemove', e => {
  const dx = e.clientX - mouseDownPos.x;
  const dy = e.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;

  segments.forEach(s => { s.material.emissiveIntensity = 0; });

  const hit = getIntersectedSegment(e);
  if (hit && hit.object.userData.isSegment) {
    hit.object.material.emissiveIntensity = 0.4;
    colorNameEl.textContent = colorNames(hit.object.userData.hue);
  } else {
    colorNameEl.textContent = '—';
  }
});

renderer.domElement.addEventListener('click', e => {
  if (isDragging) return;
  const hit = getIntersectedSegment(e);
  if (!hit || !hit.object.userData.isSegment) return;

  const hue = hit.object.userData.hue;
  const pickedColor = new THREE.Color().setHSL(hue, 0.9, 0.55);
  state.slotColors[state.activeSlot].copy(pickedColor);

  // Pulse the segment
  const seg = hit.object;
  const t0 = performance.now();
  const pulse = () => {
    const t = (performance.now() - t0) / 350;
    if (t < 1) {
      const s = 1 + 0.18 * Math.sin(t * Math.PI);
      seg.scale.set(s, s, s);
      requestAnimationFrame(pulse);
    } else {
      seg.scale.set(1, 1, 1);
    }
  };
  pulse();

  updateSwatches();
  updateLights();
  applyEnvironmentColor(pickedColor);
});

// Touch support
renderer.domElement.addEventListener('touchend', e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const synth = new MouseEvent('click', { clientX: touch.clientX, clientY: touch.clientY });
  renderer.domElement.dispatchEvent(synth);
}, { passive: false });

// ── Buttons ────────────────────────────────────────────────────────────────
document.getElementById('btn-mix').addEventListener('click', () => {
  applyEnvironmentColor(state.mixedColor);
  env.triggerMixEffect(state.mixedColor);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  state.slotColors[0].set(0xff2200);
  state.slotColors[1].set(0x0033ff);
  updateSwatches();
  updateLights();
  applyEnvironmentColor(new THREE.Color(0x220033));
});

document.getElementById('btn-randomize').addEventListener('click', () => {
  const h1 = Math.random();
  const h2 = (h1 + 0.3 + Math.random() * 0.4) % 1;
  state.slotColors[0].setHSL(h1, 0.9, 0.55);
  state.slotColors[1].setHSL(h2, 0.9, 0.55);
  updateSwatches();
  updateLights();
  applyEnvironmentColor(state.slotColors[0]);
});

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ── Init ───────────────────────────────────────────────────────────────────
updateSwatches();
updateLights();
applyEnvironmentColor(new THREE.Color(0x110022));

// ── Animation loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  controls.update();
  wheelGroup.rotation.y += 0.0015;
  env.update(t);

  // Orbiting colored lights
  pointA.position.x = -5 + Math.sin(t * 0.4) * 1.5;
  pointA.position.z = 2 + Math.cos(t * 0.3) * 1.5;
  pointB.position.x = 5 + Math.cos(t * 0.35) * 1.5;
  pointB.position.z = 2 + Math.sin(t * 0.4) * 1.5;

  composer.render();
}
animate();
