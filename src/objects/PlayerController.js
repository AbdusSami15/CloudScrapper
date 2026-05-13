import AssetKeys from "../managers/AssetKeys.js";
import { rs } from "../utils/ScreenUtil.js";

function lionNaturalHeight(scene, key) {
  if (!scene.textures.exists(key)) return 1;
  return scene.textures.get(key).getSourceImage().height || 1;
}

export default class PlayerController {
  constructor(scene, x, y) {
    this.scene     = scene;
    this.isJumping = false;
    this.isDead    = false;

    const isLandscape = scene.scale.width > scene.scale.height;
    this._lionScale          = rs(scene, isLandscape ? 0.188 : 0.128);
    const nhIdle             = lionNaturalHeight(scene, AssetKeys.LION_IDLE);
    this._lionTargetDisplayH = nhIdle * this._lionScale;

    this.sprite = scene.add.image(x, y, AssetKeys.LION_IDLE);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(20);
    this._applyUniformForKey(AssetKeys.LION_IDLE);
    this._jumpPhaseKey = null;
  }

  /** Fail FX + UI: fixed on-screen lion height (px) for every frame */
  getLionUniformHeight() {
    return this._lionTargetDisplayH;
  }

  _lionBaseScale() {
    const nh = lionNaturalHeight(this.scene, this.sprite.texture.key);
    return this._lionTargetDisplayH / nh;
  }

  _applyUniformForKey(key) {
    const k = this._jpTex(key, AssetKeys.LION_IDLE);
    if (!this.scene.textures.exists(k)) return;
    this.sprite.setTexture(k);
    const nh = lionNaturalHeight(this.scene, k);
    this.sprite.setScale(this._lionTargetDisplayH / nh);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  setTexture(key) {
    this._applyUniformForKey(key);
  }

  normalizeLionAfterFail() {
    this._applyUniformForKey(AssetKeys.LION_IDLE);
  }

  resetVisual() {
    this.scene.tweens.killTweensOf(this.sprite);
    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }

    this._applyUniformForKey(AssetKeys.LION_IDLE);
    this.sprite.setAlpha(1);
    this.sprite.setAngle(0);
    this.sprite.setVisible(true);
    this.isJumping = false;
    this.isDead = false;
    this._jumpPhaseKey = null;

    this._startIdleBobbing();
  }

  _startIdleBobbing() {
    if (this.isDead) return;
    if (this._bobTween) this._bobTween.stop();
    this.sprite.setY(this.sprite.y);
    this._bobTween = this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - rs(this.scene, 6),
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  stopIdleBobbing() {
    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }
  }

  showIdle() {
    this._applyUniformForKey(AssetKeys.LION_IDLE);
  }

  showJump() {
    const k = this._jpTex(AssetKeys.LION_JP_PREPARE, AssetKeys.LION_IDLE);
    this._applyUniformForKey(k);
  }

  showHappy() {
    this._applyUniformForKey(AssetKeys.LION_HAPPY);
  }

  showFall() {
    this._applyUniformForKey(AssetKeys.LION_FALL);
  }

  _jpTex(primary, fallback) {
    return this.scene.textures.exists(primary) ? primary : fallback;
  }

  setFacing(targetX) {
    const startX = this.sprite.x;
    if (Math.abs(targetX - startX) < 1) return;
    this.sprite.setFlipX(targetX > startX);
  }

  jumpTo(targetX, targetY, duration, onComplete) {
    if (this.isJumping) return;

    this.isJumping = true;

    const seq = [
      [0.00, AssetKeys.LION_JP_PREPARE],
      [0.11, AssetKeys.LION_JP_JUMP],
      [0.34, AssetKeys.LION_JP_MIDAIR],
      [0.62, AssetKeys.LION_JP_READYLAND],
      [0.84, AssetKeys.LION_JP_LAND]
    ];

    const first = this._jpTex(AssetKeys.LION_JP_PREPARE, AssetKeys.LION_IDLE);
    this._applyUniformForKey(first);
    this._jumpPhaseKey = first;

    const startX    = this.sprite.x;
    const startY    = this.sprite.y;
    const arcHeight = rs(this.scene, 85);
    const tweenProxy = { t: 0 };

    this.setFacing(targetX);
    this.stopIdleBobbing();

    const b0 = this._lionBaseScale();
    this.scene.tweens.add({
      targets:  this.sprite,
      scaleX:   b0 * 1.15,
      scaleY:   b0 * 0.85,
      duration: 100,
      yoyo:     true,
      ease:     "Quad.easeOut"
    });

    this.scene.tweens.add({
      targets:  tweenProxy,
      t:        1,
      duration,
      ease:     "Sine.easeInOut",
      onUpdate: () => {
        const t = tweenProxy.t;
        const x = Phaser.Math.Linear(startX, targetX, t);
        const y = Phaser.Math.Linear(startY, targetY, t) - Math.sin(Math.PI * t) * arcHeight;
        this.sprite.setPosition(x, y);

        let picked = seq[0][1];
        for (const [th, key] of seq) {
          if (t >= th) picked = key;
        }
        const fallback = picked === AssetKeys.LION_JP_PREPARE ? AssetKeys.LION_IDLE : AssetKeys.LION_JUMP;
        const tex = this._jpTex(picked, fallback);
        if (tex !== this._jumpPhaseKey) {
          this._applyUniformForKey(tex);
          this._jumpPhaseKey = tex;
        }

        const b = this._lionBaseScale();
        const stretchFactor = Math.sin(Math.PI * t) * 0.15;
        this.sprite.scaleX = b * (1 - stretchFactor);
        this.sprite.scaleY = b * (1 + stretchFactor);
      },
      onComplete: () => {
        this.isJumping = false;
        this._jumpPhaseKey = null;
        this.sprite.setPosition(targetX, targetY);

        if (this.isDead) return;

        const b1 = this._lionBaseScale();
        this.scene.tweens.add({
          targets:  this.sprite,
          scaleX:   b1 * 1.2,
          scaleY:   b1 * 0.8,
          duration: 120,
          yoyo:     true,
          ease:     "Back.easeOut",
          onComplete: () => {
            this._applyUniformForKey(AssetKeys.LION_IDLE);
            this._startIdleBobbing();
          }
        });

        if (onComplete) onComplete();
      }
    });
  }
}
