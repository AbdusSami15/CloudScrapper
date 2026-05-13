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
    // `&` in folder name must be URL-encoded for reliable fetches.
    const bgParallaxRoot = "assets/bg-base%26sky";
    const planeRoot = "assets/bg-object-airplane";

    this.load.image(AssetKeys.BG_PARALLAX_SKY_FAR, `${bgParallaxRoot}/bg-sky2.png`);
    this.load.image(AssetKeys.BG_PARALLAX_SKY_NEAR, `${bgParallaxRoot}/bg-sky1.png`);
    this.load.image(AssetKeys.BG_PARALLAX_BASE, `${bgParallaxRoot}/bg-base.png`);

    this.load.image(AssetKeys.BG_PLANE_1, `${planeRoot}/bg-0bject-1.png`);
    this.load.image(AssetKeys.BG_PLANE_2, `${planeRoot}/bg-0bject-2.png`);
    this.load.image(AssetKeys.BG_PLANE_3, `${planeRoot}/bg-0bject-3.png`);
    this.load.image(AssetKeys.BG_PLANE_5, `${planeRoot}/bg-0bject-5.png`);
    this.load.image(AssetKeys.BG_PLANE_7, `${planeRoot}/bg-0bject-7.png`);

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

    const lionJp = "assets/lion-jump-png";
    this.load.image(AssetKeys.LION_IDLE,  `${lionJp}/1-stand.png`);
    this.load.image(AssetKeys.LION_JP_PREPARE, `${lionJp}/2-prepare.png`);
    this.load.image(AssetKeys.LION_JP_JUMP, `${lionJp}/3-jump.png`);
    this.load.image(AssetKeys.LION_JP_MIDAIR, `${lionJp}/4-mid-air.png`);
    this.load.image(AssetKeys.LION_JP_READYLAND, `${lionJp}/5-readytoland.png`);
    this.load.image(AssetKeys.LION_JP_LAND, `${lionJp}/6-land.png`);
    this.load.image(AssetKeys.LION_JUMP,  `${lionJp}/3-jump.png`);
    this.load.image(AssetKeys.LION_HAPPY, `${lionJp}/7-success.png`);
    this.load.image(AssetKeys.LION_FALL, `${lionJp}/8-failure.png`);
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

    const lx = "assets/lightning";
    this.load.image(AssetKeys.LIGHTNING_BOLT_1, `${lx}/thunder-1.png`);
    this.load.image(AssetKeys.LIGHTNING_BOLT_2, `${lx}/thunder-2.png`);
    this.load.image(AssetKeys.LIGHTNING_BOLT_3, `${lx}/thunder-3.png`);
    this.load.image(AssetKeys.LIGHTNING_BOLT_4, `${lx}/thunder-4.png`);
    this.load.image(AssetKeys.LIGHTNING_BOLT_5, `${lx}/thunder-5.png`);

    this.load.audio(AssetKeys.SFX_CLICK, "src/sounds/click.mp3");
    this.load.audio(AssetKeys.SFX_START, "src/sounds/start.mp3");
    this.load.audio(AssetKeys.SFX_HIT,   "src/sounds/hit.mp3");
    this.load.audio(AssetKeys.SFX_WIN,   "src/sounds/gamewin.mp3");
    this.load.audio(AssetKeys.SFX_LOSE,  "src/sounds/gameover.mp3");
    this.load.audio(AssetKeys.SFX_JUMP,  "src/sounds/jump.mp3");

    this.load.audio(AssetKeys.SFX_THUNDER_STRIKE,  "assets/sounds/thundersoundCut.mp3");
    this.load.audio(AssetKeys.SFX_LIGHTNING_SHOCK, "assets/sounds/electric-shock-sound-effect.mp3");
    this.load.audio(AssetKeys.SFX_CLOUD_POOF,       "assets/sounds/cloud_poof.mp3");

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
