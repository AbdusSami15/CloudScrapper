import AssetKeys from "../managers/AssetKeys.js";
import { rs } from "../utils/ScreenUtil.js";

export default class PlayerController {
  constructor(scene, x, y) {
    this.scene     = scene;
    this.isJumping = false;
    this.isDead    = false;

    // Scale lion height — slightly smaller on portrait so it doesn't crowd
    // the limited horizontal space; landscape keeps the original size since
    // the wide PC viewport has plenty of breathing room.
    const isLandscape = scene.scale.width > scene.scale.height;
    this._lionScale   = rs(scene, isLandscape ? 0.14 : 0.115);

    this.sprite = scene.add.image(x, y, AssetKeys.LION_IDLE);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(20);
    this.sprite.setScale(this._lionScale);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  setTexture(key) {
    this.sprite.setTexture(key);
  }

  resetVisual() {
    // Kill any ongoing tweens on the sprite first
    this.scene.tweens.killTweensOf(this.sprite);
    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }

    this.sprite.setTexture(AssetKeys.LION_IDLE);
    this.sprite.setScale(this._lionScale);
    this.sprite.setAlpha(1);
    this.sprite.setAngle(0);
    this.sprite.setVisible(true);
    this.isJumping = false;
    this.isDead = false;

    this._startIdleBobbing();
  }

  _startIdleBobbing() {
    if (this.isDead) return;
    if (this._bobTween) this._bobTween.stop();
    this.sprite.setY(this.sprite.y); // Reset to base Y
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

  showIdle()  { this.setTexture(AssetKeys.LION_IDLE);  }
  showJump()  { this.setTexture(AssetKeys.LION_JUMP);  }
  showHappy() { this.setTexture(AssetKeys.LION_HAPPY); }
  showFall()  { this.setTexture(AssetKeys.LION_FALL);  }

  setFacing(targetX) {
    const startX = this.sprite.x;
    if (Math.abs(targetX - startX) < 1) return;
    this.sprite.setFlipX(targetX > startX);
  }

  jumpTo(targetX, targetY, duration, onComplete) {
    if (this.isJumping) return;

    this.isJumping = true;
    this.showJump();

    const startX    = this.sprite.x;
    const startY    = this.sprite.y;
    const arcHeight = rs(this.scene, 85);
    const tweenProxy = { t: 0 };

    // Face the target cloud
    this.setFacing(targetX);
    this.stopIdleBobbing();

    // Initial squash when starting the jump
    this.scene.tweens.add({
      targets:  this.sprite,
      scaleX:   this._lionScale * 1.15,
      scaleY:   this._lionScale * 0.85,
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

        // Stretch during the middle of the jump
        const stretchFactor = Math.sin(Math.PI * t) * 0.15;
        this.sprite.scaleX = this._lionScale * (1 - stretchFactor);
        this.sprite.scaleY = this._lionScale * (1 + stretchFactor);
      },
      onComplete: () => {
        this.isJumping = false;
        this.sprite.setPosition(targetX, targetY);
        
        if (this.isDead) return;

        // Impact squash on landing
        this.scene.tweens.add({
          targets:  this.sprite,
          scaleX:   this._lionScale * 1.2,
          scaleY:   this._lionScale * 0.8,
          duration: 120,
          yoyo:     true,
          ease:     "Back.easeOut",
          onComplete: () => {
            this.sprite.setScale(this._lionScale);
            this._startIdleBobbing();
          }
        });

        if (onComplete) onComplete();
      }
    });
  }
  showMultiplierBadge(multiplier) {
    const { scene } = this;
    const hr = scene.scale.height / 960;
    
    // Position above the head (lion's origin is at the feet/bottom)
    const bx = this.sprite.x;
    const by = this.sprite.y - this.sprite.displayHeight - rs(scene, 15);
    
    const badgeW = rs(scene, 85);
    const badgeH = rs(scene, 36);
    const radius = rs(scene, 10);
    
    const container = scene.add.container(bx, by).setDepth(30);
    
    // Yellow rounded rectangle background
    const bg = scene.add.graphics();
    bg.fillStyle(0xfacc15, 1); // Yellow
    bg.fillRoundedRect(-badgeW/2, -badgeH/2, badgeW, badgeH, radius);
    bg.lineStyle(rs(scene, 2), 0xca8a04, 1); // Slightly darker border
    bg.strokeRoundedRect(-badgeW/2, -badgeH/2, badgeW, badgeH, radius);
    
    // Multiplier text
    const txt = scene.add.text(0, 0, `${multiplier.toFixed(2)}x`, {
      fontFamily: "Tilt Warp",
      fontSize: `${Math.round(20 * hr)}px`,
      color: "#1d4ed8", // Deep Blue
      fontStyle: "bold",
      stroke: "#ffffff",
      strokeThickness: Math.round(1 * hr)
    }).setOrigin(0.5);
    
    container.add([bg, txt]);
    
    // Animation: Pop up, float, and fade out
    container.setScale(0.5);
    container.setAlpha(0);

    scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      y: by - rs(scene, 25),
      duration: 350,
      ease: "Back.easeOut"
    });
    
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: by - rs(scene, 60),
      delay: 1100,
      duration: 450,
      onComplete: () => container.destroy()
    });
  }
}
