import * as Constants from '../constants.js';

export const MODEL_VERSION = 1;

export const GROUPS = ['connected', 'transitioning', 'disconnected', 'error', 'loggedOut'];
export const STATE_KEYS = Object.keys(Constants.states);

export const GROUP_OF = {
    'CONNECTED': 'connected',
    'CONNECTING': 'transitioning',
    'DISCONNECTING': 'transitioning',
    'RECONNECTING': 'transitioning',
    'RESTARTING': 'transitioning',
    'LOGGING_IN': 'transitioning',
    'LOGGING_OUT': 'transitioning',
    'DISCONNECTED': 'disconnected',
    'ERROR': 'error',
    'LOGGED_OUT': 'loggedOut',
};

export const CORNERS = {pill: '100px', rounded: '5px', square: '0'};
export const SIDES = ['top', 'right', 'bottom', 'left'];
export const FIELDS = ['text', 'bg', 'fg'];

export const SPACING_PRESETS = {
    compact: {
        padding: {top: '0px', right: '6px', bottom: '0', left: '6px'},
        margin: {top: '2px', right: '0px', bottom: '2px', left: '0px'},
    },
    normal: {
        padding: {top: '0px', right: '10px', bottom: '0', left: '10px'},
        margin: {top: '3px', right: '0px', bottom: '3px', left: '0px'},
    },
    roomy: {
        padding: {top: '0px', right: '14px', bottom: '0', left: '14px'},
        margin: {top: '4px', right: '0px', bottom: '4px', left: '0px'},
    },
};

export const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// A CSS value that can't terminate its declaration or open a rule.
const SAFE_VALUE = /^[^;{}\n\r]*$/;
const cleanValue = (value, fallback) => (typeof value === 'string' && SAFE_VALUE.test(value)) ? value.trim() : fallback;

// Looks like today's schema defaults: Large text with the Traffic light theme.
export function defaultModel() {
    const amber = {bg: 'rgba(255,191,0,0.7)', fg: 'rgba(255,255,255,1)'};
    return {
        version: MODEL_VERSION,
        shape: {
            corner: 'pill',
            bold: true,
            border: {enabled: false, color: 'white'},
            spacing: 'normal',
            padding: {...SPACING_PRESETS.normal.padding},
            margin: {...SPACING_PRESETS.normal.margin},
        },
        groups: {
            connected: {text: '{country} #{number}', bg: 'rgba(0,255,0,0.7)', fg: 'rgba(255,255,255,1)'},
            transitioning: {text: 'CONNECTING', ...amber},
            disconnected: {text: 'DISCONNECTED', bg: 'rgba(255,0,0,0.7)', fg: 'rgba(255,255,255,1)'},
            error: {text: 'ERROR', bg: 'rgba(255,0,0,0.7)', fg: 'rgba(255,255,255,1)'},
            loggedOut: {text: 'LOGGED OUT', bg: 'rgba(48,26,208,0.7)', fg: 'rgba(255,255,255,1)'},
        },
        overrides: {
            DISCONNECTING: {text: 'DISCONNECTING'},
            RECONNECTING: {text: 'RECONNECTING'},
            RESTARTING: {text: 'RESTARTING'},
            LOGGING_IN: {text: 'LOGGING IN'},
            LOGGING_OUT: {text: 'LOGGING OUT'},
        },
        advanced: {common: '', states: {}},
    };
}

export function sidesEqual(a, b) {
    return SIDES.every(side => a[side] === b[side]);
}

// 'compact' | 'normal' | 'roomy' when padding and margin match a preset exactly, else 'custom'.
export function detectSpacing(padding, margin) {
    const hit = Object.keys(SPACING_PRESETS).find(name =>
        sidesEqual(SPACING_PRESETS[name].padding, padding) && sidesEqual(SPACING_PRESETS[name].margin, margin));
    return hit ?? 'custom';
}

function normalizeSides(raw, fallback) {
    const source = isObject(raw) ? raw : {};
    const sides = {};
    SIDES.forEach(side => {
        const value = cleanValue(source[side], fallback[side]);
        sides[side] = value === '' ? fallback[side] : value;
    });
    return sides;
}

function normalizeColors(raw, fallback) {
    const source = isObject(raw) ? raw : {};
    return {
        text: typeof source.text === 'string' ? source.text : fallback.text,
        bg: cleanValue(source.bg, fallback.bg),
        fg: cleanValue(source.fg, fallback.fg),
    };
}

// Returns a well-formed model from a possibly partial one. Anything invalid falls back to the default.
export function normalize(raw) {
    const base = defaultModel();
    const source = isObject(raw) ? raw : {};
    const shape = isObject(source.shape) ? source.shape : {};
    const border = isObject(shape.border) ? shape.border : {};

    let padding = normalizeSides(shape.padding, base.shape.padding);
    let margin = normalizeSides(shape.margin, base.shape.margin);
    let spacing = shape.spacing;
    if (spacing === 'custom') {
        // keep the custom sides
    } else if (Object.hasOwn(SPACING_PRESETS, spacing)) {
        padding = {...SPACING_PRESETS[spacing].padding};
        margin = {...SPACING_PRESETS[spacing].margin};
    } else {
        spacing = detectSpacing(padding, margin);
    }

    const groups = {};
    GROUPS.forEach(group => {
        groups[group] = normalizeColors(isObject(source.groups) ? source.groups[group] : null, base.groups[group]);
    });

    const overrides = {};
    if (isObject(source.overrides)) {
        STATE_KEYS.forEach(key => {
            const entry = source.overrides[key];
            if (!isObject(entry)) return;
            const clean = {};
            if (typeof entry.text === 'string') clean.text = entry.text;
            if (typeof entry.bg === 'string' && SAFE_VALUE.test(entry.bg)) clean.bg = entry.bg.trim();
            if (typeof entry.fg === 'string' && SAFE_VALUE.test(entry.fg)) clean.fg = entry.fg.trim();
            if (Object.keys(clean).length) overrides[key] = clean;
        });
    }

    const advanced = isObject(source.advanced) ? source.advanced : {};
    const states = {};
    if (isObject(advanced.states)) {
        STATE_KEYS.forEach(key => {
            if (typeof advanced.states[key] === 'string' && advanced.states[key].trim() !== '')
                states[key] = advanced.states[key];
        });
    }

    return {
        version: MODEL_VERSION,
        shape: {
            corner: Object.hasOwn(CORNERS, shape.corner) ? shape.corner : base.shape.corner,
            bold: typeof shape.bold === 'boolean' ? shape.bold : base.shape.bold,
            border: {
                enabled: typeof border.enabled === 'boolean' ? border.enabled : base.shape.border.enabled,
                color: cleanValue(border.color, base.shape.border.color) || base.shape.border.color,
            },
            spacing,
            padding,
            margin,
        },
        groups,
        overrides,
        advanced: {common: typeof advanced.common === 'string' ? advanced.common : '', states},
    };
}

// Parses the stored `panel-appearance` string. Returns null for anything that isn't a version 1 model.
export function parseStored(json) {
    if (typeof json !== 'string' || json.trim() === '') return null;
    let raw;
    try {
        raw = JSON.parse(json);
    } catch (e) {
        return null;
    }
    if (!isObject(raw) || raw.version !== MODEL_VERSION) return null;
    return normalize(raw);
}

export function serialize(model) {
    return JSON.stringify(model);
}

// A state's override merged over its group: {text, bg, fg}.
export function resolveState(model, key) {
    const group = model.groups[GROUP_OF[key]];
    return {...group, ...(model.overrides[key] ?? {})};
}

function majority(values) {
    const counts = new Map();
    values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
    let best;
    let bestCount = 0;
    counts.forEach((count, value) => {
        if (count > bestCount) {
            best = value;
            bestCount = count;
        }
    });
    return best;
}

// Turns per-state values ({KEY: {text?, bg?, fg?}}) into groups plus overrides. A group's value is the most
// common one among its members (the earliest wins a tie). Members that differ get an override.
// Fields no member supplies come from `fallbackGroups`.
export function buildGroups(stateValues, fallbackGroups = defaultModel().groups) {
    const groups = {};
    const overrides = {};
    GROUPS.forEach(group => {
        const members = STATE_KEYS.filter(key => GROUP_OF[key] === group && isObject(stateValues[key]));
        groups[group] = {...fallbackGroups[group]};
        FIELDS.forEach(field => {
            const present = members.filter(key => typeof stateValues[key][field] === 'string');
            if (!present.length) return;
            const chosen = majority(present.map(key => stateValues[key][field]));
            groups[group][field] = chosen;
            present.forEach(key => {
                if (stateValues[key][field] === chosen) return;
                overrides[key] = {...(overrides[key] ?? {}), [field]: stateValues[key][field]};
            });
        });
    });
    return {groups, overrides};
}
