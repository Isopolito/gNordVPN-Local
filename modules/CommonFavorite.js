'use strict';
const PopupMenu = imports.ui.popupMenu;

// gNordVpn-Local modules
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Vpn = Me.imports.modules.Vpn.Vpn;
const Constants = Me.imports.modules.constants;
const Signals = Me.imports.modules.Signals.Signals;
const MenuBase = Me.imports.modules.MenuBase.MenuBase;
const Favorites = Me.imports.modules.Favorites.Favorites;

var CommonFavorite = class CommonFavorite extends MenuBase {
    constructor(connectionCallback) {
        super();
        this._connectionCallback = connectionCallback;
        this._isBuilt = false;
        this.favList = {};
        this.itemList = {};
        this._destroyMap = {};
        this.prevShowHide = true;

        this._favorites = new Favorites();
        this._vpn = new Vpn();
        this._signals = new Signals();
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
        const menuItemClickId = menuItem.connect(`activate`, function (actor, event) {
                this._vpn.connectVpn(this.favList[favorite].item);
                let type = this.favList[favorite].type.substring(this.favList[favorite].type.lastIndexOf('-') + 1)
                this._connectionCallback(Constants.status.reconnecting, [type, this.favList[favorite].item]);
            }.bind(this)
        );

        this._signals.register(menuItemClickId, function () {
                menuItem.disconnect(menuItemClickId)
            }.bind(this)
        );

        const icofavBtn = super.buildFavIcon(true);
        menuItem.actor.add_child(icofavBtn);
        menuItem.icofavBtn = icofavBtn;
        this._destroyMap[favorite] = {menuItemClickId, menuItem, icofavBtn};
        menuItem.favoritePressId = icofavBtn.connect(`button-press-event`, function () {
                this._favorites.remove(this.favList[favorite].type, favorite); 
                this._toggleFavoriteMenuItem(favorite, false); 

            }.bind(this)
        );

        this._signals.register(menuItem.favoritePressId, function () {
            icofavBtn.disconnect(menuItem.favoritePressId)
        }.bind(this));

        return menuItem;
    }

    _toggleFavoriteMenuItem(favorite, toAdd) {
        let d = this._destroyMap[favorite];
        if (d) {
            this._signals.disconnect([d.menuItemClickId, d.menuItem.favoritePressId]);
            d.icofavBtn.destroy();
            d.menuItem.destroy();
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
