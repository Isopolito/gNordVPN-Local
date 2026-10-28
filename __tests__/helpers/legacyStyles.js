// Frozen copy of the style generator in the pre-redesign modules/prefs/StylesManager.js
// (_connectStylesButtons and _loadGeneratedStyle), so tests can check the presets against the
// original output. Do not edit it to follow the new code.

export const LEGACY_PANEL_TEXTS = {
    extraLarge: {
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
    large: {
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
    medium: {
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
    small: {
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
};

const styleCss = {
    'CONNECTED': {css: 'background-color: rgba(0,255,0,0.7); color: rgba(255,255,255,1);'},
    'CONNECTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
    'DISCONNECTED': {css: 'background-color: rgba(255,0,0,0.7); color: rgba(255,255,255,1);'},
    'DISCONNECTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
    'RECONNECTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
    'RESTARTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
    'ERROR': {css: 'background-color: rgba(255,0,0,0.7); color: rgba(255,255,255,1);'},
    'LOGGED_OUT': {css: 'background-color: rgba(48,26,208,0.7); color: rgba(255,255,255,1);'},
    'LOGGING_IN': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
    'LOGGING_OUT': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
        };

const styleAltCss = {
    'CONNECTED': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(0,255,0,0.7);'},
    'CONNECTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
    'DISCONNECTED': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,0,0,0.7);'},
    'DISCONNECTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
    'RECONNECTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
    'RESTARTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
    'ERROR': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,0,0,0.7);'},
    'LOGGED_OUT': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(48,26,208,0.7);'},
    'LOGGING_IN': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
    'LOGGING_OUT': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
        };

const monoCss = "background-color: rgba(255,255,255,0.7); color: rgba(0,0,0,1);";
const altMonoCss = "background-color: rgba(0,0,0,0.7); color: rgba(255,255,255,1);";

const ccss = "font-weight: bold; border-radius: 100px; padding: 0px 10px 0; margin: 3px 0px 3px 0px;";
const altCcss = "font-weight: bold; border-radius: 5px; padding: 3px 10px 0; margin: 3px 0px 3px 0px; border: 1px solid white;";

export const LEGACY_SIZES = Object.keys(LEGACY_PANEL_TEXTS);
export const LEGACY_THEMES = {
    trafficLight: {isMono: false, isAlt: false},
    outline: {isMono: false, isAlt: true},
    mono: {isMono: true, isAlt: false},
    monoOutline: {isMono: true, isAlt: true},
};

// What the old size button produced for a size and the two switches: {panelStyles, commonCss}.
export function legacyGenerate(size, theme) {
    const {isMono, isAlt} = LEGACY_THEMES[theme];
    const style = JSON.parse(JSON.stringify(isAlt ? styleAltCss : styleCss));
    Object.keys(style).forEach(key => {
        if (isMono) style[key].css = isAlt ? altMonoCss : monoCss;
        style[key].panelText = LEGACY_PANEL_TEXTS[size][key];
    });
    return {panelStyles: style, commonCss: isAlt ? altCcss : ccss};
}
