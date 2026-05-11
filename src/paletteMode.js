import * as THREE from 'three';

// ── Pentagonal prism with 5 independently-coloured face groups ─────────────
export function createPentagonalPrism(radius = 1.1, height = 2.2) {
  const n = 5;
  const positions = [];
  const normals   = [];
  const uvs       = [];
  const indices   = [];

  // Side faces — each face gets its own 4 vertices so normals & groups are clean
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;

    const base = positions.length / 3;
    positions.push(
      x0, -height / 2, z0,
      x1, -height / 2, z1,
      x1,  height / 2, z1,
      x0,  height / 2, z0,
    );

    const midA = (a0 + a1) * 0.5;
    const nx = Math.cos(midA), nz = Math.sin(midA);
    for (let v = 0; v < 4; v++) normals.push(nx, 0, nz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Top cap (fan from first vertex)
  const topBase = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    positions.push(Math.cos(a) * radius, height / 2, Math.sin(a) * radius);
    normals.push(0, 1, 0);
    uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
  }
  for (let i = 1; i < n - 1; i++) indices.push(topBase, topBase + i, topBase + i + 1);

  // Bottom cap
  const botBase = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    positions.push(Math.cos(a) * radius, -height / 2, Math.sin(a) * radius);
    normals.push(0, -1, 0);
    uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
  }
  for (let i = 1; i < n - 1; i++) indices.push(botBase, botBase + i + 1, botBase + i);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,       2));
  geo.setIndex(indices);

  const capCount = (n - 2) * 3;
  for (let i = 0; i < n; i++) geo.addGroup(i * 6, 6, i);        // 5 side groups
  geo.addGroup(n * 6,            capCount, n);                   // top cap → mat[5]
  geo.addGroup(n * 6 + capCount, capCount, n);                   // bottom cap → mat[5]

  // Per-face materials (unlit dark crystal default)
  const faceMaterials = Array.from({ length: n }, () =>
    new THREE.MeshStandardMaterial({
      color:            new THREE.Color(0x0a0028),
      emissive:         new THREE.Color(0x060018),
      emissiveIntensity: 0.5,
      transparent:      true,
      opacity:          0.88,
      roughness:        0.05,
      metalness:        0.55,
      side:             THREE.DoubleSide,
    })
  );

  const capMat = new THREE.MeshStandardMaterial({
    color:            new THREE.Color(0x050012),
    emissive:         new THREE.Color(0x020008),
    emissiveIntensity: 0.25,
    transparent:      true,
    opacity:          0.6,
    roughness:        0.2,
    metalness:        0.7,
  });

  const mesh = new THREE.Mesh(geo, [...faceMaterials, capMat]);
  mesh.visible = false;
  mesh.scale.setScalar(0);
  mesh.castShadow = true;

  return { mesh, faceMaterials };
}

// ── Mood palette data ──────────────────────────────────────────────────────
export const MOODS = {
  calm:         { label: 'Calm',         desc: 'Peaceful blues & soft teals',       colors: ['#4db8d4','#6ec6d8','#a8d8e8','#78c4c0','#5bb5c4'] },
  energetic:    { label: 'Energetic',    desc: 'Vivid reds, oranges & yellows',     colors: ['#ff2200','#ff6a00','#ffcc00','#ff3300','#ff9900'] },
  romantic:     { label: 'Romantic',     desc: 'Warm pinks & deep roses',           colors: ['#ff4466','#ff7799','#cc2255','#ff88aa','#e8194e'] },
  professional: { label: 'Professional', desc: 'Navy, slate & arctic blue',         colors: ['#1a3a5c','#2b5797','#4a7fc1','#d0dff0','#8fa9cc'] },
  playful:      { label: 'Playful',      desc: 'Bold rainbow primaries',            colors: ['#ff2200','#ffcc00','#22cc44','#0055ff','#cc00ff'] },
  natural:      { label: 'Natural',      desc: 'Earthy greens & warm browns',       colors: ['#4a7c3f','#6b9e56','#8b6347','#c4a882','#3d6b35'] },
  mysterious:   { label: 'Mysterious',   desc: 'Deep purples & midnight blues',     colors: ['#2d0b4e','#4a1a7a','#6b2fa0','#1a1040','#8833cc'] },
  warm:         { label: 'Warm',         desc: 'Sunset oranges & amber glow',       colors: ['#ff4400','#ff8800','#ffaa00','#cc3300','#ff6600'] },
  luxurious:    { label: 'Luxurious',    desc: 'Gold, violet & obsidian noir',      colors: ['#c9a227','#8b2fc9','#1a0a2e','#e8c547','#5c1a8f'] },
  ocean:        { label: 'Ocean',        desc: 'Deep sea blues & seafoam',          colors: ['#006994','#0099cc','#00c5a8','#004f6e','#33bbdd'] },
};

// ── Cinematic / cultural palette references ────────────────────────────────
export const CINEMATIC = {
  kubrick:    { label: 'Kubrick',       sub: '2001 · The Shining',         colors: ['#b0bcc8','#cc3030','#181e2a','#e8dcc0','#243040'] },
  wkw:        { label: 'Wong Kar-wai',  sub: 'In the Mood for Love',       colors: ['#c04018','#140804','#cc8020','#260608','#e09030'] },
  brutalist:  { label: 'Brutalist',     sub: 'Raw concrete & steel',       colors: ['#909090','#c4c0b8','#282828','#ece8e0','#505050'] },
  hermes:     { label: 'Hermès',        sub: 'Maison de luxe',             colors: ['#d05818','#7a3808','#e8b870','#280e04','#e07028'] },
  kodachrome: { label: 'Kodachrome',    sub: '1935–2010 film stock',       colors: ['#e8b848','#b84020','#70a040','#d07030','#f0d878'] },
  miyazaki:   { label: 'Miyazaki',      sub: 'Studio Ghibli wonder',       colors: ['#38a0c8','#70c038','#e8c030','#d86020','#b8e0e8'] },
  nordic:     { label: 'Nordic Noir',   sub: 'Scandi atmosphere',          colors: ['#98a8b8','#182838','#d8e0e8','#283848','#506070'] },
  godfather:  { label: 'The Godfather', sub: 'Gordon Willis noir',         colors: ['#140c04','#482810','#b89050','#200404','#806030'] },
};

// ── Suggestion generator — returns 3 variations of a mood ─────────────────
export function generateSuggestions(moodKey) {
  const mood = MOODS[moodKey];
  if (!mood) return [];

  const adjustColors = (colors, dH, dS, dL) => colors.map(hex => {
    const hsl = {};
    new THREE.Color(hex).getHSL(hsl);
    return '#' + new THREE.Color()
      .setHSL((hsl.h + dH + 1) % 1, Math.max(0, Math.min(1, hsl.s + dS)), Math.max(0, Math.min(1, hsl.l + dL)))
      .getHexString();
  });

  return [
    { label: mood.desc,       colors: mood.colors },
    { label: 'Pastel',        colors: adjustColors(mood.colors,  0.00, -0.25, +0.18) },
    { label: 'Hue shifted',   colors: adjustColors(mood.colors, +0.06,  0.00,  0.00) },
  ];
}
