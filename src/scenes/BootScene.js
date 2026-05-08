import AssetKeys from "../managers/AssetKeys.js";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image(AssetKeys.BG_SKY,    "assets/bg/sky.png");
    this.load.image(AssetKeys.BG_CITY,   "assets/bg/city.png");
    this.load.image(AssetKeys.BG_GROUND, "assets/bg/ground.png");

    this.load.image(AssetKeys.CLOUD,     "assets/clouds/cloud.png");
    this.load.image(AssetKeys.CLOUD_BAD, "assets/thunder/thunder-1.png");
    this.load.image(AssetKeys.CLOUD_BROKEN, "assets/clouds/brokenclouds.png");

    // Cloud v2 animation frames
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

    // Debug logging
    this.load.on("loaderror", (file) => {
      console.error("Phaser Load Error:", file.src, file.key);
    });
    this.load.on("filecomplete-audio-" + AssetKeys.SFX_CLICK, () => {
      console.log("Click sound loaded successfully");
    });
    this.load.on("filecomplete-audio-" + AssetKeys.SFX_JUMP, () => {
      console.log("Jump sound loaded successfully");
    });
    this.load.on("filecomplete-audio-" + AssetKeys.MUSIC_BG, () => {
      console.log("BG Music loaded successfully");
    });
  }

  create() {
    this.scene.start("GameScene");
  }
}
