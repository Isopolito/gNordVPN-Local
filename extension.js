// Includes
const St        = imports.gi.St;
const Main      = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang      = imports.lang;
const GLib      = imports.gi.GLib;
const Mainloop  = imports.mainloop;

// Commands to run
const CMD_VPNSTATUS = "nordvpn status";
const CMD_CONNECT = "nordvpn c";
const CMD_DISCONNECT = "nordvpn d";
// Command messages to search for
const CMD_MSG_CONNECTED = "Status: Connected";
const CMD_MSG_CONNECTING = "Status: Connecting";
const CMD_MSG_DISCONNECTED = "Status: Disconnected";
const CMD_MSG_DISCONNECTING = "Status: Disconnecting";
// Panel display text
const PANEL_CONNECTING = "CONNECTING...";
const PANEL_DISCONNECTING = "DISCONNECTING...";
const PANEL_DISCONNECTED = "UNPROTECTED";
const PANEL_CLASS_CONNECTING = "connecting";
const PANEL_CLASS_DISCONNECTING = "connecting";
const PANEL_CLASS_CONNECTED = "connected";
const PANEL_CLASS_DISCONNECTED = "unprotected";
// Menu display text
const MENU_CONNECT = "Connect";
const MENU_CONNECTING = "Connecting...";
const MENU_DISCONNECT = "Disconnect";
const MENU_DISCONNECTING = "Disconnecting...";
const MENU_UNKNOWN = "Unknown status returned";
// Status enum
let _status = { "Connecting":1, "Connected":2, "Disconnecting":3, "Disconnected":4, "NoConnection":5, "Unknown":6 };
// Status override - there is a delay in the status returning Connecting, so this isused to force the UI t show it anyway
let _statusOverride;
let _statusOverrideUntil;
// Timeouts
const TIMEOUT_NORMAL = 30;
const TIMEOUT_FAST = 1;


// Extension-wide variables
let _vpnIndicator, _statusLabel, _timeout, _menuItem, _panelLabel;

const VpnIndicator = new Lang.Class({
    Name: 'VpnIndicator',
    Extends: PanelMenu.Button,

    _init: function () {
        // Init the parent
        this.parent(0.0, "VPN Indicator", false);

        // Create the button with label for the panel
        button = new St.Bin({
            style_class: 'panel-button',
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        _panelLabel = new St.Label({
            text: PANEL_DISCONNECTED,
            style_class: PANEL_CLASS_DISCONNECTED
        });
        button.set_child(_panelLabel);

        // Create the menu items
        _statusLabel = new St.Label({ text: "Checking...", y_expand: true, style_class: "statuslabel" });
        _menuItem = new PopupMenu.PopupMenuItem(MENU_CONNECT);
        _menuItem.connect('activate', Lang.bind(this, this._toggleConnection));

        // Add the menu items to the menu
        this.menu.box.add(_statusLabel);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(_menuItem);

        // Add the button and a popup menu
        this.actor.add_actor(button);
        this._refresh();
    },

    _refresh () {
        // Stop the refreshes
        this._clearTimeout();        
        
        // Update the menu
        let statusText = this._getVpnStatusText();
        let vpnStatus = this._determineVpnStatus(statusText);

        // Once the desired state is reached, remove the status override
        if (vpnStatus === _statusOverrideUntil) {
            _statusOverride = undefined;
            _statusOverrideUntil = undefined;
        }

        this._updateMenu(vpnStatus, statusText);
        this._updatePanel(vpnStatus, statusText);

        // Start the refreshes again
        this._setTimeout(this._getRefreshTimeout(vpnStatus));
    },

    _updateMenu (vpnStatus, statusText) {
        // Set the status text on the menu
        _statusLabel.text = statusText;

        // If a status override is in place, us that instead
        if (_statusOverride) {
            vpnStatus = _statusOverride;
        }

        // Update the menu based on the status
        switch (vpnStatus) {
            case _status.Connected:
                _menuItem.actor.label_actor.text = MENU_DISCONNECT;
                _menuItem.actor.reactive = true;
                break;
            case _status.Connecting:
                _menuItem.actor.label_actor.text = MENU_CONNECTING;
                _menuItem.actor.reactive = false;
                break;
            case _status.Disconnected:
                _menuItem.actor.label_actor.text = MENU_CONNECT;
                _menuItem.actor.reactive = true;
                break;
            case _status.Disconnecting:
                _menuItem.actor.label_actor.text = MENU_DISCONNECTING;
                _menuItem.actor.reactive = false;
                break;
            default:
                _menuItem.actor.label_actor.text = MENU_UNKNOWN;
                _menuItem.actor.reactive = false;
        }
    },

    _updatePanel(vpnStatus, statusText) {
        // If a status override is in place, us that instead
        if (_statusOverride) {
            vpnStatus = _statusOverride;
        }

        // Update the panel based on the status
        switch (vpnStatus) {
            case _status.Connected:
                let statusLines = statusText.split('\n');
                let country = statusLines[2].replace("Country: ", "").toUpperCase();
                let serverNumber = statusLines[1].match(/\d+/);
                _panelLabel.text = country + " #" + serverNumber;
                _panelLabel.style_class = PANEL_CLASS_CONNECTED;
                break;
            case _status.Connecting:
                _panelLabel.text = PANEL_CONNECTING;
                _panelLabel.style_class = PANEL_CLASS_CONNECTING;
                break;
            case _status.Disconnecting:
                _panelLabel.text = PANEL_DISCONNECTING;
                _panelLabel.style_class = PANEL_CLASS_DISCONNECTING;
                break;
            case _status.Disconnected:
                _panelLabel.text = PANEL_DISCONNECTED;
                _panelLabel.style_class = PANEL_CLASS_DISCONNECTED;
                break;
            default:
                _panelLabel.text = "ERROR";
                _panelLabel.style_class = PANEL_CLASS_DISCONNECTED;
        }
    },

    _getRefreshTimeout (vpnStatus) {

        // If a status override is in place, us that instead
        if (_statusOverride) {
            vpnStatus = _statusOverride;
        }

        // Determines an appropriate refresh timeout based on the current status
        if (vpnStatus === _status.Connecting || vpnStatus === _status.Disconnecting) {
            return TIMEOUT_FAST;
        } else {
            return TIMEOUT_NORMAL;
        }
    },

    _getVpnStatusText () {
        // Read the VPN status, parse it an return the human readable part
        return GLib.spawn_command_line_sync(CMD_VPNSTATUS)[1].toString().split('\r')[3];
    },

    _determineVpnStatus (statusText) {
        // Inspect the first line of the status text and return the status as an enum
        switch (statusText.split('\n')[0]) {
            case CMD_MSG_CONNECTED:
                return _status.Connected;
            case CMD_MSG_DISCONNECTED:
                return _status.Disconnected;
            case CMD_MSG_CONNECTING:
                return _status.Connecting;
            case CMD_MSG_DISCONNECTING:
                return _status.Disconnecting;
            default:
                return _status.Unknown;
        }
    },

    _toggleConnection () {
        // Get the current status of the VPN
        let currentStatus = this._determineVpnStatus(this._getVpnStatusText());

        // Connect or disconnect based on current status
        if (currentStatus === _status.Connected) {
            GLib.spawn_command_line_async(CMD_DISCONNECT);
            _statusOverride = _status.Disconnecting;
            _statusOverrideUntil = _status.Disconnected;
        } else {
            GLib.spawn_command_line_async(CMD_CONNECT);
            _statusOverride = _status.Connecting;
            _statusOverrideUntil = _status.Connected;
        }

        this._refresh();
    },

    _clearTimeout () {
        // Remove the refresh timer if active
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = undefined;
        }
    },

    _setTimeout (timeoutDuration) {
        // Refresh after an interval
        this._timeout = Mainloop.timeout_add_seconds(timeoutDuration, Lang.bind(this, this._refresh));
    }
});


function init() {}

function enable() {
    // Add the indicator to the status area of the panel
    _vpnIndicator = new VpnIndicator();
    Main.panel.addToStatusArea('vpn-indicator', _vpnIndicator);
}

function disable() {
    // Remove the indicator from the panel
    Main.panel._rightBox.remove_child(_vpnIndicator);
}
