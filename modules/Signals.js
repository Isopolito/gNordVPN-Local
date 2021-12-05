var Signals = class Signals {
    constructor() {
        this._ids = {};
    }
    
    register(id, callback) {
        if (this._ids[id] && typeof this._ids[id] === 'function') {
            try {
                this._ids[id]();
            } catch (e) {
                log(`gnordvpn: Failure unregistering existing callback for ${id} - ${e}`);
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
                    log(`gnordvpn: Failure unregistering callback for ${id} - ${e}`);
                }
            }
        }
    }
    
    disconnectAll() {
        for (const callback in this._ids) {
            try {
                typeof callback === 'function' && callback();
            } catch (e) {
                log(`gnordvpn: In disconnectAll, failure executing callback - ${e}`);
            }
        }
        
        this._ids = {};
    }
}