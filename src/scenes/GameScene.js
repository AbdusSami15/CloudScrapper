import AssetKeys from "../managers/AssetKeys.js";
import ParallaxBackground from "../managers/ParallaxBackground.js";
import { GAME_CONFIG } from "../config/GameConfig.js";
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
    const mutedPref =
      typeof localStorage !== "undefined" &&
      localStorage.getItem(GAME_CONFIG.storageKeys.audioMuted) === "1";
    this.sound.setMute(!!mutedPref);

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

    // Background music — loop; stopped on loss (see handleRoundResultForAudio)
    if (this.cache.audio.exists(AssetKeys.MUSIC_BG)) {
      if (!this.bgm) {
        this.bgm = this.sound.add(AssetKeys.MUSIC_BG, {
          loop:   true,
          volume: GAME_CONFIG.bgmVolume
        });
      }
      this.resumeBackgroundMusic();
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
    this.parallaxBg?.destroy?.();
    this.parallaxBg = new ParallaxBackground(this);
  }

  createLogo() {
    const w = this.scale.width;
    const hr = this.scale.height / 960;
    const isLandscape = this.scale.width > this.scale.height;

    // Main branding logo in the center sky
    this.logoImage = this.add.image(w * 0.5, ry(this, 350), AssetKeys.LOGO)
      .setOrigin(0.5)
      .setDepth(15);

    const baseScale = isLandscape ? 0.25 : 0.18;
    this.logoImage.setScale(baseScale * hr);

    // New Upper Logo (branding at the top right, fixed to camera)
    const padding = ry(this, 20);
    this.upperLogo = this.add.image(w - padding, padding, AssetKeys.UPPER_LOGO)
      .setOrigin(1, 0)
      .setDepth(15)
      .setScrollFactor(0);

    // Use a smaller scale for the upper logo compared to the main logo
    const upperLogoScale = isLandscape ? 0.14 : 0.11;
    this.upperLogo.setScale(upperLogoScale * hr);
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
      this.resumeBackgroundMusic();
    } else if (next === GAME_STATES.STARTING) {
      this._enterRoundVisuals();
    }
  }

  /** Win / cashout keeps BGM; loss stops until next BETTING screen. */
  handleRoundResultForAudio(result) {
    if (result?.outcome !== "LOSS" || !this.bgm) return;
    if (this.bgm.isPlaying) {
      this.bgm.stop();
    }
  }

  resumeBackgroundMusic() {
    if (!this.cache.audio.exists(AssetKeys.MUSIC_BG)) return;
    if (!this.bgm) {
      this.bgm = this.sound.add(AssetKeys.MUSIC_BG, {
        loop:   true,
        volume: GAME_CONFIG.bgmVolume
      });
    }
    if (this.sound.mute) return;
    if (!this.bgm.isPlaying) {
      this.bgm.play();
    }
  }

  _enterBettingVisuals() {
    this.player?.sprite?.setVisible(false);
    if (this.logoImage) this.logoImage.setVisible(true);
    if (this.upperLogo) this.upperLogo.setVisible(true);
    this.cloudManager?.reset();
    this.uiManager.moveStatusToBetting();
  }

  _enterRoundVisuals() {
    this.player?.sprite?.setVisible(true);
    if (this.logoImage) this.logoImage.setVisible(false);

    // Hide upper logo in portrait mode during gameplay
    const isPortrait = this.scale.height >= this.scale.width;
    if (this.upperLogo && isPortrait) this.upperLogo.setVisible(false);

    this.uiManager.moveStatusToGameplay();
  }

  bindInput() {
    // Canvas tap (above the bottom panel) → JUMP if state allows.
    this.input.on("pointerdown", (pointer) => {
      if (this.uiManager.isPointerOverMuteControl(pointer)) return;
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
