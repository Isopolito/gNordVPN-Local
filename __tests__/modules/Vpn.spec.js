import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

// Vpn.js talks to GNOME through gi:// modules, which jest maps to the stubs in __mocks__/gi.
// The constructor needs a few fakes on those stubs; ProcCom is replaced per test.
globalThis.log = () => {};
Soup.Session = {new: () => ({}), prototype: {}};
Soup.get_major_version = () => 3;
Gio._promisify = () => {};
Gio.Subprocess = {prototype: {}};

const {default: Vpn} = await import('../../modules/Vpn.js');

function createTrackedProcCom({ rejects } = {}) {
    const calls = [];
    return {
        async execCommunicateAsync(cmd) {
            calls.push(cmd);
            if (rejects) throw rejects;
        },
        calls
    };
}

function createVpn(procCom) {
    const vpn = new Vpn({});
    vpn._procCom = procCom;
    return vpn;
}

describe('checkLogin', () => {
    it('should return true when nordvpn account succeeds (logged in)', async () => {
        const mockProcCom = createTrackedProcCom();
        const vpn = createVpn(mockProcCom);
        expect(await vpn.checkLogin()).toBe(true);
        expect(mockProcCom.calls).toContain('nordvpn account');
    });

    it('should return false when nordvpn account throws a plain Error (logged out)', async () => {
        const mockProcCom = createTrackedProcCom({ rejects: new Error("You're not logged in.") });
        const vpn = createVpn(mockProcCom);
        expect(await vpn.checkLogin()).toBe(false);
        expect(mockProcCom.calls).toContain('nordvpn account');
    });

    it('should re-throw GLib errors (infrastructure failures)', async () => {
        const glibErr = new Error('spawn failed');
        glibErr.code = 2;
        const mockProcCom = createTrackedProcCom({ rejects: glibErr });
        const vpn = createVpn(mockProcCom);
        await expect(vpn.checkLogin()).rejects.toBe(glibErr);
    });

    it('should use nordvpn account command, not nordvpn login', async () => {
        const mockProcCom = createTrackedProcCom();
        const vpn = createVpn(mockProcCom);
        await vpn.checkLogin();
        expect(mockProcCom.calls).not.toContain('nordvpn login');
        expect(mockProcCom.calls).toContain('nordvpn account');
    });
});
