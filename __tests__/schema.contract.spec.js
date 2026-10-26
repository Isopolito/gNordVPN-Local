import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSchema, parseVariantText, validateType} from './helpers/FakeSettings.js';
import * as Constants from '../modules/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Keys that are in the schema but that nothing reads. Each entry is a known bug waiting for a
// later phase; the test fails if an entry leaves the schema (or starts being read) so the list
// can't go stale.
const KNOWN_DEAD_KEYS = new Set([
    // StylesManager writes it, nothing reads it. Phase 1b deletes the key and empties this list.
    'extra-large-button',
]);

function listJs(dir) {
    return fs.readdirSync(path.join(root, dir), {withFileTypes: true}).flatMap(entry => {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) return listJs(rel);
        return entry.name.endsWith('.js') ? [rel] : [];
    });
}

// Comments are stripped so a commented-out call doesn't count as a use.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

const sources = Object.fromEntries(
    [...listJs('modules'), 'extension.js', 'prefs.js'].map(f => [f, stripComments(fs.readFileSync(path.join(root, f), 'utf8'))]));

const QUOTED = `(['"\`])([\\w-]+)\\1`;
const matchAll = (re, src) => [...src.matchAll(re)];

function scanKeys() {
    const reads = new Map();   // key -> Set(files)
    const writes = new Map();
    const other = new Map();   // reset lists / default lookups: must exist, but aren't a read
    const add = (map, key, file) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(file); };

    for (const [file, src] of Object.entries(sources)) {
        for (const m of matchAll(new RegExp(`\\.get_(?:string|boolean|int|value|strv)\\(\\s*${QUOTED}`, 'g'), src)) add(reads, m[2], file);
        for (const m of matchAll(new RegExp(`\\.bind\\(\\s*${QUOTED}\\s*,`, 'g'), src)) add(reads, m[2], file);
        for (const m of matchAll(new RegExp(`\\.set_(?:string|boolean|int|value)\\(\\s*${QUOTED}`, 'g'), src)) add(writes, m[2], file);
        for (const m of matchAll(new RegExp(`\\.get_default_value\\(\\s*${QUOTED}`, 'g'), src)) add(other, m[2], file);
        // ResetManager's key lists: this._resetSetting(settings, ['a', 'b'])
        for (const m of matchAll(/_resetSetting\(\s*settings\s*,\s*\[([^\]]*)\]/g, src)) {
            for (const k of matchAll(/['"`]([\w-]+)['"`]/g, m[1])) add(other, k[1], file);
        }
    }
    // Favorites/ConnectionMenu take their key as a constructor argument from constants.js and
    // read/write it through Favorites._getData/_setData, so the literal never appears at the call.
    for (const key of [...Object.values(Constants.favorites), ...Object.values(Constants.panel)]) {
        add(reads, key, 'modules/constants.js');
        add(writes, key, 'modules/constants.js');
    }
    return {reads, writes, other};
}

const schema = loadSchema();
const schemaKeys = Object.keys(schema.keys);
const {reads, writes, other} = scanKeys();

describe('schema contract', () => {
    it('the scanner finds the calls it is meant to find', () => {
        expect(reads.has('technology')).toBe(true);
        expect(reads.has('refresh-timeout')).toBe(true);          // VpnIndicator + bind
        expect(reads.has('number-cities-per-countries')).toBe(true); // bind only in prefs
        expect(reads.has('favorite-cities')).toBe(true);          // via constants
        expect(writes.has('panel-position')).toBe(true);
        expect(writes.has('extra-large-button')).toBe(true);
        expect(other.has('protocol')).toBe(true);                 // ResetManager list
        expect(reads.size).toBeGreaterThan(20);
    });

    it('every key the code reads, writes or resets exists in the schema', () => {
        const referenced = new Set([...reads.keys(), ...writes.keys(), ...other.keys()]);
        const missing = [...referenced].filter(k => !(k in schema.keys));
        expect(missing).toEqual([]);
    });

    it('every schema key is read somewhere, apart from KNOWN_DEAD_KEYS', () => {
        const unread = schemaKeys.filter(k => !reads.has(k) && !KNOWN_DEAD_KEYS.has(k));
        expect(unread).toEqual([]);
    });

    it('every KNOWN_DEAD_KEYS entry is still in the schema and still unread', () => {
        for (const key of KNOWN_DEAD_KEYS) {
            expect(schemaKeys).toContain(key);   // fails if the key was deleted: empty the allowlist
            expect(reads.has(key)).toBe(false);  // fails if it is read now: drop it from the allowlist
        }
    });

    it('every default parses as its declared type and respects its range', () => {
        for (const [name, def] of Object.entries(schema.keys)) {
            const value = parseVariantText(def.defaultText);
            expect(() => validateType(value, def.type)).not.toThrow();
            if (def.range) {
                expect({name, ok: value >= def.range.min && value <= def.range.max}).toEqual({name, ok: true});
            }
        }
    });

    it('panel-styles default has panelText and css for every state in Constants.states', () => {
        const styles = parseVariantText(schema.keys['panel-styles'].defaultText);
        for (const state of Object.keys(Constants.states)) {
            expect(styles[state]).toEqual({panelText: expect.any(String), css: expect.any(String)});
        }
    });

    describe('string keys with a fixed set of values', () => {
        // The selectable values are the ones the prefs combo boxes offer.
        const prefsSrc = sources[path.join('modules', 'prefs', 'GnordVpnPrefs.js')];
        const comboValues = (model) => matchAll(new RegExp(`${model}\\.set\\(${model}\\.append\\(\\),\\s*\\[0,\\s*1\\],\\s*\\['([^']+)'`, 'g'), prefsSrc).map(m => m[1]);
        const technologies = comboValues('techModel');
        const protocols = comboValues('protoModel');

        it('finds the combo box values', () => {
            expect(technologies).toEqual(['OPENVPN', 'NORDLYNX']);
            expect(protocols).toEqual(['UDP', 'TCP']);
        });

        it('technology default is one of the values the code compares against', () => {
            expect(technologies).toContain(parseVariantText(schema.keys.technology.defaultText));
        });

        it('protocol default is one of the values the code compares against', () => {
            expect(protocols).toContain(parseVariantText(schema.keys.protocol.defaultText));
        });

        it('every technology literal the code compares against is an offered value', () => {
            const compared = new Set();
            for (const src of Object.values(sources)) {
                for (const m of matchAll(/\b(?:tech|technology)\s*===?\s*(['"`])([A-Za-z]+)\1/g, src)) compared.add(m[2]);
            }
            expect(compared.size).toBeGreaterThan(0);
            for (const v of compared) expect(technologies).toContain(v);
        });
    });
});
