// Named style profiles: pure list/save/rename/delete/serialise logic. No GNOME imports.
// A profile is an AppearanceModel. The list is an array of {name, model} in save order.
import {MODEL_VERSION, clone, normalize} from './AppearanceModel.js';

export const MAX_NAME_LENGTH = 40;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Trimmed name capped at MAX_NAME_LENGTH characters; '' when empty or not a string.
export function cleanName(name) {
    if (typeof name !== 'string') return '';
    return Array.from(name.trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

export const isValidName = (name) => cleanName(name) !== '';

// Reads the stored JSON object. Malformed JSON gives []; malformed entries are skipped.
export function parseProfiles(json) {
    if (typeof json !== 'string' || json.trim() === '') return [];
    let raw;
    try {
        raw = JSON.parse(json);
    } catch (e) {
        return [];
    }
    if (!isObject(raw)) return [];
    const list = [];
    Object.entries(raw).forEach(([name, entry]) => {
        if (cleanName(name) !== name || !isObject(entry) || entry.version !== MODEL_VERSION) return;
        list.push({name, model: normalize(entry)});
    });
    return list;
}

export function serializeProfiles(list) {
    return JSON.stringify(Object.fromEntries(list.map(({name, model}) => [name, model])));
}

export const findProfile = (list, name) => list.find(p => p.name === cleanName(name)) ?? null;

// A new list with the model saved under the cleaned name; an existing name is overwritten in place.
// Returns null when the name is not valid.
export function saveProfile(list, name, model) {
    const clean = cleanName(name);
    if (clean === '') return null;
    const entry = {name: clean, model: normalize(clone(model))};
    const index = list.findIndex(p => p.name === clean);
    if (index < 0) return [...list, entry];
    return list.map((p, i) => (i === index ? entry : p));
}

export const deleteProfile = (list, name) => list.filter(p => p.name !== cleanName(name));

// A new list with `from` renamed to `to`. Returns null if `from` is missing, `to` is invalid,
// or `to` is already taken by another profile.
export function renameProfile(list, from, to) {
    const clean = cleanName(to);
    if (clean === '' || !findProfile(list, from)) return null;
    if (clean !== cleanName(from) && list.some(p => p.name === clean)) return null;
    return list.map(p => (p.name === cleanName(from) ? {...p, name: clean} : p));
}
