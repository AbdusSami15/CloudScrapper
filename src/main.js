import BootScene from "./scenes/BootScene.js";
import GameScene from "./scenes/GameScene.js";

window.addEventListener("load", () => {
  // ── Viewport detection ─────────────────────────────────────────────────
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width  ?? window.innerWidth);
  const vh = Math.round(vv?.height ?? window.innerHeight);

  const isPortrait    = vh >= vw;
  const isSmallScreen = Math.min(vw, vh) <= 900;
  const isMobileLike  = isPortrait && isSmallScreen;

  // ── HD Resolution Management ───────────────────────────────────────────
  // Use the actual device-pixel-ratio so every device renders at its native
  // pixel density.  Floor guarantees super-sampling on low-DPR PCs (1×) for
  // anti-aliased look; cap protects weaker GPUs from a 4×-DPR blow-up.
  //
  //   • Mobile  : floor 1.5 × , cap 3.0 ×  (iPhone Pro / S-series stay native)
  //   • Desktop : floor 2.0 × , cap 3.0 ×  (1× monitors get 2× super-sampling)
  const rawDpr = Number(window.devicePixelRatio) || 1;
  const dpr = isMobileLike
    ? Math.max(1.5, Math.min(3.0, rawDpr))
    : Math.max(2.0, Math.min(3.0, rawDpr));

  const config = {
    type:   Phaser.AUTO,
    parent: "game-root",
    width:  540,
    height: 960,
    resolution: dpr,
    pixelArt: false,
    antialias: true,
    autoFocus: true,
    disableContextMenu: true,
    render: {
      antialias:        true,
      antialiasGL:      true,
      roundPixels:      false,
      desynchronized:   true,
      powerPreference:  "high-performance",
      mipmapFilter:     "LINEAR_MIPMAP_LINEAR",
      failIfMajorPerformanceCaveat: false,
      premultipliedAlpha: true
    },
    backgroundColor: "#020617",
    scale: {
      mode:       Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound:  false
    },
    scene: [BootScene, GameScene]
  };

  const game = new Phaser.Game(config);
  window.__CLOUD_GAME__ = game;

  const refreshScale = () => game?.scale?.refresh();
  window.addEventListener("resize",                 refreshScale, { passive: true });
  window.visualViewport?.addEventListener("resize", refreshScale, { passive: true });
});
