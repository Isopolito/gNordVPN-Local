import {createVpn, createFakeProcCom, readFixture} from '../helpers/vpn.js';
import {FakeSettings} from '../helpers/FakeSettings.js';

const STATUS = 'nordvpn status';
const SETTINGS = 'nordvpn settings';

describe('Vpn.setSettingsFromNord', () => {
    it('writes the mapped keys from real `nordvpn settings` output', async () => {
        const settings = new FakeSettings();
        const procCom = createFakeProcCom({[STATUS]: 'Status: Disconnected', [SETTINGS]: readFixture('settings-current.txt')});
        await createVpn({procCom, settings}).setSettingsFromNord();

        expect(procCom.calls).toEqual([STATUS, SETTINGS]);
        // Only the lines resolveSettingsKey maps are written; Routing, Tray, DNS, ... are ignored.
        // Characterization: current CLIs print "Protocol: NordLynx" (no Technology line), so the
        // extension stores 'NordLynx' in `protocol`, which is not one of the UDP/TCP combo values.
        expect(settings.writes).toEqual([
            ['protocol', 'NordLynx'],
            ['firewall', true],
            ['killswitch', false],
            ['notify', true],
            ['autoconnect', true],
        ]);
    });

    it('maps the legacy output with Technology, Threat Protection Lite, Obfuscate, IPv6 and Analytics', async () => {
        const settings = new FakeSettings({firewall: true, autoconnect: true});
        const procCom = createFakeProcCom({[STATUS]: 'ok', [SETTINGS]: readFixture('settings-legacy.txt')});
        await createVpn({procCom, settings}).setSettingsFromNord();

        expect(settings.get_string('technology')).toBe('OPENVPN');
        expect(settings.get_string('protocol')).toBe('UDP');
        expect(settings.get_boolean('firewall')).toBe(false);
        expect(settings.get_boolean('killswitch')).toBe(true);
        expect(settings.get_boolean('cybersec')).toBe(false);
        expect(settings.get_boolean('obfuscate')).toBe(false);
        expect(settings.get_boolean('notify')).toBe(false);
        expect(settings.get_boolean('autoconnect')).toBe(false);
        expect(settings.get_boolean('ipv6')).toBe(false);
        expect(settings.get_boolean('analytics')).toBe(true);
        expect(settings.writes.map(([k]) => k).sort()).toEqual([
            'analytics', 'autoconnect', 'cybersec', 'firewall', 'ipv6', 'killswitch',
            'notify', 'obfuscate', 'protocol', 'technology',
        ]);
    });

    it('writes nothing when the daemon is not running', async () => {
        const settings = new FakeSettings();
        const procCom = createFakeProcCom({[STATUS]: new Error('daemon down'), [SETTINGS]: readFixture('settings-current.txt')});
        await createVpn({procCom, settings}).setSettingsFromNord();

        expect(procCom.calls).toEqual([STATUS]);
        expect(settings.writes).toEqual([]);
    });

    it('writes nothing when `nordvpn settings` prints nothing', async () => {
        const settings = new FakeSettings();
        const procCom = createFakeProcCom({[STATUS]: 'ok', [SETTINGS]: ''});
        await createVpn({procCom, settings}).setSettingsFromNord();
        expect(settings.writes).toEqual([]);
    });
});

describe('Vpn.applySettingsToNord', () => {
    const CUSTOM = {
        firewall: true, analytics: false, autoconnect: true, cybersec: false, killswitch: true,
        obfuscate: false, ipv6: true, notify: false, protocol: 'TCP', technology: 'OPENVPN',
    };
    const COMMANDS = [
        'nordvpn s firewall true',
        'nordvpn s analytics false',
        'nordvpn s autoconnect true',
        'nordvpn s cybersec false',
        'nordvpn s killswitch true',
        'nordvpn s obfuscate false',
        'nordvpn s ipv6 true',
        'nordvpn s notify false',
        'nordvpn s protocol TCP',
        'nordvpn s technology OPENVPN',
        'nordvpn s firewall true', // the trailing duplicate firewall call
    ];

    it('issues the exact command sequence after a status check', async () => {
        const procCom = createFakeProcCom();
        await createVpn({procCom, settings: new FakeSettings(CUSTOM)}).applySettingsToNord();
        expect(procCom.calls).toEqual([STATUS, ...COMMANDS]);
    });

    it('issues nothing but the status check when the daemon is not running', async () => {
        const procCom = createFakeProcCom({[STATUS]: new Error('daemon down')});
        await createVpn({procCom, settings: new FakeSettings(CUSTOM)}).applySettingsToNord();
        expect(procCom.calls).toEqual([STATUS]);
    });

    it('keeps going when one command is rejected', async () => {
        const procCom = createFakeProcCom({'nordvpn s obfuscate false': new Error('not supported with NordLynx')});
        await createVpn({procCom, settings: new FakeSettings(CUSTOM)}).applySettingsToNord();
        expect(procCom.calls).toEqual([STATUS, ...COMMANDS]);
    });

    it('is not affected by a setting changed while the status check is in flight', async () => {
        const settings = new FakeSettings(CUSTOM);
        const inner = createFakeProcCom();
        let release;
        const gate = new Promise(r => { release = r; });
        const procCom = {
            calls: inner.calls,
            async execCommunicateAsync(cmd) {
                if (cmd === STATUS) await gate;
                return inner.execCommunicateAsync(cmd);
            },
        };

        const pending = createVpn({procCom, settings}).applySettingsToNord();
        settings.set_boolean('firewall', false);
        settings.set_string('protocol', 'UDP');
        settings.set_boolean('ipv6', false);
        release();
        await pending;

        expect(inner.calls).toEqual([STATUS, ...COMMANDS]);
    });
});
