/**
 * JuiceUtils — helper for satisfying visual feedback.
 */

export function playLandingJuice(scene, x, y) {
  // 1. Particle burst (cloud puffs)
  const hr = scene.scale.height / 960;
  const puffs = 6;
  
  for (let i = 0; i < puffs; i++) {
    const angle = (Math.PI * 2 * i) / puffs;
    const dist  = 40 * hr;
    
    const puff = scene.add.circle(x, y, 6 * hr, 0xffffff, 0.8);
    puff.setDepth(15);
    
    scene.tweens.add({
      targets:  puff,
      x:        x + Math.cos(angle) * dist,
      y:        y + Math.sin(angle) * dist * 0.5,
      alpha:    0,
      scale:    0.2,
      duration: 400,
      ease:     "Quad.easeOut",
      onComplete: () => puff.destroy()
    });
  }

  // 2. Subtle camera shake
  scene.cameras.main.shake(150, 0.003);
}

export function playJumpJuice(scene, x, y) {
  scene.cameras.main.shake(85, 0.002);
}
