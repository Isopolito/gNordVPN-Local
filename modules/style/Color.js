// Pure CSS color comparison helpers. No GNOME imports.

const NAMED = {
    white: [255, 255, 255, 1], black: [0, 0, 0, 1], red: [255, 0, 0, 1], green: [0, 128, 0, 1],
    blue: [0, 0, 255, 1], yellow: [255, 255, 0, 1], orange: [255, 165, 0, 1], purple: [128, 0, 128, 1],
    gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], transparent: [0, 0, 0, 0],
};

const NUM = '(\\d*\\.?\\d+)';
const FUNC = new RegExp(`^rgba?\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*,\\s*${NUM}\\s*(?:,\\s*${NUM}\\s*)?\\)$`);

// [r, g, b, a] numbers (r/g/b 0-255, a 0-1) for rgb()/rgba()/#hex/common names, else null.
export function parseColor(css) {
    if (typeof css !== 'string') return null;
    const text = css.trim().toLowerCase();
    if (Object.hasOwn(NAMED, text)) return [...NAMED[text]];
    const fn = FUNC.exec(text);
    if (fn) {
        const v = [+fn[1], +fn[2], +fn[3], fn[4] === undefined ? 1 : +fn[4]];
        return v[0] > 255 || v[1] > 255 || v[2] > 255 || v[3] > 1 ? null : v;
    }
    const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
    if (hex) {
        let h = hex[1];
        if (h.length <= 4) h = [...h].map(c => c + c).join('');
        const n = i => parseInt(h.slice(i, i + 2), 16);
        return [n(0), n(2), n(4), h.length === 8 ? Math.round(n(6) / 255 * 1000) / 1000 : 1];
    }
    return null;
}

// True when two CSS colors are the same color. Unparseable values compare as trimmed lowercase text.
export function colorsEqual(a, b) {
    const pa = parseColor(a);
    const pb = parseColor(b);
    if (pa && pb) return pa.every((n, i) => n === pb[i]);
    if (pa || pb) return false;
    return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}
