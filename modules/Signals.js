import Logger from './Logger.js';

export default class Signals {
    constructor() {
        this._ids = {};
        this._log = new Logger('Signals');
    }
    
    register(id, callback) {
        if (this._ids[id] && typeof this._ids[id] === 'function') {
            try {
                this._ids[id]();
            } catch (e) {
                this._log.error(`failure unregistering existing callback for ${id}`, e);
            }
        }
        
        this._ids[id] = callback;
    }
    
    disconnect(ids) {
        for (const id of Array.isArray(ids) ? ids : [ids]) {
            const callback = this._ids[id];
            if (typeof callback !== 'function') continue;
            // Forget the entry first so a throwing callback is not retried by disconnectAll().
            delete this._ids[id];
            try {
                callback();
            } catch (e) {
                this._log.error(`failure unregistering callback for ${id}`, e);
            }
        }
    }
    
    disconnectAll() {
        for (const callback of Object.values(this._ids)) {
            try {
                if (typeof callback === 'function') callback();
            } catch (e) {
                this._log.error('disconnectAll failed executing callback', e);
            }
        }
        
        this._ids = {};
    }
}
