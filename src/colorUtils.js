// Color psychology, scheme math, and wheel segment metadata

export const SEGMENT_DATA = [
  // i=0  hue=0.000
  { name: 'Red',          traits: ['Passion', 'Energy', 'Urgency', 'Power', 'Love'],                   category: 'primary'   },
  // i=1  hue=0.042
  { name: 'Coral',        traits: ['Vitality', 'Energetic', 'Playful', 'Refreshing', 'Sociable'],      category: 'tertiary'  },
  // i=2  hue=0.083
  { name: 'Orange',       traits: ['Enthusiasm', 'Creativity', 'Warmth', 'Adventure', 'Friendliness'], category: 'secondary' },
  // i=3  hue=0.125
  { name: 'Amber',        traits: ['Prestige', 'Warmth', 'Celebration', 'Timelessness', 'Luxury'],     category: 'tertiary'  },
  // i=4  hue=0.167
  { name: 'Yellow',       traits: ['Optimism', 'Happiness', 'Clarity', 'Youthfulness', 'Attention'],   category: 'primary'   },
  // i=5  hue=0.208
  { name: 'Yellow-Green', traits: ['Freshness', 'Growth', 'Vitality', 'Renewal', 'Innovation'],        category: 'tertiary'  },
  // i=6  hue=0.250
  { name: 'Chartreuse',   traits: ['Energy', 'Boldness', 'Liveliness', 'Daring', 'Youthfulness'],      category: 'tertiary'  },
  // i=7  hue=0.292
  { name: 'Spring Green', traits: ['Renewal', 'Nature', 'Freshness', 'Growth', 'Balance'],             category: 'tertiary'  },
  // i=8  hue=0.333
  { name: 'Green',        traits: ['Growth', 'Health', 'Nature', 'Wealth', 'Calmness'],                category: 'secondary' },
  // i=9  hue=0.375
  { name: 'Emerald',      traits: ['Earthiness', 'Peace', 'Balance', 'Strength', 'Tradition'],         category: 'tertiary'  },
  // i=10 hue=0.417
  { name: 'Teal',         traits: ['Balance', 'Sophistication', 'Tranquility', 'Openness', 'Healing'], category: 'tertiary'  },
  // i=11 hue=0.458
  { name: 'Cyan',         traits: ['Clarity', 'Freedom', 'Communication', 'Openness', 'Freshness'],    category: 'tertiary'  },
  // i=12 hue=0.500
  { name: 'Sky Blue',     traits: ['Serenity', 'Peace', 'Calmness', 'Clarity', 'Hope'],                category: 'tertiary'  },
  // i=13 hue=0.542
  { name: 'Azure',        traits: ['Inspiration', 'Clarity', 'Intuition', 'Serenity', 'Depth'],        category: 'tertiary'  },
  // i=14 hue=0.583
  { name: 'Blue',         traits: ['Trust', 'Stability', 'Professionalism', 'Serenity', 'Intelligence'], category: 'primary' },
  // i=15 hue=0.625
  { name: 'Royal Blue',   traits: ['Authority', 'Trust', 'Responsibility', 'Maturity', 'Intelligence'], category: 'tertiary' },
  // i=16 hue=0.667
  { name: 'Indigo',       traits: ['Wisdom', 'Intuition', 'Integrity', 'Depth', 'Perception'],         category: 'tertiary'  },
  // i=17 hue=0.708
  { name: 'Violet',       traits: ['Creativity', 'Mysticism', 'Sensitivity', 'Imagination', 'Insight'], category: 'tertiary' },
  // i=18 hue=0.750
  { name: 'Purple',       traits: ['Luxury', 'Spirituality', 'Mystery', 'Wisdom', 'Imagination'],      category: 'secondary' },
  // i=19 hue=0.792
  { name: 'Magenta',      traits: ['Compassion', 'Kindness', 'Harmony', 'Universal Love', 'Balance'],  category: 'tertiary'  },
  // i=20 hue=0.833
  { name: 'Rose',         traits: ['Romance', 'Tenderness', 'Grace', 'Femininity', 'Compassion'],      category: 'tertiary'  },
  // i=21 hue=0.875
  { name: 'Pink',         traits: ['Femininity', 'Compassion', 'Playfulness', 'Romance', 'Innocence'], category: 'tertiary'  },
  // i=22 hue=0.917
  { name: 'Hot Pink',     traits: ['Confidence', 'Boldness', 'Excitement', 'Fun', 'Playfulness'],      category: 'tertiary'  },
  // i=23 hue=0.958
  { name: 'Vermilion',    traits: ['Vitality', 'Passion', 'Boldness', 'Action', 'Drive'],              category: 'tertiary'  },
];

export function colorPsychology(hue) {
  const idx = Math.round(((hue % 1) + 1) * 24) % 24;
  return SEGMENT_DATA[idx];
}

export function colorNames(hue) {
  return colorPsychology(hue).name;
}

export const SCHEMES = {
  none: {
    label: 'Free',
    desc: 'Explore freely — no harmony scheme applied.',
    compute: () => [],
  },
  mono: {
    label: 'Mono',
    desc: 'Monochromatic — one hue, varied tones. Clean, minimal, elegant.',
    compute: h => [h],
  },
  complementary: {
    label: 'Comp',
    desc: 'Complementary — opposite hues. High contrast, bold energy. (Lakers, Tide)',
    compute: h => [h, (h + 0.5) % 1],
  },
  analogous: {
    label: 'Analog',
    desc: 'Analogous — neighboring hues. Harmonious, calming. (BP, Firefox)',
    compute: h => [(h + 1 - 0.083) % 1, h, (h + 0.083) % 1],
  },
  triadic: {
    label: 'Triadic',
    desc: 'Triadic — 3 evenly spaced. Vibrant yet balanced. (Fanta, Burger King)',
    compute: h => [h, (h + 0.333) % 1, (h + 0.667) % 1],
  },
  split: {
    label: 'Split',
    desc: 'Split Complementary — softer contrast, more balance. (7-Eleven, Taco Bell)',
    compute: h => [h, (h + 0.417) % 1, (h + 0.583) % 1],
  },
  compound: {
    label: 'Compound',
    desc: 'Compound — bold palette, dynamic without harsh clashes. (FedEx, Crush)',
    compute: h => [h, (h + 0.125) % 1, (h + 0.5) % 1, (h + 0.625) % 1],
  },
  tetradic: {
    label: 'Tetrad',
    desc: 'Tetradic — two complementary pairs. Flexible, complex. (Google, eBay)',
    compute: h => [h, (h + 0.167) % 1, (h + 0.5) % 1, (h + 0.667) % 1],
  },
  square: {
    label: 'Square',
    desc: 'Square — 4 equally spaced hues. Modern, creative. (AVG, Google Drive)',
    compute: h => [h, (h + 0.25) % 1, (h + 0.5) % 1, (h + 0.75) % 1],
  },
  double: {
    label: 'Dbl Split',
    desc: 'Double Split Complementary — depth and dimension. (Wipro, Slack)',
    compute: h => [h, (h + 0.083) % 1, (h + 0.5) % 1, (h + 0.583) % 1],
  },
};

export function getSchemeHues(baseHue, schemeName) {
  const s = SCHEMES[schemeName];
  if (!s || schemeName === 'none') return [];
  return s.compute(baseHue);
}
