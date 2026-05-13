import CloudView from "../objects/CloudView.js";
import { createCloudData } from "../utils/CloudGenerator.js";
import { rx, ry } from "../utils/ScreenUtil.js";

// Cloud X positions defined in the 540-wide reference space
const PATTERN_X = [170, 330, 210, 360, 160, 320, 220, 370];

// How many clouds to spawn per batch
const BATCH_SIZE = 15;

// Spawn more clouds when player is within this many of the top
const REFILL_THRESHOLD = 5;

export default class CloudManager {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.pool = [];
    this._playerCloudIdx = -1;
    this._highestStep = -1;
    this._difficultyKey = null;
  }

  get startY() {
    const isLandscape = this.scene.scale.width > this.scene.scale.height;
    // Landscape: clouds start higher; portrait: slightly lower opening column than old 540 ref.
    const refY = isLandscape ? 405 : 590;
    return ry(this.scene, refY);
  }

  get groundY() {
    const sw  = this.scene.scale.width;
    const sh  = this.scene.scale.height;
    const dpr = Math.max(1, sw / window.innerWidth);
    const hr  = Math.min(Math.min(sw, sh) / 540, dpr);
    return sh - Math.round(92 * hr);
  }

  get groundPeakY() {
    const isLandscape = this.scene.scale.width > this.scene.scale.height;
    // Portrait: feet on mound (lower ref Y → lion sits slightly higher).
    if (!isLandscape) return ry(this.scene, 868);
    // Landscape / PC: crest of parallax hill — higher on screen than flat groundY so feet sit on peak.
    return ry(this.scene, 678);
  }

  get stepSpacingY() {
    const isLandscape = this.scene.scale.width > this.scene.scale.height;
    // Portrait: ~140px spacing fits ~5 clouds on screen
    return ry(this.scene, isLandscape ? 175 : 140);
  }

  cloudX(stepIndex) {
    const isLandscape = this.scene.scale.width > this.scene.scale.height;
    let x = PATTERN_X[stepIndex % PATTERN_X.length];
    
    if (!isLandscape) {
      // In portrait, spread them further from the center (270)
      const center = 270;
      const offset = x - center;
      // Use 1.4x spread instead of 1.6x for safety
      x = center + (offset * 1.4);
      
      // Strict clamp to ensure they stay within screen bounds (assuming ~170px cloud width)
      // 90 to 450 is a very safe range for the center point in 540-wide space
      x = Phaser.Math.Clamp(x, 90, 450);
    }
    
    return rx(this.scene, x);
  }

  reset() {
    this.scene.cameras.main.scrollY = 0;
    this._playerCloudIdx = -1;
    this._highestStep = -1;
    this._difficultyKey = null;

    for (const cloud of this.clouds) {
      cloud.setVisible(false);
      this.pool.push(cloud);
    }
    this.clouds.length = 0;
  }

  /**
   * Pre-generate all clouds for the entire round at once.
   * They are placed at their final positions; the camera scroll
   * will naturally reveal them as the player climbs.
   */
  createAllClouds(difficultyKey) {
    this._difficultyKey = difficultyKey;

    // Cloud 0 = first jump target (always safe)
    const firstData = createCloudData(0, difficultyKey, "good");
    const firstCloud = this._spawnCloud(0, firstData);

    // Clouds 1..BATCH_SIZE-1
    for (let i = 1; i < BATCH_SIZE; i++) {
      const data = createCloudData(i, difficultyKey);
      this._spawnCloud(i, data);
    }

    this.syncMultiplierReachColors();
    return firstCloud;
  }

  _spawnCloud(stepIndex, data) {
    const y = this.startY - this.stepSpacingY * stepIndex;
    const x = this.cloudX(stepIndex);
    const cloud = this._getFromPool(x, y);
    cloud.bindData(data);
    this.clouds.push(cloud);
    this._highestStep = stepIndex;
    return cloud;
  }

  /** After player lands, move pointer forward and spawn more if needed */
  advanceAfterLanding() {
    this._playerCloudIdx++;
    this._ensureCloudsAhead();
    this.syncMultiplierReachColors();
  }

  /** Client spec #15: landed clouds = gold (#FACC14), ahead = orange (#FF8F14). */
  syncMultiplierReachColors() {
    const stoodIdx = this._playerCloudIdx;
    for (const cloud of this.clouds) {
      if (!cloud.cloudData || typeof cloud.setMultiplierReached !== "function") continue;
      cloud.setMultiplierReached(cloud.cloudData.index <= stoodIdx);
    }
  }

  /** Spawn more clouds if player is getting close to the top */
  _ensureCloudsAhead() {
    const cloudsRemaining = this.clouds.length - 1 - this._playerCloudIdx;
    if (cloudsRemaining <= REFILL_THRESHOLD) {
      const startFrom = this._highestStep + 1;
      for (let i = startFrom; i < startFrom + BATCH_SIZE; i++) {
        const data = createCloudData(i, this._difficultyKey);
        this._spawnCloud(i, data);
      }
    }
  }

  _getFromPool(x, y) {
    let cloud = this.pool.pop();

    if (!cloud) {
      cloud = new CloudView(this.scene, x, y);
    } else {
      cloud.setPosition(x, y);
      cloud.setVisible(true);
    }

    cloud.setAlpha(1);
    cloud.setScale(1);
    return cloud;
  }

  /** The cloud the player is currently standing on */
  getCurrentCloud() {
    if (this._playerCloudIdx < 0 || this._playerCloudIdx >= this.clouds.length) return null;
    return this.clouds[this._playerCloudIdx];
  }

  /** The next cloud the player should jump to */
  getTargetCloud() {
    const idx = this._playerCloudIdx + 1;
    if (idx < 0 || idx >= this.clouds.length) return null;
    return this.clouds[idx];
  }

  shiftWorldDown(targetCloudY, player, callback) {
    const cam = this.scene.cameras.main;
    const desiredScreenY = ry(this.scene, 590);
    const targetScrollY = targetCloudY - desiredScreenY;

    this.scene.tweens.add({
      targets: cam,
      scrollY: targetScrollY,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => {
        if (callback) callback();
      }
    });
  }
}
