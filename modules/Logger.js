import GLib from 'gi://GLib';

export default class Logger {
    constructor(component) {
        this._component = component;
    }

    _format(level, msg, fields = {}) {
        const suffix = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
        return `[gNordVpn][${level}][${this._component}] ${msg}${suffix}`;
    }

    debug(msg, fields = {}) {
        log(this._format('DBG', msg, fields));
    }

    warn(msg, fields = {}) {
        log(this._format('WRN', msg, fields));
    }

    error(msg, e = null, fields = {}) {
        const payload = {
            ...fields,
            ...(e?.message ? {error: e.message} : {}),
        };
        logError(e ?? new Error(msg), this._format('ERR', msg, payload));
    }

    startTimer() {
        return GLib.get_monotonic_time();
    }

    // tag must be 'CALL' or 'SPAN'. CALL = one actual subprocess/HTTP call. SPAN = logical operation.
    endTimer(start, tag, fields = {}) {
        const ms = Math.round((GLib.get_monotonic_time() - start) / 1000);
        const level = tag === 'CALL' ? 'CALL' : 'SPAN';
        log(this._format(level, `${fields.operation ?? fields.cmd ?? '?'} ${ms}ms`, {
            ...fields,
            durationMs: ms,
        }));
        return ms;
    }
}
