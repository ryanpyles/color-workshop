import * as THREE from 'three';

// ── WCAG 2.1 contrast ratio ────────────────────────────────────────────────
function toLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
export function contrastRatio(colorA, colorB) {
  const L1 = luminance(colorA), L2 = luminance(colorB);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
export function wcagLevel(ratio) {
  if (ratio >= 7.0) return { label: 'AAA', pass: true,  color: '#4ade80' };
  if (ratio >= 4.5) return { label: 'AA',  pass: true,  color: '#86efac' };
  if (ratio >= 3.0) return { label: 'AA Lg', pass: true, color: '#fbbf24' };
  return             { label: 'Fail', pass: false, color: '#f87171' };
}

// ── Brand scale (10-stop Tailwind-style) ─────────────────────────────────────
const STOPS = [
  { name: '50',  lΔ: +0.44, sΔ: -0.35 },
  { name: '100', lΔ: +0.36, sΔ: -0.28 },
  { name: '200', lΔ: +0.26, sΔ: -0.18 },
  { name: '300', lΔ: +0.16, sΔ: -0.09 },
  { name: '400', lΔ: +0.07, sΔ: -0.03 },
  { name: '500', lΔ:  0,    sΔ:  0    },
  { name: '600', lΔ: -0.07, sΔ: +0.02 },
  { name: '700', lΔ: -0.14, sΔ: +0.04 },
  { name: '800', lΔ: -0.22, sΔ: +0.05 },
  { name: '900', lΔ: -0.30, sΔ: +0.05 },
];

export function generateBrandScale(baseColor, name = 'brand') {
  const hsl = {};
  baseColor.getHSL(hsl);
  return STOPS.map(s => {
    const l = Math.max(0.03, Math.min(0.97, hsl.l + s.lΔ));
    const sat = Math.max(0.04, Math.min(1, hsl.s + s.sΔ));
    const c = new THREE.Color().setHSL(hsl.h, sat, l);
    return { name: s.name, varName: `--${name}-${s.name}`, hex: '#' + c.getHexString(), color: c };
  });
}

// Also derive neutral (desaturated), accent (complementary), semantic colors
export function generateBrandSystem(baseColor) {
  const hsl = {};
  baseColor.getHSL(hsl);
  const scale = generateBrandScale(baseColor, 'primary');
  const neutral = generateBrandScale(
    new THREE.Color().setHSL(hsl.h, 0.06, 0.5), 'neutral'
  );
  const accent = generateBrandScale(
    new THREE.Color().setHSL((hsl.h + 0.5) % 1, Math.min(1, hsl.s * 1.1), 0.52), 'accent'
  );
  const semantic = [
    { name: 'success', hex: '#22c55e' },
    { name: 'warning', hex: '#f59e0b' },
    { name: 'error',   hex: '#ef4444' },
    { name: 'info',    hex: '#3b82f6' },
  ];
  return { scale, neutral, accent, semantic };
}

// ── Color format converters ───────────────────────────────────────────────
export function toHex(c)  { return '#' + c.getHexString(); }
export function toRGB(c)  {
  return `rgb(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)})`;
}
export function toHSL(c)  {
  const h = {}; c.getHSL(h);
  return `hsl(${Math.round(h.h*360)}, ${Math.round(h.s*100)}%, ${Math.round(h.l*100)}%)`;
}
export function toCMYK(c) {
  const r = c.r, g = c.g, b = c.b;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return 'cmyk(0%, 0%, 0%, 100%)';
  const cy = ((1 - r - k) / (1 - k) * 100).toFixed(0);
  const m  = ((1 - g - k) / (1 - k) * 100).toFixed(0);
  const y  = ((1 - b - k) / (1 - k) * 100).toFixed(0);
  return `cmyk(${cy}%, ${m}%, ${y}%, ${(k*100).toFixed(0)}%)`;
}

// ── Code export builders ─────────────────────────────────────────────────
export function exportCSS(entries) {
  const vars = entries.map(e => `  ${e.varName ?? '--color-' + e.name}: ${e.hex};`).join('\n');
  return `:root {\n${vars}\n}`;
}

export function exportTailwind(entries, scaleName = 'brand') {
  const inner = entries.map(e => `    '${e.name}': '${e.hex}',`).join('\n');
  return `// tailwind.config.js\ntheme: {\n  extend: {\n    colors: {\n      '${scaleName}': {\n${inner}\n      },\n    },\n  },\n}`;
}

export function exportSCSS(entries) {
  return entries.map(e => `$${(e.varName ?? '--color-' + e.name).replace('--','').replace(/-/g,'_')}: ${e.hex};`).join('\n');
}

export function exportJSON(entries) {
  const obj = {};
  entries.forEach(e => { obj[e.varName ?? e.name] = e.hex; });
  return JSON.stringify(obj, null, 2);
}
