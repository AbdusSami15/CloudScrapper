// Reference design: 540 × 960 portrait
const REF_W = 540;
const REF_H = 960;

// Map an X coordinate from the 540-wide reference to the current canvas width
export const rx = (scene, x) => (x / REF_W) * scene.scale.width;

// Map a Y coordinate from the 960-tall reference to the current canvas height
export const ry = (scene, y) => (y / REF_H) * scene.scale.height;

// Scale a size by height ratio (keeps objects proportionally sized for the screen height)
export const rs = (scene, s) => s * (scene.scale.height / REF_H);
