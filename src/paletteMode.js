import * as THREE from 'three';

// ── Five-pointed star with 5 independently-coloured arms ───────────────────
export function createStarPrism(outerR = 1.25, innerR = 0.48, height = 0.52) {
  const N = 5;
  const group = new THREE.Group();
  const armMaterials = [];

  for (let i = 0; i < N; i++) {
    const tipAngle   = (i / N) * Math.PI * 2 - Math.PI / 2;
    const leftAngle  = tipAngle - Math.PI / N;
    const rightAngle = tipAngle + Math.PI / N;

    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(leftAngle)  * innerR, Math.sin(leftAngle)  * innerR);
    shape.lineTo(Math.cos(tipAngle)   * outerR, Math.sin(tipAngle)   * outerR);
    shape.lineTo(Math.cos(rightAngle) * innerR, Math.sin(rightAngle) * innerR);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.020,
      bevelSegments: 3,
    });
    geo.translate(0, 0, -height / 2);

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x080020),
      emissive: new THREE.Color(0x040010),
      emissiveIntensity: 0.4,
      roughness: 0.04,
      metalness: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      transparent: true,
      opacity: 0.90,
    });
    armMaterials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // Center pentagon body — connects arm bases seamlessly
  const pentShape = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * innerR;
    const y = Math.sin(a) * innerR;
    if (i === 0) pentShape.moveTo(x, y);
    else pentShape.lineTo(x, y);
  }
  pentShape.closePath();

  const pentGeo = new THREE.ExtrudeGeometry(pentShape, {
    depth: height,
    bevelEnabled: false,
  });
  pentGeo.translate(0, 0, -height / 2);

  group.add(new THREE.Mesh(pentGeo, new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x020008),
    emissive: new THREE.Color(0x010005),
    emissiveIntensity: 0.2,
    roughness: 0.0,
    metalness: 0.5,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  })));

  // Orient star flat in the wheel plane
  group.rotation.x = Math.PI / 2;
  group.visible = false;
  group.scale.setScalar(0);

  return { group, armMaterials };
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
