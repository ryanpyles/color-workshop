import * as THREE from 'three';

export function createEnvironment(scene) {
  // ── Background gradient plane ────────────────────────────────────────
  const bgGeo = new THREE.SphereGeometry(80, 32, 32);
  const bgMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uColorA: { value: new THREE.Color(0x05000f) },
      uColorB: { value: new THREE.Color(0x000008) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uTime;
      varying vec3 vPos;
      void main() {
        float t = (normalize(vPos).y + 1.0) * 0.5;
        t += sin(uTime * 0.2 + vPos.x * 0.01) * 0.05;
        vec3 col = mix(uColorB, uColorA, smoothstep(0.0, 1.0, t));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const bgSphere = new THREE.Mesh(bgGeo, bgMat);
  scene.add(bgSphere);

  // ── Floating particles — clustered for spatial intentionality ────────
  const PARTICLE_COUNT = 560;
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);
  const pColors    = new Float32Array(PARTICLE_COUNT * 3);
  const pSpeeds    = new Float32Array(PARTICLE_COUNT);
  const pPhases    = new Float32Array(PARTICLE_COUNT);

  // 5 cluster centres — particles concentrate here with dead zones between
  const CLUSTER_CENTERS = [
    [ 8,  5, -10], [-9,  3,  -7], [ 7, -4,  8],
    [-6,  7,  6],  [ 2, -8,  -5],
  ];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const cc = CLUSTER_CENTERS[Math.floor(Math.random() * CLUSTER_CENTERS.length)];
    const spread = 3.5 + Math.random() * 6.5;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    pPositions[i * 3]     = cc[0] + Math.sin(phi) * Math.cos(theta) * spread;
    pPositions[i * 3 + 1] = cc[1] + Math.sin(phi) * Math.sin(theta) * spread;
    pPositions[i * 3 + 2] = cc[2] + Math.cos(phi) * spread;
    const hue = Math.random();
    const lum = 0.5 + Math.random() * 0.35;
    const c = new THREE.Color().setHSL(hue, 0.85, lum);
    pColors[i * 3]     = c.r;
    pColors[i * 3 + 1] = c.g;
    pColors[i * 3 + 2] = c.b;
    pSpeeds[i] = 0.15 + Math.random() * 0.5;
    pPhases[i] = Math.random() * Math.PI * 2;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions.slice(), 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.065, vertexColors: true,
    transparent: true, opacity: 0.55,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Bright accent "stars" — sparse, larger, pure-hue
  const STAR_COUNT = 18;
  const sPosArr = new Float32Array(STAR_COUNT * 3);
  const sColArr = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 10 + Math.random() * 12;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    sPosArr[i*3]   = r * Math.sin(ph) * Math.cos(th);
    sPosArr[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    sPosArr[i*3+2] = r * Math.cos(ph);
    const sc = new THREE.Color().setHSL(Math.random(), 1, 0.75);
    sColArr[i*3] = sc.r; sColArr[i*3+1] = sc.g; sColArr[i*3+2] = sc.b;
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPosArr, 3));
  sGeo.setAttribute('color',    new THREE.Float32BufferAttribute(sColArr, 3));
  scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.18, vertexColors: true,
    transparent: true, opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));

  // Store original positions
  const origPositions = pPositions.slice();

  // ── Ground plane ─────────────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(60, 60, 60, 60);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x0a0015) },
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 0.3 + uTime * 0.5) * cos(pos.y * 0.3 + uTime * 0.4) * 0.3;
        pos.z += wave;
        vElevation = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        vec3 col = uColor + vElevation * 0.4;
        float dist = length(vUv - 0.5) * 2.0;
        float fade = 1.0 - smoothstep(0.5, 1.0, dist);
        gl_FragColor = vec4(col, fade * 0.7);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -4;
  scene.add(ground);

  // ── Floating color orbs ──────────────────────────────────────────────
  const orbs = [];
  const ORB_COUNT = 4;
  for (let i = 0; i < ORB_COUNT; i++) {
    const hue = i / ORB_COUNT;
    const orbColor = new THREE.Color().setHSL(hue, 0.9, 0.6);
    const geo = new THREE.SphereGeometry(0.14 + Math.random() * 0.08, 14, 14);
    const mat = new THREE.MeshStandardMaterial({
      color: orbColor,
      emissive: orbColor,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.3,
    });
    const orb = new THREE.Mesh(geo, mat);
    const angle = (i / ORB_COUNT) * Math.PI * 2;
    orb.position.set(
      Math.cos(angle) * 4.5,
      Math.sin(i * 1.3) * 1.5,
      Math.sin(angle) * 4.5
    );
    orb.userData.baseAngle = angle;
    orb.userData.phase = Math.random() * Math.PI * 2;
    orb.userData.speed = 0.3 + Math.random() * 0.2;
    scene.add(orb);
    orbs.push(orb);
  }

  // ── Reflection rings ─────────────────────────────────────────────────
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.TorusGeometry(2.5 + i * 1.2, 0.007, 6, 80);
    const rMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(i / 3, 0.8, 0.6),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.rotation.x = Math.PI / 2 + (i * 0.2);
    ring.position.y = -0.5 + i * 0.15;
    scene.add(ring);
    rings.push(ring);
  }

  // ── Mix effect burst ─────────────────────────────────────────────────
  let burstActive = false;
  let burstT = 0;
  const burstParticles = [];
  const BURST_COUNT = 160;

  for (let i = 0; i < BURST_COUNT; i++) {
    const size = i < 80 ? 0.06 : 0.03; // mix of large + small debris
    const geo = new THREE.SphereGeometry(size, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = i < 80
      ? 0.06 + Math.random() * 0.10   // fast primary burst
      : 0.02 + Math.random() * 0.04;  // slow drifting debris
    mesh.userData.vel = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ).multiplyScalar(speed);
    scene.add(mesh);
    burstParticles.push(mesh);
  }

  // ── Shockwave rings (created dynamically on explode) ──────────────────
  const activeShockwaves = [];
  const shockwaveBaseGeo = new THREE.TorusGeometry(1, 0.04, 8, 100);

  // ── Target env color ─────────────────────────────────────────────────
  let targetColor = new THREE.Color(0x05000f);
  let currentColor = new THREE.Color(0x05000f);

  return {
    updateBaseColor(color) {
      const hsl = {};
      color.getHSL(hsl);
      targetColor = new THREE.Color().setHSL(hsl.h, hsl.s * 0.5, Math.max(0.03, hsl.l * 0.18));

      // Update orb colors
      orbs.forEach((orb, i) => {
        const h = (hsl.h + i / ORB_COUNT) % 1;
        const c = new THREE.Color().setHSL(h, 0.9, 0.6);
        orb.material.color.copy(c);
        orb.material.emissive.copy(c);
      });

      // Update ring colors
      rings.forEach((ring, i) => {
        const h = (hsl.h + i * 0.12) % 1;
        ring.material.color.setHSL(h, 0.8, 0.6);
      });

      // Tint particles
      const posAttr = particles.geometry.attributes.color;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const h = (hsl.h + Math.random() * 0.3 - 0.15 + 1) % 1;
        const c = new THREE.Color().setHSL(h, 0.9, 0.65);
        posAttr.setXYZ(i, c.r, c.g, c.b);
      }
      posAttr.needsUpdate = true;
    },

    triggerMixEffect(color) {
      burstActive = true;
      burstT = 0;
      burstParticles.forEach(p => {
        p.position.set(0, 0, 0);
        p.material.color.copy(color);
        p.material.opacity = 1;
        p.visible = true;
      });

      // Spawn two shockwave rings at slight angle offsets
      [0, 0.15].forEach((delay, idx) => {
        const mat = new THREE.MeshBasicMaterial({
          color: color.clone(),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(shockwaveBaseGeo.clone(), mat);
        mesh.rotation.x = Math.PI / 2 + idx * 0.4;
        mesh.rotation.z = idx * 0.6;
        scene.add(mesh);
        activeShockwaves.push({ mesh, t: -delay, maxT: 1.2 });
      });
    },

    update(t) {
      bgMat.uniforms.uTime.value = t;
      groundMat.uniforms.uTime.value = t;

      // Smoothly interpolate env color
      currentColor.lerp(targetColor, 0.015);
      bgMat.uniforms.uColorA.value.copy(currentColor);
      bgMat.uniforms.uColorB.value.copy(currentColor).multiplyScalar(0.3);
      groundMat.uniforms.uColor.value.copy(currentColor);

      // Animate particles
      const posAttr = particles.geometry.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ox = origPositions[i * 3];
        const oy = origPositions[i * 3 + 1];
        const oz = origPositions[i * 3 + 2];
        const phase = pPhases[i];
        const speed = pSpeeds[i];
        posAttr.setXYZ(
          i,
          ox + Math.sin(t * speed + phase) * 0.3,
          oy + Math.cos(t * speed * 0.7 + phase) * 0.4,
          oz + Math.sin(t * speed * 0.5 + phase) * 0.3
        );
      }
      posAttr.needsUpdate = true;

      // Animate orbs
      orbs.forEach(orb => {
        const baseAngle = orb.userData.baseAngle;
        const phase = orb.userData.phase;
        const speed = orb.userData.speed;
        orb.position.x = Math.cos(baseAngle + t * speed * 0.2) * 4.5;
        orb.position.z = Math.sin(baseAngle + t * speed * 0.2) * 4.5;
        orb.position.y = Math.sin(t * speed + phase) * 1.5;
      });

      // Spin rings
      rings.forEach((ring, i) => {
        ring.rotation.z = t * (0.1 + i * 0.05);
        ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.2 + i) * 0.15;
      });

      // Burst animation
      if (burstActive) {
        burstT += 0.018;
        burstParticles.forEach((p, i) => {
          if (!p.visible) return;
          p.position.addScaledVector(p.userData.vel, 1);
          // primary burst fades fast, debris lingers
          const fadeRate = i < 80 ? 1.0 : 0.55;
          p.material.opacity = Math.max(0, 1 - burstT * fadeRate);
          if (p.material.opacity <= 0) p.visible = false;
        });
        if (burstT >= 1.8) burstActive = false;
      }

      // Shockwave ring animation
      for (let i = activeShockwaves.length - 1; i >= 0; i--) {
        const sw = activeShockwaves[i];
        sw.t += 0.02;
        if (sw.t < 0) continue; // delay not reached yet
        const progress = sw.t / sw.maxT;
        const scale = 1 + progress * 22;   // expands to ~23× radius
        sw.mesh.scale.setScalar(scale);
        sw.mesh.material.opacity = Math.max(0, 0.9 - progress * 1.1);
        if (progress >= 1) {
          scene.remove(sw.mesh);
          sw.mesh.geometry.dispose();
          sw.mesh.material.dispose();
          activeShockwaves.splice(i, 1);
        }
      }
    },
  };
}
