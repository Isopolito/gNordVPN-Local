// Includes
const St        = imports.gi.St;
const Main      = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang      = imports.lang;
const GLib      = imports.gi.GLib;
const Mainloop  = imports.mainloop;

const STATE_OVERRIDE_UNSET = -1;

// Commands to run
const CMD_VPNSTATUS  = "nordvpn status";
const CMD_CONNECT    = "nordvpn c";
const CMD_DISCONNECT = "nordvpn d";
// Menu display text
const MENU_CONNECT       = "Connect";
const MENU_DISCONNECT    = "Disconnect";
// How many refreshes the state is overridden for
const STATE_OVERRIDE_DURATION=10
// VPN states and associated config
let _states = {
    "Status: Connected": { 
        "panelShowServer":true, // Indicates the panel text is built up with the country and ID of the VPN server
        "styleClass":"green",   // CSS class for panel button
        "canConnect":false,     // Connect menu item enabled true/false
        "canDisconnect":true,   // Disconnect menu item enabled true/false
        "refreshTimeout":30,    // Seconds to refresh when this is the status
        "overrideId": STATE_OVERRIDE_UNSET,
        "clearsOverrideId":1    // Clears a status override with this ID
    },
    "Status: Connecting": { 
        "panelText":"CONNECTING...", // Static panel button text
        "styleClass":"amber",
        "canConnect":false,
        "canDisconnect":true,
        "refreshTimeout":1,
        "overrideId": STATE_OVERRIDE_UNSET,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId":1               // Allows an override of this state to be cleared by a state with clearsOverrideId of the same ID
    },
    "Status: Disconnected": { 
        "panelText":"UNPROTECTED",
        "styleClass":"red",
        "canConnect":true,
        "canDisconnect":false,
        "refreshTimeout":10,
        "overrideId": STATE_OVERRIDE_UNSET,
        "clearsOverrideId":2
    },
    "Status: Disconnecting": { 
        "panelText":"DISCONNECTING...",
        "styleClass":"amber",
        "canConnect":true,
        "canDisconnect":false,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout":1,
        "overrideId":2
    },
    "Status: Reconnecting": { 
        "panelText":"RECONNECTING...",
        "styleClass":"amber",
        "canConnect":false,
        "canDisconnect":true,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout":2
    },
    "Status: Restarting": { 
        "panelText":"RESTARTING...",
        "styleClass":"amber",
        "canConnect":false,
        "canDisconnect":true,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout":10
    },
    "ERROR": {
        "panelText":"ERROR",
        "styleClass":"red",
        "canConnect":true,
        "canDisconnect":true,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout":5
    }
};

let _vpnIndicator, _panelLabel, _statusLabel, _connectMenuItem, _disconnectMenuItem, 
    _connectMenuItemClickId, _updateMenuLabel, _disconnectMenuItemClickId, _timeout, 
    _menuItemClickId, _isCountryMenuBuilt;

const VpnIndicator = new Lang.Class({
    Name: 'VpnIndicator',
    Extends: PanelMenu.Button,

    _init: function() {
        // Init the parent
        this.parent(0.0, "VPN Indicator", false);
        this._stateOverride = undefined;
        this._stateOverrideCounter = 0;
    },

    _tryToBuildCountryMenu() {
        const [ok, standardOut, standardError, exitStatus] = GLib.spawn_command_line_sync("nordvpn countries");
        if (!standardOut) return;

        const countries = standardOut.toString().replace(/\s+/g,' ').split(' ');
        countries.sort();

        let cPopupMenuExpander = null;
        const stringStartsWithCapitalLetter = country => country && country.charCodeAt(0) >= 65 && country.charCodeAt(0) <= 90;

        for (var i=3; i<countries.length; i++) {
            const country = countries[i].replace(",","");

            // All countries should be capitalized in output
            if (!stringStartsWithCapitalLetter(country)) continue;

            const menuItem = new PopupMenu.PopupMenuItem(country.replace(/_/g, " "));
            _menuItemClickId = menuItem.connect('activate', Lang.bind(this, function(actor, event) {
                GLib.spawn_command_line_async(`${CMD_CONNECT} ${country}`);
                this._overrideRefresh("Status: Reconnecting", 0)
            }));

            if (!cPopupMenuExpander) cPopupMenuExpander = new PopupMenu.PopupSubMenuMenuItem('Countries');
            cPopupMenuExpander.menu.addMenuItem(menuItem);
            _isCountryMenuBuilt = true;
        }

        return cPopupMenuExpander;
    },

    _overrideRefresh(state, counter) {
      this._stateOverride = _states[state];
      this._stateOverrideCounter = counter;
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
        _statusLabel = new St.Label({ text: "Checking...", y_expand: false, style_class: "statuslabel" });
        this.menu.box.add(_statusLabel);

        _updateMenuLabel = new St.Label({ visible: false, style_class: "updatelabel" });
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
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        _panelLabel = new St.Label();
        button.set_child(_panelLabel);
        this.actor.add_actor(button);

        this._refresh();
    },

    _refresh() {
        // Stop the refreshes
        this._clearTimeout();

        // Read the VPN status from the command line
        const [ok, standardOut, standardError, exitStatus] = GLib.spawn_command_line_sync(CMD_VPNSTATUS);

        // Convert Uint8Array object to string and split up the different messages
        const statusMessages = standardOut.toString().split('\n');

        // Check to see if a new version is available and display message in menu if so
        const updateAvailableText = statusMessages[0].includes('new version')
            ? statusMessages.shift(1)
            : null;

        // Determine the correct state from the "Status: xxxx" line
        // TODO: use results from vpn command to give details of error
        let status = (statusMessages[0].match(/Status: \w+/) || [''])[0]
        let vpnStatus = _states[status] || _states.ERROR;

        if (vpnStatus !== _states.ERROR) this._buildCountryMenuIfNeeded();

        // If a state override is active, increment it and override the state if appropriate
        if (this._stateOverride) {
            this._stateOverrideCounter += 1;

            if (this._stateOverrideCounter <= STATE_OVERRIDE_DURATION 
                && (vpnStatus.clearsOverrideId != this._stateOverride.overrideId)) {
                // State override still active
                vpnStatus = this._stateOverride;
            } else {
                // State override expired or cleared by current state, remove it
                this._stateOverride = undefined;
                this._stateOverrideCounter = 0;
            }
        }

        // Update the menu and panel based on the current state
        this._updateMenu(vpnStatus, status, updateAvailableText);
        this._updatePanel(vpnStatus, statusMessages);

        // Start the refreshes again
        this._setTimeout(vpnStatus.refreshTimeout);
    },

    _updateMenu(vpnStatus, statusText, updateAvailableText) {
        // Set the status text on the menu
        _statusLabel.text = statusText;
        
        if (updateAvailableText) {
            _updateMenuLabel.text = updateAvailableText;
            _updateMenuLabel.visible = true;
        } else {
            _updateMenuLabel.visible = false;;
        }

        // Activate / deactivate menu items
        _connectMenuItem.actor.reactive = vpnStatus.canConnect;
        _disconnectMenuItem.actor.reactive = vpnStatus.canDisconnect;
    },

    _updatePanel(vpnStatus, statusMessages) {
        let panelText;

        // If connected, build up the panel text based on the server location and number
        if (vpnStatus.panelShowServer) {
            let country = statusMessages[2].replace("Country: ", "").toUpperCase();
            let serverNumber = statusMessages[1].match(/\d+/);
            panelText  = country + " #" + serverNumber;
        }

        // Update the panel button
        _panelLabel.text = panelText || vpnStatus.panelText;
        _panelLabel.style_class = vpnStatus.styleClass;
    },

    _connect() {
        // Run the connect command
        GLib.spawn_command_line_async(CMD_CONNECT);

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh("Status: Connecting", 0)
    },

    _disconnect() {
        // Run the disconnect command
        GLib.spawn_command_line_async(CMD_DISCONNECT);

        // Set an override on the status as the command line status takes a while to catch up
        this._overrideRefresh("Status: Disconnecting", 0)
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

function init() {}

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
