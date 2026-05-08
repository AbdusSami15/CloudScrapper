import AssetKeys from "../managers/AssetKeys.js";
import GameManager from "../managers/GameManager.js";
import RoundManager from "../managers/RoundManager.js";
import CloudManager from "../managers/CloudManager.js";
import UIManager from "../managers/UIManager.js";
import PlayerController from "../objects/PlayerController.js";
import { rx, ry, rs } from "../utils/ScreenUtil.js";
import { GAME_STATES } from "../state/GameStates.js";

export default class GameScene extends Phaser.Scene {
  constructor() { super("GameScene"); }

  create() {
    this.createBackground();

    // ── Manager construction order ──────────────────────────────────────
    // GameManager   → state machine + balance + bet + difficulty (loaded from localStorage)
    // CloudManager  → cloud pool / generation
    // PlayerController → lion sprite
    // RoundManager  → round lifecycle (must exist before UIManager.bindControls
    //                 because UI's refreshFromState() reads roundManager state)
    // UIManager     → builds the panel & subscribes to GameManager events
    this.gameManager = new GameManager(this);
    this.cloudManager = new CloudManager(this);
    this.player = new PlayerController(this, rx(this, 270), ry(this, 760));
    this.roundManager = new RoundManager(this);
    this.uiManager = new UIManager(this);

    // Play background music (with safety check)
    if (this.cache.audio.exists(AssetKeys.MUSIC_BG)) {
      this.sound.play(AssetKeys.MUSIC_BG, { loop: true, volume: 0.4 });
    } else {
      console.warn("Background music not found in cache, skipping playback.");
    }

    this.createLogo();
    this.bindUIControls();
    this.bindInput();

    // Resume audio context on first click (browser requirement)
    this.input.once("pointerdown", () => {
      if (this.sound.context.state === "suspended") {
        this.sound.context.resume();
      }
    });

    // Subscribe AFTER all managers exist so handler can rely on them
    this.gameManager.on("state-changed", (next) => this._onStateChanged(next));

    // Initial idle visual state (BETTING)
    this._enterBettingVisuals();
    this.uiManager.setStatus("Place a bet and press PLAY");
    this.uiManager.refreshFromState();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Visuals
  // ════════════════════════════════════════════════════════════════════════
  createBackground() {
    const w = this.scale.width;
    const h = this.scale.height;

    const isLandscape = w > h;
    const hr = Math.min(Math.min(w, h) / 540, 1.0);
    const gameH = h - Math.round(92 * hr);

    const groundH = Math.max(Math.round(gameH * 0.16), 80);

    // PC (Landscape) needs taller and non-stretched buildings
    const cityH = isLandscape
      ? Math.round(gameH * 0.08) // Even smaller silhouette
      : Math.round(gameH * 0.42);

    this.add.image(w * 0.5, h * 0.5, AssetKeys.BG_SKY)
      .setDisplaySize(w, h)
      .setDepth(0)
      .setScrollFactor(0);





    if (isLandscape) {
      // Use TileSprite on PC but scale it to fill the width (so it doesn't repeat multiple times on 1 screen)
      const tex = this.textures.get(AssetKeys.BG_CITY).getSourceImage();

      // Calculate scale to fill the width (with a small buffer)
      const targetW = w * 1.02;
      const tileScale = targetW / tex.width;
      const displayH = tex.height * tileScale;

      this.add.tileSprite(w * 0.5, gameH * 1.45, w, displayH, AssetKeys.BG_CITY)
        .setOrigin(0.5, 1)
        .setTileScale(tileScale, tileScale)
        .setAlpha(0.95)
        .setDepth(1);
    } else {
      // Lowered city further (gameH * 1.05)
      this.add.image(w * 0.5, gameH * 1.07, AssetKeys.BG_CITY)
        .setOrigin(0.5, 1)
        .setDisplaySize(w * 1.05, cityH)
        .setAlpha(0.95)
        .setDepth(1);
    }

    if (isLandscape) {
      // Scale ground proportionally to maintain the "slope" look, 
      // but move it down so it doesn't take up too much vertical space.
      const gTex = this.textures.get(AssetKeys.BG_GROUND).getSourceImage();
      const gScale = (w * 1) / gTex.width;
      const ground = this.add.image(w * 0.5, gameH, AssetKeys.BG_GROUND)
        .setOrigin(0.5, 1)
        .setScale(gScale)
        .setDepth(2);

      // Extreme minimal ground visibility (4%)
      const maxVisibleH = gameH * 0.04;
      if (ground.displayHeight > maxVisibleH) {
        ground.y += (ground.displayHeight - maxVisibleH);
      }
    } else {
      // Lowered ground slightly (gameH * 1.02)
      this.add.image(w * 0.5, gameH * 1.1, AssetKeys.BG_GROUND)
        .setOrigin(0.5, 1)
        .setDisplaySize(w, groundH)
        .setDepth(2);
    }
  }

  createLogo() {
    const w = this.scale.width;
    const hr = this.scale.height / 960;
    const isLandscape = this.scale.width > this.scale.height;

    // Main branding logo in the center sky
    this.logoImage = this.add.image(w * 0.5, ry(this, 350), AssetKeys.LOGO)
      .setOrigin(0.5)
      .setDepth(3);

    const baseScale = isLandscape ? 0.25 : 0.18;
    this.logoImage.setScale(baseScale * hr);

    // New Upper Logo (branding at the top right, fixed to camera)
    const padding = ry(this, 20);
    this.upperLogo = this.add.image(w - padding, padding, AssetKeys.UPPER_LOGO)
      .setOrigin(1, 0)
      .setDepth(3)
      .setScrollFactor(0);

    // Match the exact same scaling logic as the main logo to ensure quality
    const logoScale = isLandscape ? 0.25 : 0.18;
    this.upperLogo.setScale(logoScale * hr);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Wiring
  // ════════════════════════════════════════════════════════════════════════
  bindUIControls() {
    this.uiManager.bindControls({
      onPlay:       () => this._handlePlay(),
      onJump:       () => this.roundManager.requestJump(),
      onCashout:    () => this.roundManager.requestCashout(),
      onReplay:     () => this.roundManager.requestReplay(),
      onDifficulty: () => this._handleDifficulty(),
      onStartAuto:  (count, target) => {
        this.gameManager.startAutoPlay(count, target);
        this._handlePlay();
      },
      onStopAuto:   () => this.gameManager.stopAutoPlay()
    });
  }

  _handlePlay() {
    this.roundManager.requestRoundStart();
  }

  _handleDifficulty() {
    if (!this.gameManager.isState(GAME_STATES.BETTING)) return;
    this.gameManager.cycleDifficulty();
  }

  _onStateChanged(next) {
    if (next === GAME_STATES.BETTING) {
      this._enterBettingVisuals();
    } else if (next === GAME_STATES.STARTING) {
      this._enterRoundVisuals();
    }
  }

  _enterBettingVisuals() {
    this.player?.sprite?.setVisible(false);
    if (this.logoImage) this.logoImage.setVisible(true);
    if (this.upperLogo) this.upperLogo.setVisible(true);
    this.cloudManager?.reset();
  }

  _enterRoundVisuals() {
    this.player?.sprite?.setVisible(true);
    if (this.logoImage) this.logoImage.setVisible(false);

    // Hide upper logo in portrait mode during gameplay
    const isPortrait = this.scale.height >= this.scale.width;
    if (this.upperLogo && isPortrait) this.upperLogo.setVisible(false);
  }

  bindInput() {
    // Canvas tap (above the bottom panel) → JUMP if state allows.
    this.input.on("pointerdown", (pointer) => {
      if (pointer.y >= this.uiManager.getBottomPanelTop()) return;
      this._tryJumpInput();
    });

    this.input.keyboard.on("keydown-SPACE", () => this._tryJumpInput());
  }

  _tryJumpInput() {
    if (this.gameManager.isState(GAME_STATES.READY)) {
      this.roundManager.requestJump();
    } else if (this.gameManager.isState(GAME_STATES.RESULT)) {
      // Tap anywhere also dismisses result modal as a quick replay
      this.roundManager.requestReplay();
    }
  }
}
