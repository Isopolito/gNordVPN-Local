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
    // compile() appends advanced.common after each state's generated colours, but legacy had state CSS win
    // over common. So common colour declarations move to the states that do not define that property.
    const isColor = (piece) => {
        const parsed = splitDeclaration(piece);
        return !!parsed && (parsed.prop === 'color' || parsed.prop === 'background-color') && !/!important/i.test(parsed.value);
    };
    // Css that already carries the common declarations at its head is in compiled form; leave it all alone.
    const compiledForm = common.extra.length > 0 && STATE_KEYS.some(key => {
        const entry = source[key];
        return entry && typeof entry === 'object' && startsWithAll(parseStateCss(entry.css ?? '').extra, common.extra);
    });
    const commonColors = compiledForm ? [] : common.extra.filter(isColor);
    const commonKept = compiledForm ? common.extra : common.extra.filter(piece => !isColor(piece));
    STATE_KEYS.forEach(key => {
        const entry = source[key];
        const hasEntry = entry && typeof entry === 'object';
        const {found, extra} = hasEntry ? parseStateCss(entry.css ?? '') : {found: {}, extra: []};
        const own = hasEntry && startsWithAll(extra, common.extra) ? extra.slice(common.extra.length) : extra;
        const inherited = commonColors.filter(piece => {
            const prop = splitDeclaration(piece).prop;
            const field = prop === 'color' ? 'fg' : 'bg';
            return found[field] === undefined && !own.some(o => splitDeclaration(o)?.prop === prop);
        });
        if (inherited.length || own.length) advancedStates[key] = asCss([...inherited, ...own]);
        if (!hasEntry) return;
        stateValues[key] = {
            text: typeof entry.panelText === 'string' ? entry.panelText : undefined,
            // A state that has CSS but no background or color has none, rather than inheriting its group's.
            bg: typeof entry.css === 'string' ? (found.bg ?? '') : undefined,
            fg: typeof entry.css === 'string' ? (found.fg ?? '') : undefined,
        };
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
        advanced: {common: asCss(commonKept), states: advancedStates},
    };
}
