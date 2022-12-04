'use strict';

const Clutter = imports.gi.Clutter;
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
const StateManager = Me.imports.modules.StateManager.StateManager;
const CommonFavorite = Me.imports.modules.CommonFavorite.CommonFavorite;
const PanelIcon = Me.imports.modules.PanelIcon.PanelIcon;

let vpnIndicator;
const indicatorName = `VPN Indicator`;

const VpnIndicator = GObject.registerClass({
    GTypeName: 'VpnIndicator',
}, class VpnIndicator extends PanelMenu.Button {
        _init() {
            super._init(0, indicatorName, false);
            this.loggedin;
            this.stateManager = new StateManager();

            this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
            this.settings.connect('changed', (settings, key) =>  {
                switch(key) {
                    case 'panel-styles': 
                    case 'common-panel-style':
                        this._panelIcon.updateStyle();
                        this._refresh();
                    break;

                    case 'favorite-countries': 
                        this._countryMenu.updateFavorite();
                        this._commonFavorite.updateFavorite(); 
                    break;
                    case 'favorite-cities':
                        this._cityMenu.updateFavorite(); 
                        this._commonFavorite.updateFavorite(); 
                    break;
                    case 'favorite-servers':
                        this._serverMenu.updateFavorite(); 
                        this._commonFavorite.updateFavorite(); 
                    break;

                    case 'showlogin':
                    case 'showlogout':
                        this._refresh();
                    break;

                    case 'number-cities-per-countries':
                    case 'countries-selected-for-cities': this._cityMenu.rebuild(); break;
               
                    case 'number-servers-per-countries':
                    case 'countries-selected-for-servers': this._serverMenu.rebuild(); break;

                    case 'commonfavorite': {       
                        this._commonFavorite.showHide(settings.get_boolean(`commonfavorite`)); 
                    }break;
                }

            });
        }

        _setQuickRefresh(quick) {
            this.stateManager.setQuickRefresh(quick);
            this._refresh();
        }

        _overrideRefresh(state, overrideKeys) {
            this.stateManager.refreshOverride(state, overrideKeys);
            this._refresh();
        }

        _refresh() {
            // Stop the refreshes
            this._clearTimeout();

            let status = this._vpn.getStatus();
            status.loggedin = this.loggedin;
            status.currentState = this._vpn.isNordVpnRunning()
                ? this.stateManager.resolveState(status)
                : this.stateManager.resolveState(null);

            // Ensure that menus are populated. Since the menu may be created before the VPN is running and able
            // to provide available cities, countries, etc
            if (status.currentState.stateName !== Constants.states['ERROR']) {
                this._countryMenu.tryBuild();
                this._cityMenu.tryBuild();
                this._serverMenu.tryBuild();
            }

            // Update the menu and panel based on the current state
            this._updateMenu(status);
            this._panelIcon.update(status);

            // Start the refreshes again
            this._setTimeout(status.currentState.refreshTimeout);
        }

        _updateMenu(status) {
            // Set the status text on the menu
            this._statusLabel.text = status.connectStatus;
            this._statusPopup.get_label_actor().set_text(status.connectStatus);
            this._statusPopup.menu.removeAll();

            let hasItems = false;
            let statusToDisplay = ['country', 'city', 'currentServer', 'serverIP', 'transfer', 'uptime'];
            statusToDisplay.forEach(key => {
                if (status[key]) {
                    const label = key.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1").replace(/^./, e => e.toUpperCase());
                    const menuItem = new PopupMenu.PopupMenuItem(label+": "+status[key]);
                    this._statusPopup.menu.addMenuItem(menuItem);
                    hasItems = true;
                }
            })

            if (!this.loggedin) {
                this._statusPopup.hide();
                this._statusLabel.hide();
            } else if (hasItems) {
                this._statusPopup.show();
                this._statusLabel.hide();
            } else {
                this._statusPopup.hide();
                this._statusLabel.show();
            }


            if (status.updateMessage) {
                this._updateMenuLabel.text = Constants.messages.updateAvailable;
                this._updateMenuLabel.visible = true;
            } else {
                this._updateMenuLabel.visible = false;
            }

            // Activate / deactivate menu items
            this._connectMenuItem.actor.visible = status.currentState.canConnect;
            this._disconnectMenuItem.actor.visible = status.currentState.canDisconnect;

            this._countryMenu.showHide(status.currentState.showLists);
            this._cityMenu.showHide(status.currentState.showLists);
            this._serverMenu.showHide(status.currentState.showLists);
            this._commonFavorite.showHide(status.currentState.showLists && this.settings.get_boolean(`commonfavorite`));

            this._loginMenuItem.actor.visible = !status.loggedin && this.settings.get_boolean(`showlogin`);
            this._logoutMenuItem.actor.visible = status.loggedin && this.settings.get_boolean(`showlogout`);
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

        _login() {
            this._vpn.loginVpn();

            // Set an override on the status as the command line status takes a while to catch up
            this._overrideRefresh(Constants.status.login)
        }

        _logout() {
            this._vpn.logoutVpn();

            // Set an override on the status as the command line status takes a while to catch up
            this._overrideRefresh(Constants.status.logout)
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
            this._statusPopup = new PopupMenu.PopupSubMenuMenuItem(`Checking...`);
            this._statusPopup.menu.connect(`open-state-changed`, function (actor,event) {
                this._setQuickRefresh(event);
            }.bind(this));

            this.menu.addMenuItem(this._statusPopup);

            this._statusLabel = new St.Label({text: `Checking...`, y_expand: false, style_class: `statuslabel`});
            this.menu.box.add(this._statusLabel);

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

            this._commonFavorite.build();
            this.menu.addMenuItem(this._commonFavorite.menu);

            if (this.settings.get_boolean(`commonfavorite`)) this._commonFavorite.menu.show(); 
            else this._commonFavorite.menu.hide(); 

            this._countryMenu.tryBuild();
            this.menu.addMenuItem(this._countryMenu.menu);

            this._cityMenu.tryBuild();
            this.menu.addMenuItem(this._cityMenu.menu);

            this._serverMenu.tryBuild();
            this.menu.addMenuItem(this._serverMenu.menu);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Add 'Settings' menu item 
            const settingsMenuItem = new PopupMenu.PopupMenuItem('Settings');
            this.menu.addMenuItem(settingsMenuItem);
            settingsMenuItem.connect('activate', this._openSettings.bind(this));

            // Add 'Login' menu item 
            this._loginMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.login);
            const loginMenuItemClickId = this._loginMenuItem.connect(`activate`, this._login.bind(this));
            this._signals.register(loginMenuItemClickId, function () {
                this._loginMenuItem.disconnect(loginMenuItemClickId)
            }.bind(this));
            this.menu.addMenuItem(this._loginMenuItem);

            // Add 'Logout' menu item 
            this._logoutMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.logout);
            const logoutMenuItemClickId = this._logoutMenuItem.connect(`activate`, this._logout.bind(this));
            this._signals.register(logoutMenuItemClickId, function () {
                this._logoutMenuItem.disconnect(logoutMenuItemClickId)
            }.bind(this));
            this.menu.addMenuItem(this._logoutMenuItem);

            this._panelIcon.build();
            this.add_actor(this._panelIcon.button());

            this._panelIcon.button().connect(`button-press-event`, function (actor,event) {
                //Only checking login state when clicking on menu
                //Cannot chech periodicaly because:
                //If checking with 'nordvpn account' it fetches from a server that limit request
                //If checking with 'nordvpn login' it generate a new url, preventing the use from login in
                this.loggedin = this._vpn.checkLogin();
                this._refresh();
            }.bind(this));

            this.loggedin = this._vpn.checkLogin();
        }

        _setTimeout(timeoutDuration) {
            // Refresh after an interval
            this._timeout = Mainloop.timeout_add_seconds(timeoutDuration, this._refresh.bind(this));
        }

        enable() {
            this._vpn = new Vpn();
            this._signals = new Signals();
            this._commonFavorite = new CommonFavorite(this._overrideRefresh.bind(this));
            this._countryMenu = new ConnectionMenu('Countries', 'countries', Constants.favorites.favoriteCountries, this._overrideRefresh.bind(this));
            this._cityMenu = new ConnectionMenu('Cities', 'cities', Constants.favorites.favoriteCities, this._overrideRefresh.bind(this));
            this._serverMenu = new ConnectionMenu('Servers', 'servers', Constants.favorites.favoriteServers, this._overrideRefresh.bind(this));
            this._panelIcon = new PanelIcon();
            this._settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);

            this._vpn.applySettingsToNord();
            this._buildIndicatorMenu();
            this._refresh();
        }

        disable() {
            this._clearTimeout();
            
            this._commonFavorite.disable();
            this._commonFavorite.isAdded = false;
            this._countryMenu.disable();
            this._countryMenu.isAdded = false;
            this._cityMenu.disable();
            this._cityMenu.isAdded = false;
            this._serverMenu.disable();
            this._serverMenu.isAdded = false;
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