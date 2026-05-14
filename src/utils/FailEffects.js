import AssetKeys from "../managers/AssetKeys.js";

function playSfx(scene, key, opts) {
  if (scene.cache.audio.exists(key)) {
    scene.sound.play(key, opts);
  }
}

const THUNDER_FRAMES = [
  AssetKeys.THUNDER_1,
  AssetKeys.THUNDER_2,
  AssetKeys.THUNDER_3,
  AssetKeys.THUNDER_4,
  AssetKeys.THUNDER_5,
  AssetKeys.THUNDER_6
];

const BOLT_KEYS = [
  AssetKeys.LIGHTNING_BOLT_1,
  AssetKeys.LIGHTNING_BOLT_2,
  AssetKeys.LIGHTNING_BOLT_3,
  AssetKeys.LIGHTNING_BOLT_4,
  AssetKeys.LIGHTNING_BOLT_5
];

const SHOCK_FRAMES = [
  AssetKeys.LION_SHOCK_1,
  AssetKeys.LION_SHOCK_2,
  AssetKeys.LION_SHOCK_3,
  AssetKeys.LION_SHOCK_4
];

export function playFailEffect(scene, failType, cloudView, playerSprite) {
  const targetH =
    scene.player?.getLionUniformHeight?.() ?? playerSprite.displayHeight;

  const originalSetTexture = playerSprite.setTexture;
  // Save refs on the sprite so inner functions (playLightning) can access them
  playerSprite._origSetTex = originalSetTexture;
  playerSprite._failTargetH = targetH;

  playerSprite.setTexture = function(key) {
    originalSetTexture.call(this, key);
    if (!scene.textures.exists(key)) return this;
    const nh = scene.textures.get(key).getSourceImage().height || 1;
    this.setScale(targetH / nh);
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
      scene.player?.normalizeLionAfterFail?.();
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
        .setScale(0.52 * hr)
        .setDepth(38)
        .setAlpha(0)
    : null;

  // Hide the actual player sprite while the thunder-embedded character plays
  playerSprite.setVisible(false);

  if (cloudImg) {
    scene.tweens.add({ targets: cloudImg, alpha: 1, duration: 80 });

    THUNDER_FRAMES.forEach((key, i) => {
      timers.push(scene.time.delayedCall(i * 220, () => {
        if (cloudImg.active) cloudImg.setTexture(key);
      }));
    });
  }

  // Strike moment: Thor thunder + camera shake + SHOW DOLL STRIKE (SKELETON)
  // Shifted to 660ms to match the slower Viking animation
  timers.push(scene.time.delayedCall(660, () => {
    playSfx(scene, AssetKeys.SFX_THUNDER_STRIKE, { volume: 0.74 });
    scene.cameras.main.shake(400, 0.016);

    if (playerSprite.active) {
      playerSprite.setVisible(true);
      playerSprite.setDepth(39); // In front of viking (viking is at 38)

      // Position the doll at bottom-right of the cloud with rotation (per reference)
      if (cloudView) {
        const cw = cloudView.cloudSprite.displayWidth;
        const ch = cloudView.cloudSprite.displayHeight;
        playerSprite.x = cloudView.x - cw * 0.04;
        playerSprite.y = cloudView.y + ch * 0.40;
        playerSprite.setAngle(40); // Tilted right as if struck
      }
      
      // Cycle through shock/skeleton frames more slowly (250ms each)
      SHOCK_FRAMES.forEach((key, i) => {
        timers.push(scene.time.delayedCall(i * 250, () => {
          if (playerSprite.active) {
            playerSprite.setTexture(key);
            // Make doll 30% bigger during thunder
            playerSprite.setScale(playerSprite.scaleX * 1.3, playerSprite.scaleY * 1.3);
          }
        }));
      });
    }
  }));

  // Final fall plummet + Camera follow
  // Delayed to 1800ms to allow the full shock sequence to be seen
  timers.push(scene.time.delayedCall(1800, () => {
    if (!playerSprite.active) return;
    
    // Switch cloud back to basic thunder cloud (no character)
    if (cloudImg && cloudImg.active) {
        cloudImg.setTexture(AssetKeys.THUNDER_1);
    }

    // Ensure we end on the final shock/fall frame
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
    playSfx(scene, AssetKeys.SFX_CLOUD_POOF, { volume: 0.68 });

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
    playerSprite.setTexture(AssetKeys.LION_FALL);

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
      ease:     "Quad.easeIn",
      onComplete: () => {
        if (playerSprite.active) {
          playerSprite.setTexture(AssetKeys.LION_SHOCK_4);
          playerSprite.setAlpha(1);
        }
      }
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
  let boltImg = null;

  if (cloudView) {
    cloudView.revealBadCloud();
    playSfx(scene, AssetKeys.SFX_LIGHTNING_SHOCK, { volume: 0.72 });
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

  const hrBolt = scene.scale.height / 960;
  const boltReady =
    BOLT_KEYS.length &&
    scene.textures.exists(BOLT_KEYS[0]) &&
    cloudView;

  if (boltReady) {
    boltImg = scene.add.image(cloudView.x, cloudView.y - Math.round(28 * hrBolt), BOLT_KEYS[0])
      .setOrigin(0.5, 0)
      .setDepth(4) // Move behind the cloud (cloud is at depth 5)
      .setAlpha(0)
      .setScale(0.15 * hrBolt); // Smaller lightning bolt

    scene.tweens.add({ targets: boltImg, alpha: 1, duration: 45 });

    BOLT_KEYS.forEach((key, i) => {
      timers.push(scene.time.delayedCall(35 + i * 52, () => {
        if (boltImg && boltImg.active && scene.textures.exists(key)) {
          boltImg.setTexture(key);
        }
      }));
    });

    timers.push(scene.time.delayedCall(520, () => {
      if (boltImg && boltImg.active) {
        scene.tweens.add({
          targets:  boltImg,
          alpha:    0,
          duration: 120,
          onComplete: () => boltImg.destroy()
        });
      }
    }));
  }

  scene.cameras.main.shake(300, 0.01);

  // Capture lion's normal display height BEFORE shock frames
  const normalH = playerSprite.displayHeight;

  SHOCK_FRAMES.forEach((key, i) => {
    timers.push(scene.time.delayedCall(i * 120, () => {
      if (playerSprite.active) {
        if (key !== AssetKeys.LION_SHOCK_4) {
          // Use original setTexture (no auto-scale), then apply 70% size
          playerSprite._origSetTex.call(playerSprite, key);
          const nh = scene.textures.get(key).getSourceImage().height || 1;
          const reducedScale = (playerSprite._failTargetH * 0.55) / nh;
          playerSprite.setScale(reducedScale);
        } else {
          playerSprite.setTexture(key);
        }
      }
    }));
  });

  // Start the fall after the shock sequence
  timers.push(scene.time.delayedCall(800, () => {
    if (!playerSprite.active) return;

    // Switch to fall sprite (wrapper restores full scale)
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
    if (boltImg && boltImg.active) boltImg.destroy();
  };
}
