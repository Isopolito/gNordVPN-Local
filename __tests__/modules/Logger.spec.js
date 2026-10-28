import Logger from '../../modules/Logger.js';
import GLib from 'gi://GLib';

describe('Logger.endTimer', () => {
    it('always logs, even fast successful calls, and returns the duration', () => {
        const lines = [];
        globalThis.log = m => lines.push(m);
        GLib.get_monotonic_time = () => 5000;
        expect(new Logger('T').endTimer(0, 'CALL', {cmd: 'nordvpn', success: true})).toBe(5);
        expect(lines).toHaveLength(1);
    });
});
