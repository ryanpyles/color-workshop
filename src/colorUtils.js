const COLOR_NAMES = [
  [0, 'Red'],
  [0.042, 'Red-Orange'],
  [0.083, 'Orange'],
  [0.125, 'Amber'],
  [0.167, 'Yellow'],
  [0.208, 'Yellow-Green'],
  [0.25, 'Chartreuse'],
  [0.292, 'Spring Green'],
  [0.333, 'Green'],
  [0.375, 'Emerald'],
  [0.417, 'Teal'],
  [0.458, 'Cyan'],
  [0.5, 'Sky Blue'],
  [0.542, 'Azure'],
  [0.583, 'Blue'],
  [0.625, 'Indigo'],
  [0.667, 'Violet'],
  [0.708, 'Purple'],
  [0.75, 'Magenta'],
  [0.792, 'Rose'],
  [0.833, 'Crimson'],
  [0.875, 'Scarlet'],
  [0.917, 'Vermilion'],
  [0.958, 'Coral'],
];

export function colorNames(hue) {
  let closest = COLOR_NAMES[0][1];
  let minDist = Infinity;
  for (const [h, name] of COLOR_NAMES) {
    const d = Math.min(Math.abs(hue - h), 1 - Math.abs(hue - h));
    if (d < minDist) { minDist = d; closest = name; }
  }
  return closest;
}
