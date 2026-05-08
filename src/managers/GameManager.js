import { GAME_STATES, LEGAL_TRANSITIONS } from "../state/GameStates.js";
import { GAME_CONFIG }                   from "../config/GameConfig.js";
import DifficultyConfig, { DIFFICULTY_ORDER } from "../config/DifficultyConfig.js";

/**
 * GameManager owns:
 *   • Authoritative game state (with legal-transition validation)
 *   • Balance, current bet, current difficulty
 *   • localStorage persistence
 *   • Phaser-event-style emitter for state / balance / bet / difficulty changes
 */
export default class GameManager {
  constructor(scene) {
    this.scene = scene;

    this.state           = GAME_STATES.BETTING;
    this.previousState   = null;
    this.emitter         = new Phaser.Events.EventEmitter();

    // Hydrate from localStorage with safe fallbacks
    this.balance    = this._loadNumber("balance", GAME_CONFIG.startingBalance);
    this.bet        = this._loadNumber("bet",     GAME_CONFIG.defaultBet);
    this.difficulty = this._loadString("difficulty", DIFFICULTY_ORDER[0]);

    this.autoSpinsRemaining    = 0;
    this.isAutoPlaying         = false;
    this.autoCashoutMultiplier = 999.0;

    // Clamp to valid ranges
    this.balance = Math.max(0, Math.round(this.balance * 100) / 100);
    this.bet     = Phaser.Math.Clamp(this.bet, GAME_CONFIG.minBet, GAME_CONFIG.maxBet);
    if (!DifficultyConfig[this.difficulty]) {
      this.difficulty = DIFFICULTY_ORDER[0];
    }

    // Recovery: if the player burned through their balance before refresh,
    // restore the starting balance so the game stays playable.
    if (this.balance < GAME_CONFIG.minBet) {
      this.balance = GAME_CONFIG.startingBalance;
      this._saveNumber("balance", this.balance);
    }
  }

  // ── State machine ──────────────────────────────────────────────────────
  setState(nextState, reason) {
    if (this.state === nextState) return true;

    const allowed = LEGAL_TRANSITIONS[this.state] || [];
    if (!allowed.includes(nextState)) {
      console.warn(`[GameManager] Illegal transition ${this.state} → ${nextState}`,
        reason ? `(${reason})` : "");
      return false;
    }

    this.previousState = this.state;
    this.state         = nextState;
    this.emitter.emit("state-changed", nextState, this.previousState, reason);
    return true;
  }

  isState(s)   { return this.state === s; }
  isAnyOf(arr) { return arr.includes(this.state); }

  // ── Balance / bet / difficulty (with persistence + events) ─────────────
  setBalance(value) {
    const clean = Math.max(0, Math.round(Number(value) * 100) / 100);
    if (clean === this.balance) return;
    const old = this.balance;
    this.balance = clean;
    this._saveNumber("balance", clean);
    this.emitter.emit("balance-changed", clean, old);
  }

  /** Apply settlement: balance += payout − betAmount  */
  applySettlement({ betAmount, payout }) {
    const net = (payout || 0) - (betAmount || 0);
    this.setBalance(this.balance + net);
  }

  setBet(value) {
    const clean = Phaser.Math.Clamp(
      Math.round(Number(value)),
      GAME_CONFIG.minBet, GAME_CONFIG.maxBet
    );
    if (clean === this.bet) return;
    this.bet = clean;
    this._saveNumber("bet", clean);
    this.emitter.emit("bet-changed", clean);
  }

  adjustBet(delta) { this.setBet(this.bet + delta); }

  setDifficulty(key) {
    if (!DifficultyConfig[key] || key === this.difficulty) return;
    this.difficulty = key;
    this._saveString("difficulty", key);
    this.emitter.emit("difficulty-changed", key);
  }

  cycleDifficulty() {
    const idx  = DIFFICULTY_ORDER.indexOf(this.difficulty);
    const next = DIFFICULTY_ORDER[(idx + 1) % DIFFICULTY_ORDER.length];
    this.setDifficulty(next);
  }

  getDifficultyConfig() { return DifficultyConfig[this.difficulty]; }

  startAutoPlay(count, target) {
    this.autoSpinsRemaining    = count;
    this.autoCashoutMultiplier = target || 99.0;
    this.isAutoPlaying         = true;
    this.emitter.emit("autoplay-started", count, this.autoCashoutMultiplier);
  }

  stopAutoPlay() {
    this.autoSpinsRemaining = 0;
    this.isAutoPlaying      = false;
    this.emitter.emit("autoplay-stopped");
  }

  decrementAutoSpins() {
    if (this.autoSpinsRemaining > 0) {
      this.autoSpinsRemaining--;
      this.emitter.emit("autoplay-updated", this.autoSpinsRemaining);
      if (this.autoSpinsRemaining <= 0) {
        this.stopAutoPlay();
      }
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────
  canAffordBet() { return this.bet <= this.balance; }

  // ── Subscription helpers ───────────────────────────────────────────────
  on(event,  cb) { this.emitter.on(event,  cb); }
  off(event, cb) { this.emitter.off(event, cb); }

  // ── Persistence (private) ──────────────────────────────────────────────
  _key(name) { return GAME_CONFIG.storageKeys[name]; }

  _loadNumber(name, fallback) {
    try {
      const v = window.localStorage?.getItem(this._key(name));
      const n = v == null ? NaN : Number(v);
      return Number.isFinite(n) ? n : fallback;
    } catch { return fallback; }
  }

  _loadString(name, fallback) {
    try {
      const v = window.localStorage?.getItem(this._key(name));
      return v == null ? fallback : String(v);
    } catch { return fallback; }
  }

  _saveNumber(name, v) {
    try { window.localStorage?.setItem(this._key(name), String(v)); } catch {}
  }

  _saveString(name, v) {
    try { window.localStorage?.setItem(this._key(name), String(v)); } catch {}
  }
}
