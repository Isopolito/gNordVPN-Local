import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// gNordVpn-Local modules
import * as Vpn from './Vpn';
import * as Constants from './constants';
import * as Signals from './Signals';
import * as MenuBase from './MenuBase';
import * as Favorites from './Favorites';
import * as Common from './common';

var ConnectionMenu = class ConnectionMenu extends MenuBase {
    constructor(connectionLabel, connectionType, favoritesKey, connectionCallback) {
        super();
        this._connectionCallback = connectionCallback;
        this._connectionMenu = null;
        this._connectionMenuItems = [];
        this._favConnectionItems = [];
        this._isBuilt = false;
        this._menuSeperator = null;
        this._destroyMap = {};

        this._favorites = new Favorites();
        this._vpn = new Vpn();
        this._signals = new Signals();

        this._connectionLabel = connectionLabel;
        this._connectionType = connectionType;
        this._favoritesKey = favoritesKey;
    }

    updateFavorite() {
        const connectionFavs = this._favorites.get(this._favoritesKey).favorites;

        //connectionFavs-favConnectionItems
        let toAddToFav = Common.safeObjectKeys(connectionFavs).filter(x => !this._favConnectionItems.includes(x));
        toAddToFav.forEach(connection => {
            this._toggleConnectionMenuItem(connection, !true);
        })

        //_favConnectionItems-connectionFavs
        let toRemoveFromFav = this._favConnectionItems.filter(x => !Common.safeObjectKeys(connectionFavs).includes(x))
        toRemoveFromFav.forEach(connection => {
            this._toggleConnectionMenuItem(connection, !false);
        })
    }

    rebuild() {
        this._isBuilt = false;
        this._connectionMenu.menu.removeAll();
        this._connectionMenu.menu.addMenuItem(this._buildPlaceHolderMenuItem());
        this.tryBuild();
    }

    _buildPlaceHolderMenuItem() {
        return new PopupMenu.PopupMenuItem("Loading...");
    }

    _buildConnectionMenuItem(connection, isFavorite) {
        const menuItem = new PopupMenu.PopupMenuItem(connection);
        const menuItemClickId = menuItem.connect(`activate`, (actor, event) => {
            this._vpn.connectVpn(this._connections[connection]);
            this._connectionCallback(Constants.status.reconnecting, [this._connectionType, this._connections[connection]]);
        });

        this._signals.register(menuItemClickId, () => menuItem.disconnect(menuItemClickId));

        const icofavBtn = super.buildFavIcon(isFavorite);
        menuItem.actor.add_child(icofavBtn);
        menuItem.icofavBtn = icofavBtn;
        this._destroyMap[connection] = {menuItemClickId, menuItem, icofavBtn};
        menuItem.favoritePressId = icofavBtn.connect(`button-press-event`, () => {
            this._toggleConnectionMenuItem(connection, isFavorite);
            if (isFavorite) this._favorites.remove(this._favoritesKey, connection);
            else this._favorites.add(this._favoritesKey, connection, this._connections[connection]);
        });

        this._signals.register(menuItem.favoritePressId, () => icofavBtn.disconnect(menuItem.favoritePressId));
        return menuItem;
    }

    _toggleConnectionMenuItem(connection, isFavorite) {
        let d = this._destroyMap[connection];
        if (d && !d.isDisposed) {

            d.isDisposed = true;
            this._signals.disconnect([d.menuItemClickId, d.menuItem.favoritePressId]);
            d.icofavBtn.destroy();
            d.menuItem.destroy();
        }

        const newMenuItem = this._buildConnectionMenuItem(connection, !isFavorite);
        this._addConnectionMenuItem(connection, newMenuItem, !isFavorite);
    }

    _addConnectionMenuItem(connection, newMenuItem, isFavorite) {
        if (isFavorite) {
            let idx = this._connectionMenuItems.findIndex(item => item === connection);
            if (idx >= 0) this._connectionMenuItems.splice(idx, 1);

            this._favConnectionItems.push(connection);
            this._favConnectionItems.sort();
            idx = this._favConnectionItems.findIndex(item => item === connection);
            this._connectionMenu.menu.addMenuItem(newMenuItem, idx);

            this._menuSeperator.destroy();
            this._menuSeperator = new PopupMenu.PopupSeparatorMenuItem();
            this._connectionMenu.menu.addMenuItem(this._menuSeperator, this._favConnectionItems.length);
        } else {
            let idx = this._favConnectionItems.findIndex(item => item === connection);
            if (idx >= 0) this._favConnectionItems.splice(idx, 1);

            this._connectionMenuItems.push(connection);
            this._connectionMenuItems.sort();
            idx = this._connectionMenuItems.findIndex(item => item === connection) + this._favConnectionItems.length + 1;
            idx = idx > this._connectionMenu.menu.numMenuItems
                ? this._connectionMenu.menu.numMenuItems - 1
                : idx;

            this._connectionMenu.menu.addMenuItem(newMenuItem, idx);
        }
    }

    get isBuilt() {
        return this._isBuilt;
    }

    get menu() {
        return this._connectionMenu;
    }

    disable() {
        this._signals.disconnectAll();
        this._connectionMenu.destroy();
        this._connectionMenuItems = [];
        this._favConnectionItems = [];
        this._isBuilt = false;
    }

    tryBuild() {
        if (this._isBuilt) return;
        if (!this._connectionMenu) this._connectionMenu = new PopupMenu.PopupSubMenuMenuItem(this._connectionLabel);
        else this._connectionMenu.menu.removeAll();

        this._connections = this._vpn.getConnectionList(this._connectionType);
        if (!this._connections) return;

        this._connectionMenuItems = [];
        this._favConnectionItems = [];

        const connectionFavs = this._favorites.get(this._favoritesKey, this._connections);
        this._connections = {...connectionFavs.favorites, ...connectionFavs.itemsMinusFavorites};

        for (const connection of Common.safeObjectKeys(connectionFavs.favorites).sort()) {
            const menuItem = this._buildConnectionMenuItem(connection, true);
            this._favConnectionItems.push(connection);
            this._connectionMenu.menu.addMenuItem(menuItem);
        }

        this._menuSeperator = new PopupMenu.PopupSeparatorMenuItem();
        this._connectionMenu.menu.addMenuItem(this._menuSeperator);

        for (const connection of Common.safeObjectKeys(connectionFavs.itemsMinusFavorites).sort()) {
            const menuItem = this._buildConnectionMenuItem(connection, false);
            this._connectionMenuItems.push(connection);
            this._connectionMenu.menu.addMenuItem(menuItem);
        }

        if (Common.safeObjectKeys(this._connections).length < 1) {
            this._connectionMenu.hide();
        } else {
            this._connectionMenu.show();
        }

        this._isBuilt = true;
    }

    showHide(show = true) {
        if (Common.safeObjectKeys(this._connections).length < 1 || !show) {
            this._connectionMenu.hide();
        } else {
            this._connectionMenu.show();
        }
    }
}