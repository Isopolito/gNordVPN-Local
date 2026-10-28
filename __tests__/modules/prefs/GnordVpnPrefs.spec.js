import {jest} from '@jest/globals';
import {createFakeProcCom} from '../../helpers/vpn.js';   // first: patches the gi stubs Vpn.js needs
import {FakeSettings} from '../../helpers/FakeSettings.js';
import {fakes, registry, resetRegistry, findAll, createWindow} from '../../helpers/fakeGtk.js';
import GnordVpnPrefs from '../../../modules/prefs/GnordVpnPrefs.js';
import ResetManager from '../../../modules/prefs/ResetManager.js';

const {Grid, Button, Switch, SpinButton, ComboBoxText, ComboBox, TreeView, Adjustment} = fakes;

const COUNTRIES_OUT = 'Canada\nFrance\nGermany\nJapan\nUnited_States\n';
const COUNTRY_IDS = [
    {name: 'Canada', id: 38}, {name: 'France', id: 74}, {name: 'Germany', id: 81},
    {name: 'Japan', id: 108}, {name: 'United States', id: 228},
];
const ACCOUNT_OUT = 'Account Information:\nEmail Address: user@example.com\nVPN Service: Active\n';
const flush = () => new Promise(r => setImmediate(r));

// Builds the real prefs UI against FakeSettings and a fake `nordvpn` CLI.
async function buildPrefs({settings = {}, cli = {}} = {}) {
    resetRegistry();
    const fake = new FakeSettings(settings);
    const procCom = createFakeProcCom({
        'nordvpn status': new Error('daemon down'),   // so setSettingsFromNord leaves settings alone
        'nordvpn account': new Error('not logged in'),
        'nordvpn countries': COUNTRIES_OUT,
        ...cli,
    });
    const prefs = new GnordVpnPrefs(fake, {name: 'gNordVpn-Local', version: '1'});
    prefs._vpn._procCom = procCom;
    prefs._vpn._httpGet = async () => COUNTRY_IDS;
    const window = createWindow();
    prefs.fillPreferencesWindow(window);
    await flush();
    fake.writes.length = 0; // only record what the test itself does
    const grid = (label) => {
        const g = findAll(Grid).find(x => x.hasLabel(label));
        if (!g) throw new Error(`no grid with label '${label}'`);
        return g;
    };
    return {prefs, settings: fake, procCom, window, grid};
}

const buttonLabelled = (label) => findAll(Button).find(b => b.label === label);

describe('GnordVpnPrefs', () => {
    describe('General page', () => {
        it('shows the panel position setting and writes changes to panel-position', async () => {
            const {settings, grid} = await buildPrefs();
            const combo = grid('Select Panel Position:').controlFor('Select Panel Position:');
            expect(combo).toBeInstanceOf(ComboBoxText);
            expect(combo.get_active_id()).toBe('right');

            combo.set_active_id('left');
            expect(settings.get_string('panel-position')).toBe('left');
            combo.set_active_id('center');
            expect(settings.get_string('panel-position')).toBe('center');
        });

        it('binds the common favorite switch both ways', async () => {
            const {settings, grid} = await buildPrefs();
            const sw = grid('Display a common favorite tab:').controlFor('Display a common favorite tab:');
            expect(sw.active).toBe(false);

            sw.userSet(true);
            expect(settings.get_boolean('commonfavorite')).toBe(true);
            settings.set_boolean('commonfavorite', false);
            expect(sw.active).toBe(false);
        });

        it('binds the refresh spinner adjustment to refresh-timeout', async () => {
            const {settings, grid} = await buildPrefs();
            const label = 'Seconds between NordVpn status calls (will take affect on restart)';
            const spinner = grid(label).controlFor(label);
            expect(spinner.get_adjustment().value).toBe(15);

            spinner.get_adjustment().value = 30;
            expect(settings.get_int('refresh-timeout')).toBe(30);
        });

        it('Reset All Settings resets through ResetManager', async () => {
            const spy = jest.spyOn(ResetManager.prototype, 'resetAllSettings');
            try {
                const {settings} = await buildPrefs({settings: {
                    autoconnect: true, commonfavorite: true, showlogin: false, showlogout: true,
                    firewall: true, protocol: 'TCP', technology: 'NORDLYNX',
                    'number-cities-per-countries': 3, 'number-servers-per-countries': 4,
                }});
                buttonLabelled('Reset All Settings').click();

                expect(spy).toHaveBeenCalledTimes(1);
                for (const key of ['autoconnect', 'commonfavorite', 'showlogin', 'showlogout', 'firewall', 'protocol',
                    'technology', 'number-cities-per-countries', 'number-servers-per-countries']) {
                    expect({key, value: settings.get_value(key).deep_unpack()})
                        .toEqual({key, value: settings.get_default_value(key).deep_unpack()});
                }
            } finally {
                spy.mockRestore();
            }
        });
    });

    describe('Account page', () => {
        it('binds the show login and show logout switches to their keys', async () => {
            const {settings, grid} = await buildPrefs();
            const g = grid('Show login button in menu:');
            const login = g.controlFor('Show login button in menu:');
            const logout = g.controlFor('Show logout button in menu:');
            expect([login.active, logout.active]).toEqual([true, false]);

            login.userSet(false);
            logout.userSet(true);
            expect(settings.get_boolean('showlogin')).toBe(false);
            expect(settings.get_boolean('showlogout')).toBe(true);
            settings.set_boolean('showlogin', true);
            expect(login.active).toBe(true);
        });

        it('logged out: only Login is enabled and it calls Vpn.loginVpn', async () => {
            const {prefs} = await buildPrefs();
            const loginSpy = jest.spyOn(prefs._vpn, 'loginVpn').mockResolvedValue();
            const logoutSpy = jest.spyOn(prefs._vpn, 'logoutVpn').mockResolvedValue();

            buttonLabelled('Logout').click();   // disabled: ignored
            expect(logoutSpy).not.toHaveBeenCalled();
            buttonLabelled('Login').click();
            expect(loginSpy).toHaveBeenCalledTimes(1);
        });

        it('logged in: only Logout is enabled and it calls Vpn.logoutVpn', async () => {
            const {prefs, grid} = await buildPrefs({cli: {'nordvpn account': ACCOUNT_OUT}});
            const loginSpy = jest.spyOn(prefs._vpn, 'loginVpn').mockResolvedValue();
            const logoutSpy = jest.spyOn(prefs._vpn, 'logoutVpn').mockResolvedValue();

            expect(grid('Account email:').controlFor('Account email:').label).toBe('user@example.com');
            buttonLabelled('Login').click();    // disabled: ignored
            expect(loginSpy).not.toHaveBeenCalled();
            buttonLabelled('Logout').click();
            expect(logoutSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Connection page', () => {
        const SWITCHES = {
            'Autoconnect to VPN on startup:': 'autoconnect',
            'Enable CyberSec:': 'cybersec',
            'Enable Firewall:': 'firewall',
            'Enable Killswitch:': 'killswitch',
            'Enable Obfuscate:': 'obfuscate',
            'Enable Analyics (send anonymous usage to NordVpn):': 'analytics',
            'Enable IPv6:': 'ipv6',
        };

        it.each(Object.entries(SWITCHES))('switch "%s" writes %s', async (label, key) => {
            const {settings, grid} = await buildPrefs();
            const sw = grid(label).controlFor(label);
            expect(sw).toBeInstanceOf(Switch);
            expect(sw.active).toBe(settings.get_boolean(key));

            sw.userSet(true);
            expect(settings.get_boolean(key)).toBe(true);
            sw.userSet(false);
            expect(settings.get_boolean(key)).toBe(false);
            // and the other direction
            settings.set_boolean(key, true);
            expect(sw.active).toBe(true);
        });

        it('technology combo writes OPENVPN / NORDLYNX', async () => {
            const {prefs, settings} = await buildPrefs({settings: {technology: 'OPENVPN'}});
            expect(prefs._techCbox.active).toBe(0);

            prefs._techCbox.set_active(1);
            expect(settings.get_string('technology')).toBe('NORDLYNX');
            prefs._techCbox.set_active(0);
            expect(settings.get_string('technology')).toBe('OPENVPN');
        });

        it('protocol combo writes UDP / TCP', async () => {
            const {prefs, settings} = await buildPrefs();
            expect(prefs._protoCbox.active).toBe(0);
            prefs._protoCbox.set_active(1);
            expect(settings.get_string('protocol')).toBe('TCP');
            prefs._protoCbox.set_active(0);
            expect(settings.get_string('protocol')).toBe('UDP');
        });

        it('a fresh install (schema defaults) shows OpenVPN', async () => {
            const {prefs} = await buildPrefs();
            expect(prefs._techCbox.active).toBe(0);
        });

        it('OPENVPN enables obfuscate and protocol; NORDLYNX disables them', async () => {
            const {prefs, grid} = await buildPrefs({settings: {technology: 'OPENVPN'}});
            const obfuscate = grid('Enable Obfuscate:').controlFor('Enable Obfuscate:');
            expect([obfuscate.sensitive, prefs._protoCbox.sensitive]).toEqual([true, true]);

            prefs._techCbox.set_active(1);
            expect([obfuscate.sensitive, prefs._protoCbox.sensitive]).toEqual([false, false]);
            prefs._techCbox.set_active(0);
            expect([obfuscate.sensitive, prefs._protoCbox.sensitive]).toEqual([true, true]);
        });

        it('starts with obfuscate and protocol disabled when technology is NORDLYNX', async () => {
            const {prefs, grid} = await buildPrefs({settings: {technology: 'NORDLYNX'}});
            expect(grid('Enable Obfuscate:').controlFor('Enable Obfuscate:').sensitive).toBe(false);
            expect(prefs._protoCbox.sensitive).toBe(false);
        });

        it('refreshes the combos from `nordvpn settings` after the async sync', async () => {
            const {prefs, settings} = await buildPrefs({
                settings: {technology: 'OPENVPN', protocol: 'UDP'},
                cli: {'nordvpn status': 'Status: Disconnected', 'nordvpn settings': 'Technology: NORDLYNX\nProtocol: TCP\n'},
            });
            expect(settings.get_string('technology')).toBe('NORDLYNX');
            expect(prefs._techCbox.active).toBe(1);
            expect(prefs._protoCbox.active).toBe(1);
            expect(prefs._protoCbox.sensitive).toBe(false);
        });

        it('Apply calls applySettingsToNord once and is disabled while it runs', async () => {
            const {prefs} = await buildPrefs();
            let finish;
            const spy = jest.spyOn(prefs._vpn, 'applySettingsToNord').mockReturnValue(new Promise(r => { finish = r; }));
            const apply = buttonLabelled('Apply');

            apply.click();
            expect(apply.sensitive).toBe(false);
            apply.click();   // ignored while in flight
            expect(spy).toHaveBeenCalledTimes(1);

            finish();
            await flush();
            expect(apply.sensitive).toBe(true);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('Reset Connection Settings restores the schema defaults, ending on OPENVPN', async () => {
            const {prefs, settings} = await buildPrefs({settings: {
                cybersec: true, firewall: true, killswitch: true, obfuscate: true, notify: true, ipv6: true,
                protocol: 'TCP', technology: 'NORDLYNX',
            }});
            buttonLabelled('Reset Connection Settings').click();

            for (const key of ['cybersec', 'firewall', 'killswitch', 'obfuscate', 'notify', 'ipv6', 'protocol']) {
                expect({key, value: settings.get_value(key).deep_unpack()})
                    .toEqual({key, value: settings.get_default_value(key).deep_unpack()});
            }
            expect(settings.get_string('technology')).toBe('OPENVPN');
            expect(prefs._techCbox.active).toBe(0);
            expect(prefs._protoCbox.active).toBe(0);
            expect(prefs._protoCbox.sensitive).toBe(true);
        });
    });

    describe('Cities and Servers pages', () => {
        const treeViews = () => {
            const [cities, servers] = findAll(TreeView);
            return {cities, servers};
        };
        const rowOf = (view, name) => view.get_model().rows.findIndex(r => r[0] === name);
        const selectedNames = (view) => view.get_selection().selectedRows().map(i => view.get_model().rows[i][0]);

        it('populates both lists from the CLI countries and selects the saved ones', async () => {
            await buildPrefs({settings: {
                'countries-selected-for-cities': ['Germany', 'United_States'],
                'countries-selected-for-servers': [74],
            }});
            const {cities, servers} = treeViews();
            expect(cities.get_model().rows.map(r => r[0])).toEqual(['Canada', 'France', 'Germany', 'Japan', 'United States']);
            expect(selectedNames(cities)).toEqual(['Germany', 'United States']);
            expect(selectedNames(servers)).toEqual(['France']);
        });

        it('does not write settings while the lists are being populated', async () => {
            const fake = new FakeSettings({
                'countries-selected-for-cities': ['Germany'],
                'countries-selected-for-servers': [74],
            });
            resetRegistry();
            const prefs = new GnordVpnPrefs(fake);
            prefs._vpn._procCom = createFakeProcCom({'nordvpn status': new Error('down'), 'nordvpn account': new Error('x'), 'nordvpn countries': COUNTRIES_OUT});
            prefs._vpn._httpGet = async () => COUNTRY_IDS;
            prefs.fillPreferencesWindow(createWindow());
            await flush();

            const touched = fake.writes.map(([k]) => k);
            expect(touched).not.toContain('countries-selected-for-cities');
            expect(touched).not.toContain('countries-selected-for-servers');
            expect(prefs._cityPopulating).toBe(false);
            expect(prefs._serverPopulating).toBe(false);
        });

        it('writes countries-selected-for-cities when the selection changes', async () => {
            const {settings} = await buildPrefs();
            const {cities} = treeViews();
            const sel = cities.get_selection();

            sel.select_iter({row: rowOf(cities, 'Canada')});
            sel.select_iter({row: rowOf(cities, 'United States')});
            expect(settings.get_value('countries-selected-for-cities').deep_unpack()).toEqual(['Canada', 'United_States']);

            sel.unselect_all();
            expect(settings.get_value('countries-selected-for-cities').deep_unpack()).toEqual([]);
        });

        it('writes countries-selected-for-servers (country ids) when the selection changes', async () => {
            const {settings} = await buildPrefs();
            const {servers} = treeViews();
            const sel = servers.get_selection();

            sel.select_iter({row: rowOf(servers, 'Germany')});
            sel.select_iter({row: rowOf(servers, 'Japan')});
            expect(settings.get_value('countries-selected-for-servers').deep_unpack()).toEqual([81, 108]);
        });

        it('suppresses writes while _cityPopulating / _serverPopulating is set', async () => {
            const {prefs, settings} = await buildPrefs();
            const {cities, servers} = treeViews();

            prefs._cityPopulating = true;
            prefs._serverPopulating = true;
            cities.get_selection().select_iter({row: 0});
            servers.get_selection().select_iter({row: 0});
            expect(settings.writes).toEqual([]);

            prefs._cityPopulating = false;
            cities.get_selection().select_iter({row: 1});
            expect(settings.writes.map(([k]) => k)).toEqual(['countries-selected-for-cities']);
        });

        it('binds the max cities / servers spinners to their keys', async () => {
            const {settings, grid} = await buildPrefs();
            const cities = grid('Max cities per country displayed:').controlFor('Max cities per country displayed:');
            const servers = grid('Max servers per country displayed:').controlFor('Max servers per country displayed:');
            expect([cities.value, servers.value]).toEqual([10, 10]);

            cities.set_value(25);
            servers.set_value(7);
            expect(settings.get_int('number-cities-per-countries')).toBe(25);
            expect(settings.get_int('number-servers-per-countries')).toBe(7);
        });
    });
});
