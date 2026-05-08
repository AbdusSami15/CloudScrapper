/**
 * Cloud Scrapper round-state machine.
 *
 * Lifecycle:
 *   BETTING ──(PLAY)──► STARTING ──► READY ──(JUMP)──► JUMPING
 *                                       ▲                │
 *                                       │      LANDED_GOOD
 *                                       └────────┘
 *                                       │
 *                                       ▼
 *                                    CASHOUT ──► RESULT ──► BETTING
 *                                       │
 *                                  LANDED_BAD ──► RESULT ──► BETTING
 */
export const GAME_STATES = Object.freeze({
  BETTING:      "BETTING",      // pre-round, can change bet/difficulty
  STARTING:     "STARTING",     // bet deducted, round being set up
  READY:        "READY",        // sitting on a cloud, awaiting jump or cashout
  JUMPING:      "JUMPING",      // mid-air, awaiting landing
  LANDED_GOOD:  "LANDED_GOOD",  // success animation playing
  LANDED_BAD:   "LANDED_BAD",   // fail animation playing
  CASHOUT:      "CASHOUT",      // player chose to collect winnings
  RESULT:       "RESULT"        // result modal visible
});

/**
 * Map of allowed transitions: { fromState: [...allowedNextStates] }
 * Any transition not listed is rejected by GameManager.setState().
 */
export const LEGAL_TRANSITIONS = Object.freeze({
  [GAME_STATES.BETTING]:     [GAME_STATES.STARTING],
  [GAME_STATES.STARTING]:    [GAME_STATES.READY, GAME_STATES.RESULT],
  [GAME_STATES.READY]:       [GAME_STATES.JUMPING, GAME_STATES.CASHOUT],
  [GAME_STATES.JUMPING]:     [GAME_STATES.LANDED_GOOD, GAME_STATES.LANDED_BAD],
  [GAME_STATES.LANDED_GOOD]: [GAME_STATES.READY, GAME_STATES.CASHOUT],
  [GAME_STATES.LANDED_BAD]:  [GAME_STATES.RESULT],
  [GAME_STATES.CASHOUT]:     [GAME_STATES.RESULT],
  [GAME_STATES.RESULT]:      [GAME_STATES.BETTING]
});

/** Convenience: states in which mid-round controls (bet/difficulty) must be locked. */
export const LOCKED_STATES = new Set([
  GAME_STATES.STARTING,
  GAME_STATES.READY,
  GAME_STATES.JUMPING,
  GAME_STATES.LANDED_GOOD,
  GAME_STATES.LANDED_BAD,
  GAME_STATES.CASHOUT,
  GAME_STATES.RESULT
]);
