import AssetKeys from "../managers/AssetKeys.js";

const THUNDER_FRAMES = [
  AssetKeys.THUNDER_1,
  AssetKeys.THUNDER_2,
  AssetKeys.THUNDER_3,
  AssetKeys.THUNDER_4,
  AssetKeys.THUNDER_5,
  AssetKeys.THUNDER_6
];

const SHOCK_FRAMES = [
  AssetKeys.LION_SHOCK_1,
  AssetKeys.LION_SHOCK_2,
  AssetKeys.LION_SHOCK_3,
  AssetKeys.LION_SHOCK_4
];

export function playFailEffect(scene, failType, cloudView, playerSprite) {
  // Store the original display size to ensure fail textures match the actual doll size
  const targetH = playerSprite.displayHeight;
  const originalScale = playerSprite.scale;

  // We'll wrap setTexture to keep the height consistent
  const originalSetTexture = playerSprite.setTexture;
  playerSprite.setTexture = function(key) {
    originalSetTexture.call(this, key);
    // Keep the height identical to the idle doll, maintaining aspect ratio
    this.setDisplaySize(targetH * (this.width / this.height), targetH);
    return this;
  };

  const type = (failType || "").toLowerCase();
  let cleanup;

  switch (type) {
    case "thunder":
      cleanup = playThunder(scene, cloudView, playerSprite);
      break;
    case "burst":
      cleanup = playBurst(scene, cloudView, playerSprite);
      break;
    case "lightning":
      cleanup = playLightning(scene, cloudView, playerSprite);
      break;
    default:
      // Fallback to thunder for safety
      cleanup = playThunder(scene, cloudView, playerSprite);
      break;
  }

  return () => {
    if (cleanup) cleanup();
    if (playerSprite.active) {
      playerSprite.setTexture = originalSetTexture;
      playerSprite.setScale(originalScale);
      playerSprite.setTexture(AssetKeys.LION_IDLE);
      playerSprite.setAngle(0);
      playerSprite.setAlpha(1);
      playerSprite.setVisible(true);
    }
  };
}

function playThunder(scene, cloudView, playerSprite) {
  const timers = [];
  const hr     = scene.scale.height / 960;
  const wr     = scene.scale.width  / 540;

  if (cloudView) {
    cloudView.revealBadCloud();
  }

  // Overlay image that sequences through Thor frames (reveals Thor rising up)
  const cloudImg = cloudView
    ? scene.add.image(cloudView.x, cloudView.y, AssetKeys.THUNDER_1)
        .setOrigin(0.5)
        .setScale(0.42 * hr)
        .setDepth(38)
        .setAlpha(0)
    : null;

  // Hide the actual player sprite while the thunder-embedded character plays
  playerSprite.setVisible(false);

  if (cloudImg) {
    scene.tweens.add({ targets: cloudImg, alpha: 1, duration: 80 });

    THUNDER_FRAMES.forEach((key, i) => {
      timers.push(scene.time.delayedCall(i * 150, () => {
        if (cloudImg.active) cloudImg.setTexture(key);
      }));
    });
  }

  // Camera shake on strike frame
  timers.push(scene.time.delayedCall(450, () => {
    scene.cameras.main.shake(400, 0.016);
  }));

  // Final fall plummet + Camera follow
  timers.push(scene.time.delayedCall(1100, () => {
    if (!playerSprite.active) return;
    
    // Switch cloud back to basic thunder cloud (no character)
    if (cloudImg && cloudImg.active) {
        cloudImg.setTexture(AssetKeys.THUNDER_1);
    }

    // Now show the actual player sprite to start the fall
    playerSprite.setVisible(true);
    playerSprite.setTexture(AssetKeys.LION_SHOCK_4);

    const groundY = scene.cloudManager.groundPeakY;
    const fallDist = groundY - playerSprite.y;
    const duration = Math.max(800, Math.min(1500, fallDist * 1.5));

    // Fall Tween
    scene.tweens.add({
      targets:  playerSprite,
      alpha:    0.82,
      y:        groundY,
      angle:    180, // Face downwards
      duration: duration,
      ease:     "Quad.easeIn",
      onComplete: () => {
        if (cloudImg && cloudImg.active) cloudImg.destroy();
      }
    });

    // Camera follow back to ground
    scene.tweens.add({
      targets: scene.cameras.main,
      scrollY: 0,
      duration: duration,
      ease: "Quad.easeIn"
    });
  }));

  return () => {
    timers.forEach(t => t.remove(false));
    scene.tweens.killTweensOf(playerSprite);
    if (cloudImg && cloudImg.active) cloudImg.destroy();
  };
}

function playBurst(scene, cloudView, playerSprite) {
  const fragments = [];
  const timers    = [];
  const hr        = scene.scale.height / 960;
  const wr        = scene.scale.width  / 540;

  if (cloudView) {
    // Show broken cloud image
    cloudView.revealBrokenCloud();

    // Cloud crack + shake effect
    scene.tweens.add({
      targets:  cloudView,
      scaleX:   1.15,
      scaleY:   1.15,
      duration: 200,
      yoyo:     true,
      ease:     "Bounce.easeOut"
    });

    // Scatter cloud fragments (using white for better visibility)
    const radius   = Math.round(10 * hr);
    const spreadX  = Math.round(85 * wr);
    const spreadY  = Math.round(55 * hr);

    for (let i = 0; i < 10; i++) {
      const angle    = (Math.PI * 2 * i) / 10;
      const fragment = scene.add.circle(cloudView.x, cloudView.y, radius, 0xffffff, 0.95);
      fragment.setDepth(39);
      fragments.push(fragment);

      scene.tweens.add({
        targets:  fragment,
        x:        cloudView.x + Math.cos(angle) * spreadX,
        y:        cloudView.y + Math.sin(angle) * spreadY,
        alpha:    0,
        scale:    0.1,
        delay:    50, // Slight delay to see the initial burst
        duration: 450,
        ease:     "Quad.easeOut",
        onComplete: () => fragment.destroy()
      });
    }
  }

  playerSprite.setVisible(true);
  playerSprite.setAlpha(1);
  scene.cameras.main.shake(250, 0.012);

  // Switch to fall sprite and plummet
  timers.push(scene.time.delayedCall(350, () => {
    if (!playerSprite.active) return;

    // Use the fall.png sprite for broken cloud
    playerSprite.setTexture(AssetKeys.LION_FALL_BROKEN);

    const groundY = scene.cloudManager.groundPeakY;
    const fallDist = groundY - playerSprite.y;
    const duration = Math.max(800, Math.min(1500, fallDist * 1.5));

    // Fall straight down, face downward
    scene.tweens.add({
      targets:  playerSprite,
      alpha:    0.85,
      y:        groundY,
      angle:    180,
      duration: duration,
      ease:     "Quad.easeIn"
    });

    // Camera follows back to ground
    scene.tweens.add({
      targets: scene.cameras.main,
      scrollY: 0,
      duration: duration,
      ease: "Quad.easeIn"
    });
  }));

  return () => {
    timers.forEach(t => t.remove(false));
    scene.tweens.killTweensOf(playerSprite);
    for (const f of fragments) {
      scene.tweens.killTweensOf(f);
      if (f.active) f.destroy();
    }
  };
}
function playLightning(scene, cloudView, playerSprite) {
  const timers = [];

  if (cloudView) {
    cloudView.revealBadCloud();
    scene.tweens.add({
      targets:  cloudView,
      scaleX:   1.08,
      scaleY:   1.08,
      duration: 100,
      yoyo:     true,
      repeat:   1,
      ease:     "Sine.easeInOut"
    });
  }

  scene.cameras.main.shake(300, 0.01);

  // Play the shock sequence (skeleton frames)
  SHOCK_FRAMES.forEach((key, i) => {
    timers.push(scene.time.delayedCall(i * 120, () => {
      if (playerSprite.active) playerSprite.setTexture(key);
    }));
  });

  // Start the fall after the shock sequence
  timers.push(scene.time.delayedCall(800, () => {
    if (!playerSprite.active) return;

    playerSprite.setTexture(AssetKeys.LION_SHOCK_4);

    const groundY = scene.cloudManager.groundPeakY;
    const fallDist = groundY - playerSprite.y;
    const duration = Math.max(800, Math.min(1500, fallDist * 1.5));

    scene.tweens.add({
      targets:  playerSprite,
      alpha:    0.85,
      y:        groundY,
      angle:    180,
      duration: duration,
      ease:     "Quad.easeIn"
    });

    scene.tweens.add({
      targets: scene.cameras.main,
      scrollY: 0,
      duration: duration,
      ease: "Quad.easeIn"
    });
  }));

  return () => {
    timers.forEach(t => t.remove(false));
    scene.tweens.killTweensOf(playerSprite);
  };
}
