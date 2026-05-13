import { GAME_STATES, LOCKED_STATES } from "../state/GameStates.js";
import { GAME_CONFIG }                from "../config/GameConfig.js";
import AssetKeys                      from "./AssetKeys.js";

/**
 * UIManager — pure-Phaser bottom panel + status text + result modal.
 *
 *   • State-driven primary button:
 *       BETTING        → "PLAY"
 *       READY (idx≥1)  → "CASH OUT  $X"
 *       READY (idx=0)  → "JUMP"
 *       JUMPING/LANDED → disabled
 *       RESULT         → "PLAY AGAIN"
 *   • Locks bet/difficulty controls outside BETTING.
 *   • Animated balance counter on settlement.
 *   • Result modal with Bet / Multiplier / Payout stats grid.
 */
export default class UIManager {
  constructor(scene) {
    this.scene    = scene;
    this.controls = null;

    this._displayedBalance = scene.gameManager.balance;
    this._balanceTween     = null;
    this._buttonMode       = "play";   // play | jump | cashout | replay | wait
    this._locked           = false;

    const sw = scene.scale.width;
    const sh = scene.scale.height;

    // ── DPR-aware sizing ───────────────────────────────────────────────────
    // Canvas now runs at viewport × DPR (see main.js).  The hr factor must
    // be capped at DPR so UI elements don't visually grow beyond reference
    // size on wide PC monitors but DO scale up for HD pixel density.
    const dpr = Math.max(1, sw / window.innerWidth);
    const hr  = Math.min(Math.min(sw, sh) / 540, dpr);
    this._hr  = hr;
    this._sw  = sw;
    this._sh  = sh;
    this._dpr = dpr;

    // With manual HD sizing, the canvas always fills the viewport — visH
    // equals canvas height (no overflow clipping to worry about).
    this._visH = sh;

    this._buildBottomPanel();
    this._buildStatusText();
    this._buildResultModal();
    this._buildMuteControl();
    this._subscribeToGameManager();
    
    // Reposition HTML + mute on window resize
    scene.scale.on("resize", () => this._onUiResize());
  }

  _onUiResize() {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const dpr = Math.max(1, sw / window.innerWidth);
    this._hr = Math.min(Math.min(sw, sh) / 540, dpr);
    this._sw = sw;
    this._sh = sh;
    this._dpr = dpr;
    this._visH = sh;

    this._repositionMuteControl();
    this._repositionHtmlElements();
  }

  /** Cloud-themed mute toggle (matches sample: fluffy cloud + yellow glyph + black stroke). */
  _buildMuteControl() {
    const { scene } = this;
    const hr = this._hr;

    const cw = Math.round(82 * hr);
    const ch = Math.round(46 * hr);
    const pad = Math.round(12 * hr);
    const cx = pad + cw / 2;
    const cy = pad + ch / 2;

    const cloud = scene.add.image(0, 0, AssetKeys.CLOUD_V2_1).setOrigin(0.5);
    cloud.setDisplaySize(cw, ch);

    const stroke = Math.max(3, Math.round(4 * hr));
    const fs = Math.max(15, Math.round(21 * hr));
    this._muteIcon = scene.add.text(0, -1, "♪", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize:   `${fs}px`,
      color:      "#fde047",
      fontStyle:  "bold"
    })
      .setOrigin(0.5)
      .setStroke("#000000", stroke);

    this._muteContainer = scene.add.container(cx, cy, [cloud, this._muteIcon])
      .setDepth(210)
      .setScrollFactor(0);

    const hit = new Phaser.Geom.Rectangle(-cw / 2, -ch / 2, cw, ch);
    this._muteContainer.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    if (this._muteContainer.input) {
      this._muteContainer.input.cursor = "pointer";
    }

    this._muteContainer.on("pointerdown", (pointer, _lx, _ly, event) => {
      if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      if (pointer && pointer.event && typeof pointer.event.stopPropagation === "function") {
        pointer.event.stopPropagation();
      }
      this._toggleMuteControl();
    });

    this._muteCloudW = cw;
    this._muteCloudH = ch;

    this._syncMuteVisual();
  }

  _repositionMuteControl() {
    if (!this._muteContainer || !this._muteIcon) return;

    const hr = this._hr;
    const cw = Math.round(82 * hr);
    const ch = Math.round(46 * hr);
    const pad = Math.round(12 * hr);
    const cx = pad + cw / 2;
    const cy = pad + ch / 2;

    this._muteCloudW = cw;
    this._muteCloudH = ch;

    this._muteContainer.setPosition(cx, cy);

    const cloud = this._muteContainer.list[0];
    if (cloud && cloud.setDisplaySize) {
      cloud.setDisplaySize(cw, ch);
    }

    const stroke = Math.max(3, Math.round(4 * hr));
    const fs = Math.max(15, Math.round(21 * hr));
    this._muteIcon.setFontSize(fs);
    this._muteIcon.setStroke("#000000", stroke);

    if (this._muteContainer.input && this._muteContainer.input.hitArea) {
      const r = this._muteContainer.input.hitArea;
      if (r instanceof Phaser.Geom.Rectangle) {
        r.setTo(-cw / 2, -ch / 2, cw, ch);
      }
    }

    this._syncMuteVisual();
  }

  _syncMuteVisual() {
    if (!this._muteIcon) return;
    const muted = this.scene.sound.mute === true;
    this._muteIcon.setText(muted ? "✕" : "♪");
  }

  _toggleMuteControl() {
    const next = !this.scene.sound.mute;
    this.scene.sound.setMute(next);

    try {
      localStorage.setItem(GAME_CONFIG.storageKeys.audioMuted, next ? "1" : "0");
    } catch (_e) {
      /* ignore quota / privacy mode */
    }

    this._syncMuteVisual();

    if (!next && this.scene.gameManager?.isState(GAME_STATES.BETTING)) {
      this.scene.resumeBackgroundMusic();
    }
  }

  _repositionHtmlElements() {
    const { _hr: hr, _sw: sw, _visH: visH } = this;
    if (this._apScrim) {
        this._apScrim.setSize(sw, visH);
    }

    if (!this._apSpinSliderEl) return;
    const cardW = Math.min(Math.round(440 * hr), sw - Math.round(30 * hr));
    const cardH = Math.round(420 * hr);
    const cardX = (sw - cardW) / 2;
    const cardY = (visH - cardH) / 2 - Math.round(20 * hr);
    const gridPad = Math.round(24 * hr);

    if (this._apContainer) {
        this._apContainer.setPosition(cardX, cardY);
    }

    const startY = cardY + Math.round(95 * hr);
    const btnH = Math.round(52 * hr);
    const btnGap = Math.round(10 * hr);
    
    const sliderY = startY + (3 * (btnH + btnGap)) + Math.round(15 * hr);
    const sliderW = cardW - gridPad * 2 - Math.round(55 * hr);
    const sliderX = cardX + gridPad;
    
    this._apSpinSliderEl.style.left  = `${sliderX}px`;
    this._apSpinSliderEl.style.top   = `${sliderY}px`;
    this._apSpinSliderEl.style.width = `${sliderW}px`;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Layout — bottom panel
  // ════════════════════════════════════════════════════════════════════════
  _buildBottomPanel() {
    const { _hr: hr, _sw: sw, _sh: sh, _visH: visH, scene } = this;
    const gm = scene.gameManager;

    // Geometry
    const MARGIN     = Math.round(12 * hr);
    const cellH      = Math.round(56 * hr);
    const playH      = Math.round(64 * hr);
    const cellGap    = Math.round(8  * hr);
    const panelPad   = Math.round(8  * hr);
    const cellRadius = Math.round(12 * hr);
    const panelRad   = Math.round(16 * hr);

    // Check orientation early for layout decisions
    const isLandscape = sw > sh;

    const panelH   = playH + panelPad * 2;
    const panelTop = isLandscape 
      ? visH - panelH - Math.round(14 * hr) 
      : visH - panelH - Math.round(2 * hr);
    
    // On PC, don't stretch the panel to full width; keep it as a centered island
    const maxPanelW = Math.round(940 * hr);
    const panelW = isLandscape
      ? Math.min(sw - MARGIN * 4, maxPanelW)
      : sw - MARGIN * 2;
      
    const panelX = (sw - panelW) / 2;
    this._panelTop = panelTop;

    const contentW = panelW - panelPad * 2;
    const contentLeft = panelX + panelPad;

    // Cell weights - adjusted for better PC balance
    const W = { balance: 1.25, bet: 1.65, diff: 1.25, auto: 0.65, play: 1.80 };
    const totalGaps   = cellGap * 4;
    const totalWeight = W.balance + W.bet + W.diff + W.auto + W.play;
    const unit        = (contentW - totalGaps) / totalWeight;

    const wBal  = unit * W.balance;
    const wBet  = unit * W.bet;
    const wDiff = unit * W.diff;
    const wAuto = unit * W.auto;
    const wPlay = unit * W.play;

    const xBal  = contentLeft;
    const xBet  = xBal  + wBal  + cellGap;
    const xDiff = xBet  + wBet  + cellGap;
    const xAuto = xDiff + wDiff + cellGap;
    const xPlay = xAuto + wAuto + cellGap;

    const cellY = panelTop + (panelH - cellH) / 2;
    const playY = panelTop + (panelH - playH) / 2;

    this._geom = { hr, MARGIN, cellH, playH, cellRadius, cellY, playY,
                   xBal, wBal, xBet, wBet, xDiff, wDiff, xAuto, wAuto, xPlay, wPlay };

    // Outer panel
    const panel = scene.add.graphics().setDepth(100).setScrollFactor(0);
    panel.fillStyle(0x0f172a, 0.92); // More opaque for premium feel
    panel.fillRoundedRect(panelX, panelTop, panelW, panelH, panelRad);
    panel.lineStyle(1.5, 0x94a3b8, 0.35); // Slightly thicker border
    panel.strokeRoundedRect(panelX, panelTop, panelW, panelH, panelRad);

    // Cell backgrounds (4 cells: balance, bet, diff, auto)
    const cellGfx = scene.add.graphics().setDepth(101).setScrollFactor(0);
    const drawCell = (x, w) => {
      cellGfx.fillStyle(0x020617, 0.40);
      cellGfx.fillRoundedRect(x, cellY, w, cellH, cellRadius);
      cellGfx.lineStyle(1, 0x94a3b8, 0.18);
      cellGfx.strokeRoundedRect(x, cellY, w, cellH, cellRadius);
    };
    drawCell(xBal,  wBal);
    drawCell(xBet,  wBet);
    drawCell(xDiff, wDiff);
    drawCell(xAuto, wAuto);

    // Style presets
    const labelStyle = {
      fontFamily:    "Tilt Warp",
      fontSize:      `${Math.max(9, Math.round(10 * hr))}px`,
      color:         "#cbd5e1",
      fontStyle:     "bold",
      letterSpacing: 1.4
    };
    const valueStyle = {
      fontFamily: "Tilt Warp",
      fontSize:   `${Math.round(17 * hr)}px`,
      color:      "#ffffff",
      fontStyle:  "bold"
    };

    const cellPadX  = Math.round(12 * hr);
    const labelTopY = cellY + Math.round(9 * hr);
    const valueBotY = cellY + cellH - Math.round(9 * hr);

    const addLabel = (x, text) =>
      scene.add.text(x + cellPadX, labelTopY, text, labelStyle).setDepth(102).setScrollFactor(0);

    const addLabelCentered = (cx, text) =>
      scene.add.text(cx, labelTopY, text, labelStyle).setOrigin(0.5, 0).setDepth(102).setScrollFactor(0);

    // BALANCE
    addLabel(xBal, "BALANCE");
    this.pointsText = scene.add.text(
      xBal + cellPadX, valueBotY, this._fmtMoney(gm.balance),
      { ...valueStyle, color: "#22c55e" }
    ).setOrigin(0, 1).setDepth(102).setScrollFactor(0);

    // BET
    const subBtn = Math.round(26 * hr);
    const subY   = cellY + cellH - subBtn / 2 - Math.round(7 * hr);
    const minusX = xBet + cellPadX + subBtn / 2;
    const plusX  = xBet + wBet - cellPadX - subBtn / 2;
    addLabelCentered(xBet + wBet / 2, "BET");
    this._minusBtn = this._makeSubBtn(minusX, subY, subBtn, "-",
      `${Math.round(15 * hr)}px`, () => this._onBetAdjust(-1));
    this._plusBtn  = this._makeSubBtn(plusX,  subY, subBtn, "+",
      `${Math.round(15 * hr)}px`, () => this._onBetAdjust(+1));
    this.betText = scene.add.text(
      (minusX + plusX) / 2, subY, `${gm.bet}`,
      { ...valueStyle, fontSize: `${Math.round(16 * hr)}px` }
    ).setOrigin(0.5).setDepth(102).setScrollFactor(0);

    // Make the BET area interactive to show the Quick Bet modal
    this.betButton = scene.add.zone(xBet, cellY, wBet, cellH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .setDepth(103);
    this.betButton.on("pointerdown", () => {
      this._playClick();
      if (this._locked) return;
      this._showQuickBet(true);
    });

    // DIFFICULTY
    addLabelCentered(xDiff + wDiff / 2, "DIFFICULTY");
    this.difficultyText = scene.add.text(
      xDiff + wDiff / 2, valueBotY, gm.getDifficultyConfig().displayName,
      { ...valueStyle, fontSize: `${Math.round(15 * hr)}px` }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);
    this.difficultyButton = scene.add.zone(xDiff, cellY, wDiff, cellH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .setDepth(103);
    this.difficultyButton.on("pointerdown", () => {
      this._playClick();
      if (this._locked) return;
      this.controls?.onDifficulty?.();
    });

    // AUTO (placeholder)
    addLabelCentered(xAuto + wAuto / 2, "AUTO");
    this.autoValueText = scene.add.text(
      xAuto + wAuto / 2, valueBotY, "\u21bb",
      { fontFamily: "Tilt Warp", fontSize: `${Math.round(20 * hr)}px`,
        color: "#cbd5e1", fontStyle: "bold" }
    ).setOrigin(0.5, 1).setDepth(102).setScrollFactor(0);
    this.autoButton = scene.add.zone(xAuto, cellY, wAuto, cellH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .setDepth(103);
    this.autoButton.on("pointerdown", () => {
      this._playClick();
      this._onAutoPressed();
    });

    // PLAY (state-driven)
    this._buildPlayButton(xPlay, playY, wPlay, playH);
  }

  _buildPlayButton(x, y, w, h) {
    const { _hr: hr, scene } = this;
    const radius = Math.round(8 * hr); // Changed from h/2 to a smaller fixed radius for a rectangular look

    this._playGfx     = scene.add.graphics().setDepth(101).setScrollFactor(0);
    this._playRect    = { x, y, w, h, radius };

    this._playLabel = scene.add.text(
      x + w / 2, y + h / 2, "PLAY",
      {
        fontFamily:      "Tilt Warp",
        fontSize:        `${Math.round(20 * hr)}px`,
        color:           "#ffffff",
        fontStyle:       "bold",
        stroke:          "#0a3a17",
        strokeThickness: Math.round(2 * hr),
        letterSpacing:   1.2
      }
    ).setOrigin(0.5).setDepth(103).setScrollFactor(0);

    this._playSubLabel = scene.add.text(
      x + w / 2, y + h / 2 + Math.round(16 * hr), "",
      {
        fontFamily: "Tilt Warp",
        fontSize:   `${Math.round(11 * hr)}px`,
        color:      "#dcfce7",
        fontStyle:  "bold"
      }
    ).setOrigin(0.5).setDepth(103).setScrollFactor(0);

    this._playZone = scene.add.zone(x, y, w, h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .setDepth(104);
    this._playZone.on("pointerdown", () => {
      // If mode is 'play', use start sfx, otherwise click
      if (this._buttonMode === "play" || this._buttonMode === "replay") {
        this._playStart();
      } else {
        this._playClick();
      }
      this._onPlayPressed();
    });

    this._renderPlayButton("play", { fill: 0x22c55e, border: 0x15803d });
  }

  /** Re-render the PLAY button graphics for given visual mode. */
  _renderPlayButton(mode, colors) {
    const { _hr: hr } = this;
    const { x, y, w, h, radius } = this._playRect;
    const g = this._playGfx;
    g.clear();

    // Drop shadow
    g.fillStyle(0x000000, 0.30);
    g.fillRoundedRect(x, y + Math.round(4 * hr), w, h, radius);
    // Main fill
    g.fillStyle(colors.fill, 1);
    g.fillRoundedRect(x, y, w, h, radius);
    // Top highlight
    g.fillStyle(0xffffff, 0.20);
    g.fillRoundedRect(
      x + Math.round(2 * hr),
      y + Math.round(2 * hr),
      w - Math.round(4 * hr),
      Math.round(h * 0.45),
      Math.max(radius - Math.round(2 * hr), 1)
    );
    // Border
    g.lineStyle(Math.round(2 * hr), colors.border, 0.70);
    g.strokeRoundedRect(x, y, w, h, radius);
  }

  _buildStatusText() {
    const { _hr: hr, _sw: sw, scene } = this;
    const isPortrait = scene.scale.height >= scene.scale.width;

    // Gameplay position (top of screen)
    this._statusTopY = Math.round(78 * hr);
    // Betting position (below center logo, portrait only)
    this._statusBetY = isPortrait ? Math.round(680 * hr) : this._statusTopY;

    this.statusText = scene.add.text(
      sw * 0.5, this._statusBetY, "Place a bet and press PLAY",
      {
        fontFamily:      "Tilt Warp",
        fontSize:        `${Math.round(18 * hr)}px`,
        color:           "#ffffff",
        fontStyle:       "bold",
        stroke:          "#08243a",
        strokeThickness: Math.round(4 * hr)
      }
    ).setOrigin(0.5).setDepth(101).setScrollFactor(0);

    this._badgeTopY = Math.round(108 * hr);
    this._badgeBetY = isPortrait ? Math.round(720 * hr) : this._badgeTopY;

    this.multiplierBadge = scene.add.text(
      sw * 0.5, this._badgeBetY, "",
      {
        fontFamily:      "Tilt Warp",
        fontSize:        `${Math.round(28 * hr)}px`,
        color:           "#facc15",
        fontStyle:       "bold",
        stroke:          "#000000",
        strokeThickness: Math.round(4 * hr)
      }
    ).setOrigin(0.5).setDepth(101).setVisible(false).setScrollFactor(0);
  }

  /** Animate status text below logo (betting screen) + pulse */
  moveStatusToBetting() {
    // Stop any existing pulse
    if (this._statusPulse) { this._statusPulse.remove(); this._statusPulse = null; }

    if (this.statusText) {
      this.statusText.setScale(1);
      this.scene.tweens.add({
        targets: this.statusText,
        y: this._statusBetY,
        duration: 350,
        ease: "Quad.easeOut",
        onComplete: () => {
          // Start scale pulse after arriving
          this._statusPulse = this.scene.tweens.add({
            targets: this.statusText,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          });
        }
      });
    }
    if (this.multiplierBadge) {
      this.scene.tweens.add({
        targets: this.multiplierBadge,
        y: this._badgeBetY,
        duration: 350,
        ease: "Quad.easeOut"
      });
    }
  }

  /** Animate status text to top (gameplay) */
  moveStatusToGameplay() {
    // Stop pulse
    if (this._statusPulse) { this._statusPulse.remove(); this._statusPulse = null; }
    if (this.statusText) this.statusText.setScale(1);

    if (this.statusText) {
      this.scene.tweens.add({
        targets: this.statusText,
        y: this._statusTopY,
        duration: 400,
        ease: "Quad.easeOut"
      });
    }
    if (this.multiplierBadge) {
      this.scene.tweens.add({
        targets: this.multiplierBadge,
        y: this._badgeTopY,
        duration: 400,
        ease: "Quad.easeOut"
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Result modal
  // ════════════════════════════════════════════════════════════════════════
  _buildResultModal() {
    const { _hr: hr, _sw: sw, _visH: visH, scene } = this;

    this._modalScrim = scene.add.rectangle(0, 0, sw, visH, 0x020617, 0.65)
      .setOrigin(0, 0).setDepth(200).setVisible(false).setScrollFactor(0);

    const cardW = Math.min(Math.round(420 * hr), sw - Math.round(40 * hr));
    const cardH = Math.round(280 * hr);
    const cardX = (sw - cardW) / 2;
    const cardY = (visH - cardH) / 2;
    const radius = Math.round(20 * hr);

    this._modalCard = scene.add.graphics().setDepth(201).setVisible(false).setScrollFactor(0);
    this._modalCard.fillStyle(0x0f172a, 0.96);
    this._modalCard.fillRoundedRect(cardX, cardY, cardW, cardH, radius);
    this._modalCard.lineStyle(1, 0x94a3b8, 0.30);
    this._modalCard.strokeRoundedRect(cardX, cardY, cardW, cardH, radius);

    this._modalTitle = scene.add.text(
      cardX + cardW / 2, cardY + Math.round(36 * hr), "YOU WON!",
      {
        fontFamily:      "Tilt Warp",
        fontSize:        `${Math.round(30 * hr)}px`,
        color:           "#22c55e",
        fontStyle:       "bold",
        stroke:          "#000000",
        strokeThickness: Math.round(4 * hr)
      }
    ).setOrigin(0.5).setDepth(202).setVisible(false).setScrollFactor(0);

    // Stats grid (3 columns: Bet | Multiplier | Payout)
    const statsY = cardY + Math.round(110 * hr);
    const statW  = cardW / 3;

    const statLabelStyle = {
      fontFamily:    "Tilt Warp",
      fontSize:      `${Math.round(10 * hr)}px`,
      color:         "#94a3b8",
      fontStyle:     "bold",
      letterSpacing: 1.4
    };
    const statValueStyle = {
      fontFamily: "Tilt Warp",
      fontSize:   `${Math.round(20 * hr)}px`,
      color:      "#ffffff",
      fontStyle:  "bold"
    };

    this._modalLabels = [];

    const mkStat = (cx, label) => {
      const lbl = scene.add.text(cx, statsY, label, statLabelStyle)
        .setOrigin(0.5).setDepth(202).setVisible(false).setScrollFactor(0);
      const val = scene.add.text(cx, statsY + Math.round(24 * hr), "—", statValueStyle)
        .setOrigin(0.5).setDepth(202).setVisible(false).setScrollFactor(0);
      this._modalLabels.push(lbl);
      return val;
    };

    this._statBet     = mkStat(cardX + statW * 0.5, "BET");
    this._statMult    = mkStat(cardX + statW * 1.5, "MULTIPLIER");
    this._statPayout  = mkStat(cardX + statW * 2.5, "PAYOUT");
    this._statPayout.setColor("#22c55e");

    // Replay button
    const btnW = cardW - Math.round(40 * hr);
    const btnH = Math.round(54 * hr);
    const btnX = cardX + (cardW - btnW) / 2;
    const btnY = cardY + cardH - btnH - Math.round(20 * hr);
    const btnR = Math.round(btnH / 2);

    this._modalBtnGfx = scene.add.graphics().setDepth(202).setVisible(false).setScrollFactor(0);
    this._modalBtnGfx.fillStyle(0x000000, 0.30);
    this._modalBtnGfx.fillRoundedRect(btnX, btnY + Math.round(4 * hr), btnW, btnH, btnR);
    this._modalBtnGfx.fillStyle(0x22c55e, 1);
    this._modalBtnGfx.fillRoundedRect(btnX, btnY, btnW, btnH, btnR);
    this._modalBtnGfx.fillStyle(0xffffff, 0.20);
    this._modalBtnGfx.fillRoundedRect(
      btnX + Math.round(2 * hr),
      btnY + Math.round(2 * hr),
      btnW - Math.round(4 * hr),
      Math.round(btnH * 0.45),
      Math.max(btnR - Math.round(2 * hr), 1)
    );
    this._modalBtnGfx.lineStyle(Math.round(2 * hr), 0x15803d, 0.7);
    this._modalBtnGfx.strokeRoundedRect(btnX, btnY, btnW, btnH, btnR);

    this._modalBtnText = scene.add.text(
      btnX + btnW / 2, btnY + btnH / 2, "PLAY AGAIN",
      {
        fontFamily:      "Tilt Warp",
        fontSize:        `${Math.round(18 * hr)}px`,
        color:           "#ffffff",
        fontStyle:       "bold",
        stroke:          "#0a3a17",
        strokeThickness: Math.round(2 * hr),
        letterSpacing:   1.2
      }
    ).setOrigin(0.5).setDepth(203).setVisible(false).setScrollFactor(0);

    this._modalBtnZone = scene.add.zone(btnX, btnY, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(204).setScrollFactor(0)
      .setVisible(false);
    this._modalBtnZone.on("pointerdown", () => {
      this._playClick();
      this.controls?.onReplay?.();
    });

    this._buildQuickBetModal();
    this._buildAutoPlayModal();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Autoplay modal
  // ════════════════════════════════════════════════════════════════════════
  _buildAutoPlayModal() {
    const { _hr: hr, _sw: sw, _visH: visH, scene } = this;
    const values = [1, 10, 20, 50, 100, 250, 500, 750, 1000];
    this._selectedAutoCount = values[1] || 10;

    this._apScrim = scene.add.rectangle(0, 0, sw, visH, 0x020617, 0.5)
      .setOrigin(0, 0).setDepth(220).setVisible(false).setScrollFactor(0)
      .setInteractive();
    this._apScrim.on("pointerdown", () => this._showAutoPlay(false));

    const cardW = Math.min(Math.round(440 * hr), sw - Math.round(30 * hr));
    const cardH = Math.round(420 * hr);
    const cardX = (sw - cardW) / 2;
    const cardY = (visH - cardH) / 2 - Math.round(20 * hr);
    const radius = Math.round(20 * hr);

    this._apContainer = scene.add.container(cardX, cardY).setDepth(221).setVisible(false).setScrollFactor(0);

    this._apCard = scene.add.graphics();
    this._apCard.fillStyle(0x1e293b, 0.98);
    this._apCard.fillRoundedRect(0, 0, cardW, cardH, radius);
    this._apCard.lineStyle(2, 0x334155, 0.8);
    this._apCard.strokeRoundedRect(0, 0, cardW, cardH, radius);
    this._apContainer.add(this._apCard);

    const gridPad = Math.round(24 * hr);

    // Header
    const title = scene.add.text(gridPad, Math.round(24 * hr), "Autoplay settings", {
      fontFamily: "Tilt Warp", fontSize: `${Math.round(20 * hr)}px`, color: "#ffffff", fontStyle: "bold"
    });

    // Close Button (X)
    const closeSize = Math.round(36 * hr);
    const closeX = cardW - gridPad - closeSize / 2;
    const closeY = Math.round(24 * hr) + Math.round(10 * hr);
    
    this._apCloseGfx = scene.add.graphics();
    this._apCloseGfx.fillStyle(0xffffff, 0.1);
    this._apCloseGfx.fillCircle(closeX, closeY, closeSize / 2);
    
    this._apCloseText = scene.add.text(closeX, closeY, "✕", {
      fontFamily: "Tilt Warp", fontSize: `${Math.round(18 * hr)}px`, color: "#ffffff"
    }).setOrigin(0.5);
    
    this._apCloseZone = scene.add.zone(closeX, closeY, closeSize, closeSize).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this._apCloseZone.on("pointerdown", () => {
      this._playClick();
      this._showAutoPlay(false);
    });

    const sub = scene.add.text(gridPad, Math.round(65 * hr), "NUMBERS OF AUTOSPINS:", {
      fontFamily: "Tilt Warp", fontSize: `${Math.round(11 * hr)}px`, color: "#94a3b8"
    });

    this._apContainer.add([title, this._apCloseGfx, this._apCloseText, this._apCloseZone, sub]);

    // Grid (3x3)
    const cols = 3;
    const btnGap = Math.round(10 * hr);
    const btnW = (cardW - gridPad * 2 - btnGap * (cols - 1)) / cols;
    const btnH = Math.round(52 * hr);
    const startX = gridPad;
    const startY = Math.round(95 * hr);

    this._apButtons = [];
    values.forEach((val, i) => {
      const r = i / cols | 0;
      const c = i % cols;
      const bx = startX + c * (btnW + btnGap);
      const by = startY + r * (btnH + btnGap);

      const bg = scene.add.graphics();
      const txt = scene.add.text(bx + btnW / 2, by + btnH / 2, String(val), {
        fontFamily: "Tilt Warp", fontSize: `${Math.round(18 * hr)}px`, color: "#ffffff", fontStyle: "bold"
      }).setOrigin(0.5);

      const draw = (active) => {
        bg.clear();
        bg.fillStyle(active ? 0x334155 : 0x0f172a, 1);
        bg.fillRoundedRect(bx, by, btnW, btnH, Math.round(10 * hr));
        bg.lineStyle(2, active ? 0x475569 : 0x334155, 1);
        bg.strokeRoundedRect(bx, by, btnW, btnH, Math.round(10 * hr));
      };
      draw(val === this._selectedAutoCount);

      const zone = scene.add.zone(bx, by, btnW, btnH).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      
      zone.on("pointerdown", () => {
        this._playClick();
        this._selectedAutoCount = val;
        this._apButtons.forEach(b => b.draw(b.val === val));
        if (this._apSpinSliderEl) {
            this._apSpinSliderEl.value = val.toString();
            this._apTargetText.setText(String(val));
        }
        this._updateApActionText();
      });

      this._apContainer.add([bg, txt, zone]);
      this._apButtons.push({ val, bg, txt, zone, draw });
    });

    // Start Button
    const sBtnW = cardW - gridPad * 2;
    const sBtnH = Math.round(56 * hr);
    const sBtnX = gridPad;
    const sBtnY = cardH - sBtnH - Math.round(20 * hr);

    this._apActionGfx = scene.add.graphics();
    this._apActionGfx.fillStyle(0x22c55e, 1);
    this._apActionGfx.fillRoundedRect(sBtnX, sBtnY, sBtnW, sBtnH, Math.round(12 * hr));

    this._apActionText = scene.add.text(sBtnX + sBtnW / 2, sBtnY + sBtnH / 2, "", {
      fontFamily: "Tilt Warp", fontSize: `${Math.round(18 * hr)}px`, color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5);
    
    this._apActionZone = scene.add.zone(sBtnX, sBtnY, sBtnW, sBtnH).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    
    this._apActionZone.on("pointerdown", () => {
      this._playStart();
      this.controls?.onStartAuto?.(this._selectedAutoCount);
      this._showAutoPlay(false);
    });

    this._apTargetText = scene.add.text(cardW - gridPad, 0, String(this._selectedAutoCount), {
      fontFamily: "Tilt Warp", fontSize: `${Math.round(20 * hr)}px`, color: "#ffffff", fontStyle: "bold"
    }).setOrigin(1, 0.5);
    this._apTargetText.y = Math.round(75 * hr);

    this._apContainer.add([this._apActionGfx, this._apActionText, this._apActionZone, this._apTargetText]);
    this._updateApActionText();

    // HTML Slider for SPIN COUNT (1 to 1000)
    const uiRoot = document.getElementById("ui-root");
    this._apSpinSliderEl = document.createElement("input");
    this._apSpinSliderEl.type = "range";
    this._apSpinSliderEl.min = "1";
    this._apSpinSliderEl.max = "1000";
    this._apSpinSliderEl.step = "1";
    this._apSpinSliderEl.className = "autoplay-slider";
    this._apSpinSliderEl.style.position = "absolute";
    this._apSpinSliderEl.style.display = "none";
    this._apSpinSliderEl.style.zIndex = "1000";
    uiRoot.appendChild(this._apSpinSliderEl);

    this._apSpinSliderEl.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        this._selectedAutoCount = val;
        this._apTargetText.setText(String(val));
        this._apButtons.forEach(b => b.draw(b.val === val));
        this._updateApActionText();
    });

    this._repositionHtmlElements();
  }

  _updateApActionText() {
    if (!this._apActionText) return;
    const txt = `Start autoplay (${this._selectedAutoCount})`;
    this._apActionText.setText(txt);
  }

  _showAutoPlay(visible) {
    if (visible && this.scene.logoImage) this.scene.logoImage.setVisible(false);
    else if (!visible && this.scene.logoImage && this.scene.gameManager.isState("BETTING")) {
        this.scene.logoImage.setVisible(true);
    }

    if (this._apContainer) this._apContainer.setVisible(visible);
    
    if (this._apSpinSliderEl) {
        this._apSpinSliderEl.style.display = visible ? "block" : "none";
        if (visible) {
            this._apSpinSliderEl.value = this._selectedAutoCount.toString();
            this._apTargetText.setText(String(this._selectedAutoCount));
            this._updateApActionText();
            this._repositionHtmlElements();
        }
    }
    this.scene.children.list.filter(c => c.name === "ap_elem").forEach(c => c.setVisible(visible));
    this._apButtons.forEach(b => {
      b.draw(b.val === this._selectedAutoCount);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Quick Bet modal
  // ════════════════════════════════════════════════════════════════════════
  _buildQuickBetModal() {
    const { _hr: hr, _sw: sw, _visH: visH, scene } = this;
    const values = [1, 2, 5, 10, 20, 30, 40, 50, 80, 100, 120, 150, 200];

    this._qbScrim = scene.add.rectangle(0, 0, sw, visH, 0x020617, 0.4)
      .setOrigin(0, 0).setDepth(210).setVisible(false).setScrollFactor(0)
      .setInteractive();
    this._qbScrim.on("pointerdown", () => this._showQuickBet(false));

    const cardW = Math.min(Math.round(440 * hr), sw - Math.round(30 * hr));
    const cardH = Math.round(310 * hr);
    const cardX = (sw - cardW) / 2;
    const cardY = this._panelTop - cardH - Math.round(10 * hr);
    const radius = Math.round(20 * hr);

    this._qbCard = scene.add.graphics().setDepth(211).setVisible(false).setScrollFactor(0);
    this._qbCard.fillStyle(0x1e293b, 0.98); // Slate-800 style
    this._qbCard.fillRoundedRect(cardX, cardY, cardW, cardH, radius);
    this._qbCard.lineStyle(2, 0x334155, 0.8);
    this._qbCard.strokeRoundedRect(cardX, cardY, cardW, cardH, radius);

    this._qbTitle = scene.add.text(cardX + Math.round(20 * hr), cardY + Math.round(18 * hr), "QUICK BET", {
      fontFamily: "Tilt Warp", fontSize: `${Math.round(14 * hr)}px`, color: "#94a3b8", letterSpacing: 1.5
    }).setDepth(212).setVisible(false).setScrollFactor(0);

    // Button Grid (4 columns)
    const cols = 4;
    const btnGap = Math.round(10 * hr);
    const gridPad = Math.round(20 * hr);
    const btnW = (cardW - gridPad * 2 - btnGap * (cols - 1)) / cols;
    const btnH = Math.round(48 * hr);
    const startX = cardX + gridPad;
    const startY = cardY + Math.round(50 * hr);

    this._qbButtons = [];
    values.forEach((val, i) => {
      const r = i / cols | 0;
      const c = i % cols;
      const bx = startX + c * (btnW + btnGap);
      const by = startY + r * (btnH + btnGap);
      const br = Math.round(8 * hr);

      const bg = scene.add.graphics().setDepth(212).setVisible(false).setScrollFactor(0);
      bg.fillStyle(0x0f172a, 1);
      bg.fillRoundedRect(bx, by, btnW, btnH, br);
      bg.lineStyle(1, 0x334155, 0.5);
      bg.strokeRoundedRect(bx, by, btnW, btnH, br);

      const txt = scene.add.text(bx + btnW / 2, by + btnH / 2, String(val), {
        fontFamily: "Tilt Warp", fontSize: `${Math.round(16 * hr)}px`, color: "#ffffff", fontStyle: "bold"
      }).setOrigin(0.5).setDepth(213).setVisible(false).setScrollFactor(0);

      const zone = scene.add.zone(bx, by, btnW, btnH).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(214).setVisible(false).setScrollFactor(0);
      
      zone.on("pointerdown", () => {
        this._playClick();
        scene.gameManager.setBet(val);
        this._showQuickBet(false);
      });

      this._qbButtons.push({ bg, txt, zone });
    });
  }

  _showQuickBet(visible) {
    [this._qbScrim, this._qbCard, this._qbTitle].forEach(o => o && o.setVisible(visible));
    this._qbButtons.forEach(b => {
      b.bg.setVisible(visible);
      b.txt.setVisible(visible);
      b.zone.setVisible(visible);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Wiring
  // ════════════════════════════════════════════════════════════════════════
  bindControls(controls) {
    this.controls = controls;
    this.refreshFromState();
  }

  _subscribeToGameManager() {
    const gm = this.scene.gameManager;
    gm.on("state-changed",      () => this.refreshFromState());
    gm.on("balance-changed",    (next) => this._tweenBalance(next));
    gm.on("bet-changed",        (next) => this.betText.setText(`${next}`));
    gm.on("autoplay-started", (count) => {
      this.autoValueText.setText(String(count)).setColor("#facc15");
      this.autoValueText.setFontStyle("bold");
      this.refreshFromState();
    });
    gm.on("autoplay-updated", (count) => {
      this.autoValueText.setText(String(count));
    });
    gm.on("autoplay-stopped", () => {
      this.autoValueText.setText("\u21bb").setColor("#cbd5e1");
      this.autoValueText.setFontStyle("normal");
      this.refreshFromState();
    });
    gm.on("difficulty-changed", () => {
      this.difficultyText.setText(this.scene.gameManager.getDifficultyConfig().displayName);
    });
  }

  // ── Inputs ─────────────────────────────────────────────────────────────
  _onAutoPressed() {
    const gm = this.scene.gameManager;
    if (gm.isAutoPlaying) {
      gm.stopAutoPlay();
    } else {
      if (this._locked) return;
      this._showAutoPlay(true);
    }
  }
  _onBetAdjust(direction) {
    if (this._locked) return;
    this.scene.gameManager.adjustBet(direction * GAME_CONFIG.betStep);
  }

  _onPlayPressed() {
    switch (this._buttonMode) {
      case "play":    this.controls?.onPlay?.();    break;
      case "stop":    this.scene.gameManager.stopAutoPlay(); break;
      case "jump":    this.controls?.onJump?.();    break;
      case "cashout": this.controls?.onCashout?.(); break;
      case "replay":  this.controls?.onReplay?.();  break;
      // wait/disabled → no-op
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  State-driven UI refresh
  // ════════════════════════════════════════════════════════════════════════
  refreshFromState() {
    const gm    = this.scene.gameManager;
    const round = this.scene.roundManager;
    const state = gm.state;

    this._locked = LOCKED_STATES.has(state);
    this._setSubButtonsEnabled(!this._locked);
    this._setDifficultyEnabled(!this._locked);

    switch (state) {
      case GAME_STATES.BETTING:
        if (gm.isAutoPlaying) {
          this._setButtonMode("stop",
            { fill: 0xf43f5e, border: 0xbe123c },
            "✕ STOP", "");
        } else {
          this._setButtonMode("play",
            { fill: 0x22c55e, border: 0x15803d },
            "PLAY", "");
        }
        this._hideMultiplierBadge();
        break;

      case GAME_STATES.STARTING:
        this._setButtonMode("wait",
          { fill: 0x475569, border: 0x1f2937 },
          "...", "");
        break;

      case GAME_STATES.READY: {
        if (round && round.hasLandedAtLeastOnce) {
          this._setButtonMode("cashout",
            { fill: 0xf59e0b, border: 0x92400e },
            "CASH OUT",
            `$${this._fmtMoney(round.pendingPayout)}`);
        } else {
          this._setButtonMode("jump",
            { fill: 0x3b82f6, border: 0x1e3a8a },
            "JUMP", "");
        }
        this._showMultiplierBadge(round?.lockedMultiplier ?? 1);
        break;
      }

      case GAME_STATES.JUMPING:
      case GAME_STATES.LANDED_GOOD:
      case GAME_STATES.LANDED_BAD:
      case GAME_STATES.CASHOUT:
        this._setButtonMode("wait",
          { fill: 0x475569, border: 0x1f2937 },
          "...", "");
        break;

      case GAME_STATES.RESULT:
        this._setButtonMode("replay",
          { fill: 0x22c55e, border: 0x15803d },
          "PLAY AGAIN", "");
        break;
    }
  }

  refreshCashoutButton() {
    if (this._buttonMode === "cashout") {
      const round = this.scene.roundManager;
      this._playSubLabel.setText(`$${this._fmtMoney(round.pendingPayout)}`);
    }
  }

  _setButtonMode(mode, colors, label, subLabel) {
    this._buttonMode = mode;
    this._renderPlayButton(mode, colors);
    this._playLabel.setText(label);
    this._playSubLabel.setText(subLabel || "");

    const dim = (mode === "wait");
    this._playLabel.setAlpha(dim ? 0.7 : 1);
    this._playSubLabel.setAlpha(dim ? 0.7 : 1);
  }

  _setSubButtonsEnabled(enabled) {
    [this._minusBtn, this._plusBtn].forEach(z => {
      if (!z) return;
      z.input.enabled = enabled;
    });
    this.betText.setAlpha(enabled ? 1 : 0.5);
  }

  _setDifficultyEnabled(enabled) {
    if (!this.difficultyButton) return;
    this.difficultyButton.input.enabled = enabled;
    this.difficultyText.setAlpha(enabled ? 1 : 0.5);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Public API used by RoundManager / GameScene
  // ════════════════════════════════════════════════════════════════════════
  getBottomPanelTop() { return this._panelTop; }

  /** Prevents gameplay tap-to-jump from firing when touching the mute cloud. */
  isPointerOverMuteControl(pointer) {
    if (!this._muteContainer || !this._muteContainer.scene) return false;
    const b = this._muteContainer.getBounds();
    return Phaser.Geom.Rectangle.Contains(b, pointer.x, pointer.y);
  }

  setStatus(text)         { this.statusText.setText(text); }

  setCurrentMultiplier(value) {
    this.statusText.setText(`Next reward: ${value.toFixed(2)}x`);
    this._showMultiplierBadge(value);
  }

  _showMultiplierBadge(value) {
    if (!this.multiplierBadge) return;
    this.multiplierBadge.setText(`${value.toFixed(2)}x`);
    this.multiplierBadge.setVisible(true);
  }

  _hideMultiplierBadge() {
    if (this.multiplierBadge) this.multiplierBadge.setVisible(false);
  }

  showInsufficientBalance(bet, balance) {
    this.statusText.setText(`Insufficient balance ($${this._fmtMoney(balance)})`);
    this.scene.cameras.main.shake(180, 0.006);
  }

  showResult(result) {
    const won = result.outcome === "WIN";

    this._modalAllVisible(true);

    this._modalTitle
      .setText(won ? "YOU WON!" : "ROUND OVER")
      .setColor(won ? "#22c55e" : "#ef4444");

    if (won) {
      this.scene.sound.play(AssetKeys.SFX_WIN, { volume: 0.6 });
    } else {
      this.scene.sound.play(AssetKeys.SFX_LOSE, { volume: 0.6 });
    }

    this._statBet.setText(`$${this._fmtMoney(result.betAmount)}`);
    this._statMult.setText(`${result.multiplier.toFixed(2)}x`);
    this._statPayout
      .setText(`$${this._fmtMoney(result.payout)}`)
      .setColor(won ? "#22c55e" : "#ef4444");
  }

  hideResult() { this._modalAllVisible(false); }

  _modalAllVisible(v) {
    [this._modalScrim, this._modalCard, this._modalTitle,
     this._statBet, this._statMult, this._statPayout,
     this._modalBtnGfx, this._modalBtnText, this._modalBtnZone,
     ...this._modalLabels]
      .forEach(o => o && o.setVisible(v));
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════════════════
  _tweenBalance(target) {
    if (this._balanceTween) this._balanceTween.stop();
    const start = this._displayedBalance;

    this._balanceTween = this.scene.tweens.addCounter({
      from:     start,
      to:       target,
      duration: GAME_CONFIG.balanceTweenMs,
      ease:     "Cubic.easeOut",
      onUpdate: (tw) => {
        this._displayedBalance = tw.getValue();
        this.pointsText.setText(this._fmtMoney(this._displayedBalance));
      },
      onComplete: () => {
        this._displayedBalance = target;
        this.pointsText.setText(this._fmtMoney(target));
      }
    });
  }

  _fmtMoney(v) {
    const n = Number(v) || 0;
    return n.toFixed(2);
  }

  _makeSubBtn(x, y, size, label, fontSize, onClick) {
    const r = Math.round(size * 0.30);
    const g = this.scene.add.graphics().setDepth(102).setScrollFactor(0);
    g.fillStyle(0x0f172a, 0.85);
    g.fillRoundedRect(x - size / 2, y - size / 2, size, size, r);
    g.lineStyle(1, 0x94a3b8, 0.22);
    g.strokeRoundedRect(x - size / 2, y - size / 2, size, size, r);

    this.scene.add.text(x, y, label, {
      fontFamily: "Tilt Warp", fontSize, color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5).setDepth(103).setScrollFactor(0);

    const zone = this.scene.add.zone(x, y, size, size)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .setDepth(104);
    zone.on("pointerdown", () => {
      this._playClick();
      onClick();
    });
    return zone;
  }

  _playClick() {
    console.log("Attempting to play click sound...");
    this.scene.sound.play(AssetKeys.SFX_CLICK, { volume: 1.0 });
  }

  _playStart() {
    this.scene.sound.play(AssetKeys.SFX_START, { volume: 0.7 });
  }
}
