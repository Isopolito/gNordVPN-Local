import {
    GROUPS, MODEL_VERSION, SPACING_PRESETS, STATE_KEYS, buildGroups, clone, defaultModel, detectSpacing,
} from './AppearanceModel.js';

// Panel texts for each size. Copied from the old StylesManager._connectStylesButtons.
export const SIZE_PRESETS = {
    small: {
        label: 'Small',
        panelTexts: {
            'CONNECTED': '{ctry}',
            'CONNECTING': '.',
            'DISCONNECTED': '∅',
            'DISCONNECTING': '.',
            'RECONNECTING': '.',
            'RESTARTING': '.',
            'ERROR': '⚠',
            'LOGGED_OUT': '?',
            'LOGGING_IN': '.',
            'LOGGING_OUT': '.',
        },
    },
    medium: {
        label: 'Medium',
        panelTexts: {
            'CONNECTED': '{ctry}#{number}',
            'CONNECTING': '...',
            'DISCONNECTED': 'OFF',
            'DISCONNECTING': '...',
            'RECONNECTING': '...',
            'RESTARTING': '...',
            'ERROR': 'ERR',
            'LOGGED_OUT': 'OUT',
            'LOGGING_IN': '...',
            'LOGGING_OUT': '...',
        },
    },
    large: {
        label: 'Large',
        panelTexts: {
            'CONNECTED': '{country} #{number}',
            'CONNECTING': 'CONNECTING',
            'DISCONNECTED': 'DISCONNECTED',
            'DISCONNECTING': 'DISCONNECTING',
            'RECONNECTING': 'RECONNECTING',
            'RESTARTING': 'RESTARTING',
            'ERROR': 'ERROR',
            'LOGGED_OUT': 'LOGGED OUT',
            'LOGGING_IN': 'LOGGING IN',
            'LOGGING_OUT': 'LOGGING OUT',
        },
    },
    extraLarge: {
        label: 'Extra Large',
        panelTexts: {
            'CONNECTED': '{city}, {country}  -  {uptimeHr}:{uptimeMin}:{uptimeSec}  -  ↑{transferUp} ↓{transferDown}',
            'CONNECTING': 'VPN CONNECTING',
            'DISCONNECTED': 'VPN DISCONNECTED',
            'DISCONNECTING': 'VPN DISCONNECTING ',
            'RECONNECTING': 'VPN RECONNECTING',
            'RESTARTING': 'VPN RESTARTING',
            'ERROR': 'VPN ERROR',
            'LOGGED_OUT': 'VPN LOGGED OUT',
            'LOGGING_IN': 'VPN LOGGING IN',
            'LOGGING_OUT': 'VPN LOGGING OUT',
        },
    },
};

const WHITE = 'rgba(255,255,255,1)';
const AMBER = 'rgba(255,191,0,0.7)';
const RED = 'rgba(255,0,0,0.7)';

const uniform = (bg, fg) => Object.fromEntries(GROUPS.map(group => [group, {bg, fg}]));

// Shapes copied from the old `ccss` and `altCcss`.
const FILLED_SHAPE = {
    corner: 'pill',
    bold: true,
    border: {enabled: false, color: 'white'},
    padding: {...SPACING_PRESETS.normal.padding},
    margin: {...SPACING_PRESETS.normal.margin},
};
const OUTLINE_SHAPE = {
    corner: 'rounded',
    bold: true,
    border: {enabled: true, color: 'white'},
    padding: {top: '3px', right: '10px', bottom: '0', left: '10px'},
    margin: {...SPACING_PRESETS.normal.margin},
};

// Colors for each group, copied from the old styleCss, styleAltCss, monoCss and altMonoCss.
export const THEME_PRESETS = {
    trafficLight: {
        label: 'Traffic light',
        shape: FILLED_SHAPE,
        colors: {
            connected: {bg: 'rgba(0,255,0,0.7)', fg: WHITE},
            transitioning: {bg: AMBER, fg: WHITE},
            disconnected: {bg: RED, fg: WHITE},
            error: {bg: RED, fg: WHITE},
            loggedOut: {bg: 'rgba(48,26,208,0.7)', fg: WHITE},
        },
    },
    outline: {
        label: 'Outline',
        shape: OUTLINE_SHAPE,
        colors: {
            connected: {bg: 'rgba(0,0,0,0.7)', fg: 'rgba(0,255,0,0.7)'},
            transitioning: {bg: 'rgba(0,0,0,0.7)', fg: AMBER},
            disconnected: {bg: 'rgba(0,0,0,0.7)', fg: RED},
            error: {bg: 'rgba(0,0,0,0.7)', fg: RED},
            loggedOut: {bg: 'rgba(0,0,0,0.7)', fg: 'rgba(48,26,208,0.7)'},
        },
    },
    mono: {
        label: 'Mono',
        shape: FILLED_SHAPE,
        colors: uniform('rgba(255,255,255,0.7)', 'rgba(0,0,0,1)'),
    },
    monoOutline: {
        label: 'Mono outline',
        shape: OUTLINE_SHAPE,
        colors: uniform('rgba(0,0,0,0.7)', WHITE),
    },
};

// Returns a copy of `model` with the size's panel texts. Only text changes. Each group gets its most
// common text and members that differ get a text override, so Large and Extra Large keep distinct
// transitional labels. Colors, shape, advanced CSS and non-text overrides are left alone.
export function applySize(model, sizeKey) {
    const preset = SIZE_PRESETS[sizeKey];
    if (!preset) throw new Error(`Unknown size preset: ${sizeKey}`);
    const result = clone(model);

    const stateValues = {};
    STATE_KEYS.forEach(key => stateValues[key] = {text: preset.panelTexts[key]});
    const built = buildGroups(stateValues, result.groups);
    GROUPS.forEach(group => result.groups[group].text = built.groups[group].text);

    STATE_KEYS.forEach(key => {
        const entry = {...(result.overrides[key] ?? {})};
        delete entry.text;
        if (built.overrides[key]) entry.text = built.overrides[key].text;
        if (Object.keys(entry).length) result.overrides[key] = entry;
        else delete result.overrides[key];
    });
    return result;
}

// Returns a copy of `model` with the theme's shape and colors. Panel texts, advanced CSS and text
// overrides are left alone; color overrides are cleared because the theme sets every group's colors.
export function applyTheme(model, themeKey) {
    const preset = THEME_PRESETS[themeKey];
    if (!preset) throw new Error(`Unknown theme preset: ${themeKey}`);
    const result = clone(model);

    result.shape = {...clone(preset.shape), spacing: detectSpacing(preset.shape.padding, preset.shape.margin)};
    GROUPS.forEach(group => Object.assign(result.groups[group], preset.colors[group]));
    STATE_KEYS.forEach(key => {
        const entry = result.overrides[key];
        if (!entry) return;
        delete entry.bg;
        delete entry.fg;
        if (!Object.keys(entry).length) delete result.overrides[key];
    });
    return result;
}

// A fresh model for a size and theme: what the old size button produced with the old switches set.
export function buildPreset(sizeKey, themeKey) {
    const empty = defaultModel();
    empty.version = MODEL_VERSION;
    empty.overrides = {};
    return applyTheme(applySize(empty, sizeKey), themeKey);
}
