import { GAME_STATES }     from "../state/GameStates.js";
import { GAME_CONFIG }     from "../config/GameConfig.js";
import { playFailEffect }  from "../utils/FailEffects.js";
import { playLandingJuice, playJumpJuice } from "../utils/JuiceUtils.js";
import AssetKeys from "./AssetKeys.js";

/**
 * Drives the full round lifecycle:
 *   requestRoundStart → start → ready → jump → land → cashout/fail → result
 *
 * Implements:
 *   • Bet validation against balance (insufficient-balance feedback)
 *   • Settlement at round end (balance += payout − betAmount)
 *   • Anti-spam guards (`isResolving`, `replayDebounceMs`)
 *   • Event/timer cleanup on round restart (no stale tweens)
 */
export default class RoundManager {
  constructor(scene) {
    this.scene = scene;

    this.currentStep       = 0;
    this.currentMultiplier = 1;
    this.lockedMultiplier  = 1;     // last-landed cloud's multiplier (the cashout value)
    this.betAmountLocked   = 0;     // bet amount snapshotted at round start

    this.lastResult        = null;  // { betAmount, multiplier, payout, outcome }
    this.pendingEvents     = [];
    this.failCleanup       = null;

    this.isResolving       = false;
    this.lastReplayAt      = 0;
    this.hasLandedAtLeastOnce = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Public API (called by UI / GameScene)
  // ════════════════════════════════════════════════════════════════════════

  /** Starts a brand-new round. Validates bet, deducts nothing yet
   *  (settlement is at round end), transitions BETTING → STARTING → READY. */
  requestRoundStart() {
    const gm = this.scene.gameManager;

    // Replay debounce
    const now = Date.now();
    if (now - this.lastReplayAt < 220) return;
    this.lastReplayAt = now;

    if (!gm.isState(GAME_STATES.BETTING)) {
      console.warn("[Round] requestRoundStart ignored, state =", gm.state);
      return;
    }

    if (!gm.canAffordBet()) {
      this.scene.uiManager.showInsufficientBalance(gm.bet, gm.balance);
      return;
    }

    if (!gm.setState(GAME_STATES.STARTING, "round_start")) return;

    this._setupRound();

    gm.setState(GAME_STATES.READY, "round_ready");
  }

  /** Player decided to jump to the next cloud. */
  requestJump() {
    const gm = this.scene.gameManager;
    if (!gm.isState(GAME_STATES.READY)) return;
    if (this.scene.player.isJumping)    return;

    const targetCloud = this.scene.cloudManager.getTargetCloud();
    if (!targetCloud) return;

    gm.setState(GAME_STATES.JUMPING, "jump_started");
    this.scene.uiManager.setStatus("Jumping...");
    playJumpJuice(this.scene, this.scene.player.x, this.scene.player.y);
    this.scene.sound.play(AssetKeys.SFX_JUMP, { volume: 1.0 });

    this.scene.player.jumpTo(targetCloud.x, targetCloud.y + 2, 500, () => {
      this._resolveLanding(targetCloud);
    });
  }

  /** Player decided to collect winnings instead of risking another jump. */
  requestCashout() {
    const gm = this.scene.gameManager;

    // Cashout is allowed once you have at least one successful landing
    if (!gm.isState(GAME_STATES.READY))           return;
    if (!this.hasLandedAtLeastOnce)               return;
    if (this.isResolving)                         return;

    if (!gm.setState(GAME_STATES.CASHOUT, "user_cashout")) return;

    const payout    = this._computePayout(this.lockedMultiplier);
    this.lastResult = {
      betAmount:  this.betAmountLocked,
      multiplier: this.lockedMultiplier,
      payout,
      outcome:    "WIN"
    };

    gm.applySettlement({ betAmount: this.betAmountLocked, payout });
    this._showResult();
  }

  /** Reset to BETTING (called by replay button). */
  requestReplay() {
    const gm  = this.scene.gameManager;
    const now = Date.now();
    if (now - this.lastReplayAt < 220) return;
    this.lastReplayAt = now;

    if (!gm.isState(GAME_STATES.RESULT)) return;

    // Cleanup FIRST (this may set player visible), then state change hides it
    this._clearPendingWork();

    if (!gm.setState(GAME_STATES.BETTING, "replay")) return;

    // Ensure player is hidden on betting screen
    this.scene.player.sprite.setVisible(false);

    this.scene.uiManager.hideResult();
    this.scene.uiManager.setStatus("Place a bet and press PLAY");

    if (gm.isAutoPlaying) {
      this._track(this.scene.time.delayedCall(800, () => {
        if (gm.isAutoPlaying) this.requestRoundStart();
      }));
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Private — round setup & resolution
  // ════════════════════════════════════════════════════════════════════════

  _setupRound() {
    this._clearPendingWork();

    const gm  = this.scene.gameManager;
    const key = gm.difficulty;

    this.currentStep       = 0;
    this.currentMultiplier = 1;
    this.lockedMultiplier  = 1;
    this.betAmountLocked   = gm.bet;
    this.isResolving       = false;
    this.hasLandedAtLeastOnce = false;
    this.lastResult        = null;

    this.scene.cloudManager.reset();

    // Pre-generate all 15 clouds for the entire round
    const firstCloud = this.scene.cloudManager.createAllClouds(key);

    this.currentMultiplier = 1.0;
    this.lockedMultiplier  = 1.0;

    this.scene.uiManager.setCurrentMultiplier(firstCloud.cloudData.multiplier);
    this.scene.uiManager.setStatus("Tap to jump");

    // Position first, THEN reset visuals (so idle bobbing captures the correct ground Y)
    const startX = this.scene.scale.width * 0.5;
    const startY = this.scene.cloudManager.groundPeakY;
    this.scene.player.setPosition(startX, startY);
    this.scene.player.resetVisual();

    this.scene.player.setFacing(firstCloud.x);

    if (gm.isAutoPlaying) {
      this._track(this.scene.time.delayedCall(1000, () => {
        if (gm.isAutoPlaying) this.requestJump();
      }));
    }
  }

  _resolveLanding(targetCloud) {
    if (targetCloud.cloudData.type === "good") {
      this._handleSuccess(targetCloud);
    } else {
      this._handleFailure(targetCloud);
    }
  }

  _handleSuccess(targetCloud) {
    const gm = this.scene.gameManager;
    if (!gm.setState(GAME_STATES.LANDED_GOOD, "good_landing")) return;

    this.currentStep       = targetCloud.cloudData.index;
    this.currentMultiplier = targetCloud.cloudData.multiplier;
    this.lockedMultiplier  = targetCloud.cloudData.multiplier;
    this.hasLandedAtLeastOnce = true;

    this.scene.sound.play(AssetKeys.SFX_HIT, { volume: 0.6 });
    targetCloud.playGoodFeedback();
    targetCloud.setHighlighted(true);
    playLandingJuice(this.scene, targetCloud.x, targetCloud.y);

    const prevCloud = this.scene.cloudManager.getCurrentCloud();
    if (prevCloud) prevCloud.setHighlighted(false);

    this.scene.player.showHappy();
    this.scene.player.showMultiplierBadge(this.currentMultiplier);
    this.scene.uiManager.setCurrentMultiplier(this.currentMultiplier);
    this.scene.uiManager.refreshCashoutButton();
    this.scene.uiManager.setStatus(`Safe! ${this.currentMultiplier.toFixed(2)}x locked`);

    this.scene.cloudManager.advanceAfterLanding();
    const nextCloud = this.scene.cloudManager.getTargetCloud();
    if (nextCloud) this.scene.player.setFacing(nextCloud.x);

    this._track(this.scene.time.delayedCall(220, () => {
      this.scene.cloudManager.shiftWorldDown(targetCloud.y, this.scene.player, () => {
        this.scene.player.showIdle();
        gm.setState(GAME_STATES.READY, "ready_for_next_jump");
        this.scene.uiManager.setStatus("Tap to jump or CASH OUT");

        if (gm.isAutoPlaying) {
          this._track(this.scene.time.delayedCall(800, () => {
            if (!gm.isAutoPlaying) return;
            if (this.lockedMultiplier >= gm.autoCashoutMultiplier) {
              this.requestCashout();
            } else {
              this.requestJump();
            }
          }));
        }
      });
    }));
  }

  _handleFailure(targetCloud) {
    const gm = this.scene.gameManager;
    if (!gm.setState(GAME_STATES.LANDED_BAD, "bad_landing")) return;

    this.isResolving = true;

    const payout    = 0;
    this.lastResult = {
      betAmount:  this.betAmountLocked,
      multiplier: this.lockedMultiplier,
      payout,
      outcome:    "LOSS"
    };

    this.scene.uiManager.setStatus("Bad cloud!");
    this.scene.player.isDead = true;
    this.scene.player.stopIdleBobbing();
    this.failCleanup = playFailEffect(
      this.scene,
      targetCloud.cloudData.failType,
      targetCloud,
      this.scene.player.sprite
    );

    gm.applySettlement({ betAmount: this.betAmountLocked, payout });

    this._track(this.scene.time.delayedCall(GAME_CONFIG.resultDelayMs, () => {
      this._showResult();
    }));
  }

  _showResult() {
    const gm = this.scene.gameManager;
    if (!gm.setState(GAME_STATES.RESULT, "show_result")) return;
    
    this.scene.uiManager.showResult(this.lastResult);

    if (gm.isAutoPlaying) {
      gm.decrementAutoSpins();
      
      // Auto-replay after a delay if still auto-playing
      if (gm.isAutoPlaying) {
        this._track(this.scene.time.delayedCall(1200, () => {
          this.requestReplay();
        }));
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════════════════

  _computePayout(multiplier) {
    return Math.round(this.betAmountLocked * multiplier * 100) / 100;
  }

  _track(event) { this.pendingEvents.push(event); }

  _clearPendingWork() {
    for (const ev of this.pendingEvents) ev.remove(false);
    this.pendingEvents.length = 0;

    if (this.failCleanup) {
      this.failCleanup();
      this.failCleanup = null;
    }

    if (this.scene.player) {
      this.scene.player.isJumping = false;
      this.scene.tweens.killTweensOf(this.scene.player.sprite);
    }

    if (this.scene.cloudManager) {
      this.scene.tweens.killTweensOf(this.scene.cloudManager.clouds);
    }

    this.isResolving = false;
  }

  // Convenience getters used by UI for the cashout button
  get pendingPayout() { return this._computePayout(this.lockedMultiplier); }
}
