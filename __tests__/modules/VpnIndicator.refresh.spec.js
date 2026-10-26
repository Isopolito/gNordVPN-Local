import {jest} from '@jest/globals';
import GLib from 'gi://GLib';

globalThis.log = () => {};
globalThis.logError = () => {};

// Controllable GLib: records every timeout_add_seconds delay and every Source.remove id.
const timers = {nextId: 100, added: [], removed: []};
GLib.PRIORITY_DEFAULT = 0;
GLib.SOURCE_REMOVE = false;
GLib.get_monotonic_time = () => 0;
GLib.timeout_add_seconds = (priority, delay, cb) => {
    const id = timers.nextId++;
    timers.added.push({id, delay, cb});
    return id;
};
GLib.Source = {remove: (id) => { timers.removed.push(id); }};

const {default: VpnIndicator} = await import('../../modules/VpnIndicator.js');
const {default: StateManager} = await import('../../modules/StateManager.js');
const Constants = await import('../../modules/constants.js');

const delays = () => timers.added.map(t => t.delay);
const lastDelay = () => timers.added[timers.added.length - 1].delay;

const REFRESH_TIMEOUT = 30;

function makeStatus(connectStatus, overrides = {}) {
    return {
        running: true, connectStatus, country: 'N/A', city: 'N/A', currentServer: 'N/A', serverIp: 'N/A',
        currentTech: 'N/A', currentProtocol: 'N/A', transfer: 'N/A', uptime: 'N/A', ...overrides,
    };
}

function createIndicator({status = makeStatus(Constants.states.DISCONNECTED), loggedIn = true} = {}) {
    const extension = {
        getSettings: () => ({get_value: (k) => ({unpack: () => (k === 'refresh-timeout' ? REFRESH_TIMEOUT : undefined)})}),
    };
    const indicator = new VpnIndicator(extension);
    const menuStub = () => ({tryBuild: jest.fn(async () => {}), showHide: jest.fn()});
    indicator._vpn = {getStatus: jest.fn(async () => ({...status}))};
    indicator._stateManager = new StateManager();
    indicator._panelIcon = {update: jest.fn(), updateStyle: jest.fn()};
    indicator._countryMenu = menuStub();
    indicator._cityMenu = menuStub();
    indicator._serverMenu = menuStub();
    indicator._isLoggedIn = loggedIn;
    return indicator;
}

beforeEach(() => {
    timers.nextId = 100;
    timers.added.length = 0;
    timers.removed.length = 0;
});

describe('VpnIndicator._refresh', () => {
    it('reads the refresh-timeout setting in the constructor', () => {
        expect(createIndicator()._refreshTimeoutInSec).toBe(REFRESH_TIMEOUT);
    });

    it('updates the panel with the resolved state', async () => {
        const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTED)});
        await indicator._refresh();
        const arg = indicator._panelIcon.update.mock.calls[0][0];
        expect(arg.currentState.stateName).toBe(Constants.states.CONNECTED);
        expect(arg.loggedin).toBe(true);
    });

    it('resolves LOGGED OUT when the indicator is not logged in', async () => {
        const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTED), loggedIn: false});
        await indicator._refresh();
        expect(indicator._panelIcon.update.mock.calls[0][0].currentState.stateName).toBe(Constants.states.LOGGED_OUT);
    });

    it('resolves ERROR (state null) when the daemon is not running', async () => {
        const indicator = createIndicator({status: makeStatus('N/A', {running: false})});
        await indicator._refresh();
        expect(indicator._panelIcon.update.mock.calls[0][0].currentState.stateName).toBe(Constants.states.ERROR);
        expect(indicator._lastKnownRunning).toBe(false);
    });

    describe('scheduling the next poll', () => {
        it.each([
            [Constants.states.CONNECTED, REFRESH_TIMEOUT],
            [Constants.states.DISCONNECTED, REFRESH_TIMEOUT],
            [Constants.states.CONNECTING, 2],
            [Constants.states.DISCONNECTING, 2],
            [Constants.states.RECONNECTING, 2],
        ])('schedules the policy delay for %s', async (connectStatus, expected) => {
            const indicator = createIndicator({status: makeStatus(connectStatus)});
            await indicator._refresh();
            expect(delays()).toEqual([expected]);
        });

        it('keeps polling every 2s while Connecting for 30s, then uses the user interval', async () => {
            jest.useFakeTimers({now: 1_000_000});
            try {
                const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTING)});
                await indicator._refresh();
                expect(lastDelay()).toBe(2);
                jest.setSystemTime(1_000_000 + 29_900);
                await indicator._refresh();
                expect(lastDelay()).toBe(2);
                jest.setSystemTime(1_000_000 + 30_000);
                await indicator._refresh();
                expect(lastDelay()).toBe(REFRESH_TIMEOUT);
            } finally {
                jest.useRealTimers();
            }
        });

        it('restarts the fast window when the state leaves and re-enters a transitional state', async () => {
            jest.useFakeTimers({now: 1_000_000});
            try {
                const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTING)});
                await indicator._refresh();
                jest.setSystemTime(1_000_000 + 40_000);
                indicator._vpn.getStatus = jest.fn(async () => makeStatus(Constants.states.CONNECTED));
                await indicator._refresh();
                expect(indicator._transitionalSince).toBeNull();
                indicator._vpn.getStatus = jest.fn(async () => makeStatus(Constants.states.CONNECTING));
                await indicator._refresh();
                expect(lastDelay()).toBe(2);
            } finally {
                jest.useRealTimers();
            }
        });

        it('polls every 2s while the menu is open and returns to the user interval on close', async () => {
            const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTED)});
            indicator._setQuickRefresh(true);
            await flush(); // let the un-awaited _refresh() inside _setQuickRefresh finish
            expect(lastDelay()).toBe(2);
            indicator._setQuickRefresh(false);
            await flush();
            expect(lastDelay()).toBe(REFRESH_TIMEOUT);
        });

        it('reports the computed delay in the _refresh SPAN log', async () => {
            const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTING)});
            const spy = jest.spyOn(indicator._log, 'endTimer');
            await indicator._refresh();
            expect(spy.mock.calls[0][2]).toMatchObject({operation: '_refresh', nextDelay: 2});
        });

        it('picks up a changed refresh-timeout setting for the next poll', async () => {
            const indicator = createIndicator();
            indicator._refreshTimeoutInSec = 12;
            await indicator._refresh();
            expect(lastDelay()).toBe(12);
        });

        it('clamps the delay to at least 1 second', async () => {
            const indicator = createIndicator();
            indicator._refreshTimeoutInSec = 0;
            await indicator._refresh();
            expect(lastDelay()).toBe(1);
        });

        it('removes the pending timer before polling and stores the new one', async () => {
            const indicator = createIndicator();
            await indicator._refresh();
            const first = indicator._timeout;
            expect(first).toBe(100);
            await indicator._refresh();
            expect(timers.removed).toEqual([first]);
            expect(indicator._timeout).toBe(101);
        });

        it('the timer callback runs _refresh once and does not repeat', async () => {
            const indicator = createIndicator();
            await indicator._refresh();
            const spy = jest.spyOn(indicator, '_refresh');
            const result = timers.added[0].cb();
            expect(result).toBe(GLib.SOURCE_REMOVE);
            expect(spy).toHaveBeenCalledTimes(1);
            await flush();
        });

        it('does not schedule after the indicator is destroyed', async () => {
            const indicator = createIndicator();
            indicator._isDestroyed = true;
            await indicator._refresh();
            expect(timers.added).toEqual([]);
            expect(indicator._vpn.getStatus).not.toHaveBeenCalled();
        });

        it('does not update or schedule if destroyed while getStatus is in flight', async () => {
            const indicator = createIndicator();
            indicator._vpn.getStatus = jest.fn(async () => { indicator._isDestroyed = true; return makeStatus('N/A'); });
            await indicator._refresh();
            expect(indicator._panelIcon.update).not.toHaveBeenCalled();
            expect(timers.added).toEqual([]);
        });
    });

    describe('in-flight guard', () => {
        it('runs a second _refresh requested while one is in flight exactly once afterwards', async () => {
            const indicator = createIndicator();
            const releases = [];
            indicator._vpn.getStatus = jest.fn(() => new Promise(res => { releases.push(() => res(makeStatus(Constants.states.DISCONNECTED))); }));

            const first = indicator._refresh();
            await indicator._refresh(); // deferred, not dropped
            await indicator._refresh(); // coalesced with the one above
            expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(1);
            expect(indicator._isRefreshing).toBe(true);
            expect(indicator._pendingRefresh).toBe(true);

            releases[0]();
            await first;
            await flush();
            expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(2);
            releases[1]();
            await flush();
            expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(2);
            expect(indicator._pendingRefresh).toBe(false);
        });

        it('a deferred call does not clear the in-flight flag or schedule a stray timer', async () => {
            const indicator = createIndicator();
            let release;
            indicator._vpn.getStatus = jest.fn(() => new Promise(res => { release = () => res(makeStatus(Constants.states.DISCONNECTED)); }));

            const first = indicator._refresh();
            await indicator._refresh();
            expect(indicator._isRefreshing).toBe(true);
            expect(timers.added).toHaveLength(0);

            release();
            await first;
            await flush();
            // Only the follow-up refresh (still pending here) has not scheduled yet: no timer leaks.
            expect(timers.added.every(t => timers.removed.includes(t.id) || t.id === indicator._timeout)).toBe(true);
        });

        it('leaves exactly one live timer after overlapping refreshes settle', async () => {
            const indicator = createIndicator();
            const first = indicator._refresh();
            indicator._refresh();
            indicator._refresh();
            await first;
            await flush();
            await flush();
            const live = timers.added.filter(t => !timers.removed.includes(t.id));
            expect(live).toHaveLength(1);
            expect(live[0].id).toBe(indicator._timeout);
        });

        it('_setTimeout removes an existing timer before scheduling a new one', () => {
            const indicator = createIndicator();
            indicator._setTimeout(5);
            const first = indicator._timeout;
            indicator._setTimeout(5);
            expect(timers.removed).toEqual([first]);
            expect(indicator._timeout).not.toBe(first);
        });

        it('an _overrideRefresh during a refresh sets the override and its follow-up refresh runs', async () => {
            const indicator = createIndicator();
            const releases = [];
            indicator._vpn.getStatus = jest.fn(() => new Promise(res => { releases.push(() => res(makeStatus(Constants.states.DISCONNECTED))); }));

            const first = indicator._refresh();
            indicator._overrideRefresh(Constants.status.connecting);
            expect(indicator._stateManager.stateOverride.stateName).toBe(Constants.states.CONNECTING);

            releases[0]();
            await first;
            await flush();
            expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(2);
            releases[1]();
            await flush();
            expect(indicator._panelIcon.update.mock.calls.at(-1)[0].currentState.stateName).toBe(Constants.states.CONNECTING);
        });

        it('clears the in-flight flag after completion', async () => {
            const indicator = createIndicator();
            await indicator._refresh();
            expect(indicator._isRefreshing).toBe(false);
        });
    });

    describe('pending refresh', () => {
        it('runs an immediate follow-up refresh instead of scheduling a timer', async () => {
            const indicator = createIndicator();
            let calls = 0;
            indicator._vpn.getStatus = jest.fn(async () => {
                calls++;
                if (calls === 1) indicator._pendingRefresh = true;
                return makeStatus(Constants.states.DISCONNECTED);
            });
            await indicator._refresh();
            await flush();
            expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(2);
            expect(indicator._pendingRefresh).toBe(false);
            // Only the follow-up schedules the timer.
            expect(timers.added).toHaveLength(1);
        });
    });

    describe('style changes', () => {
        it('re-render from the cached status without calling getStatus', async () => {
            const settingsHandlers = [];
            const indicator = createIndicator({status: makeStatus(Constants.states.CONNECTED)});
            indicator._extSettings = {connect: (_, cb) => { settingsHandlers.push(cb); return 1; }};
            indicator._connectChanged();
            await indicator._refresh();
            indicator._vpn.getStatus.mockClear();
            indicator._panelIcon.update.mockClear();

            settingsHandlers[0]({}, 'panel-styles');
            settingsHandlers[0]({}, 'common-panel-style');
            expect(indicator._panelIcon.updateStyle).toHaveBeenCalledTimes(2);
            expect(indicator._panelIcon.update).toHaveBeenCalledTimes(2);
            expect(indicator._panelIcon.update.mock.calls[0][0]).toBe(indicator._lastStatus);
            expect(indicator._vpn.getStatus).not.toHaveBeenCalled();
        });

        it('only restyle (no render) before the first status arrives', () => {
            const settingsHandlers = [];
            const indicator = createIndicator();
            indicator._extSettings = {connect: (_, cb) => { settingsHandlers.push(cb); return 1; }};
            indicator._connectChanged();
            settingsHandlers[0]({}, 'panel-styles');
            expect(indicator._panelIcon.updateStyle).toHaveBeenCalledTimes(1);
            expect(indicator._panelIcon.update).not.toHaveBeenCalled();
            expect(indicator._vpn.getStatus).not.toHaveBeenCalled();
        });
    });

    describe('failure backoff', () => {
        it('adds 5s, then doubles up to a 60s cap, on consecutive failures', async () => {
            const indicator = createIndicator();
            indicator._vpn.getStatus = jest.fn(async () => { throw new Error('spawn failed'); });
            const seen = [];
            for (let i = 0; i < 6; i++) {
                await indicator._refresh();
                seen.push(indicator._refreshBackoffSec);
            }
            expect(seen).toEqual([5, 10, 20, 40, 60, 60]);
            // delay = refresh-timeout + backoff
            expect(delays()).toEqual([35, 40, 50, 70, 90, 90]);
        });

        it('does not update the panel on failure', async () => {
            const indicator = createIndicator();
            indicator._vpn.getStatus = jest.fn(async () => { throw new Error('x'); });
            await indicator._refresh();
            expect(indicator._panelIcon.update).not.toHaveBeenCalled();
        });

        it('resets the backoff after a successful refresh', async () => {
            const indicator = createIndicator();
            indicator._refreshBackoffSec = 40;
            await indicator._refresh();
            expect(indicator._refreshBackoffSec).toBe(0);
            expect(lastDelay()).toBe(REFRESH_TIMEOUT);
        });
    });

    describe('throttled menu build', () => {
        it('builds the three menus on the first successful refresh', async () => {
            const indicator = createIndicator();
            await indicator._refresh();
            expect(indicator._countryMenu.tryBuild).toHaveBeenCalledWith(true);
            expect(indicator._cityMenu.tryBuild).toHaveBeenCalledWith(true);
            expect(indicator._serverMenu.tryBuild).toHaveBeenCalledWith(true);
        });

        it('does not rebuild within the 30s window', async () => {
            const indicator = createIndicator();
            await indicator._refresh();
            await indicator._refresh();
            expect(indicator._countryMenu.tryBuild).toHaveBeenCalledTimes(1);
        });

        it('does not build when the daemon is not running (ERROR state)', async () => {
            const indicator = createIndicator({status: makeStatus('N/A', {running: false})});
            await indicator._refresh();
            expect(indicator._countryMenu.tryBuild).not.toHaveBeenCalled();
            expect(indicator._lastMenuBuild).toBeNull();
        });
    });
});

async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}
