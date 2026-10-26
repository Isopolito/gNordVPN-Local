import * as Constants from './constants.js';

export const FAST_POLL_SEC = 2;
export const FAST_POLL_WINDOW_MS = 30_000;

const TRANSITIONAL_STATES = new Set([
    Constants.states['CONNECTING'],
    Constants.states['DISCONNECTING'],
    Constants.states['RECONNECTING'],
    Constants.states['RESTARTING'],
    Constants.states['LOGGING_IN'],
    Constants.states['LOGGING_OUT'],
]);

export function isTransitional(stateName) {
    return TRANSITIONAL_STATES.has(stateName);
}

// Seconds to wait before the next status poll. Poll fast while the menu is open or while
// a transitional state has lasted less than FAST_POLL_WINDOW_MS, otherwise use the user's interval.
export function nextDelaySec({stateName, menuOpen, transitionalSinceMs, nowMs, userIntervalSec}) {
    if (menuOpen) return FAST_POLL_SEC;
    if (isTransitional(stateName) && transitionalSinceMs != null && nowMs - transitionalSinceMs < FAST_POLL_WINDOW_MS)
        return FAST_POLL_SEC;
    return userIntervalSec;
}
