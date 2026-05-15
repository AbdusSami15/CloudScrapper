import AssetKeys from "./AssetKeys.js";
import { rs } from "../utils/ScreenUtil.js";

/**
 * Sky layers + ground + independent plane flyers (parallax scrollFactor).
 * Dual sky: sky1 above horizon, sky2 tiles repeat upward — moves with camera like clouds (reference diagram).
 * Planes respawn off-screen with random lane/speed; two-plane setups never share direction.
 */
export default class ParallaxBackground {
  constructor(scene) {
    this.scene       = scene;
    this.objects     = [];
    this.planeAgents = [];

    this._planeTick = (_t, delta) => this._updatePlanes(delta);
    
    // Background Lightning System
    this._nextLightningTime = Date.now() + Phaser.Math.Between(8000, 15000);
    this._lightningTick = () => {
      if (Date.now() > this._nextLightningTime) {
        this._triggerBackgroundLightning();
        this._nextLightningTime = Date.now() + Phaser.Math.Between(10000, 22000);
      }
    };

    this._boundLayout = () => this.layout();
    scene.scale.on("resize", this._boundLayout);
    scene.events.on("update", this._planeTick);
    scene.events.on("update", this._lightningTick);
    scene.events.once("shutdown", () => this.destroy());

    this.layout();
  }

  destroy() {
    this.scene.scale.off("resize", this._boundLayout);
    this.scene.events.off("update", this._planeTick);
    this.scene.events.off("update", this._lightningTick);
    for (const o of this.objects) {
      if (o && o.destroy) o.destroy();
    }
    this.objects = [];
    this.planeAgents = [];
  }

  /** Scale texture so both dimensions cover target viewport (centered). */
  _cover(img, vw, vh) {
    const tex = img.texture.getSourceImage();
    const tw  = tex.width;
    const th  = tex.height;
    const sc  = Math.max(vw / tw, vh / th);
    img.setDisplaySize(tw * sc, th * sc);
  }

  /**
   * Random travel axis when alone; with exactly one other plane, force opposite direction.
   * With 3 planes, random unless everyone else agrees — then flip for balance.
   */
  _pickTravelRightExcluding(agent) {
    const others = this.planeAgents.filter((a) => a !== agent && a.sprite?.active);
    if (!others.length) return Math.random() < 0.5;

    const rights = others.filter((o) => o.vx > 0).length;
    const lefts  = others.length - rights;

    // Strict balance: ensure directions are as evenly split as possible
    if (rights > lefts) return false;
    if (lefts > rights) return true;
    return Math.random() < 0.5;
  }

  /** Sprite authored nose-right: flip when travelling left (vx negative). */
  _applyTravel(agent, travelRight, speedBase) {
    const jitter = Phaser.Math.FloatBetween(0.88, 1.12);
    agent.baseSpeed = speedBase;
    agent.vx = travelRight ? speedBase * jitter : -speedBase * jitter;
    agent.sprite.setFlipX(!travelRight);
  }

  /** Random depth along off-screen edge + random altitude band. */
  _randomSpawnXY(agent, travelRight, cam, pad, laneMargin, bandTop, bandH) {
    const pl = agent.sprite;
    const vw = cam.worldView.width; // Use world view width
    const hw = Math.max(pl.displayWidth * 0.52, vw * 0.04);

    // Assign lanes to prevent planes from traveling in the same row
    const totalPlanes = this.planeAgents.length || 2;
    const agentIdx    = this.planeAgents.indexOf(agent);
    const laneH       = bandH / totalPlanes;
    const laneCenter  = bandTop + (agentIdx * laneH) + (laneH * 0.5);
    
    pl.y = laneCenter + Phaser.Math.FloatBetween(-laneH * 0.15, laneH * 0.15);

    const span = laneMargin + Phaser.Math.Between(0, Math.round(vw * 0.48));

    if (travelRight) {
      pl.x = cam.worldView.x - pad - hw - span;
    } else {
      pl.x = cam.worldView.x + vw + pad + hw + span;
    }
  }

  /** Respawn after exiting frame — random lane/speed; direction mixes random + pairing rules. */
  _respawnPlane(agent, cam, bandTop, bandH, pad, laneMargin) {
    const w = this.scene.scale.width;
    const speedBase = (w / 540) * Phaser.Math.FloatBetween(48, 96);
    const travelRight = this._pickTravelRightExcluding(agent);
    this._applyTravel(agent, travelRight, speedBase);
    this._randomSpawnXY(agent, travelRight, cam, pad, laneMargin, bandTop, bandH);
  }

  _updatePlanes(delta) {
    if (!this.planeAgents.length) return;

    const cam = this.scene.cameras.main;
    const pad = cam.worldView.width * 0.12;
    const laneMargin = cam.worldView.width * 0.06;
    const dt = delta / 1000;

    // Relative to camera world view so they stay in the sky near the player
    const bandTop = cam.worldView.y + cam.worldView.height * 0.07;
    const bandH   = cam.worldView.height * 0.38;

    const left = cam.worldView.x - pad;
    const right = cam.worldView.x + cam.worldView.width + pad;

    for (const agent of this.planeAgents) {
      const pl = agent.sprite;
      if (!pl || !pl.active) continue;

      pl.x += agent.vx * dt;

      const hw = Math.max(pl.displayWidth * 0.52, cam.width * 0.04);

      if (agent.vx > 0 && pl.x - hw > right) {
        this._respawnPlane(agent, cam, bandTop, bandH, pad, laneMargin);
      } else if (agent.vx < 0 && pl.x + hw < left) {
        this._respawnPlane(agent, cam, bandTop, bandH, pad, laneMargin);
      }
    }
  }

  _triggerBackgroundLightning() {
    const scene = this.scene;
    const cam = scene.cameras.main;
    
    // Pick random bolt image
    const boltKeys = [
      AssetKeys.LIGHTNING_BOLT_1,
      AssetKeys.LIGHTNING_BOLT_2,
      AssetKeys.LIGHTNING_BOLT_3,
      AssetKeys.LIGHTNING_BOLT_4,
      AssetKeys.LIGHTNING_BOLT_5
    ];
    const key = Phaser.Utils.Array.GetRandom(boltKeys);
    
    // Random position in sky
    const rx = cam.worldView.x + Phaser.Math.Between(0, cam.worldView.width);
    const ry = cam.worldView.y + Phaser.Math.Between(0, cam.worldView.height * 0.3);
    
    const bolt = scene.add.image(rx, ry, key)
      .setOrigin(0.5, 0)
      .setDepth(3) // Behind clouds (depth 5)
      .setAlpha(0)
      .setTint(0x99ccff); // Slight blue tint for ambient lightning
      
    // Flash background sky subtly
    const flash = scene.add.rectangle(cam.worldView.centerX, cam.worldView.centerY, cam.worldView.width * 2, cam.worldView.height * 2, 0xffffff, 0)
      .setDepth(2)
      .setScrollFactor(0);

    // Play sound (low volume for background)
    if (scene.sound.mute === false) {
      scene.sound.play(AssetKeys.SFX_THUNDER_STRIKE, { volume: 0.12 });
    }

    // Bolt sequence
    scene.tweens.add({
      targets: bolt,
      alpha: 1,
      duration: 50,
      yoyo: true,
      hold: 60,
      onComplete: () => bolt.destroy()
    });

    // Sky flash sequence
    scene.tweens.add({
      targets: flash,
      alpha: 0.15,
      duration: 60,
      yoyo: true,
      onComplete: () => flash.destroy()
    });
  }

  layout() {
    for (const o of this.objects) {
      if (o && o.destroy) o.destroy();
    }
    this.objects = [];
    this.planeAgents = [];

    const scene = this.scene;
    const w     = scene.scale.width;
    const h     = scene.scale.height;
    const isLandscape = w > h;

    const push = (o) => {
      this.objects.push(o);
      return o;
    };

    const hasParallaxSky =
      scene.textures.exists(AssetKeys.BG_PARALLAX_SKY_FAR) &&
      scene.textures.exists(AssetKeys.BG_PARALLAX_SKY_NEAR);

    if (hasParallaxSky) {
      // Anchor sky1 bottom just above the canvas edge so it overlaps the base/city seam — avoids the dark gap (#020617) between skyline and sky art.
      const edgePadRef = isLandscape ? 72 : 48;
      const sky1BottomY = h - rs(scene, edgePadRef);

      const sky1 = push(scene.add.image(w * 0.5, sky1BottomY, AssetKeys.BG_PARALLAX_SKY_NEAR));
      sky1.setOrigin(0.5, 1);
      const sky1CoverH = Math.max(h * 1.42, sky1BottomY * 1.06);
      this._cover(sky1, w * 1.14, sky1CoverH);
      sky1.setDepth(1).setScrollFactor(1, 1);

      const sky1TopY = sky1BottomY - sky1.displayHeight;

      const sky2Key = AssetKeys.BG_PARALLAX_SKY_FAR;
      const sky2Tex = scene.textures.get(sky2Key).getSourceImage();
      const tileTargetW = w * 1.12;
      const tileCoverH  = h * 1.08;
      const scTile      = Math.max(tileTargetW / sky2Tex.width, tileCoverH / sky2Tex.height);
      const tileDispW   = sky2Tex.width * scTile;
      const tileDispH   = sky2Tex.height * scTile;

      const climbEstimate = rs(scene, 140 * 110);
      const numSky2Tiles  = Math.min(96, Math.ceil(climbEstimate / tileDispH) + 14);

      for (let i = 0; i < numSky2Tiles; i++) {
        const cy = sky1TopY - (i + 0.5) * tileDispH;
        const sky2 = push(scene.add.image(w * 0.5, cy, sky2Key));
        sky2.setOrigin(0.5, 0.5);
        sky2.setDisplaySize(tileDispW, tileDispH);
        sky2.setDepth(0).setScrollFactor(1, 1);
      }
    } else if (scene.textures.exists(AssetKeys.BG_SKY)) {
      push(scene.add.image(w * 0.5, h * 0.5, AssetKeys.BG_SKY))
        .setDisplaySize(w, h)
        .setDepth(0)
        .setScrollFactor(0.1, 0.1);
    } else {
      push(scene.add.rectangle(w * 0.5, h * 0.5, w, h, 0x38bdf8, 1))
        .setDepth(0)
        .setScrollFactor(0.08, 0.1);
    }

    const planeKeys = [
      AssetKeys.BG_PLANE_1,
      AssetKeys.BG_PLANE_2,
      AssetKeys.BG_PLANE_3,
      AssetKeys.BG_PLANE_5,
      AssetKeys.BG_PLANE_7
    ].filter((k) => scene.textures.exists(k));

    if (planeKeys.length) {
      const count = isLandscape ? 3 : 2;
      const cam = scene.cameras.main;

      const pad = cam.worldView.width * 0.12;
      const bandTop = cam.worldView.y + cam.worldView.height * 0.07;
      const bandH = cam.worldView.height * 0.38;
      const laneMargin = cam.worldView.width * 0.06;

      for (let i = 0; i < count; i++) {
        const key = planeKeys[i % planeKeys.length];
        const tex = scene.textures.get(key).getSourceImage();
        const planeFrac = isLandscape ? 0.095 : 0.18;
        const baseW = Math.round(planeFrac * w);
        const scPlane = baseW / tex.width;

        const pl = push(scene.add.image(0, 0, key));
        pl.setDepth(3);
        pl.setScrollFactor(1, 1); // Not attached to camera, exists in world space
        pl.setScale(scPlane);

        const speedBase = ((w / 540) * Phaser.Math.FloatBetween(52, 92));

        const travelRight =
          i === 0
            ? Math.random() < 0.5
            : !(this.planeAgents[this.planeAgents.length - 1].vx > 0);

        const agent = {
          sprite: pl,
          vx:     0,
          baseSpeed: speedBase
        };
        this._applyTravel(agent, travelRight, speedBase);
        this._randomSpawnXY(agent, travelRight, cam, pad, laneMargin, bandTop, bandH);

        this.planeAgents.push(agent);
      }
    }

    if (scene.textures.exists(AssetKeys.BG_PARALLAX_BASE)) {
      const tex = scene.textures.get(AssetKeys.BG_PARALLAX_BASE).getSourceImage();
      const cropTopRatio = 0.34;
      const cropY        = Math.floor(tex.height * cropTopRatio);
      const cropH        = tex.height - cropY;

      const base = push(
        scene.add.image(w * 0.5, h, AssetKeys.BG_PARALLAX_BASE).setOrigin(0.5, 1)
      );
      base.setCrop(0, cropY, tex.width, cropH);
      base.setDepth(4).setScrollFactor(0.52, 0.62);
      const sx = w / tex.width;
      // Width always sx; Y scaled separately per orientation (hill height tuning).
      if (isLandscape) {
        const landHeightMul = 0.67;
        base.setScale(sx, sx * landHeightMul);
      } else {
        const portraitHeightMul = 1.19;
        base.setScale(sx, sx * portraitHeightMul);
      }
    } else {
      if (scene.textures.exists(AssetKeys.BG_CITY)) {
        const cityH = isLandscape ? Math.round(h * 0.08) : Math.round(h * 0.38);
        push(scene.add.image(w * 0.5, h * (isLandscape ? 1.02 : 1.05), AssetKeys.BG_CITY))
          .setOrigin(0.5, 1)
          .setDisplaySize(w * 1.05, cityH)
          .setAlpha(0.95)
          .setDepth(4)
          .setScrollFactor(0.55, 0.68);
      }

      const groundH = Math.max(Math.round(h * 0.14), Math.round(72 * (w / Math.max(window.innerWidth, 1))));
      if (scene.textures.exists(AssetKeys.BG_GROUND)) {
        push(scene.add.image(w * 0.5, h * 1.06, AssetKeys.BG_GROUND))
          .setOrigin(0.5, 1)
          .setDisplaySize(w, groundH)
          .setDepth(5)
          .setScrollFactor(0.65, 0.72);
      }
    }
  }
}
