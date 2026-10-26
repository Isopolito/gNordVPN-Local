import {jest} from '@jest/globals';
import {createVpn, createFakeProcCom, createFakeSettings} from '../helpers/vpn.js';

describe('Vpn.connectVpn', () => {
    let now;
    beforeEach(() => {
        now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterEach(() => jest.restoreAllMocks());

    it('runs a plain connect when there is no query', async () => {
        const procCom = createFakeProcCom();
        const vpn = createVpn({procCom});
        await vpn.connectVpn();
        expect(procCom.calls).toEqual(['nordvpn c']);
    });

    it('turns autoconnect off, on with the query, then connects with the query', async () => {
        const procCom = createFakeProcCom();
        const vpn = createVpn({procCom});
        await vpn.connectVpn('Germany');
        expect(procCom.calls).toEqual([
            'nordvpn set autoconnect off',
            'nordvpn set autoconnect on  Germany', // sic: the constant has a trailing space
            'nordvpn c Germany',
        ]);
    });

    it('still connects when the autoconnect commands fail', async () => {
        const procCom = createFakeProcCom({
            'nordvpn set autoconnect off': new Error('nope'),
            'nordvpn set autoconnect on  Germany': new Error('nope'),
            'nordvpn c Germany': 'connected',
        });
        const vpn = createVpn({procCom});
        await expect(vpn.connectVpn('Germany')).resolves.toBe('connected');
    });

    it('returns null and spawns nothing within 9 seconds of the previous attempt', async () => {
        const procCom = createFakeProcCom();
        const vpn = createVpn({procCom});
        await vpn.connectVpn();
        procCom.calls.length = 0;

        now += 8_999;
        expect(vpn.isConnectThrottled()).toBe(true);
        expect(await vpn.connectVpn()).toBeNull();
        expect(await vpn.connectVpn('France')).toBeNull();
        expect(procCom.calls).toEqual([]);
    });

    it('connects again once 9 seconds have passed', async () => {
        const procCom = createFakeProcCom();
        const vpn = createVpn({procCom});
        await vpn.connectVpn();
        now += 9_000;
        expect(vpn.isConnectThrottled()).toBe(false);
        await vpn.connectVpn();
        expect(procCom.calls).toEqual(['nordvpn c', 'nordvpn c']);
    });

    it('is not throttled before the first attempt', () => {
        expect(createVpn().isConnectThrottled()).toBe(false);
    });

    it('a rejected connect still counts toward the throttle window', async () => {
        const vpn = createVpn({procCom: createFakeProcCom({'nordvpn c': new Error('fail')})});
        await expect(vpn.connectVpn()).rejects.toThrow('fail');
        expect(vpn.isConnectThrottled()).toBe(true);
    });
});

describe('Vpn.getServers URL construction', () => {
    const BASE = 'https://api.nordvpn.com/v1/servers/recommendations?limit=5';
    const GROUP = '&filters[servers_groups][identifier]=legacy_standard';

    function serversVpn(settingValues, httpResponses = []) {
        const settings = createFakeSettings({
            'number-servers-per-countries': 5,
            'countries-selected-for-servers': [81],
            technology: 'NORDLYNX',
            protocol: 'UDP',
            obfuscate: false,
            ...settingValues,
        });
        const vpn = createVpn({settings});
        const urls = [];
        vpn._httpGet = async (url) => { urls.push(url); return httpResponses.length ? httpResponses.shift() : []; };
        return {vpn, urls};
    }

    it.each([
        ['NORDLYNX', 'UDP', false, '&filters[servers_technologies][identifier]=wireguard_udp'],
        ['NORDLYNX', 'TCP', true, '&filters[servers_technologies][identifier]=wireguard_udp'],
        ['OPENVPN', 'UDP', false, '&filters[servers_technologies][identifier]=openvpn_udp'],
        ['OPENVPN', 'UDP', true, '&filters[servers_technologies][identifier]=openvpn_xor_udp'],
        ['OPENVPN', 'TCP', false, '&filters[servers_technologies][identifier]=openvpn_tcp'],
        ['OPENVPN', 'TCP', true, '&filters[servers_technologies][identifier]=openvpn_xor_tcp'],
    ])('technology=%s protocol=%s obfuscate=%s', async (technology, protocol, obfuscate, filter) => {
        const {vpn, urls} = serversVpn({technology, protocol, obfuscate});
        await vpn.getServers();
        expect(urls).toEqual([BASE + filter + GROUP + '&filters[country_id]=81']);
    });

    it('adds no technology filter for an unrecognised technology', async () => {
        const {vpn, urls} = serversVpn({technology: 'NAKED'});
        await vpn.getServers();
        expect(urls).toEqual([BASE + GROUP + '&filters[country_id]=81']);
    });

    it('adds no technology filter for OPENVPN with an unrecognised protocol', async () => {
        const {vpn, urls} = serversVpn({technology: 'OPENVPN', protocol: 'QUIC'});
        await vpn.getServers();
        expect(urls).toEqual([BASE + GROUP + '&filters[country_id]=81']);
    });

    it('uses the configured limit and issues one request per selected country', async () => {
        const {vpn, urls} = serversVpn({'number-servers-per-countries': 12, 'countries-selected-for-servers': [81, 57]});
        await vpn.getServers();
        expect(urls).toHaveLength(2);
        expect(urls[0]).toContain('limit=12');
        expect(urls[0]).toMatch(/country_id\]=81$/);
        expect(urls[1]).toMatch(/country_id\]=57$/);
    });

    it('maps server names to hostnames without .nordvpn.com', async () => {
        const {vpn} = serversVpn({}, [[
            {name: 'Germany #1234', hostname: 'de1234.nordvpn.com'},
            {name: 'Germany #99', hostname: 'de99.nordvpn.com'},
        ]]);
        expect(await vpn.getServers()).toEqual({'Germany #1234': 'de1234', 'Germany #99': 'de99'});
    });

    it('skips countries whose request returned null', async () => {
        const {vpn} = serversVpn({'countries-selected-for-servers': [1, 2]}, [null, [{name: 'X #1', hostname: 'x1.nordvpn.com'}]]);
        expect(await vpn.getServers()).toEqual({'X #1': 'x1'});
    });

    it('returns null when a request throws', async () => {
        const {vpn} = serversVpn({});
        vpn._httpGet = async () => { throw new Error('network'); };
        expect(await vpn.getServers()).toBeNull();
    });

    it('returns an empty object when no countries are selected', async () => {
        const {vpn, urls} = serversVpn({'countries-selected-for-servers': []});
        expect(await vpn.getServers()).toEqual({});
        expect(urls).toEqual([]);
    });
});
