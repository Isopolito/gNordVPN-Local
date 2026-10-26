import {CORNERS, MODEL_VERSION, STATE_KEYS, buildGroups, defaultModel, detectSpacing} from './AppearanceModel.js';
import {expandSides, splitDeclaration, splitDeclarations} from './StyleCompiler.js';

const BORDER = /^1px\s+solid\s+(\S.*)$/i;

function cornerOf(value) {
    const hit = Object.keys(CORNERS).find(name => CORNERS[name] === value);
    if (hit) return hit;
    return value === '0px' ? 'square' : null;
}

// Parses one state's CSS. background-color and color are recognised; everything else is returned verbatim
// in `extra`. A repeated property goes to `extra` too, so nothing is dropped.
function parseStateCss(css) {
    const found = {};
    const extra = [];
    splitDeclarations(css).forEach(piece => {
        const parsed = splitDeclaration(piece);
        const field = parsed && {'background-color': 'bg', 'color': 'fg'}[parsed.prop];
        if (field && found[field] === undefined && !/!important/i.test(parsed.value)) found[field] = parsed.value;
        else extra.push(piece);
    });
    return {found, extra};
}

// Parses the common CSS into shape pieces plus an `extra` list of unrecognised declarations.
function parseCommonCss(css) {
    const shape = {};
    const extra = [];
    const pieces = splitDeclarations(css);
    // A property that repeats stays verbatim in `extra`, in order, so the cascade survives a recompile.
    const counts = {};
    pieces.forEach(piece => {
        const parsed = splitDeclaration(piece);
        if (parsed) counts[parsed.prop] = (counts[parsed.prop] ?? 0) + 1;
    });
    pieces.forEach(piece => {
        const parsed = splitDeclaration(piece);
        let handled = false;
        if (parsed && counts[parsed.prop] === 1 && !/!important/i.test(parsed.value)) {
            if (parsed.prop === 'font-weight' && parsed.value === 'bold' && shape.bold === undefined) {
                shape.bold = true;
                handled = true;
            } else if (parsed.prop === 'border-radius' && shape.corner === undefined && cornerOf(parsed.value)) {
                shape.corner = cornerOf(parsed.value);
                handled = true;
            } else if ((parsed.prop === 'padding' || parsed.prop === 'margin') && shape[parsed.prop] === undefined) {
                shape[parsed.prop] = expandSides(parsed.value);
                handled = shape[parsed.prop] !== null;
            } else if (parsed.prop === 'border' && shape.border === undefined && BORDER.test(parsed.value)) {
                shape.border = {enabled: true, color: parsed.value.match(BORDER)[1].trim()};
                handled = !/[;{}]/.test(shape.border.color);
            }
        }
        if (!handled) extra.push(piece);
    });
    return {shape, extra};
}

const startsWithAll = (list, prefix) => prefix.length > 0 && prefix.every((piece, i) => list[i] === piece);

const asCss = (pieces) => pieces.map(piece => `${piece};`).join(' ');

// Builds an appearance model from the legacy `panel-styles` ({KEY: {panelText, css}}) and
// `common-panel-style` values. Nothing is lost: unrecognised declarations go into `advanced` verbatim.
export function parse(panelStyles, commonCss) {
    const base = defaultModel();
    const source = (panelStyles && typeof panelStyles === 'object') ? panelStyles : {};

    const common = parseCommonCss(typeof commonCss === 'string' ? commonCss : '');
    const stateValues = {};
    const advancedStates = {};
    STATE_KEYS.forEach(key => {
        const entry = source[key];
        if (!entry || typeof entry !== 'object') return;
        const {found, extra} = parseStateCss(entry.css ?? '');
        stateValues[key] = {
            text: typeof entry.panelText === 'string' ? entry.panelText : undefined,
            // A state that has CSS but no background or color has none, rather than inheriting its group's.
            bg: typeof entry.css === 'string' ? (found.bg ?? '') : undefined,
            fg: typeof entry.css === 'string' ? (found.fg ?? '') : undefined,
        };
        // compile() repeats advanced.common at the head of each state's advanced tail; drop that copy.
        const own = startsWithAll(extra, common.extra) ? extra.slice(common.extra.length) : extra;
        if (own.length) advancedStates[key] = asCss(own);
    });
    const {groups, overrides} = buildGroups(stateValues, base.groups);

    const padding = common.shape.padding ?? base.shape.padding;
    const margin = common.shape.margin ?? base.shape.margin;

    return {
        version: MODEL_VERSION,
        shape: {
            corner: common.shape.corner ?? 'square',
            bold: common.shape.bold === true,
            border: common.shape.border ?? {enabled: false, color: base.shape.border.color},
            spacing: detectSpacing(padding, margin),
            padding,
            margin,
        },
        groups,
        overrides,
        advanced: {common: asCss(common.extra), states: advancedStates},
    };
}
