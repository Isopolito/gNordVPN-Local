'use strict';

const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;

// gNordvpn-Local modules
const Me = ExtensionUtils.getCurrentExtension();
const Vpn = Me.imports.modules.Vpn.Vpn;
const Constants = Me.imports.modules.constants;
const Signals = Me.imports.modules.Signals.Signals;
const ConnectionMenu = Me.imports.modules.ConnectionMenu.ConnectionMenu;
const vpnStateManagement = Me.imports.modules.vpnStateManagement;

let vpnIndicator;
const indicatorName = `VPN Indicator`;

const VpnIndicator = GObject.registerClass({
    GTypeName: 'VpnIndicator',
}, class VpnIndicator extends PanelMenu.Button {
        _init() {
            super._init(0, indicatorName, false);

            this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
            this.settings.connect('changed', (settings, key)=>  {
                switch(key){
                    case 'number-cities-per-countries':
                    case 'countries-selected-for-cities': this._cityMenu.rebuild(); break;
                }

            });
        }

        _overrideRefresh(state) {
            vpnStateManagement.refreshOverride(state);
            this._refresh();
        }

        _refresh() {
            // Stop the refreshes
            this._clearTimeout();

            const status = this._vpn.getStatus();
            const currentVpnState = vpnStateManagement.resolveState(status);
            if (currentVpnState !== vpnStateManagement.states.ERROR) {
                // Ensure that menus are populated. Since the menu may be created before the VPN is running and able
                // to provide available cities, countries, etc
                this._countryMenu.tryBuild();
                this._cityMenu.tryBuild();
            }

            // Update the menu and panel based on the current state
            this._updateMenu(currentVpnState, status);
            this._updatePanel(currentVpnState, status);

            // Start the refreshes again
            this._setTimeout(currentVpnState.refreshTimeout);
        }

        _updateMenu(vpnStatus, status) {

            // Set the status text on the menu
            this._statusLabel.get_label_actor().set_text(status.connectStatus);
            this._statusLabel.menu.removeAll();

            ['country', 'city', 'currentServer', 'serverIP', 'transfer', 'uptime'].forEach(key => {
                if(status[key]){
                    const label = key.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1").replace(/^./, e => e.toUpperCase());
                    const menuItem = new PopupMenu.PopupMenuItem(label+": "+status[key]);
                    this._statusLabel.menu.addMenuItem(menuItem);
                }
            })


            if (status.updateMessage) {
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
        
        _openSettings() {
            if (typeof ExtensionUtils.openPrefs === 'function') {
                ExtensionUtils.openPrefs();
            } else {
                Util.spawn([
                    "gnome-shell-extension-prefs",
                    Me.uuid
                ]);
            }
        }

        _buildIndicatorMenu() {
            this._statusLabel = new PopupMenu.PopupSubMenuMenuItem(`Checking...`);
            this.menu.addMenuItem(this._statusLabel);

            // Optionally add 'Update' status
            this._updateMenuLabel = new St.Label({visible: false, style_class: `updatelabel`});
            this.menu.box.add(this._updateMenuLabel);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Add 'Connect' menu item 
            this._connectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.connect);
            const connectMenuItemClickId = this._connectMenuItem.connect(`activate`, this._connect.bind(this));
            this._signals.register(connectMenuItemClickId, function () {
                this._connectMenuItem.disconnect(connectMenuItemClickId)
            }.bind(this));
            this.menu.addMenuItem(this._connectMenuItem);

            // Add 'Disconnect' menu item 
            this._disconnectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.disconnect);
            const disconnectMenuItemClickId = this._disconnectMenuItem.connect(`activate`, this._disconnect.bind(this));
            this._signals.register(disconnectMenuItemClickId, function () {
                this._disconnectMenuItem.disconnect(disconnectMenuItemClickId)
            }.bind(this));
            this.menu.addMenuItem(this._disconnectMenuItem);
            
            this._countryMenu.tryBuild();
            this.menu.addMenuItem(this._countryMenu.menu);

            this._cityMenu.tryBuild();
            this.menu.addMenuItem(this._cityMenu.menu);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Add 'Settings' menu item 
            const settingsMenuItem = new PopupMenu.PopupMenuItem('Settings...');
            this.menu.addMenuItem(settingsMenuItem);
            settingsMenuItem.connect('activate', this._openSettings.bind(this));

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
            this.add_actor(button);
        }

        _setTimeout(timeoutDuration) {
            // Refresh after an interval
            this._timeout = Mainloop.timeout_add_seconds(timeoutDuration, this._refresh.bind(this));
        }

        enable() {
            this._vpn = new Vpn();
            this._signals = new Signals();
            this._countryMenu = new ConnectionMenu('Countries', 'countries', Constants.favorites.favoriteCountries, this._overrideRefresh.bind(this));
            this._cityMenu = new ConnectionMenu('Cities', 'cities', Constants.favorites.favoriteCities, this._overrideRefresh.bind(this));
            this._settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);

            this._vpn.applySettingsToNord();
            this._buildIndicatorMenu();
            this._refresh();
        }

        disable() {
            this._clearTimeout();

            this._countryMenu.disable();
            this._countryMenu.isAdded = false;
            this._cityMenu.disable();
            this._cityMenu.isAdded = false;
            this._signals.disconnectAll();
        }
    }
);

function init() {
}

function enable() {
    vpnIndicator = new VpnIndicator();
    vpnIndicator.enable();
    Main.panel.addToStatusArea(indicatorName, vpnIndicator, 1);
}

function disable() {
    vpnIndicator.disable();
    vpnIndicator.destroy();
    vpnIndicator = null;
}