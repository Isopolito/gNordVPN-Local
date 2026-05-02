import Gio from 'gi://Gio';

import Logger from './Logger.js';

function _cmdName(command) {
    return command.trim().split(/\s+/)[0].split('/').pop();
}

export default class ProcCom {
    constructor(props) {
        this._log = new Logger('ProcCom');
        Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
    }

    async execCommunicateAsync(command, input = null) {
        let argv = command.split(/\s+/);
        const t = this._log.startTimer();
        const cmd = _cmdName(command);
        let proc;
        try {
            proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (e) {
            this._log.endTimer(t, 'CALL', {cmd, blocking: false, success: false});
            this._log.error('subprocess creation failed', e);
            throw e;
        }
        const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
        const success = proc.get_successful();
        this._log.endTimer(t, 'CALL', {cmd, blocking: false, success});
        if (!success) throw new Error(stderr);
        return stdout;
    }

}
