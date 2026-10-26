import {CORNERS, SIDES, STATE_KEYS, resolveState} from './AppearanceModel.js';

// Splits a CSS declaration list on ';' outside parentheses and quotes. Empty pieces are dropped.
export function splitDeclarations(css) {
    const pieces = [];
    let depth = 0;
    let quote = null;
    let current = '';
    for (const ch of String(css ?? '')) {
        if (quote) {
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth = Math.max(0, depth - 1);
        } else if (ch === ';' && depth === 0) {
            pieces.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    pieces.push(current);
    return pieces.map(piece => piece.trim()).filter(piece => piece !== '');
}

// {prop, value} with the property lowercased, or null for a piece that has no ':'.
export function splitDeclaration(declaration) {
    const at = declaration.indexOf(':');
    if (at < 1) return null;
    return {prop: declaration.slice(0, at).trim().toLowerCase(), value: declaration.slice(at + 1).trim()};
}

// Expands a 1-4 value padding/margin shorthand to {top, right, bottom, left}, or null if it isn't one.
export function expandSides(value) {
    const parts = value.trim().split(/\s+(?![^(]*\))/);
    if (parts.length < 1 || parts.length > 4 || parts.some(part => part === '')) return null;
    const [top, right = top, bottom = top, left = right] = parts;
    return {top, right, bottom, left};
}

function shortestSides(sides) {
    const {top, right, bottom, left} = sides;
    if (top === right && right === bottom && bottom === left) return top;
    if (top === bottom && right === left) return `${top} ${right}`;
    if (right === left) return `${top} ${right} ${bottom}`;
    return `${top} ${right} ${bottom} ${left}`;
}

// Makes sure a hand-written declaration list ends in ';' so CSS appended after it still parses.
const terminated = (css) => (css.endsWith(';') || css.endsWith('}') ? css : `${css};`);

const asDeclarations = (pairs) => pairs.filter(([, value]) => value !== '' && value != null)
    .map(([prop, value]) => `${prop}: ${value};`);

// The shared CSS for every state: font-weight, border-radius, padding, margin, border, then advanced.common.
export function compileCommon(model) {
    const {shape, advanced} = model;
    const declarations = asDeclarations([
        ['font-weight', shape.bold ? 'bold' : ''],
        ['border-radius', CORNERS[shape.corner]],
        ['padding', shortestSides(shape.padding)],
        ['margin', shortestSides(shape.margin)],
        ['border', shape.border.enabled ? `1px solid ${shape.border.color}` : ''],
    ]);
    if (advanced.common.trim() !== '') declarations.push(terminated(advanced.common.trim()));
    return declarations.join(' ');
}

// Returns {panelStyles: {<STATE_KEY>: {panelText, css}}, commonCss}, the shape PanelIcon reads.
export function compile(model) {
    const panelStyles = {};
    STATE_KEYS.forEach(key => {
        const {text, bg, fg} = resolveState(model, key);
        const declarations = asDeclarations([['background-color', bg], ['color', fg]]);
        const extra = model.advanced.states[key];
        if (extra && extra.trim() !== '') declarations.push(terminated(extra.trim()));
        panelStyles[key] = {panelText: text, css: declarations.join(' ')};
    });
    return {panelStyles, commonCss: compileCommon(model)};
}

// A canonical form of a declaration list for comparing two CSS strings. Order between different properties
// is ignored, but repeated occurrences of one property keep their order (the last one wins in CSS):
// lowercased properties, collapsed whitespace, no space after commas, padding/margin expanded.
export function normalizeDeclarations(css) {
    const groups = new Map();
    splitDeclarations(css).forEach(piece => {
        const parsed = splitDeclaration(piece);
        if (!parsed) return addToGroup(groups, piece.replace(/\s+/g, ' '), piece.replace(/\s+/g, ' '));
        let value = parsed.value.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\s*!\s*important$/i, ' !important');
        if (parsed.prop === 'padding' || parsed.prop === 'margin') {
            const sides = expandSides(value);
            if (sides) value = SIDES.map(side => sides[side]).join(' ');
        }
        addToGroup(groups, parsed.prop, `${parsed.prop}:${value}`);
    });
    return [...groups.keys()].sort().flatMap(key => groups.get(key));
}

function addToGroup(groups, key, entry) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
}

// True when two {panelStyles, commonCss} results mean the same thing.
export function sameStyles(a, b) {
    if (JSON.stringify(normalizeDeclarations(a.commonCss)) !== JSON.stringify(normalizeDeclarations(b.commonCss)))
        return false;
    return STATE_KEYS.every(key => {
        const left = a.panelStyles[key];
        const right = b.panelStyles[key];
        if (!left || !right) return !left && !right;
        return left.panelText === right.panelText &&
            JSON.stringify(normalizeDeclarations(left.css)) === JSON.stringify(normalizeDeclarations(right.css));
    });
}
