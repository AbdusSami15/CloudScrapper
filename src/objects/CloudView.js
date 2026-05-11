import AssetKeys from "../managers/AssetKeys.js";

const CLOUD_FRAMES = [
  AssetKeys.CLOUD_V2_1,
  AssetKeys.CLOUD_V2_2,
  AssetKeys.CLOUD_V2_3,
  AssetKeys.CLOUD_V2_4,
  AssetKeys.CLOUD_V2_5,
  AssetKeys.CLOUD_V2_6,
  AssetKeys.CLOUD_V2_7,
  AssetKeys.CLOUD_V2_8,
  AssetKeys.CLOUD_V2_9
];

export default class CloudView extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);

    // Scale cloud proportionally to canvas HEIGHT so it looks correct in both
    // portrait (540×960) and landscape ENVELOP (1920×1080).
    this.cloudSprite = scene.add.image(0, 0, CLOUD_FRAMES[0]);
    this.cloudSprite.setOrigin(0.5);

    const isLandscape = scene.scale.width > scene.scale.height;
    const sizeFactor = isLandscape ? 0.30 : 0.175;
    const targetCloudW = scene.scale.height * sizeFactor;

    this._cloudScale = targetCloudW / this.cloudSprite.width;
    this.cloudSprite.setScale(this._cloudScale);

    const hr = scene.scale.height / 960;
    const fontSize = `${Math.round((isLandscape ? 28 : 20) * hr)}px`;

    this.multiplierText = scene.add.text(0, 0, "", {
      fontFamily: "Tilt Warp",
      fontSize,
      color: "#1850d8",
      fontStyle: "bold",
      stroke: "#ffffff",
      strokeThickness: Math.round(4 * hr)
    }).setOrigin(0.5);

    this.add([this.cloudSprite, this.multiplierText]);

    this.cloudData = null;
    this.isActiveCloud = false;
    this._frameIndex = 0;
    this._animTimer = null;

    this.setSize(
      this.cloudSprite.width * this._cloudScale,
      this.cloudSprite.height * this._cloudScale
    );

    this.setDepth(5);
    scene.add.existing(this);
  }

  bindData(cloudData) {
    this.cloudData = cloudData;
    this.resetVisual();
    this.multiplierText.setText(`${cloudData.multiplier.toFixed(2)}x`);

    // Start a subtle bobbing idle animation
    if (this._idleTween) this._idleTween.remove();
    this._idleTween = this.scene.tweens.add({
      targets: this.cloudSprite,
      y: `+=${this.scene.scale.height * 0.008}`,
      duration: 1500 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Start frame animation (each cloud has a random offset so they don't all sync)
    this._startFrameAnimation();
  }

  _startFrameAnimation() {
    this._stopFrameAnimation();

    // Random starting frame so clouds look organic
    this._frameIndex = Math.floor(Math.random() * CLOUD_FRAMES.length);

    // Cycle frames at ~120ms per frame for a smooth, lively animation
    this._animTimer = this.scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        this._frameIndex = (this._frameIndex + 1) % CLOUD_FRAMES.length;
        if (this.cloudSprite.active) {
          this.cloudSprite.setTexture(CLOUD_FRAMES[this._frameIndex]);
          // Maintain scale after texture swap
          this.cloudSprite.setScale(this._cloudScale);
        }
      }
    });
  }

  _stopFrameAnimation() {
    if (this._animTimer) {
      this._animTimer.remove(false);
      this._animTimer = null;
    }
  }

  resetVisual() {
    this.setAlpha(1);
    this.setScale(1);
    this.setAngle(0);
    this.setVisible(true);

    // Stop bobbing tween FIRST, then reset positions
    if (this._idleTween) {
      this._idleTween.remove();
      this._idleTween = null;
    }
    if (this._highlightTween) {
      this._highlightTween.remove();
      this._highlightTween = null;
    }

    this._stopFrameAnimation();

    // Reset sprite back to origin (fixes upward drift from bobbing tween)
    this.cloudSprite.setTexture(CLOUD_FRAMES[0]);
    this.cloudSprite.setPosition(0, 0);
    this.cloudSprite.setAlpha(1);
    this.cloudSprite.setScale(this._cloudScale);
    this.cloudSprite.setAngle(0);

    this.multiplierText.setPosition(0, 0);
    this.multiplierText.setAlpha(1);
    this.multiplierText.setScale(1);
    this.multiplierText.setAngle(0);
    this.multiplierText.setVisible(true);
  }

  revealBadCloud() {
    if (this._idleTween) this._idleTween.pause();
    this._stopFrameAnimation();
    // Swap to dark Thor cloud when the player lands on a bad one
    const goodDisplayW = this.cloudSprite.width * this._cloudScale;
    this.cloudSprite.setTexture(AssetKeys.CLOUD_BAD);
    // Match the good cloud's display width using the bad texture's native width
    const badScale = goodDisplayW / this.cloudSprite.width;
    this.cloudSprite.setScale(badScale);
    this.multiplierText.setVisible(false);
  }

  revealBrokenCloud() {
    if (this._idleTween) this._idleTween.pause();
    this._stopFrameAnimation();
    // Swap to broken cloud image
    const goodDisplayW = this.cloudSprite.width * this._cloudScale;
    this.cloudSprite.setTexture(AssetKeys.CLOUD_BROKEN);
    const brokenScale = goodDisplayW / this.cloudSprite.width;
    this.cloudSprite.setScale(brokenScale);
    this.multiplierText.setVisible(false);
  }

  setHighlighted(isHighlighted) {
    this.isActiveCloud = isHighlighted;

    if (isHighlighted) {
      if (!this._highlightTween) {
        this._highlightTween = this.scene.tweens.add({
          targets: this,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    } else {
      if (this._highlightTween) {
        this._highlightTween.remove();
        this._highlightTween = null;
        this.setScale(1);
      }
    }
  }

  playGoodFeedback() {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 120,
      yoyo: true,
      ease: "Back.easeOut"
    });
  }
}
