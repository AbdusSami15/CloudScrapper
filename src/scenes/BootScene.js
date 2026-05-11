import AssetKeys from "../managers/AssetKeys.js";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // ── Update HTML loading screen from Phaser progress ─────────────────
    const statusEl = document.getElementById("load-status");
    const barFillEl = document.getElementById("load-bar-fill");

    this.load.on("progress", (value) => {
      const pct = Math.round(value * 100);
      if (statusEl) statusEl.textContent = `PREPARING GAME ASSETS (${pct}%)`;
      if (barFillEl) barFillEl.style.width = `${pct}%`;
    });

    this.load.on("complete", () => {
      if (statusEl) statusEl.textContent = "READY!";
      if (barFillEl) barFillEl.style.width = "100%";
    });

    // ── Asset Loading ───────────────────────────────────────────────────
    this.load.image(AssetKeys.BG_SKY,    "assets/bg/sky.png");
    this.load.image(AssetKeys.BG_CITY,   "assets/bg/city.png");
    this.load.image(AssetKeys.BG_GROUND, "assets/bg/ground.png");

    this.load.image(AssetKeys.CLOUD,     "assets/clouds/cloud.png");
    this.load.image(AssetKeys.CLOUD_BAD, "assets/thunder/thunder-1.png");
    this.load.image(AssetKeys.CLOUD_BROKEN, "assets/clouds/brokenclouds.png");

    for (let i = 1; i <= 9; i++) {
      this.load.image(AssetKeys[`CLOUD_V2_${i}`], `assets/Cloud-v2/Cloud-v2-${i}.png`);
    }

    this.load.image(AssetKeys.LOGO, "assets/logo_CP.png");
    this.load.image(AssetKeys.UPPER_LOGO, "assets/upperlogo.png");

    this.load.image(AssetKeys.LION_IDLE,  "assets/lion/lion_idle.png");
    this.load.image(AssetKeys.LION_JUMP,  "assets/lion/lion_jump.png");
    this.load.image(AssetKeys.LION_HAPPY, "assets/lion/lion_happy.png");
    this.load.image(AssetKeys.LION_FALL,  "assets/lion/lion_fall.png");
    this.load.image(AssetKeys.LION_FALL_BROKEN, "assets/lion/fall.png");

    this.load.image(AssetKeys.LION_SHOCK_1, "assets/lion/lion-shock-1.png");
    this.load.image(AssetKeys.LION_SHOCK_2, "assets/lion/lion-shock-2.png");
    this.load.image(AssetKeys.LION_SHOCK_3, "assets/lion/lion-shock-3.png");
    this.load.image(AssetKeys.LION_SHOCK_4, "assets/lion/lion-shock-4.png");

    this.load.image(AssetKeys.THUNDER_1, "assets/thunder/thunder-1.png");
    this.load.image(AssetKeys.THUNDER_2, "assets/thunder/thunder-2.png");
    this.load.image(AssetKeys.THUNDER_3, "assets/thunder/thunder-3.png");
    this.load.image(AssetKeys.THUNDER_4, "assets/thunder/thunder-4.png");
    this.load.image(AssetKeys.THUNDER_5, "assets/thunder/thunder-5.png");
    this.load.image(AssetKeys.THUNDER_6, "assets/thunder/thunder-6.png");

    this.load.audio(AssetKeys.SFX_CLICK, "src/sounds/click.mp3");
    this.load.audio(AssetKeys.SFX_START, "src/sounds/start.mp3");
    this.load.audio(AssetKeys.SFX_HIT,   "src/sounds/hit.mp3");
    this.load.audio(AssetKeys.SFX_WIN,   "src/sounds/gamewin.mp3");
    this.load.audio(AssetKeys.SFX_LOSE,  "src/sounds/gameover.mp3");
    this.load.audio(AssetKeys.SFX_JUMP,  "src/sounds/jump.mp3");
    this.load.audio(AssetKeys.MUSIC_BG, {
      key: AssetKeys.MUSIC_BG,
      url: "src/sounds/bgmusic.mpeg",
      type: "mp3"
    });

    this.load.on("loaderror", (file) => {
      console.error("Phaser Load Error:", file.src, file.key);
    });

    // ── Force LINEAR filter on every image texture once loaded ─────────
    // Default is LINEAR but some mobile WebGL contexts revert to NEAREST,
    // producing pixelated edges on smooth assets (lion, clouds, logo).
    this.load.on("filecomplete-image", (key) => {
      const tex = this.textures.get(key);
      if (tex && tex.setFilter) {
        tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    });
  }

  create() {
    // Minimum 2 second display, then fade out the HTML overlay
    const MIN_MS = 2000;
    const startTime = performance.timing?.navigationStart || (Date.now() - 2000);
    const elapsed = Date.now() - startTime;
    const wait = Math.max(0, MIN_MS - elapsed);

    this.time.delayedCall(wait, () => {
      const overlay = document.getElementById("loading-screen");
      if (overlay) {
        overlay.classList.add("fade-out");
        setTimeout(() => overlay.remove(), 600);
      }
      this.scene.start("GameScene");
    });
  }
}
