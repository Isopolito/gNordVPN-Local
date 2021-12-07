const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;

// gNordvpn-Local modules
const Me = ExtensionUtils.getCurrentExtension();
const vpnStateManagement = Me.imports.modules.vpnStateManagement;
const Constants = Me.imports.modules.constants;

class VpnIndicator {
    constructor() {
        this._vpnIndicator = null;
    }

    _overrideRefresh(state) {
        vpnStateManagement.refreshOverride(state);
        this._refresh();
    }

    // Can`t build this country selection menu until nordvpn is properly up and running.
    // If menu construction only happens once at startup when gnome is loading up extensions, 
    // the menu won`t get populated correctly.
    _buildCountryMenuIfNeeded() {
        this._countryMenu.tryBuild();
        if (this._countryMenu.isBuilt && !this._countryMenu.isAdded) {
            this._vpnIndicator.menu.addMenuItem(this._countryMenu.menu);
            this._countryMenu.isAdded = true;
        }
    }

    _refresh() {
        // Stop the refreshes
        this._clearTimeout();

        const status = this._vpn.getStatus();
        const currentVpnState = vpnStateManagement.resolveState(status);
        if (currentVpnState !== vpnStateManagement.states.ERROR) this._buildCountryMenuIfNeeded();

        // Update the menu and panel based on the current state
        this._updateMenu(currentVpnState, status.connectStatus, status.updateMessage);
        this._updatePanel(currentVpnState, status);

        // Start the refreshes again
        this._setTimeout(currentVpnState.refreshTimeout);
    }

    _updateMenu(vpnStatus, statusText, updateAvailableText) {
        // Set the status text on the menu
        this._statusLabel.text = statusText;

        if (updateAvailableText) {
            this._updateMenuLabel.text = Constants.messages.updateAvailable;
            this._updateMenuLabel.visible = true;
        } else {
            this._updateMenuLabel.visible = false;
        }

        // Activate / deactivate menu items
        this._connectMenuItem.actor.reactive = vpnStatus.canConnect;
        this._disconnectMenuItem.actor.reactive = vpnStatus.canDisconnect;
    }

    _updatePanel(vpnState, status) {
        let panelText;

        // If connected, build up the panel text based on the server location and number
        if (vpnState.panelShowServer) panelText = status.country + ` #` + status.serverNumber;

        // Update the panel button
        this._panelLabel.text = panelText || vpnState.panelText;
        this._panelLabel.style_class = vpnState.styleClass;
    }

    _connect() {
        this._vpn.connectVpn();

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh(Constants.status.connecting)
    }

    _disconnect() {
        // Run the disconnect command
        this._vpn.disconnectVpn();

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh(Constants.status.disconnecting)
    }

    _clearTimeout() {
        // Remove the refresh timer if active
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = undefined;
        }
    }

    _buildIndicatorMenu() {
        // Add the menu items to the menu
        this._statusLabel = new St.Label({text: `Checking...`, y_expand: false, style_class: `statuslabel`});
        this._vpnIndicator.menu.box.add(this._statusLabel);

        this._updateMenuLabel = new St.Label({visible: false, style_class: `updatelabel`});
        this._vpnIndicator.menu.box.add(this._updateMenuLabel);

        this._vpnIndicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._connectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.connect);
        const connectMenuItemClickId = this._connectMenuItem.connect(`activate`, this._connect.bind(this));
        this._signals.register(connectMenuItemClickId, function () {
            this._connectMenuItem.disconnect(connectMenuItemClickId)
        }.bind(this));
        this._vpnIndicator.menu.addMenuItem(this._connectMenuItem);

        this._disconnectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.disconnect);
        const disconnectMenuItemClickId = this._disconnectMenuItem.connect(`activate`, this._disconnect.bind(this));
        this._signals.register(disconnectMenuItemClickId, function () {
            this._disconnectMenuItem.disconnect(disconnectMenuItemClickId)
        }.bind(this));
        this._vpnIndicator.menu.addMenuItem(this._disconnectMenuItem);

        // Create and add the button with label for the panel
        let button = new St.Bin({
            style_class: `panel-button`,
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: false,
            track_hover: true
        });

        this._panelLabel = new St.Label();
        button.set_child(this._panelLabel);
        this._vpnIndicator.add_actor(button);
    }

    _setTimeout(timeoutDuration) {
        // Refresh after an interval
        this._timeout = Mainloop.timeout_add_seconds(timeoutDuration, this._refresh.bind(this));
    }

    enable() {
        // Add the indicator to the status area of the panel
        const indicatorName = `VPN Indicator`;
        if (!this._vpnIndicator) this._vpnIndicator = new PanelMenu.Button(0.0, indicatorName, false);
        Main.panel.addToStatusArea(indicatorName, this._vpnIndicator);

        this._vpn = new Me.imports.modules.Vpn.Vpn();
        this._signals = new Me.imports.modules.Signals.Signals();
        this._countryMenu = new Me.imports.modules.CountryMenu.CountryMenu(this._overrideRefresh.bind(this));

        this._buildIndicatorMenu();

        this._refresh();
    }

    disable() {
        this._clearTimeout();

        this._countryMenu.disable();
        this._countryMenu.isAdded = false;
        this._signals.disconnectAll();

        // Remove the indicator from the panel
        this._vpnIndicator.disable();
        this._vpnIndicator = null;
    }
};

function init() {
    return new VpnIndicator();
}