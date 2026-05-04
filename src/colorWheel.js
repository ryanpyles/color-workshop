import * as THREE from 'three';

const SEGMENTS = 24;
const INNER_R = 1.6;
const OUTER_R = 3.0;
const THICKNESS = 0.45;

export function createColorWheel(scene) {
  const wheelGroup = new THREE.Group();
  scene.add(wheelGroup);

  const segments = [];

  // ── Outer hue ring ─────────────────────────────────────────────────────
  for (let i = 0; i < SEGMENTS; i++) {
    const hue = i / SEGMENTS;
    const angleStart = (i / SEGMENTS) * Math.PI * 2 - Math.PI / SEGMENTS;
    const angleEnd = ((i + 1) / SEGMENTS) * Math.PI * 2 - Math.PI / SEGMENTS;

    const shape = buildArcShape(INNER_R, OUTER_R, angleStart, angleEnd, 12);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -THICKNESS / 2);

    const color = new THREE.Color().setHSL(hue, 0.95, 0.55);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.4,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isSegment = true;
    mesh.userData.hue = hue;
    mesh.castShadow = true;
    wheelGroup.add(mesh);
    segments.push(mesh);
  }

  // ── Inner sphere – shows mixed color ──────────────────────────────────
  const sphereGeo = new THREE.SphereGeometry(INNER_R - 0.15, 64, 64);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.1,
    metalness: 0.8,
    envMapIntensity: 1,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.userData.isMixSphere = true;
  wheelGroup.add(sphere);

  // ── Inner triangle (primary colors) ───────────────────────────────────
  const triGroup = new THREE.Group();
  const primaryHues = [0, 1 / 3, 2 / 3]; // red, green, blue
  const triRadius = INNER_R - 0.5;

  const triShape = new THREE.Shape();
  primaryHues.forEach((h, i) => {
    const angle = (h * Math.PI * 2) - Math.PI / 2;
    const x = Math.cos(angle) * triRadius;
    const y = Math.sin(angle) * triRadius;
    i === 0 ? triShape.moveTo(x, y) : triShape.lineTo(x, y);
  });
  triShape.closePath();

  const triGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.08,
    bevelEnabled: false,
  });
  triGeo.translate(0, 0, -0.04);

  // Vertex colors for the triangle
  const positions = triGeo.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const triColors = primaryHues.map(h => new THREE.Color().setHSL(h, 0.95, 0.55));

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    // Barycentric-ish blending based on proximity to each vertex
    const verts = primaryHues.map((h, vi) => {
      const a = (h * Math.PI * 2) - Math.PI / 2;
      return new THREE.Vector2(Math.cos(a) * triRadius, Math.sin(a) * triRadius);
    });
    const dists = verts.map(v => 1 / (Math.hypot(x - v.x, y - v.y) + 0.001));
    const total = dists.reduce((s, d) => s + d, 0);
    const weights = dists.map(d => d / total);
    const r = weights.reduce((s, w, i) => s + w * triColors[i].r, 0);
    const g = weights.reduce((s, w, i) => s + w * triColors[i].g, 0);
    const b = weights.reduce((s, w, i) => s + w * triColors[i].b, 0);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  triGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const triMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.2,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const triMesh = new THREE.Mesh(triGeo, triMat);
  triGroup.add(triMesh);
  wheelGroup.add(triGroup);

  // ── Glow ring ─────────────────────────────────────────────────────────
  const ringGeo = new THREE.TorusGeometry(OUTER_R + 0.08, 0.06, 8, 80);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  wheelGroup.add(ring);

  // Tilt the whole wheel for a nice 3D look
  wheelGroup.rotation.x = Math.PI * 0.18;

  return { wheelGroup, segments };
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
