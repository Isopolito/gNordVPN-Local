import GLib from 'gi://GLib';

export default class Logger {
    constructor(component) {
        this._component = component;
    }

    debug(msg, fields = {}) {
        console.debug(`[gnordvpn][DBG][${this._component}] ${msg}`, JSON.stringify(fields));
    }

    warn(msg, fields = {}) {
        console.warn(`[gnordvpn][WRN][${this._component}] ${msg}`, JSON.stringify(fields));
    }

    error(msg, e = null, fields = {}) {
        console.error(`[gnordvpn][ERR][${this._component}] ${msg}`, e?.message ?? '', JSON.stringify(fields));
    }

    startTimer() {
        return GLib.get_monotonic_time();
    }

    // tag must be 'CALL' or 'SPAN'. CALL = one actual subprocess/HTTP call. SPAN = logical operation.
    endTimer(start, tag, fields = {}) {
        const ms = Math.round((GLib.get_monotonic_time() - start) / 1000);
        const level = tag === 'CALL' ? 'CALL' : 'SPAN';
        console.debug(
            `[gnordvpn][${level}][${this._component}] ${fields.operation ?? fields.cmd ?? '?'} ${ms}ms`,
            JSON.stringify({...fields, durationMs: ms})
        );
        return ms;
    }
}
