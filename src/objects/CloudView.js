import AssetKeys from "../managers/AssetKeys.js";
import { UI_FONT_FAMILY } from "../config/UiFont.js";

/** Multiplier colours — client PDF #15 */
export const MULT_UNREACHED_ORANGE = "#FF8F14";
export const MULT_REACHED_GOLD = "#FACC14";

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
    const fontSize = `${Math.round((isLandscape ? 34 : 26) * hr)}px`;

    this.multiplierText = scene.add.text(0, 0, "", {
      fontFamily: UI_FONT_FAMILY,
      fontSize,
      color: MULT_UNREACHED_ORANGE,
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: Math.round(5 * hr)
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
    this.setMultiplierReached(false);

    // Start a subtle bobbing idle animation
    this._startIdleBobbing();

    // Start frame animation (each cloud has a random offset so they don't all sync)
    this._startFrameAnimation();
  }

  _startIdleBobbing() {
    if (this._idleTween) {
      this._idleTween.remove();
      this._idleTween = null;
    }

    this._idleTween = this.scene.tweens.add({
      targets: this.cloudSprite,
      y: `+=${this.scene.scale.height * 0.011}`,
      duration: 1500 + Math.random() * 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
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
    if (this._idleTween) {
      this._idleTween.remove();
      this._idleTween = null;
    }
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
    if (this._idleTween) {
      this._idleTween.remove();
      this._idleTween = null;
    }
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
    // 1. Properly stop and null the idle tween before killing other tweens
    if (this._idleTween) {
      this._idleTween.remove();
      this._idleTween = null;
    }

    // 2. Kill any existing bounce tweens to prevent overlap
    this.scene.tweens.killTweensOf([this.cloudSprite, this.multiplierText]);

    const isLandscape = this.scene.scale.width > this.scene.scale.height;
    const dipY = isLandscape ? 18 : 12;

    // 3. Squash & Stretch + Downward dip
    this.scene.tweens.add({
      targets: this.cloudSprite,
      y: dipY,
      scaleX: this._cloudScale * 1.25,
      scaleY: this._cloudScale * 0.75,
      duration: 100,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.cloudSprite.y = 0;
        this.cloudSprite.setScale(this._cloudScale);
        // 5. Restart idle bobbing
        this._startIdleBobbing();
      }
    });

    // 4. Multiplier text bounce
    this.scene.tweens.add({
      targets: this.multiplierText,
      y: dipY * 0.8,
      scale: 1.15,
      duration: 100,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.multiplierText.y = 0;
        this.multiplierText.setScale(1);
      }
    });
  }

  setMultiplierReached(reached) {
    if (!this.multiplierText || !this.multiplierText.active) return;
    if (!this.multiplierText.visible) return;
    this.multiplierText.setColor(reached ? MULT_REACHED_GOLD : MULT_UNREACHED_ORANGE);
  }
}
