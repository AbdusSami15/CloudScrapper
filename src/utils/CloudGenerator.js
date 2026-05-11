import DifficultyConfig from "../config/DifficultyConfig.js";
import { getMultiplier } from "./Multiplier.js";

const FAIL_TYPES = ["thunder", "burst", "lightning"];

/**
 * Shuffled-bag picker — guarantees:
 *   • Each fail type appears EXACTLY twice every 6 picks
 *   • Order within the bag is randomly shuffled (Fisher-Yates)
 *   • Same fail type cannot appear 3+ times in a row
 *
 * Bag is rebuilt-and-reshuffled when empty.  Using a bag of 6 (2× each)
 * instead of 3 (1× each) gives natural variety while still ensuring
 * mathematically equal long-term distribution.
 */
let _failBag = [];

function _refillBag() {
  _failBag = [...FAIL_TYPES, ...FAIL_TYPES];

  // Fisher-Yates shuffle
  for (let i = _failBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_failBag[i], _failBag[j]] = [_failBag[j], _failBag[i]];
  }

  // Optional: avoid the very-rare "same as last-picked" case at bag-boundary.
  // If the first item of the new bag matches what we popped last, swap it
  // with a random mid-bag item.
  if (_lastPicked && _failBag[_failBag.length - 1] === _lastPicked) {
    const swapIdx = Math.floor(Math.random() * (_failBag.length - 1));
    [_failBag[_failBag.length - 1], _failBag[swapIdx]] =
      [_failBag[swapIdx], _failBag[_failBag.length - 1]];
  }
}

let _lastPicked = null;

function getRandomFailType() {
  if (_failBag.length === 0) _refillBag();
  const pick = _failBag.pop();
  _lastPicked = pick;
  return pick;
}

export function createCloudData(stepIndex, difficultyKey, forceType = null) {
  const cfg  = DifficultyConfig[difficultyKey];
  const type = forceType || (Math.random() < cfg.badChance ? "bad" : "good");

  return {
    index:      stepIndex,
    type,
    failType:   type === "bad" ? getRandomFailType() : null,
    multiplier: getMultiplier(difficultyKey, stepIndex)
  };
}

// ── For testing / debugging ────────────────────────────────────────────────
export function _resetFailBag() {
  _failBag = [];
  _lastPicked = null;
}
