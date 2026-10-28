import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Not a spec: an in-memory GSettings built from the real schema XML, so tests run against the
// shipped keys, types, ranges and defaults. Like real GSettings it throws on an unknown key, and
// it refuses a write whose type doesn't match the key's declared type.

export const SCHEMA_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas',
    'org.gnome.shell.extensions.gnordvpn-local.gschema.xml');

// ---- GVariant type strings ---------------------------------------------------------------------

// Returns the index just past the single complete type that starts at `pos`.
function typeEnd(t, pos = 0) {
    const c = t[pos];
    if (c === 'a') return typeEnd(t, pos + 1);
    if (c === '{') {
        const keyEnd = typeEnd(t, pos + 1);
        const valEnd = typeEnd(t, keyEnd);
        if (t[valEnd] !== '}') throw new Error(`Bad dict type '${t}'`);
        return valEnd + 1;
    }
    if ('sbiduxntqyvho'.includes(c)) return pos + 1;
    throw new Error(`Unsupported GVariant type '${t}'`);
}

// Throws unless `value` (a plain JS value) is valid for the GVariant type string `type`.
export function validateType(value, type) {
    const fail = () => { throw new Error(`Value ${JSON.stringify(value)} is not of GVariant type '${type}'`); };
    if (type === 's') { if (typeof value !== 'string') fail(); return; }
    if (type === 'b') { if (typeof value !== 'boolean') fail(); return; }
    if (type === 'i') {
        if (!Number.isInteger(value) || value < -(2 ** 31) || value > 2 ** 31 - 1) fail();
        return;
    }
    if (type === 'd') { if (typeof value !== 'number') fail(); return; }
    if (type.startsWith('a{')) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) fail();
        const keyType = type.slice(2, typeEnd(type, 2));
        const valType = type.slice(2 + keyType.length, -1);
        for (const [k, v] of Object.entries(value)) {
            validateType(k, keyType);
            validateType(v, valType);
        }
        return;
    }
    if (type.startsWith('a')) {
        if (!Array.isArray(value)) fail();
        value.forEach(v => validateType(v, type.slice(1)));
        return;
    }
    throw new Error(`Unsupported GVariant type '${type}'`);
}

// ---- GVariant text format (the subset the schema defaults use) --------------------------------

export function parseVariantText(text) {
    let i = 0;
    const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
    const fail = (msg) => { throw new Error(`${msg} at ${i} in: ${text}`); };

    function str() {
        const quote = text[i++];
        let out = '';
        while (i < text.length && text[i] !== quote) {
            if (text[i] === '\\') {
                const esc = text[++i];
                out += ({n: '\n', t: '\t', r: '\r'})[esc] ?? esc;
            } else {
                out += text[i];
            }
            i++;
        }
        if (text[i] !== quote) fail('Unterminated string');
        i++;
        return out;
    }

    function value() {
        ws();
        if (text[i] === '@') { while (i < text.length && !/\s/.test(text[i])) i++; ws(); }
        const c = text[i];
        if (c === '"' || c === "'") return str();
        if (c === '[') {
            i++;
            const items = [];
            ws();
            while (text[i] !== ']') {
                items.push(value());
                ws();
                if (text[i] === ',') { i++; ws(); } else if (text[i] !== ']') fail('Expected , or ]');
            }
            i++;
            return items;
        }
        if (c === '{') {
            i++;
            const obj = {};
            ws();
            while (text[i] !== '}') {
                const k = value();
                ws();
                if (text[i] !== ':') fail('Expected :');
                i++;
                obj[k] = value();
                ws();
                if (text[i] === ',') { i++; ws(); } else if (text[i] !== '}') fail('Expected , or }');
            }
            i++;
            return obj;
        }
        const m = /^(true|false|-?\d+(\.\d+)?)/.exec(text.slice(i));
        if (!m) fail('Unparseable value');
        i += m[0].length;
        return m[0] === 'true' ? true : m[0] === 'false' ? false : Number(m[0]);
    }

    const result = value();
    ws();
    if (i !== text.length) fail('Trailing text');
    return result;
}

// ---- schema XML ------------------------------------------------------------------------------

// Returns {id, keys: {name: {type, defaultText, default, range}}}. Regex based: the schema is
// machine-simple (no enums/flags/choices), and a failure here is itself a useful test failure.
export function parseSchema(xml) {
    const id = /<schema\s+id="([^"]+)"/.exec(xml)?.[1];
    const keys = {};
    const keyRe = /<key\s+name="([^"]+)"\s+type="([^"]+)"\s*>([\s\S]*?)<\/key>/g;
    let m;
    while ((m = keyRe.exec(xml))) {
        const [, name, type, body] = m;
        const defaultText = /<default>([\s\S]*?)<\/default>/.exec(body)?.[1];
        const unescaped = defaultText?.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const rangeM = /<range\s+min="([^"]+)"\s+max="([^"]+)"/.exec(body);
        if (keys[name]) throw new Error(`Duplicate key '${name}' in schema`);
        keys[name] = {
            type,
            defaultText: unescaped,
            range: rangeM ? {min: Number(rangeM[1]), max: Number(rangeM[2])} : null,
        };
    }
    return {id, keys};
}

export function loadSchema() {
    return parseSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

// ---- variants + settings ---------------------------------------------------------------------

const clone = (v) => (v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

// Stand-in for GLib.Variant: `new GLib.Variant('as', [...])` and what get_value() returns.
export class FakeVariant {
    constructor(type, value) {
        this._type = type;
        this._value = clone(value);
    }
    get_type_string() { return this._type; }
    unpack() { return clone(this._value); }
    deep_unpack() { return clone(this._value); }
}

// Call from a spec: `installGLibVariant(GLib)` so `new GLib.Variant(...)` in the code works.
export function installGLibVariant(GLib) {
    GLib.Variant = FakeVariant;
}

// Gio.SettingsBindFlags values from the GIO headers.
export const BindFlags = {DEFAULT: 0, GET: 1, SET: 2, NO_SENSITIVITY: 4, GET_NO_CHANGES: 8, INVERT_BOOLEAN: 16};
export function installGioBindFlags(Gio) {
    Gio.SettingsBindFlags = BindFlags;
}

export class FakeSettings {
    // `overrides` maps key -> raw value, applied over the schema defaults (and type-checked).
    constructor(overrides = {}, schema = loadSchema()) {
        this._schema = schema;
        this._values = {};
        this._handlers = new Map();
        this._nextId = 1;
        this.writes = []; // every accepted write, in order: [key, value]
        for (const [name, def] of Object.entries(schema.keys)) {
            def.default = parseVariantText(def.defaultText);
            validateType(def.default, def.type);
            this._values[name] = clone(def.default);
        }
        for (const [k, v] of Object.entries(overrides)) this._write(k, v, null, false);
    }

    get schemaId() { return this._schema.id; }
    keys() { return Object.keys(this._schema.keys); }

    _key(name) {
        const def = this._schema.keys[name];
        if (!def) throw new Error(`Settings schema '${this._schema.id}' does not contain a key named '${name}'`);
        return def;
    }

    _typed(name, type, fn) {
        const def = this._key(name);
        if (def.type !== type) throw new Error(`Key '${name}' is type '${def.type}', not '${type}'`);
        return fn(def);
    }

    _write(name, value, expectedType, record = true) {
        const def = this._key(name);
        if (expectedType && def.type !== expectedType) {
            throw new Error(`Key '${name}' is type '${def.type}', not '${expectedType}'`);
        }
        validateType(value, def.type);
        // Real GSettings rejects (returns FALSE) a write outside the key's <range>.
        if (def.range && (value < def.range.min || value > def.range.max)) return false;
        if (record) this.writes.push([name, clone(value)]);
        const changed = JSON.stringify(this._values[name]) !== JSON.stringify(value);
        this._values[name] = clone(value);
        // Modelled as: 'changed' fires only when the stored value differs.
        if (changed && record) this._emit(name);
        return true;
    }

    _emit(name) {
        for (const h of [...this._handlers.values()]) {
            if (h.signal === 'changed' || h.signal === `changed::${name}`) h.cb(this, name);
        }
    }

    get_string(k) { return this._typed(k, 's', () => this._values[k]); }
    get_boolean(k) { return this._typed(k, 'b', () => this._values[k]); }
    get_int(k) { return this._typed(k, 'i', () => this._values[k]); }
    get_value(k) { return new FakeVariant(this._key(k).type, this._values[k]); }
    get_default_value(k) { const d = this._key(k); return new FakeVariant(d.type, d.default); }

    set_string(k, v) { return this._write(k, v, 's'); }
    set_boolean(k, v) { return this._write(k, v, 'b'); }
    set_int(k, v) { return this._write(k, v, 'i'); }
    set_value(k, variant) {
        const def = this._key(k);
        if (variant.get_type_string() !== def.type) {
            throw new Error(`Key '${k}' is type '${def.type}', got variant '${variant.get_type_string()}'`);
        }
        return this._write(k, variant.deep_unpack(), null);
    }
    reset(k) { this._write(k, clone(this._key(k).default), null); }

    connect(signal, cb) {
        const id = this._nextId++;
        this._handlers.set(id, {signal, cb});
        return id;
    }
    disconnect(id) { this._handlers.delete(id); }

    // g_settings_bind. `object` is any widget/adjustment that supports connect('notify::<prop>')
    // (see helpers/fakeGtk.js). Initial settings -> object sync, then both directions per `flags`.
    bind(key, object, property, flags = BindFlags.DEFAULT) {
        const def = this._key(key);
        const get = flags === BindFlags.DEFAULT || (flags & BindFlags.GET);
        const set = flags === BindFlags.DEFAULT || (flags & BindFlags.SET);
        const toWidget = () => { object[property] = clone(this._values[key]); };
        if (get) {
            toWidget();
            this.connect(`changed::${key}`, toWidget);
        }
        if (set) {
            object.connect(`notify::${property}`, () => {
                let v = object[property];
                if (def.type === 'i') v = Math.round(v);
                this._write(key, v, null);
            });
        }
    }
}
