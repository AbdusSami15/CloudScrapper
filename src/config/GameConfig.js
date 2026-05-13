export const GAME_CONFIG = Object.freeze({
  startingBalance: 1000,
  defaultBet:      10,
  minBet:          1,
  maxBet:          1000,
  betStep:         1,

  storageKeys: {
    balance:    "cloudscrapper_balance",
    bet:        "cloudscrapper_bet",
    difficulty: "cloudscrapper_difficulty",
    audioMuted: "cloudscrapper_audio_muted"
  },

  /** Master BGM level (linear 0–1). Slightly low so UI/SFX read clearly. */
  bgmVolume: 0.22,

  // UI / animation
  balanceTweenMs:  450,
  resultDelayMs:   2800
});
