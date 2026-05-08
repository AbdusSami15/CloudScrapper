import DifficultyConfig from "../config/DifficultyConfig.js";

export function getMultiplier(difficultyKey, stepIndex) {
  const cfg = DifficultyConfig[difficultyKey];
  if (!cfg) return 1;

  const value = cfg.startMultiplier * Math.pow(1 + cfg.growthRate, stepIndex);
  return Number(value.toFixed(2));
}