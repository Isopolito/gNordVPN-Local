const ExtensionUtils = imports.misc.extensionUtils;

var Favorites = class Favorites {
    constructor() {
        this._settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
    }

    _getData(a) { return this._settings.get_string(a); }
    _setData(a, b) { return this._settings.set_string(a, b); }
    
    get(favoriteType, items=[]) {
        let favorites = {};
        try {
            let data = this._getData(favoriteType);
            if (!data) data = '{}';
            favorites = JSON.parse(data);
        } catch(e) {}

        for (const key of Object.keys(favorites)) 
            if (key in items) delete items[key];

        return {
            favorites,
            itemsMinusFavorites: items,
        }
    }
    
    remove(favoriteType, item) {
        if (!item) return;

        try {
            let data = this._getData(favoriteType);
            if (!data) data = '{}';

            let favorites = JSON.parse(data);
            delete favorites[item];

            this._setData(favoriteType, JSON.stringify(favorites));

        } catch(e) {
            log('gnordvpn: ', e);
        }
    }

    add(favoriteType, item, item2) {
        if (!item || !item2) return;

        let favorites = {};
        try {
            let data = this._getData(favoriteType);
            if (!data) data = '{}';
            favorites = JSON.parse(data);
        } catch(e) {}

        try {
            favorites[item] = item2;
            this._setData(favoriteType, JSON.stringify(favorites));
        } catch(e) { 
            log('gnordvpn: ', e);
        }
    }
}
