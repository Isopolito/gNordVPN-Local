const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;

// gNordvpn-Local modules
const Me = ExtensionUtils.getCurrentExtension();
const vpnStateManagement = Me.imports.modules.vpnStateManagement;
const Vpn = new Me.imports.modules.Vpn.Vpn();
const Constants = Me.imports.modules.constants;
const Favorites = new Me.imports.modules.Favorites.Favorites();

let _vpnIndicator, _panelLabel, _statusLabel, _connectMenuItem, _disconnectMenuItem,
    _connectMenuItemClickId, _updateMenuLabel, _disconnectMenuItemClickId, _isCountryMenuBuilt,
    _countryMenu, _countryMenuItems, _favCountryCount;

const VpnIndicator = new Lang.Class({
    Name: `VpnIndicator`,
    Extends: PanelMenu.Button,

    _init: function () {
        // Init the parent
        this.parent(0.0, `VPN Indicator`, false);
        this._countryCallback = this._overrideRefresh.bind(this);
    },

    _tryToBuildCountryMenu() {
        const countries = Vpn.getCountries();
        if (!countries || countries.length < 1) return;

        _countryMenuItems = [];
        _favCountryCount = 0;
        const countryFavs = Favorites.get(Constants.favorites.favoriteCountries, countries);
        const cPopupMenuExpander = new PopupMenu.PopupSubMenuMenuItem(`Countries`);
        for (const country of countryFavs.favorites) {
            const menuItem = buildCountryMenuItem(country, true, this._countryCallback);
            _favCountryCount++;
            cPopupMenuExpander.menu.addMenuItem(menuItem);
        }

        cPopupMenuExpander.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const country of countryFavs.itemsMinusFavorites) {
            const menuItem = buildCountryMenuItem(country, false, this._countryCallback);
            _countryMenuItems.push(country);
            cPopupMenuExpander.menu.addMenuItem(menuItem);
        }

        _isCountryMenuBuilt = true;
        return cPopupMenuExpander;
    },

    _overrideRefresh(state) {
        vpnStateManagement.refreshOverride(state);
        this._refresh();
    },

    // Can`t build this country selection menu until nordvpn is properly up and running.
    // If menu construction only happens once at startup when gnome is loading up extensions 
    // after reboot, the menu won`t get populated correctly.
    _buildCountryMenuIfNeeded() {
        if (_isCountryMenuBuilt) return;

        _countryMenu = this._tryToBuildCountryMenu();
        if (_countryMenu) this.menu.addMenuItem(_countryMenu);
    },

    enable() {
        // Add the menu items to the menu
        _statusLabel = new St.Label({text: `Checking...`, y_expand: false, style_class: `statuslabel`});
        this.menu.box.add(_statusLabel);

        _updateMenuLabel = new St.Label({visible: false, style_class: `updatelabel`});
        this.menu.box.add(_updateMenuLabel);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        _connectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.connect);
        _connectMenuItemClickId = _connectMenuItem.connect(`activate`, Lang.bind(this, this._connect));
        this.menu.addMenuItem(_connectMenuItem);

        _disconnectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.disconnect);
        _disconnectMenuItemClickId = _disconnectMenuItem.connect(`activate`, Lang.bind(this, this._disconnect));
        this.menu.addMenuItem(_disconnectMenuItem);

        // Create and add the button with label for the panel
        let button = new St.Bin({
            style_class: `panel-button`,
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: false,
            track_hover: true
        });
        _panelLabel = new St.Label();
        button.set_child(_panelLabel);
        this.add_actor(button);

        this._refresh();
    },

    _refresh() {
        // Stop the refreshes
        this._clearTimeout();

        const status = Vpn.getStatus();
        const currentVpnState = vpnStateManagement.resolveState(status);
        if (currentVpnState !== vpnStateManagement.states.ERROR) this._buildCountryMenuIfNeeded();

        // Update the menu and panel based on the current state
        this._updateMenu(currentVpnState, status.connectStatus, status.updateMessage);
        this._updatePanel(currentVpnState, status);

        // Start the refreshes again
        this._setTimeout(currentVpnState.refreshTimeout);
    },

    _updateMenu(vpnStatus, statusText, updateAvailableText) {
        // Set the status text on the menu
        _statusLabel.text = statusText;

        if (updateAvailableText) {
            _updateMenuLabel.text = Constants.messages.updateAvailable;
            _updateMenuLabel.visible = true;
        } else {
            _updateMenuLabel.visible = false;
        }

        // Activate / deactivate menu items
        _connectMenuItem.actor.reactive = vpnStatus.canConnect;
        _disconnectMenuItem.actor.reactive = vpnStatus.canDisconnect;
    },

    _updatePanel(vpnState, status) {
        let panelText;

        // If connected, build up the panel text based on the server location and number
        if (vpnState.panelShowServer) panelText = status.country + ` #` + status.serverNumber;

        // Update the panel button
        _panelLabel.text = panelText || vpnState.panelText;
        _panelLabel.style_class = vpnState.styleClass;
    },

    _connect() {
        Vpn.connectVpn();

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh(Constants.status.connecting)
    },

    _disconnect() {
        // Run the disconnect command
        Vpn.disconnectVpn();

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh(Constants.status.disconnecting)
    },

    _clearTimeout() {
        // Remove the refresh timer if active
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = undefined;
        }
    },

    _setTimeout(timeoutDuration) {
        // Refresh after an interval
        this._timeout = Mainloop.timeout_add_seconds(timeoutDuration, Lang.bind(this, this._refresh));
    },

    disable() {
        // Clear timeout and remove menu callback
        this._clearTimeout();

        // Make sure the country menu gets rebuilt if this extension is re-enabled
        _isCountryMenuBuilt = false;

        // Disconnect the menu click handlers
        if (this._connectMenuItemClickId) {
            this._connectMenuItem.disconnect(this._connectMenuItemClickId);
        }
        if (this._disconnectMenuItemClickId) {
            this._disconnectMenuItem.disconnect(this._disconnectMenuItemClickId);
        }
    },

    destroy() {
        // Call destroy on the parent
        this.parent();
    }
});

function init() {
}

function enable() {
    // Init the indicator
    _vpnIndicator = new VpnIndicator();

    // Add the indicator to the status area of the panel
    if (!_vpnIndicator) _vpnIndicator = new VpnIndicator();
    _vpnIndicator.enable();
    Main.panel.addToStatusArea(`vpn-indicator`, _vpnIndicator);
}

function disable() {
    // Remove the indicator from the panel
    _vpnIndicator.disable();
    destroy();
}

function destroy() {
    _vpnIndicator.destroy();
}

function buildFavIcon(isFavorite) {
    let icon_name = isFavorite ? `starred-symbolic` : `non-starred-symbolic`;
    let iconfav = new St.Icon({
        icon_name: icon_name,
        style_class: `system-status-icon`
    });

    return new St.Button({
        style_class: `ci-action-btn`,
        can_focus: true,
        child: iconfav,
        x_align: Clutter.ActorAlign.END,
        x_expand: true,
        y_expand: true
    });
}

function buildCountryMenuItem(country, isFavorite, refresh) {
    const countryDisplayName = Vpn.getDisplayName(country);
    const menuItem = new PopupMenu.PopupMenuItem(countryDisplayName);
    menuItem.connect(`activate`, Lang.bind(this, function (actor, event) {
        // This logic will be a callback param
        Vpn.connectVpn(country);
        refresh(Constants.status.reconnecting)
    }));

    const icofavBtn = buildFavIcon(isFavorite);
    menuItem.actor.add_child(icofavBtn);
    menuItem.icofavBtn = icofavBtn;
    menuItem.favoritePressId = icofavBtn.connect(`button-press-event`,
        Lang.bind(this, function () {
            const newMenuItem = buildCountryMenuItem(country, !isFavorite, refresh);
            menuItem.destroy();
            addCountryMenuItem(country, _countryMenu.menu, newMenuItem, !isFavorite);

            if (isFavorite) {
                Favorites.remove(Constants.favorites.favoriteCountries, country);
            } else {
                Favorites.add(Constants.favorites.favoriteCountries, country);
            }
        })
    );

    return menuItem;
}

function addCountryMenuItem(country, menu, newMenuItem, shouldAddToTop) {
    let idx = _countryMenuItems.findIndex(item => item === country);
    if (idx > 0) _countryMenuItems.splice(idx, 1);

    if (shouldAddToTop) {
        menu.addMenuItem(newMenuItem, 0);
        _favCountryCount++;
    } else {
        _countryMenuItems.push(country);
        _countryMenuItems.sort();
        idx = _countryMenuItems.findIndex(item => item === country) + 1 + _favCountryCount;
        menu.addMenuItem(newMenuItem, idx > menu.numMenuItems ? menu.numMenuItems : idx);
    }
}

