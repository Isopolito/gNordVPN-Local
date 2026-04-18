export default class Signals {
    constructor() {
        this._ids = {};
    }
    
    register(id, callback) {
        if (this._ids[id] && typeof this._ids[id] === 'function') {
            try {
                this._ids[id]();
            } catch (e) {
                log(`gNordVpn: failure unregistering existing callback for ${id} - ${e}`);
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
                    log(`gNordVpn: failure unregistering callback for ${id} - ${e}`);
                }
            }
        }
    }
    
    disconnectAll() {
        for (const callback in this._ids) {
            try {
                typeof callback === 'function' && callback();
            } catch (e) {
                log(`gNordVpn: disconnectAll failed executing callback - ${e}`);
            }
        }
        
        this._ids = {};
    }
}
