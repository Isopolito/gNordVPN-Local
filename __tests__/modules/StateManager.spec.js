import StateManager from '../../modules/StateManager.js';
import * as Constants from '../../modules/constants.js';

globalThis.log = () => {};

const S = Constants.states;
const loggedIn = (connectStatus, extra = {}) => ({connectStatus, loggedin: true, country: 'N/A', city: 'N/A', currentServer: 'N/A', ...extra});

describe('StateManager.resolveState', () => {
    let sm;
    beforeEach(() => { sm = new StateManager(); });

    describe('state mapping', () => {
        it.each([
            [S.CONNECTED, {canConnect: false, canDisconnect: true, refreshTimeout: 30}],
            [S.CONNECTING, {canConnect: false, canDisconnect: true, refreshTimeout: 1}],
            [S.DISCONNECTED, {canConnect: true, canDisconnect: false, refreshTimeout: 10}],
            [S.DISCONNECTING, {canConnect: true, canDisconnect: false, refreshTimeout: 1}],
            [S.RECONNECTING, {canConnect: false, canDisconnect: true, refreshTimeout: 2}],
            [S.RESTARTING, {canConnect: false, canDisconnect: true, refreshTimeout: 10}],
            [S.LOGGING_IN, {canConnect: false, canDisconnect: false, showLists: false, refreshTimeout: 1}],
            [S.LOGGING_OUT, {canConnect: false, canDisconnect: false, showLists: false, refreshTimeout: 1}],
        ])('maps connectStatus %p', (connectStatus, expected) => {
            const resolved = sm.resolveState(loggedIn(connectStatus));
            expect(resolved.stateName).toBe(connectStatus);
            expect(resolved).toMatchObject(expected);
        });

        it('maps an unknown connectStatus to ERROR', () => {
            const resolved = sm.resolveState(loggedIn('N/A'));
            expect(resolved.stateName).toBe(S.ERROR);
            expect(resolved).toMatchObject({canConnect: true, canDisconnect: true, refreshTimeout: 5});
        });

        it('maps a null status (daemon not running) to ERROR', () => {
            expect(sm.resolveState(null).stateName).toBe(S.ERROR);
        });
    });

    describe('logged out', () => {
        it('forces LOGGED OUT regardless of connectStatus', () => {
            const resolved = sm.resolveState({connectStatus: S.CONNECTED, loggedin: false});
            expect(resolved.stateName).toBe(S.LOGGED_OUT);
            expect(resolved).toMatchObject({canConnect: false, canDisconnect: false, showLists: false, refreshTimeout: 10});
        });
    });

    describe('quick refresh', () => {
        it('overrides refreshTimeout with 1 second while on', () => {
            sm.setQuickRefresh(true);
            expect(sm.resolveState(loggedIn(S.CONNECTED)).refreshTimeout).toBe(1);
            sm.setQuickRefresh(false);
            expect(sm.resolveState(loggedIn(S.CONNECTED)).refreshTimeout).toBe(30);
        });

        it('does not mutate the shared state table', () => {
            sm.setQuickRefresh(true);
            sm.resolveState(loggedIn(S.CONNECTED));
            expect(sm.states[S.CONNECTED].refreshTimeout).toBe(30);
        });
    });

    describe('state override', () => {
        it('persists while nothing clears it', () => {
            sm.refreshOverride(S.CONNECTING);
            for (let i = 0; i < 3; i++) {
                expect(sm.resolveState(loggedIn(S.DISCONNECTED)).stateName).toBe(S.CONNECTING);
            }
            expect(sm.stateOverride).toBeDefined();
        });

        it('is cleared by a state whose clearsOverrideId matches (CONNECTED clears CONNECTING)', () => {
            sm.refreshOverride(S.CONNECTING);
            expect(sm.resolveState(loggedIn(S.CONNECTED)).stateName).toBe(S.CONNECTED);
            expect(sm.stateOverride).toBeUndefined();
        });

        it('is cleared by DISCONNECTED when the override is DISCONNECTING (id 2)', () => {
            sm.refreshOverride(S.DISCONNECTING);
            expect(sm.resolveState(loggedIn(S.DISCONNECTED)).stateName).toBe(S.DISCONNECTED);
            expect(sm.stateOverride).toBeUndefined();
        });

        it('is not cleared by a state with a different clearsOverrideId', () => {
            sm.refreshOverride(S.CONNECTING); // id 1
            expect(sm.resolveState(loggedIn(S.DISCONNECTED)).stateName).toBe(S.CONNECTING); // clears id 2
        });

        it('LOGGED OUT clears a logging-out override (id 3)', () => {
            sm.refreshOverride(S.LOGGING_OUT);
            const resolved = sm.resolveState({connectStatus: S.CONNECTED, loggedin: false});
            expect(resolved.stateName).toBe(S.LOGGED_OUT);
            expect(sm.stateOverride).toBeUndefined();
        });

        it('expires after STATE_OVERRIDE_DURATION resolves', () => {
            sm.refreshOverride(S.CONNECTING);
            const status = loggedIn(S.DISCONNECTED);
            for (let i = 0; i < sm.STATE_OVERRIDE_DURATION; i++) {
                expect(sm.resolveState(status).stateName).toBe(S.CONNECTING);
            }
            // The next resolve pushes the counter past the duration and clears it.
            expect(sm.resolveState(status).stateName).toBe(S.DISCONNECTED);
            expect(sm.stateOverride).toBeUndefined();
            expect(sm.stateOverrideCounter).toBe(0);
        });

        it('refreshOverride resets the counter', () => {
            sm.refreshOverride(S.CONNECTING);
            sm.resolveState(loggedIn(S.DISCONNECTED));
            sm.resolveState(loggedIn(S.DISCONNECTED));
            sm.refreshOverride(S.CONNECTING);
            expect(sm.stateOverrideCounter).toBe(0);
        });

        it('is not counted or cleared when the status is null', () => {
            sm.refreshOverride(S.CONNECTING);
            expect(sm.resolveState(null).stateName).toBe(S.ERROR);
            expect(sm.stateOverride).toBeDefined();
            expect(sm.stateOverrideCounter).toBe(0);
        });
    });

    describe('overrideKeys', () => {
        it('clears when the connected country matches (underscores become spaces)', () => {
            sm.refreshOverride(S.RECONNECTING, ['countries', 'United_States']);
            const status = loggedIn(S.CONNECTED, {country: 'United States'});
            // RECONNECTING has no overrideId clearing it, so only the key can clear it
            expect(sm.resolveState(loggedIn(S.DISCONNECTED, {country: 'Germany'})).stateName).toBe(S.RECONNECTING);
            expect(sm.resolveState(status).stateName).toBe(S.CONNECTED);
            expect(sm.stateOverride).toBeUndefined();
        });

        it('clears when the connected city matches', () => {
            sm.refreshOverride(S.RECONNECTING, ['cities', 'New_York']);
            expect(sm.resolveState(loggedIn(S.CONNECTED, {city: 'Boston'})).stateName).toBe(S.RECONNECTING);
            expect(sm.resolveState(loggedIn(S.CONNECTED, {city: 'New York'})).stateName).toBe(S.CONNECTED);
        });

        it('clears when the connected server matches (without .nordvpn.com)', () => {
            sm.refreshOverride(S.RECONNECTING, ['servers', 'us1234']);
            expect(sm.resolveState(loggedIn(S.CONNECTED, {currentServer: 'us9999.nordvpn.com'})).stateName).toBe(S.RECONNECTING);
            expect(sm.resolveState(loggedIn(S.CONNECTED, {currentServer: 'us1234.nordvpn.com'})).stateName).toBe(S.CONNECTED);
            expect(sm.stateOverride).toBeUndefined();
        });

        it('a non-matching key leaves the override active', () => {
            sm.refreshOverride(S.RECONNECTING, ['countries', 'France']);
            expect(sm.resolveState(loggedIn(S.CONNECTED, {country: 'Germany'})).stateName).toBe(S.RECONNECTING);
            expect(sm.stateOverride).toBeDefined();
        });
    });

    // Current behaviour, not endorsed: STATE_OVERRIDE_UNSET (-1) is used both as "this state clears
    // nothing" and "this override can't be cleared", so they compare equal. A RECONNECTING override
    // (used by every connect-to-location click) is dropped by any status whose clearsOverrideId is
    // -1 (CONNECTING, DISCONNECTING, RECONNECTING, RESTARTING, ERROR, LOGGING_*).
    it('a RECONNECTING override is cleared by a CONNECTING status because both use the -1 sentinel', () => {
        sm.refreshOverride(S.RECONNECTING);
        expect(sm.resolveState(loggedIn(S.CONNECTING)).stateName).toBe(S.CONNECTING);
        expect(sm.stateOverride).toBeUndefined();
    });

    // Documents a hazard in current behaviour, not endorsed: refreshOverride stores overrideKeys
    // on the shared entry in `states`, so keys leak into later overrides of the same state.
    it('overrideKeys set on a state persist on the shared state object', () => {
        sm.refreshOverride(S.RECONNECTING, ['countries', 'France']);
        expect(sm.states[S.RECONNECTING].overrideKeys).toEqual(['countries', 'France']);
    });
});
