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
        for (const id in ids) {
            if (this._ids[id] && typeof this._ids[id] === 'function') {
                try {
                    this._ids[id]();
                    this._ids[id] = null;
                } catch (e) {
                    this._log.error(`failure unregistering callback for ${id}`, e);
                }
            }
        }
    }
    
    disconnectAll() {
        for (const callback in this._ids) {
            try {
                typeof callback === 'function' && callback();
            } catch (e) {
                this._log.error('disconnectAll failed executing callback', e);
            }
        }
        
        this._ids = {};
    }
}
