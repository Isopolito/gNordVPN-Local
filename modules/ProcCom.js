import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export default class ProcCom {
    constructor(props) {
        Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
    }

    async execCommunicateAsync(command, input = null) {
        let argv = command.split(/\s+/);
        try {
            const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            const [stdout, stderr] = await proc.communicate_utf8_async(null, null);

            if (proc.get_successful()) return stdout;
            else throw new Error(stderr);
        } catch (e) {
            logError(e, `gnordvpn`);
        }
    }

    execCommunicateSync(command) {
        return GLib.spawn_command_line_sync(command);
    }
}