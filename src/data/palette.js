// Sprout Lands default palette (subset by role). New pixel art must use only these colors.
export const PAL = {
  ink: '#645552', inkDark: '#353738',
  cream: '#f3e5c2', creamLight: '#f7ebaa', creamDark: '#dcb98a',
  wood: '#aa7959', woodDark: '#754c60', woodLight: '#c49a6c', woodMid: '#90625d',
  stone: '#9da89a', stoneDark: '#6b7470', stoneLight: '#c1c8b9', stoneDeep: '#545959',
  leafDark: '#566560', leaf: '#67835c', leafMid: '#78a158', leafLight: '#a4c263', leafPale: '#c0d470',
  water: '#7ba6b4', waterLight: '#9bd4c3',
  gold: '#eeba77', goldLight: '#f2cf8c', goldDark: '#d79e61', sun: '#f7ebaa',
  rose: '#d99a9a', roseDark: '#a35b70', roseLight: '#f3d8c5',
  violet: '#a09dd4', violetDark: '#685d9e', violetLight: '#ddd5de',
  blue: '#92b2d4', blueDark: '#7180b1', blueLight: '#cbe0de',
  yellow: '#eae178', yellowDark: '#b09643', yellowLight: '#f3f2c0',
  peach: '#eeba77', peachDark: '#ba7c54', peachLight: '#f7ebaa',
  night: '#504086',
};

export const hex = (s) => parseInt(s.slice(1), 16);

// Glucose state colors (UI only; always paired with an icon or text).
export const STATE_COLOR = { in_range: PAL.leafMid, high: PAL.goldDark, low: PAL.roseDark, urgent_low: PAL.roseDark, urgent_high: PAL.goldDark, stale: PAL.stoneDark };
