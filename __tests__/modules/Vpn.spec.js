import { jest } from '@jest/globals';

// Mock the external modules
jest.mock('gi://Gio', () => ({
    app_info_launch_default_for_uri: jest.fn()
}), { virtual: true });

jest.mock('gi://Soup', () => ({
    Session: {
        new: jest.fn().mockReturnValue({
            send_and_read: jest.fn().mockReturnValue({
                get_data: jest.fn().mockReturnValue(new TextEncoder().encode('{"mockData": true}'))
            })
        })
    },
    Message: {
        new: jest.fn().mockReturnValue({
            get_status: jest.fn().mockReturnValue(200),
            get_reason_phrase: jest.fn().mockReturnValue('OK')
        })
    },
    Status: {
        OK: 200
    },
    get_major_version: jest.fn().mockReturnValue(3)
}), { virtual: true });

jest.mock('../../modules/ProcCom.js', () => ({
    default: class {
        execCommunicateSync() {
            return [true, 'mock output', '', 0];
        }
        execCommunicateAsync() {
            return Promise.resolve('mock async output');
        }
    }
}), { virtual: true });

// Import the Vpn class
import Vpn from '../../modules/Vpn.js';

describe('Vpn_tests', () => {
    let vpn;
    let mockSettings;

    beforeEach(() => {
        // Create a mock settings object
        mockSettings = {
            set_string: jest.fn(),
            set_boolean: jest.fn(),
            get_boolean: jest.fn(),
            get_string: jest.fn(),
            get_value: jest.fn().mockReturnValue({ unpack: () => 5, deep_unpack: () => ['country1', 'country2'] }),
        };

        vpn = new Vpn(mockSettings);
    });

    test('_processCityCountryOutput processes clean country output correctly', () => {
        const input = `Albania
Australia
Brazil
Canada
United_States`;
        const expected = ['Albania', 'Australia', 'Brazil', 'Canada', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('_processCityCountryOutput handles junk characters', () => {
        const input = `*Albania
**Australia
---Brazil
>>>Canada
  United_States`;
        const expected = ['Albania', 'Australia', 'Brazil', 'Canada', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('_resolveSettingsValue correctly resolves boolean values', () => {
        expect(vpn._resolveSettingsValue('enabled')).toBe(true);
        expect(vpn._resolveSettingsValue('disabled')).toBe(false);
        expect(vpn._resolveSettingsValue('some other value')).toBe('some other value');
    });

    test('_resolveSettingsKey correctly resolves setting keys', () => {
        expect(vpn._resolveSettingsKey('firewall')).toBe('firewall');
        expect(vpn._resolveSettingsKey('kill switch')).toBe('killswitch');
        expect(vpn._resolveSettingsKey('threat protection lite')).toBe('cybersec');
        expect(vpn._resolveSettingsKey('unknown setting')).toBe(null);
    });

    test('isNordVpnRunning returns true when exit status is 0', () => {
        expect(vpn.isNordVpnRunning()).toBe(true);
    });

    test('getAccount parses account information correctly', () => {
        const mockOutput = `Your account:
Email Address: test@example.com
VPN Service: Active (Expires on 31 December 2025)`;
        jest.spyOn(vpn, '_execSyncIfVpnOn').mockReturnValue(mockOutput);

        const account = vpn.getAccount();
        expect(account).toEqual({
            emailAddress: 'test@example.com',
            vpnService: 'Active (Expires on 31 December 2025)'
        });
    });

    test('checkLogin returns true when already logged in', () => {
        jest.spyOn(vpn._procCom, 'execCommunicateSync').mockReturnValue([true, 'You are already logged in.', '', 0]);
        expect(vpn.checkLogin()).toBe(true);
    });

    test('getStatus parses status information correctly', async () => {
        const mockOutput = `Status: Connected
Current server: mock.nordvpn.com
Country: United States
City: New York
Server IP: 123.456.789.0
Current technology: NordLynx
Current protocol: UDP
Transfer: 100 MB received, 50 MB sent
Uptime: 1 hour 30 minutes`;

        jest.spyOn(vpn._procCom, 'execCommunicateAsync').mockResolvedValue(mockOutput);

        const status = await vpn.getStatus();
        expect(status).toEqual({
            connectStatus: 'Status: Connected',
            updateMessage: undefined,
            country: 'UNITED STATES',
            city: 'New York',
            serverNumber: null,
            currentServer: 'mock.nordvpn.com',
            serverIp: '123.456.789.0',
            currentTech: 'NordLynx',
            currentProtocol: 'UDP',
            transfer: '100 MB received, 50 MB sent',
            uptime: '1 hour 30 minutes'
        });
    });

    test('loginVpn launches default browser with login URL', () => {
        const mockLoginOutput = 'Continue in the browser: https://nordvpn.com/login';
        jest.spyOn(vpn, '_execSyncIfVpnOn').mockReturnValue(mockLoginOutput);

        vpn.loginVpn();

        expect(vpn._execSyncIfVpnOn).toHaveBeenCalledWith('nordvpn login');
        expect(jest.requireMock('gi://Gio').app_info_launch_default_for_uri)
            .toHaveBeenCalledWith('https://nordvpn.com/login', null);
    });

    // Add more tests for other methods as needed...
});