import * as THREE from 'three';
import { SEGMENT_DATA } from './colorUtils.js';

const SEGMENTS = 24;
const INNER_R = 1.6;
const OUTER_R = 3.0;

// Category → extrusion depth (gives visual hierarchy: primary tallest)
const DEPTH = { primary: 0.65, secondary: 0.50, tertiary: 0.36 };

export function createColorWheel(scene) {
  const wheelGroup = new THREE.Group();
  scene.add(wheelGroup);

  const segments = [];

  // ── Outer hue ring ────────────────────────────────────────────────────
  for (let i = 0; i < SEGMENTS; i++) {
    const hue = i / SEGMENTS;
    const data = SEGMENT_DATA[i];
    const depth = DEPTH[data.category];

    const angleStart = (i / SEGMENTS) * Math.PI * 2 - Math.PI / SEGMENTS;
    const angleEnd = ((i + 1) / SEGMENTS) * Math.PI * 2 - Math.PI / SEGMENTS;

    const shape = buildArcShape(INNER_R, OUTER_R, angleStart, angleEnd, 12);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -depth / 2);

    const color = new THREE.Color().setHSL(hue, 0.95, 0.55);
    const mat = new THREE.MeshStandardMaterial({
      color: color.clone(),
      emissive: color.clone(),
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.4,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isSegment = true;
    mesh.userData.hue = hue;
    mesh.userData.segmentIndex = i;
    mesh.userData.baseColor = color.clone();
    mesh.userData.category = data.category;
    mesh.userData.colorMult = 1.0;
    mesh.userData.schemeHighlight = false;
    mesh.userData.hovered = false;
    mesh.castShadow = true;
    wheelGroup.add(mesh);
    segments.push(mesh);
  }

  // ── Primary & secondary category markers ──────────────────────────────
  // Primary: gold spheres on outer edge; Secondary: silver spheres
  const primaryIndices = [0, 4, 14];    // Red, Yellow, Blue
  const secondaryIndices = [2, 8, 18];  // Orange, Green, Purple

  primaryIndices.forEach(i => {
    addMarker(wheelGroup, i, 0.13, 0xffd700, 0xffd700, 0.9);
  });
  secondaryIndices.forEach(i => {
    addMarker(wheelGroup, i, 0.09, 0xdddddd, 0xffffff, 0.6);
  });

  // ── Inner triangle (primary hues blended) ─────────────────────────────
  const triRadius = INNER_R - 0.45;
  const primaryHues = [0, 1 / 3, 2 / 3]; // RGB triangle
  const triShape = new THREE.Shape();
  primaryHues.forEach((h, idx) => {
    const angle = h * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * triRadius;
    const y = Math.sin(angle) * triRadius;
    idx === 0 ? triShape.moveTo(x, y) : triShape.lineTo(x, y);
  });
  triShape.closePath();

  const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.1, bevelEnabled: false });
  triGeo.translate(0, 0, -0.05);

  // Vertex-color blend across triangle corners
  const triColors = primaryHues.map(h => new THREE.Color().setHSL(h, 0.95, 0.55));
  const pos = triGeo.attributes.position;
  const vcols = new Float32Array(pos.count * 3);
  const verts2d = primaryHues.map((h, vi) => {
    const a = h * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector2(Math.cos(a) * triRadius, Math.sin(a) * triRadius);
  });
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const dists = verts2d.map(v => 1 / (Math.hypot(x - v.x, y - v.y) + 0.001));
    const total = dists.reduce((s, d) => s + d, 0);
    const w = dists.map(d => d / total);
    vcols[i * 3]     = w.reduce((s, wi, j) => s + wi * triColors[j].r, 0);
    vcols[i * 3 + 1] = w.reduce((s, wi, j) => s + wi * triColors[j].g, 0);
    vcols[i * 3 + 2] = w.reduce((s, wi, j) => s + wi * triColors[j].b, 0);
  }
  triGeo.setAttribute('color', new THREE.BufferAttribute(vcols, 3));

  const triMesh = new THREE.Mesh(triGeo, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.2,
    metalness: 0.3,
    side: THREE.DoubleSide,
  }));
  wheelGroup.add(triMesh);

  // ── Mix color center sphere ───────────────────────────────────────────
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(INNER_R - 0.18, 64, 64),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1a0033),
      emissive: new THREE.Color(0x1a0033),
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.45,
      transparent: true,
      opacity: 1.0,
    })
  );
  sphere.userData.isMixSphere = true;
  wheelGroup.add(sphere);

  // ── Outer glow ring ───────────────────────────────────────────────────
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(OUTER_R + 0.1, 0.055, 8, 80),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })
  );
  ring.rotation.x = Math.PI / 2;
  wheelGroup.add(ring);

  // 3D tilt for perspective
  wheelGroup.rotation.x = Math.PI * 0.18;

  return { wheelGroup, segments, mixSphere: sphere };
}

function addMarker(group, segIndex, radius, color, emissive, intensity) {
  const hue = segIndex / SEGMENTS;
  const midAngle = hue * Math.PI * 2;
  const r = OUTER_R + 0.3;
  const geo = new THREE.SphereGeometry(radius, 10, 10);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.1,
    metalness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(Math.cos(midAngle) * r, Math.sin(midAngle) * r, 0);
  group.add(mesh);
}

function buildArcShape(innerR, outerR, startAngle, endAngle, steps) {
  const shape = new THREE.Shape();
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / steps);
    pts.push(new THREE.Vector2(Math.cos(a) * outerR, Math.sin(a) * outerR));
  }
  for (let i = steps; i >= 0; i--) {
    const a = startAngle + (endAngle - startAngle) * (i / steps);
    pts.push(new THREE.Vector2(Math.cos(a) * innerR, Math.sin(a) * innerR));
  }
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
  shape.closePath();
  return shape;
}
