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
        for (const id of ids) {
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
        for (const callback of this._ids) {
            try {
                callback();
            } catch (e) {
                log(`gnordvpn: In disconnectAll, failure executing callback - ${e}`);
            }
        }
        
        this._ids ={};
    }
}