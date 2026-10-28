import {nextDelaySec, isTransitional, FAST_POLL_SEC, FAST_POLL_WINDOW_MS} from '../../modules/RefreshPolicy.js';
import * as Constants from '../../modules/constants.js';

const S = Constants.states;
const USER = 30;
const NOW = 1_000_000;
const delay = (stateName, extra = {}) => nextDelaySec({
    stateName, menuOpen: false, transitionalSinceMs: NOW, nowMs: NOW, userIntervalSec: USER, ...extra,
});

describe('RefreshPolicy.nextDelaySec', () => {
    it('exports the fast-poll constants', () => {
        expect(FAST_POLL_SEC).toBe(2);
        expect(FAST_POLL_WINDOW_MS).toBe(30_000);
    });

    it.each([S.CONNECTING, S.DISCONNECTING, S.RECONNECTING, S.RESTARTING, S.LOGGING_IN, S.LOGGING_OUT])(
        'polls fast in transitional state %s', (state) => {
            expect(isTransitional(state)).toBe(true);
            expect(delay(state)).toBe(2);
        });

    it.each([S.CONNECTED, S.DISCONNECTED, S.ERROR, S.LOGGED_OUT, undefined])(
        'uses the user interval in non-transitional state %s', (state) => {
            expect(isTransitional(state)).toBe(false);
            expect(delay(state)).toBe(USER);
        });

    it('polls fast with the menu open in any state', () => {
        expect(delay(S.CONNECTED, {menuOpen: true})).toBe(2);
        expect(delay(S.ERROR, {menuOpen: true})).toBe(2);
    });

    it('menu open wins even after the transitional window has expired', () => {
        expect(delay(S.CONNECTING, {menuOpen: true, nowMs: NOW + 60_000})).toBe(2);
    });

    it('window boundary: 29.9s is fast, 30s falls back to the user interval', () => {
        expect(delay(S.CONNECTING, {nowMs: NOW + 29_900})).toBe(2);
        expect(delay(S.CONNECTING, {nowMs: NOW + 30_000})).toBe(USER);
    });

    it('passes the user interval through unchanged', () => {
        expect(delay(S.CONNECTED, {userIntervalSec: 7})).toBe(7);
        expect(delay(S.CONNECTED, {userIntervalSec: 120})).toBe(120);
    });

    it('treats a missing transitionalSinceMs as not fast', () => {
        expect(delay(S.CONNECTING, {transitionalSinceMs: null})).toBe(USER);
    });
});
