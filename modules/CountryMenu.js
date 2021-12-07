'use strict';
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const MenuBase = Me.imports.modules.MenuBase.MenuBase;
const Constants = Me.imports.modules.constants;

var CountryMenu = class CountryMenu extends MenuBase {
    constructor(countryCallback) {
        super();
        this._countryCallback = countryCallback;
        this._countryMenu = null;
        this._countryMenuItems = [];
        this._favCountryItems = [];
        this._isBuilt = false;
        this._menuSeperator = null;

        this._favorites = new Me.imports.modules.Favorites.Favorites();
        this._vpn = new Me.imports.modules.Vpn.Vpn();
        this._signals = new Me.imports.modules.Signals.Signals();
    }

    _buildCountryMenuItem(country, isFavorite) {
        const countryDisplayName = this._vpn.getDisplayName(country);
        const menuItem = new PopupMenu.PopupMenuItem(countryDisplayName);
        const menuItemClickId = menuItem.connect(`activate`, function (actor, event) {
                this._vpn.connectVpn(country);
                this._countryCallback(Constants.status.reconnecting)
            }.bind(this)
        );

        this._signals.register(menuItemClickId, function () {
                menuItem.disconnect(menuItemClickId)
            }.bind(this)
        );

        const icofavBtn = super.buildFavIcon(isFavorite);
        menuItem.actor.add_child(icofavBtn);
        menuItem.icofavBtn = icofavBtn;
        menuItem.favoritePressId = icofavBtn.connect(`button-press-event`, function () {
                this._signals.disconnect([menuItemClickId, menuItem.favoritePressId]);
                icofavBtn.destroy();
                menuItem.destroy();

                const newMenuItem = this._buildCountryMenuItem(country, !isFavorite);
                this._addCountryMenuItem(country, newMenuItem, !isFavorite);

                if (isFavorite) {
                    this._favorites.remove(Constants.favorites.favoriteCountries, country);
                } else {
                    this._favorites.add(Constants.favorites.favoriteCountries, country);
                }
            }.bind(this)
        );

        this._signals.register(menuItem.favoritePressId, function () {
            icofavBtn.disconnect(menuItem.favoritePressId)
        }.bind(this));
        return menuItem;
    }

    _addCountryMenuItem(country, newMenuItem, isFavorite) {
        if (isFavorite) {
            let idx = this._countryMenuItems.findIndex(item => item === country);
            if (idx >= 0) this._countryMenuItems.splice(idx, 1);

            this._favCountryItems.push(country);
            this._favCountryItems.sort();
            idx = this._favCountryItems.findIndex(item => item === country);
            this._countryMenu.menu.addMenuItem(newMenuItem, idx);

            this._menuSeperator.destroy();
            this._menuSeperator = new PopupMenu.PopupSeparatorMenuItem();
            this._countryMenu.menu.addMenuItem(this._menuSeperator, this._favCountryItems.length);
        } else {
            let idx = this._favCountryItems.findIndex(item => item === country);
            if (idx >= 0) this._favCountryItems.splice(idx, 1);

            this._countryMenuItems.push(country);
            this._countryMenuItems.sort();
            idx = this._countryMenuItems.findIndex(item => item === country) + this._favCountryItems.length + 1;
            idx = idx > this._countryMenu.menu.numMenuItems
                ? this._countryMenu.menu.numMenuItems - 1
                : idx;

            this._countryMenu.menu.addMenuItem(newMenuItem, idx);
        }
    }

    get isBuilt() {
        return this._isBuilt;
    }

    get menu() {
        return this._countryMenu;
    }

    disable() {
        this._signals.disconnectAll();
        this._countryMenu.destroy();
        this._countryMenuItems = [];
        this._favCountryItems = [];
        this._isBuilt = false;
    }

    tryBuild() {
        if (this._isBuilt) return;

        const countries = this._vpn.getCountries();
        if (!countries || countries.length < 1) return;

        this._countryMenuItems = [];
        this._favCountryItems = [];

        const countryFavs = this._favorites.get(Constants.favorites.favoriteCountries, countries);
        const countryMenu = new PopupMenu.PopupSubMenuMenuItem(`Countries`);
        for (const country of countryFavs.favorites) {
            const menuItem = this._buildCountryMenuItem(country, true);
            this._favCountryItems.push(country);
            countryMenu.menu.addMenuItem(menuItem);
        }

        this._menuSeperator = new PopupMenu.PopupSeparatorMenuItem();
        countryMenu.menu.addMenuItem(this._menuSeperator);

        for (const country of countryFavs.itemsMinusFavorites) {
            const menuItem = this._buildCountryMenuItem(country, false);
            this._countryMenuItems.push(country);
            countryMenu.menu.addMenuItem(menuItem);
        }

        this._isBuilt = true;
        this._countryMenu = countryMenu;
    }
}