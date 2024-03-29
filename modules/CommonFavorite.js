import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import Vpn from './Vpn.js';
import Signals from './Signals.js';
import Favorites from './Favorites.js';
import MenuBase from './MenuBase.js';
import * as Constants from './constants.js';

export default class CommonFavorite extends MenuBase {
    constructor(connectionCallback, settings) {
        super();
        this._connectionCallback = connectionCallback;
        this._isBuilt = false;
        this.favList = {};
        this.itemList = {};
        this._destroyMap = {};
        this.prevShowHide = true;

        this._favorites = new Favorites(settings);
        this._vpn = new Vpn(settings);
        this._signals = new Signals();
    }

    disable() {
        this._isBuilt = false;
        this._destroyMap = {};
        this.favList = {};
        this.itemList = {};
    }
    
    updateFavorite() {

        let newFav = {};

        Object.keys(Constants.favorites).forEach(key => {
            let getFav = this._favorites.get(Constants.favorites[key]).favorites; 
            let getFavReformat = {};
            Object.keys(getFav).forEach(k => {
                getFavReformat[k] = {item: getFav[k], type: Constants.favorites[key]};
            })
            newFav = {...newFav, ...getFavReformat};   
        });

        //newFav-favList
        let toAddToFav = Object.keys(newFav).filter(x => !Object.keys(this.favList).includes(x));
        toAddToFav.forEach(favorite => { this.favList[favorite] = newFav[favorite]; this._toggleFavoriteMenuItem(favorite, true); })

        //favList-newFav
        let toRemoveFromFav = Object.keys(this.favList).filter(x => !Object.keys(newFav).includes(x))
        toRemoveFromFav.forEach(favorite => { this._toggleFavoriteMenuItem(favorite, false); })
    
        this.showHide(this.prevShowHide);
    }

    rebuild() {
        this._isBuilt = false;
        this.build();
    }

    _buildFavoriteMenuItem(favorite) {
        const menuItem = new PopupMenu.PopupMenuItem(favorite);
        const menuItemClickId = menuItem.connect(`activate`, (actor, event) => {
                this._vpn.connectVpn(this.favList[favorite].item);
                let type = this.favList[favorite].type.substring(this.favList[favorite].type.lastIndexOf('-') + 1)
                this._connectionCallback(Constants.status.reconnecting, [type, this.favList[favorite].item]);
            });

        this._signals.register(menuItemClickId, () => menuItem.disconnect(menuItemClickId));

        const icofavBtn = super.buildFavIcon(true);
        menuItem.actor.add_child(icofavBtn);
        menuItem.icofavBtn = icofavBtn;
        this._destroyMap[favorite] = {menuItemClickId, menuItem, icofavBtn};
        menuItem.favoritePressId = icofavBtn.connect(`button-press-event`, () => {
                this._favorites.remove(this.favList[favorite].type, favorite); 
                this._toggleFavoriteMenuItem(favorite, false); 
            });

        this._signals.register(menuItem.favoritePressId, () => icofavBtn.disconnect(menuItem.favoritePressId));
        return menuItem;
    }

    _toggleFavoriteMenuItem(favorite, toAdd) {
        let menuItemElements = this._destroyMap[favorite];
        if (menuItemElements) {
            this._signals.disconnect([menuItemElements.menuItemClickId, menuItemElements.menuItem.favoritePressId]);
            menuItemElements.icofavBtn.destroy();
            menuItemElements.menuItem.destroy();
        }

        if (toAdd) { 
            const newMenuItem = this._buildFavoriteMenuItem(favorite);
            this._addFavoriteMenuItem(favorite, newMenuItem);

        } else { 
            delete this.favList[favorite];
        }
    }

    _addFavoriteMenuItem(favorite, newMenuItem) {
        let byType = {}
        Object.keys(this.favList).forEach(key => {
            if (!byType[this.favList[key].type]) byType[this.favList[key].type] = [];
            byType[this.favList[key].type].push(key);
        })
        Object.keys(byType).forEach(key => byType[key]);

        let idx = 0;
        let typeFound;
        let typeList = Object.keys(Constants.favorites).map(e => Constants.favorites[e]);
        typeList.every(type => {
            if (!byType[type]) byType[type] = [];
            if (type === this.favList[favorite].type) typeFound = type;
            else idx += byType[type].length;
        
            return !typeFound;
        })

        idx += byType[typeFound].sort().findIndex(item => item === favorite);

        this._favoriteMenu.menu.addMenuItem(newMenuItem, idx);
    }

    get isBuilt() {
        return this._isBuilt;
    }

    get menu() {
        return this._favoriteMenu;
    }

    build() {
        if (this._isBuilt) return;
        if (!this._favoriteMenu) this._favoriteMenu = new PopupMenu.PopupSubMenuMenuItem("Favorites");
        else this._favoriteMenu.menu.removeAll();

        this.favList = {};
        this.itemList = {};
        Object.keys(Constants.favorites).forEach(key => {
            let getFav = this._favorites.get(Constants.favorites[key]).favorites;
            let getFavReformat = {};
            Object.keys(getFav).forEach(k => {
                getFavReformat[k] = {item: getFav[k], type: Constants.favorites[key]};
            })

            this.favList = {...this.favList, ...getFavReformat};
            
            for (const fav of Object.keys(getFav).sort()) {
                const menuItem = this._buildFavoriteMenuItem(fav);
                this.itemList[fav] = menuItem;
                this._favoriteMenu.menu.addMenuItem(menuItem);
            }
        })

        if (Object.keys(this.favList).length < 1) {
            this._favoriteMenu.hide();
        } else {
            this._favoriteMenu.show();
        }

        this._isBuilt = true;
    }

    showHide(show=true) {
        this.prevShowHide = show;
        if (Object.keys(this.favList).length < 1 || !show) {
            this._favoriteMenu.hide();
        } else {
            this._favoriteMenu.show();
        }
    }
}
