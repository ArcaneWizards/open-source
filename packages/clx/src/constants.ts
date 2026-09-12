export const CLX_PORT = 3650;
export const CLX_SERVER_PORT = 7000;
export const CLX_DECK_FPS = 60;

/**
 * How much of a difference between the calculated timecode state,
 * and previous timecode state is required to trigger an update.
 */
export const CLX_MINIMUM_DRIFT_FOR_UPDATE_MS = 500 / CLX_DECK_FPS;

/**
 * How many frames need to be missed before we consider a timecode to be lagging.
 */
export const CLX_LAGGING_FRAME_COUNT = 2;

/**
 * If we haven't received a timecode update for this amount of time,
 * consider the timecode to be lagging
 */
export const CLX_LAGGING_TIMEOUT_MS =
  (1000 / CLX_DECK_FPS) * CLX_LAGGING_FRAME_COUNT;
