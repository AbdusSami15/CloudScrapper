import BootScene from "./scenes/BootScene.js";
import GameScene from "./scenes/GameScene.js";

window.addEventListener("load", () => {
  // ── Manual HD canvas sizing ─────────────────────────────────────────────
  // Phaser 3.80's `resolution` config is unreliable in RESIZE mode, so we
  // size the canvas ourselves:
  //
  //   • canvas internal buffer  = viewport × DPR  (HD pixels)
  //   • canvas CSS size         = viewport       (so it visually fits)
  //
  // The browser then downscales the HD buffer to the viewport which gives
  // genuine pixel-perfect rendering — identical to native apps.
  // ───────────────────────────────────────────────────────────────────────

  const computeDpr = () => {
    const rawDpr        = Number(window.devicePixelRatio) || 1;
    const vw            = window.innerWidth;
    const vh            = window.innerHeight;
    const isPortrait    = vh >= vw;
    const isSmallScreen = Math.min(vw, vh) <= 900;
    const isMobileLike  = isPortrait && isSmallScreen;
    // Cap DPR at 3.0 — handles iPhone Pro / S-series / Pixel Pro natively.
    // Floor 2.0 on desktop to super-sample 1×-DPR monitors for AA.
    return isMobileLike
      ? Math.max(1.5, Math.min(3.0, rawDpr))
      : Math.max(2.0, Math.min(3.0, rawDpr));
  };

  const computeSize = () => {
    const dpr = computeDpr();
    return {
      cssW:  window.innerWidth,
      cssH:  window.innerHeight,
      gameW: Math.round(window.innerWidth  * dpr),
      gameH: Math.round(window.innerHeight * dpr),
      dpr
    };
  };

  const initial = computeSize();

  const config = {
    type:               Phaser.AUTO,
    parent:             "game-root",
    width:              initial.gameW,
    height:             initial.gameH,
    pixelArt:           false,
    antialias:          true,
    autoFocus:          true,
    disableContextMenu: true,
    render: {
      antialias:          true,
      antialiasGL:        true,
      roundPixels:        false,
      powerPreference:    "high-performance",
      premultipliedAlpha: true
      // NOTE: `desynchronized: true` causes tearing/distortion lines on
      // some Mali/Adreno GPUs — removed deliberately.
      // NOTE: `mipmapFilter: "LINEAR_MIPMAP_LINEAR"` produces texture-edge
      // bleeding on non-power-of-2 PNGs — removed deliberately.
    },
    backgroundColor: "#020617",
    scale: {
      // NONE mode: we control canvas size ourselves (see below).
      mode:       Phaser.Scale.NONE,
      width:      initial.gameW,
      height:     initial.gameH,
      autoCenter: Phaser.Scale.NO_CENTER,
      autoRound:  false
    },
    scene: [BootScene, GameScene]
  };

  const game = new Phaser.Game(config);
  window.__CLOUD_GAME__ = game;

  // ── Apply CSS size so the HD buffer is visually downscaled to viewport ─
  const applyCssSize = (sz) => {
    const c = game.canvas;
    if (!c) return;
    c.style.position    = "absolute";
    c.style.left        = "0";
    c.style.top         = "0";
    c.style.width       = sz.cssW + "px";
    c.style.height      = sz.cssH + "px";
    c.style.touchAction = "none";
  };
  applyCssSize(initial);
  game.events.once("ready", () => applyCssSize(computeSize()));

  // ── Resize handler (debounced via rAF) ─────────────────────────────────
  let resizing = false;
  const onResize = () => {
    if (resizing) return;
    resizing = true;
    requestAnimationFrame(() => {
      const sz = computeSize();
      game.scale.resize(sz.gameW, sz.gameH);
      applyCssSize(sz);
      resizing = false;
    });
  };

  window.addEventListener("resize",                 onResize, { passive: true });
  window.addEventListener("orientationchange",      onResize, { passive: true });
  window.visualViewport?.addEventListener("resize", onResize, { passive: true });
});
