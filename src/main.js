import BootScene from "./scenes/BootScene.js";
import GameScene from "./scenes/GameScene.js";

window.addEventListener("load", () => {
  // ── Viewport detection ────────────────────────────────────────────────────
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width  ?? window.innerWidth);
  const vh = Math.round(vv?.height ?? window.innerHeight);

  const isPortrait    = vh >= vw;
  const isSmallScreen = Math.min(vw, vh) <= 900;
  const isMobileLike  = isPortrait && isSmallScreen;

  // ── Layer 4: Resolution management ───────────────────────────────────────
  // Using native devicePixelRatio for maximum HD clarity on all screens
  const renderResolution = Math.max(1, window.devicePixelRatio || 1);

  // ── Layer 2: Adaptive Phaser scaling ────────────────────────────────────
  // RESIZE on all devices: canvas === viewport, no overflow, no clipping.
  // rx/ry/rs utilities in ScreenUtil automatically adapt every game element
  // to whatever viewport size the user has (portrait mobile or landscape PC).
  const config = {
    type:   Phaser.AUTO,
    parent: "game-root",
    width:  540,
    height: 960,
    resolution: renderResolution,
    render: {
      antialias:   true,
      antialiasGL: true,
      roundPixels: false
    },
    backgroundColor: "#020617",
    scale: {
      mode:       Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, GameScene]
  };

  const game = new Phaser.Game(config);
  window.__CLOUD_GAME__ = game;

  const refreshScale = () => game?.scale?.refresh();
  window.addEventListener("resize",             refreshScale, { passive: true });
  window.visualViewport?.addEventListener("resize", refreshScale, { passive: true });
});
