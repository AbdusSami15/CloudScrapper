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
  // Use devicePixelRatio for crisp HD rendering (cap at 2 to avoid GPU overload)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const config = {
    type:   Phaser.AUTO,
    parent: "game-root",
    width:  540,
    height: 960,
    resolution: dpr,
    pixelArt: false,
    render: {
      antialias:      true,
      antialiasGL:    true,
      roundPixels:    false,
      desynchronized: true,
      mipmapFilter:   "LINEAR_MIPMAP_LINEAR"
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
