import {createVpn, createFakeProcCom, readFixture} from '../helpers/vpn.js';

const statusVpn = (response) => createVpn({procCom: createFakeProcCom({'nordvpn status': response})});

// NOTE: the nordvpn CLI on the dev machine was installed but disconnected when these were
// written, so the connected fixtures are hand-written from the parsing code in modules/Vpn.js
// and the documented CLI output format. IP addresses use documentation ranges (RFC 5737).
describe('Vpn.getStatus', () => {
    it('parses current-format connected output', async () => {
        const status = await statusVpn(readFixture('status-connected-current.txt')).getStatus();
        expect(status).toMatchObject({
            running: true,
            connectStatus: 'Status: Connected',
            country: 'GERMANY',
            city: 'Frankfurt',
            currentServer: 'de1234.nordvpn.com',
            serverIp: '203.0.113.10',
            currentTech: 'NORDLYNX',
            currentProtocol: 'UDP',
            transfer: '1.25 MiB received, 310.40 KiB sent',
            uptime: '1 hour 5 minutes 3 seconds',
        });
        expect(status.updateMessage).toBeUndefined();
    });

    it('extracts the server number from the hostname as a regex match array', async () => {
        const status = await statusVpn(readFixture('status-connected-current.txt')).getStatus();
        // Current behaviour: serverNumber is the String.match() result, not a plain string/number.
        expect(status.serverNumber[0]).toBe('1234');
    });

    it('parses legacy-format output (Current server: / Server IP:)', async () => {
        const status = await statusVpn(readFixture('status-connected-legacy.txt')).getStatus();
        expect(status).toMatchObject({
            running: true,
            connectStatus: 'Status: Connected',
            country: 'UNITED STATES',
            city: 'New York',
            currentServer: 'us9876.nordvpn.com',
            serverIp: '198.51.100.7',
            currentTech: 'OPENVPN',
            currentProtocol: 'TCP',
            transfer: '4.10 MiB received, 1.02 MiB sent',
            uptime: '12 minutes 40 seconds',
        });
        expect(status.serverNumber[0]).toBe('9876');
    });

    it('returns N/A defaults for a disconnected status', async () => {
        const status = await statusVpn(readFixture('status-disconnected.txt')).getStatus();
        expect(status).toEqual({
            running: true,
            connectStatus: 'Status: Disconnected',
            updateMessage: undefined,
            country: 'N/A',
            city: 'N/A',
            serverNumber: 'N/A',
            currentServer: 'N/A',
            serverIp: 'N/A',
            currentTech: 'N/A',
            currentProtocol: 'N/A',
            transfer: 'N/A',
            uptime: 'N/A',
        });
    });

    it('captures the update-available message', async () => {
        const status = await statusVpn(readFixture('status-update-available.txt')).getStatus();
        expect(status.connectStatus).toBe('Status: Disconnected');
        expect(status.updateMessage).toContain('new version of NordVPN is available');
    });

    it('reports running with connectStatus N/A when the output is empty', async () => {
        const status = await statusVpn('').getStatus();
        expect(status.running).toBe(true);
        expect(status.connectStatus).toBe('N/A');
    });

    it('reports running: false when nordvpn exits non-zero (plain Error)', async () => {
        const status = await statusVpn(new Error('Whoops! Cannot reach System Daemon.')).getStatus();
        expect(status.running).toBe(false);
        expect(status.connectStatus).toBe('N/A');
        expect(status.country).toBe('N/A');
    });

    it('rethrows a GLib.Error-like spawn failure (non-Error object with a numeric .code)', async () => {
        const glibErr = {message: 'Failed to execute child process "nordvpn"', code: 4};
        const vpn = createVpn({procCom: {execCommunicateAsync: async () => { throw glibErr; }}});
        await expect(vpn.getStatus()).rejects.toBe(glibErr);
    });

    // Current behaviour: unlike checkLogin(), getStatus() only looks at `instanceof Error`, so an
    // Error that also carries a .code is treated as "daemon not running" rather than rethrown.
    it('swallows an Error that carries a .code as running: false', async () => {
        const err = new Error('spawn failed');
        err.code = 4;
        const status = await statusVpn(err).getStatus();
        expect(status.running).toBe(false);
    });

    it('rethrows non-Error rejections', async () => {
        const vpn = createVpn({procCom: {execCommunicateAsync: async () => { throw 'boom'; }}});
        await expect(vpn.getStatus()).rejects.toBe('boom');
    });

    it('runs exactly one subprocess per call', async () => {
        const procCom = createFakeProcCom({'nordvpn status': 'Status: Disconnected\n'});
        await createVpn({procCom}).getStatus();
        expect(procCom.calls).toEqual(['nordvpn status']);
    });
});
