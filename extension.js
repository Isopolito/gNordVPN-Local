const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

// gNordvpn-Local modules
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const vpnStateManagement = Me.imports.modules.vpnStateManagement;
const Vpn = new Me.imports.modules.Vpn.Vpn(GLib.spawn_command_line_sync, GLib.spawn_command_line_async);

// Menu display text
const MENU_CONNECT = "Connect";
const MENU_DISCONNECT = "Disconnect";

// How many refreshes the state is overridden for
let _vpnIndicator, _panelLabel, _statusLabel, _connectMenuItem, _disconnectMenuItem,
    _connectMenuItemClickId, _updateMenuLabel, _disconnectMenuItemClickId, _timeout,
    _menuItemClickId, _isCountryMenuBuilt;

const VpnIndicator = new Lang.Class({
    Name: 'VpnIndicator',
    Extends: PanelMenu.Button,

    _init: function () {
        // Init the parent
        this.parent(0.0, "VPN Indicator", false);
    },

    _tryToBuildCountryMenu() {
        let cPopupMenuExpander = null;
        
        for (const country of Vpn.getCountries()) {
            const menuItem = new PopupMenu.PopupMenuItem(country.displayName);
            _menuItemClickId = menuItem.connect('activate', Lang.bind(this, function (actor, event) {
                Vpn.connectVpn(country.name);
                this._overrideRefresh("Status: Reconnecting")
            }));

            if (!cPopupMenuExpander) cPopupMenuExpander = new PopupMenu.PopupSubMenuMenuItem('Countries');
            cPopupMenuExpander.menu.addMenuItem(menuItem);
            _isCountryMenuBuilt = true;
        }

        return cPopupMenuExpander;
    },

    _overrideRefresh(state) {
        vpnStateManagement.refreshOverride(state);
        this._refresh()
    },

    // Can't build this country selection menu until nordvpn is properly up and running.
    // If menu construction only happens once at startup when gnome is loading up extensions 
    // after reboot, the menu won't get populated correctly.
    _buildCountryMenuIfNeeded() {
        if (_isCountryMenuBuilt) return;

        const countryMenu = this._tryToBuildCountryMenu();
        if (countryMenu) this.menu.addMenuItem(countryMenu);
    },

    enable() {
        // Add the menu items to the menu
        _statusLabel = new St.Label({text: "Checking...", y_expand: false, style_class: "statuslabel"});
        this.menu.box.add(_statusLabel);

        _updateMenuLabel = new St.Label({visible: false, style_class: "updatelabel"});
        this.menu.box.add(_updateMenuLabel);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        _connectMenuItem = new PopupMenu.PopupMenuItem(MENU_CONNECT);
        _connectMenuItemClickId = _connectMenuItem.connect('activate', Lang.bind(this, this._connect));
        this.menu.addMenuItem(_connectMenuItem);

        _disconnectMenuItem = new PopupMenu.PopupMenuItem(MENU_DISCONNECT);
        _disconnectMenuItemClickId = _disconnectMenuItem.connect('activate', Lang.bind(this, this._disconnect));
        this.menu.addMenuItem(_disconnectMenuItem);

        // Create and add the button with label for the panel
        let button = new St.Bin({
            style_class: 'panel-button',
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
            _updateMenuLabel.text = 'Update Available';
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
        if (vpnState.panelShowServer) panelText = status.country + " #" + status.serverNumber;

        // Update the panel button
        _panelLabel.text = panelText || vpnState.panelText;
        _panelLabel.style_class = vpnState.styleClass;
    },

    _connect() {
        Vpn.connectVpn();

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh("Status: Connecting")
    },

    _disconnect() {
        // Run the disconnect command
        Vpn.disconnectVpn();

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh("Status: Disconnecting")
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
    Main.panel.addToStatusArea('vpn-indicator', _vpnIndicator);
}

function disable() {
    // Remove the indicator from the panel
    _vpnIndicator.disable();
    destroy();
}

function destroy() {
    _vpnIndicator.destroy();
}