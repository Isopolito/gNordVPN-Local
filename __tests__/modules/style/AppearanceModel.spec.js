import {
    GROUPS, GROUP_OF, STATE_KEYS, SPACING_PRESETS, buildGroups, defaultModel, detectSpacing, normalize,
    parseStored, resolveState, serialize,
} from '../../../modules/style/AppearanceModel.js';
import * as Constants from '../../../modules/constants.js';

describe('group membership', () => {
    it('covers every state exactly once', () => {
        expect(Object.keys(GROUP_OF).sort()).toEqual(Object.keys(Constants.states).sort());
        expect(STATE_KEYS).toEqual(Object.keys(Constants.states));
    });

    it('has 5 groups with ERROR and LOGGED_OUT on their own', () => {
        expect(GROUPS).toEqual(['connected', 'transitioning', 'disconnected', 'error', 'loggedOut']);
        const transitioning = STATE_KEYS.filter(key => GROUP_OF[key] === 'transitioning');
        expect(transitioning).toEqual(['CONNECTING', 'DISCONNECTING', 'RECONNECTING', 'RESTARTING', 'LOGGING_IN', 'LOGGING_OUT']);
        expect(GROUP_OF.ERROR).toBe('error');
        expect(GROUP_OF.LOGGED_OUT).toBe('loggedOut');
    });
});

describe('resolveState', () => {
    it('returns the group value when there is no override', () => {
        const model = defaultModel();
        expect(resolveState(model, 'CONNECTED')).toEqual(model.groups.connected);
    });

    it('merges an override over the group, field by field', () => {
        const model = defaultModel();
        model.overrides.CONNECTING = {bg: 'red'};
        expect(resolveState(model, 'CONNECTING')).toEqual({...model.groups.transitioning, bg: 'red'});
        expect(resolveState(model, 'RESTARTING').bg).toBe(model.groups.transitioning.bg);
    });

    it('lets an override blank a field', () => {
        const model = defaultModel();
        model.overrides.ERROR = {bg: ''};
        expect(resolveState(model, 'ERROR').bg).toBe('');
    });
});

describe('buildGroups', () => {
    const stateValues = (texts) => Object.fromEntries(Object.entries(texts).map(([key, text]) => [key, {text}]));

    it('picks the most common value among members and overrides the rest', () => {
        const {groups, overrides} = buildGroups(stateValues({
            CONNECTING: 'a', DISCONNECTING: 'b', RECONNECTING: 'b', RESTARTING: 'b', LOGGING_IN: 'a', LOGGING_OUT: 'a',
        }));
        // a and b tie 3-3, so the earliest member's value wins
        expect(groups.transitioning.text).toBe('a');
        expect(overrides).toEqual({DISCONNECTING: {text: 'b'}, RECONNECTING: {text: 'b'}, RESTARTING: {text: 'b'}});
    });

    it('lets a strict majority win', () => {
        const {groups, overrides} = buildGroups(stateValues({
            CONNECTING: 'x', DISCONNECTING: 'y', RECONNECTING: 'y', RESTARTING: 'y', LOGGING_IN: 'x', LOGGING_OUT: 'y',
        }));
        expect(groups.transitioning.text).toBe('y');
        expect(overrides).toEqual({CONNECTING: {text: 'x'}, LOGGING_IN: {text: 'x'}});
    });

    it('creates no overrides when members agree', () => {
        expect(buildGroups({ERROR: {bg: 'r', fg: 'w'}}).overrides).toEqual({});
    });

    it('keeps the fallback for groups and fields nobody supplies', () => {
        const fallback = defaultModel().groups;
        const {groups} = buildGroups({ERROR: {bg: 'pink'}}, fallback);
        expect(groups.error).toEqual({...fallback.error, bg: 'pink'});
        expect(groups.connected).toEqual(fallback.connected);
    });
});

describe('detectSpacing', () => {
    it.each(Object.keys(SPACING_PRESETS))('recognises %s', (name) => {
        expect(detectSpacing(SPACING_PRESETS[name].padding, SPACING_PRESETS[name].margin)).toBe(name);
    });

    it('is custom when padding or margin differs', () => {
        const {padding, margin} = SPACING_PRESETS.normal;
        expect(detectSpacing({...padding, top: '5px'}, margin)).toBe('custom');
        expect(detectSpacing(padding, {...margin, left: '1px'})).toBe('custom');
    });

    it('has distinct presets and normal matches the old default CSS', () => {
        expect(new Set(Object.values(SPACING_PRESETS).map(p => JSON.stringify(p))).size).toBe(3);
        expect(SPACING_PRESETS.normal.padding).toEqual({top: '4px', right: '10px', bottom: '0', left: '10px'});
        expect(SPACING_PRESETS.normal.margin).toEqual({top: '3px', right: '0px', bottom: '3px', left: '0px'});
    });
});

describe('normalize and parseStored', () => {
    it('leaves a default model unchanged', () => {
        const model = defaultModel();
        expect(normalize(model)).toEqual(model);
    });

    it('round-trips through serialize and parseStored', () => {
        const model = defaultModel();
        model.advanced.common = 'opacity: 0.5;';
        model.advanced.states.ERROR = 'text-decoration: underline;';
        expect(parseStored(serialize(model))).toEqual(model);
    });

    it.each([[null], [undefined], [''], ['   '], ['{not json'], ['[]'], ['"str"'], ['{}'], ['{"version":2}'], ['{"version":"1"}']])(
        'parseStored returns null for %p', (input) => {
            expect(parseStored(input)).toBeNull();
        });

    it('fills missing and invalid fields with defaults', () => {
        const model = normalize({
            version: 1,
            shape: {corner: 'hexagon', bold: 'yes', border: {enabled: 1}, spacing: 'huge'},
            groups: {connected: {bg: 42, fg: 'blue'}, bogus: {}},
            overrides: {ERROR: 'nope', NOT_A_STATE: {bg: 'x'}, CONNECTING: {bg: 'green', extra: 1}},
            advanced: {common: 7, states: {ERROR: '   ', LOGGED_OUT: 'opacity: 1;'}},
        });
        const base = defaultModel();
        expect(model.shape.corner).toBe('pill');
        expect(model.shape.bold).toBe(true);
        expect(model.shape.border.enabled).toBe(false);
        expect(model.shape.spacing).toBe('normal');
        expect(model.groups.connected).toEqual({...base.groups.connected, fg: 'blue'});
        expect(model.groups.bogus).toBeUndefined();
        expect(model.overrides).toEqual({CONNECTING: {bg: 'green'}});
        expect(model.advanced).toEqual({common: '', states: {LOGGED_OUT: 'opacity: 1;'}});
    });

    it('applies a named spacing preset over stored sides, and keeps custom sides', () => {
        const compact = normalize({shape: {spacing: 'compact', padding: {top: '99px'}}});
        expect(compact.shape.padding).toEqual(SPACING_PRESETS.compact.padding);
        const custom = normalize({shape: {spacing: 'custom', padding: {top: '9px', right: '1px', bottom: '2px', left: '3px'}}});
        expect(custom.shape.spacing).toBe('custom');
        expect(custom.shape.padding.top).toBe('9px');
    });

    it('rejects values that could inject extra CSS declarations or rules', () => {
        const model = normalize({
            groups: {connected: {bg: 'red; position: fixed', fg: 'x } body { color: red'}},
            shape: {padding: {top: '1px; margin: 0'}, border: {color: 'red; x: y'}},
            overrides: {ERROR: {bg: 'a;b'}},
        });
        const base = defaultModel();
        expect(model.groups.connected.bg).toBe(base.groups.connected.bg);
        expect(model.groups.connected.fg).toBe(base.groups.connected.fg);
        expect(model.shape.padding.top).toBe(base.shape.padding.top);
        expect(model.shape.border.color).toBe('white');
        expect(model.overrides.ERROR).toBeUndefined();
    });
});
