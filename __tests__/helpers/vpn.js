import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

// Not a spec: shared setup for specs that exercise the real modules/Vpn.js.
// Vpn.js talks to GNOME through gi:// modules, which jest maps to the stubs in __mocks__/gi.
globalThis.log = () => {};
globalThis.logError = () => {};
Soup.Session = {new: () => ({}), prototype: {}};
Soup.get_major_version = () => 3;
GLib.get_monotonic_time = () => 0;
GLib.PRIORITY_DEFAULT = 0;
Gio._promisify = () => {};
Gio.Subprocess = {prototype: {}};

const {default: Vpn} = await import('../../modules/Vpn.js');
export {Vpn};

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const readFixture = (name) => fs.readFileSync(path.join(fixtureDir, name), 'utf8');

// Fake ProcCom. `responses` maps a command to a string (resolved) or an Error (rejected).
export function createFakeProcCom(responses = {}) {
    const calls = [];
    return {
        calls,
        async execCommunicateAsync(cmd) {
            calls.push(cmd);
            const r = responses[cmd];
            if (r instanceof Error) throw r;
            return r ?? '';
        },
    };
}

// Fake GSettings. `values` maps key -> raw value; get_value() wraps it like a GVariant.
export function createFakeSettings(values = {}) {
    const wrap = (v) => ({unpack: () => v, deep_unpack: () => v});
    return {
        values,
        get_string: (k) => values[k],
        get_boolean: (k) => values[k],
        get_value: (k) => wrap(values[k]),
        set_string: (k, v) => { values[k] = v; },
        set_boolean: (k, v) => { values[k] = v; },
        set_value: (k, v) => { values[k] = v.deep_unpack(); },
    };
}

export function createVpn({procCom = createFakeProcCom(), settings = createFakeSettings()} = {}) {
    const vpn = new Vpn(settings);
    vpn._procCom = procCom;
    return vpn;
}
