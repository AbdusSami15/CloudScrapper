import DifficultyConfig from "../config/DifficultyConfig.js";
import { getMultiplier } from "./Multiplier.js";

const FAIL_TYPES = ["thunder", "burst"];

function getRandomFailType() {
  return FAIL_TYPES[Phaser.Math.Between(0, FAIL_TYPES.length - 1)];
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