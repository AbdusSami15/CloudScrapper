import DifficultyConfig from "../config/DifficultyConfig.js";
import { getMultiplier } from "./Multiplier.js";

const FAIL_TYPES = ["thunder", "burst", "lightning"];

function getRandomFailType() {
  const r = Math.random();
  if (r < 0.33) return FAIL_TYPES[0]; // thunder
  if (r < 0.66) return FAIL_TYPES[1]; // burst
  return FAIL_TYPES[2];               // lightning
}

export function createCloudData(stepIndex, difficultyKey, forceType = null) {
  const cfg = DifficultyConfig[difficultyKey];
  const type = forceType || (Math.random() < cfg.badChance ? "bad" : "good");

  return {
    index: stepIndex,
    type,
    failType: type === "bad" ? getRandomFailType() : null,
    multiplier: getMultiplier(difficultyKey, stepIndex)
  };
}