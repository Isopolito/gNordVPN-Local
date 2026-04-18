import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import Logger from './Logger.js';

const _log = new Logger('ProcCom');

function _cmdName(command) {
    return command.trim().split(/\s+/)[0].split('/').pop();
}

export default class ProcCom {
    constructor(props) {
        Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
    }

    async execCommunicateAsync(command, input = null) {
        let argv = command.split(/\s+/);
        const t = _log.startTimer();
        const cmd = _cmdName(command);
        let proc;
        try {
            proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (e) {
            _log.endTimer(t, 'CALL', {cmd, blocking: false, success: false});
            logError(e, `gNordVpn`);
            throw e;
        }
        const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
        const success = proc.get_successful();
        _log.endTimer(t, 'CALL', {cmd, blocking: false, success});
        if (!success) throw new Error(stderr);
        return stdout;
    }

    execCommunicateSync(command) {
        const t = _log.startTimer();
        const result = GLib.spawn_command_line_sync(command);
        _log.endTimer(t, 'CALL', {cmd: _cmdName(command), blocking: true, success: result[0]});
        return result;
    }
}
