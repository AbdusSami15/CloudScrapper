const DifficultyConfig = {
  easy: {
    key:             "easy",
    displayName:     "Easy",
    startMultiplier: 1.01,
    growthRate:      0.01,
    badChance:       0.20
  },
  medium: {
    key:             "medium",
    displayName:     "Medium",
    startMultiplier: 1.5,
    growthRate:      0.02,
    badChance:       0.30
  },
  hard: {
    key:             "hard",
    displayName:     "Hard",
    startMultiplier: 2.0,
    growthRate:      0.03,
    badChance:       0.40
  },
  crazy: {
    key:             "crazy",
    displayName:     "Crazy",
    startMultiplier: 3.0,
    growthRate:      0.05,
    badChance:       0.55
  }
};

export const DIFFICULTY_ORDER = ["easy", "medium", "hard", "crazy"];

export default DifficultyConfig;
