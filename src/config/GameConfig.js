export const GAME_CONFIG = Object.freeze({
  startingBalance: 1000,
  defaultBet:      10,
  minBet:          1,
  maxBet:          1000,
  betStep:         1,

  storageKeys: {
    balance:    "cloudscrapper_balance",
    bet:        "cloudscrapper_bet",
    difficulty: "cloudscrapper_difficulty"
  },

  // UI / animation
  balanceTweenMs:  450,
  resultDelayMs:   2500
});
