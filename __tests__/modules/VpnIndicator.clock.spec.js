import {jest} from '@jest/globals';
import GLib from 'gi://GLib';

globalThis.log = () => {};
globalThis.logError = () => {};

// Controllable GLib: the 1s tick is driven by hand and the monotonic clock is set by the test.
const timers = {nextId: 100, active: new Map(), removed: []};
let nowUs = 0;
GLib.PRIORITY_DEFAULT = 0;
GLib.SOURCE_REMOVE = false;
GLib.SOURCE_CONTINUE = true;
GLib.get_monotonic_time = () => nowUs;
GLib.timeout_add_seconds = (priority, delay, cb) => {
    const id = timers.nextId++;
    timers.active.set(id, {delay, cb});
    return id;
};
GLib.Source = {remove: (id) => { timers.removed.push(id); timers.active.delete(id); }};

const {default: VpnIndicator} = await import('../../modules/VpnIndicator.js');
const {default: StateManager} = await import('../../modules/StateManager.js');
const Constants = await import('../../modules/constants.js');

const flush = () => new Promise(res => setImmediate(res));
const TEMPLATE = '{uptimeHr}:{uptimeMin}:{uptimeSec}';

// The 1s clock source is the active timer with delay 1 (the poll timer uses the refresh interval).
const clockEntry = () => [...timers.active.values()].find(t => t.delay === 1);
const tick = (seconds = 1) => {
    nowUs += seconds * 1_000_000;
    const entry = clockEntry();
    const keep = entry.cb();
    if (keep === GLib.SOURCE_REMOVE) timers.active.delete([...timers.active].find(([, t]) => t === entry)[0]);
};
const lastUptimeArg = (indicator) => {
    const calls = indicator._panelIcon.update.mock.calls;
    return calls[calls.length - 1][1];
};

function makeStatus(connectStatus, uptime = 'N/A') {
    return {
        running: true, connectStatus, country: 'N/A', city: 'N/A', currentServer: 'N/A', serverIp: 'N/A',
        currentTech: 'N/A', currentProtocol: 'N/A', transfer: 'N/A', uptime,
    };
}

function createIndicator(template = TEMPLATE) {
    const extension = {
        getSettings: () => ({
            get_value: (k) => ({unpack: () => (k === 'refresh-timeout' ? 30 : undefined)}),
            connect: jest.fn(() => 1),
        }),
    };
    const indicator = new VpnIndicator(extension);
    const menuStub = () => ({tryBuild: jest.fn(async () => {}), showHide: jest.fn()});
    indicator._vpn = {getStatus: jest.fn(async () => makeStatus(Constants.states.CONNECTED, '1 minute'))};
    indicator._stateManager = new StateManager();
    indicator._panelIcon = {
        update: jest.fn(), updateStyle: jest.fn(),
        getTemplate: jest.fn(() => indicator._template),
    };
    indicator._template = template;
    indicator._countryMenu = menuStub();
    indicator._cityMenu = menuStub();
    indicator._serverMenu = menuStub();
    indicator._isLoggedIn = true;
    return indicator;
}

const poll = async (indicator, status) => {
    indicator._vpn.getStatus = jest.fn(async () => status);
    await indicator._refresh();
};

beforeEach(() => {
    timers.nextId = 100;
    timers.active.clear();
    timers.removed.length = 0;
    nowUs = 5_000_000;
});

describe('VpnIndicator uptime clock', () => {
    it('ticks the label every second without calling getStatus', async () => {
        const indicator = createIndicator();
        await indicator._refresh();
        expect(lastUptimeArg(indicator)).toBe(60);
        expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(1);

        tick();
        expect(lastUptimeArg(indicator)).toBe(61);
        tick();
        expect(lastUptimeArg(indicator)).toBe(62);
        tick(3);
        expect(lastUptimeArg(indicator)).toBe(65);
        expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(1);
        // The tick re-renders the cached status.
        const calls = indicator._panelIcon.update.mock.calls;
        expect(calls[calls.length - 1][0]).toBe(indicator._lastStatus);
    });

    it('runs a single 1s timer across repeated polls', async () => {
        const indicator = createIndicator();
        await indicator._refresh();
        await indicator._refresh();
        expect([...timers.active.values()].filter(t => t.delay === 1)).toHaveLength(1);
    });

    it('does not resync, and never steps backwards, when a poll differs by 1s', async () => {
        const indicator = createIndicator();
        await indicator._refresh(); // sync at 60
        tick(10);                   // estimate 70
        await poll(indicator, makeStatus(Constants.states.CONNECTED, '1 minute 9 seconds')); // 69, 1s behind
        expect(lastUptimeArg(indicator)).toBe(70);
        await poll(indicator, makeStatus(Constants.states.CONNECTED, '1 minute 11 seconds')); // 71, 1s ahead
        expect(lastUptimeArg(indicator)).toBe(70);
        tick();
        expect(lastUptimeArg(indicator)).toBe(71);
    });

    it('resyncs when a poll differs by 2s or more', async () => {
        const indicator = createIndicator();
        await indicator._refresh(); // 60
        tick(10);                   // 70
        await poll(indicator, makeStatus(Constants.states.CONNECTED, '1 minute 12 seconds')); // 72
        expect(lastUptimeArg(indicator)).toBe(72);
        await poll(indicator, makeStatus(Constants.states.CONNECTED, '30 seconds')); // reset, 42 behind 72
        expect(lastUptimeArg(indicator)).toBe(30);
        tick();
        expect(lastUptimeArg(indicator)).toBe(31);
    });

    it('stops the timer on disconnect and starts fresh on reconnect', async () => {
        const indicator = createIndicator();
        await indicator._refresh();
        const id = indicator._uptimeTimer;
        expect(id).not.toBeNull();

        await poll(indicator, makeStatus(Constants.states.DISCONNECTED));
        expect(timers.removed).toContain(id);
        expect(clockEntry()).toBeUndefined();
        expect(indicator._uptimeTimer).toBeNull();
        expect(lastUptimeArg(indicator)).toBeUndefined();

        await poll(indicator, makeStatus(Constants.states.CONNECTED, '5 seconds'));
        expect(clockEntry()).toBeDefined();
        expect(lastUptimeArg(indicator)).toBe(5);
    });

    it('does not start when the template has no uptime tokens', async () => {
        const indicator = createIndicator('{city}, {country}');
        await indicator._refresh();
        expect(clockEntry()).toBeUndefined();
        expect(indicator._uptimeTimer).toBeNull();
    });

    it('does not start when the polled uptime is missing', async () => {
        const indicator = createIndicator();
        await poll(indicator, makeStatus(Constants.states.CONNECTED, 'N/A'));
        expect(clockEntry()).toBeUndefined();
    });

    it('stops when a template change removes the tokens and restarts when they return', async () => {
        const indicator = createIndicator();
        await indicator._refresh();
        expect(clockEntry()).toBeDefined();

        indicator._template = '{city}';
        indicator._connectChanged();
        // Drive the settings handler the way GSettings would.
        const handler = indicator._extSettings.connect.mock.calls[0][1];
        handler(indicator._extSettings, 'panel-styles');
        expect(indicator._panelIcon.updateStyle).toHaveBeenCalled();
        expect(clockEntry()).toBeUndefined();
        expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(1);

        indicator._template = '{uptime}';
        handler(indicator._extSettings, 'common-panel-style');
        expect(clockEntry()).toBeDefined();
        expect(indicator._vpn.getStatus).toHaveBeenCalledTimes(1);
    });

    it('stops the timer in disable()', async () => {
        const indicator = createIndicator();
        await indicator._refresh();
        const id = indicator._uptimeTimer;
        indicator._commonFavorite = {disable: jest.fn()};
        indicator._countryMenu.disable = jest.fn();
        indicator._cityMenu.disable = jest.fn();
        indicator._serverMenu.disable = jest.fn();
        indicator._signals = {disconnectAll: jest.fn()};
        indicator.disable();
        expect(timers.removed).toContain(id);
        expect(clockEntry()).toBeUndefined();
        await flush();
    });
});
