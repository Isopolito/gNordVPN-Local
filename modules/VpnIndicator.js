import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Vpn from './Vpn.js';
import Signals from './Signals.js';
import ConnectionMenu from './ConnectionMenu.js';
import StateManager from './StateManager.js';
import CommonFavorite from './CommonFavorite.js';
import PanelIcon from './PanelIcon.js';
import * as Constants from './constants.js';

export default GObject.registerClass(
    class VpnIndicator extends PanelMenu.Button {
        _isLoggedIn = false;
        _isRefreshing = false;
        _isDisconnected = false;
        _indicatorName = `VPN Indicator`;
        _stateManager = new StateManager();
        _lastMenuBuild = null;

        constructor(extension) {
            super();
            this._extension = extension;
            this._extSettings = extension.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
        }

        _init() {
            super._init(0.5, this._indicatorName, false);
        }

        _connectChanged() {
            this._extSettings.connect(`changed`, (settings, key) => {
                switch (key) {
                    case `panel-position`:
                        this._moveIndicator();
                        break;
                    case `panel-styles`:
                    case `common-panel-style`:
                        this._panelIcon.updateStyle();
                        this._refresh();
                        break;
                    case `favorite-countries`:
                        this._countryMenu.updateFavorite();
                        this._commonFavorite.updateFavorite();
                        break;
                    case `favorite-cities`:
                        this._cityMenu.updateFavorite();
                        this._commonFavorite.updateFavorite();
                        break;
                    case `favorite-servers`:
                        this._serverMenu.updateFavorite();
                        this._commonFavorite.updateFavorite();
                        break;
                    case `showlogin`:
                    case `showlogout`:
                        this._refresh();
                        break;
                    case `number-cities-per-countries`:
                    case `countries-selected-for-cities`:
                        this._cityMenu.rebuild();
                        break;
                    case `number-servers-per-countries`:
                    case `countries-selected-for-servers`:
                        this._serverMenu.rebuild();
                        break;
                    case `commonfavorite`: {
                        this._commonFavorite.showHide(settings.get_boolean(`commonfavorite`));
                        break;
                    }
                }
            });
        }

        _setQuickRefresh(quick) {
            this._stateManager.setQuickRefresh(quick);
            this._refresh();
        }

        _overrideRefresh(state, overrideKeys) {
            this._stateManager.refreshOverride(state, overrideKeys);
            this._refresh();
        }

        async _refresh() {
            try {
                if (this._isRefreshing || this._isDisconnected) return;
                this.isRefreshing = true;

                // Stop the refreshes
                this._clearTimeout();

                const status = await this._vpn.getStatus();
                status.loggedin = this._isLoggedIn;
                status.currentState = this._vpn.isNordVpnRunning()
                    ? this._stateManager.resolveState(status)
                    : this._stateManager.resolveState(null);

                this._throttledMenuBuild(status);

                // Update the menu and panel based on the current state
                this._updateMenu(status);
                this._panelIcon.update(status);

                // Start the refreshes again. Need the panel to update more frequently for extra large button so uptime/speed is relevant
                const timeoutInSec = this._extSettings.get_boolean(`extra-large-button`) ? 3 : status.currentState.refreshTimeout;
                this._setTimeout(timeoutInSec);
            } catch (e) {
                log(e, `gnordvpn: Unable to refresh`);
            } finally {
                this.isRefreshing = false;
            }
        }

        _throttledMenuBuild(status) {
            // Don't build more frequently than once every 30 seconds
            if ((Date.now() - this._lastMenuBuild) > 30_000) {
                this._lastMenuBuild = Date.now();
                // Ensure that menus are populated. Since the menu may be created before the VPN is running and able
                // to provide available cities, countries, etc
                if (status.currentState.stateName !== Constants.states[`ERROR`]) {
                    this._countryMenu.tryBuild();
                    this._cityMenu.tryBuild();
                    this._serverMenu.tryBuild();
                }
            }
            ;
        }

        _updateMenu(status) {
            if (!this._statusPopup || !this._statusLabel) return;

            // Set the status text on the menu
            this._statusLabel.text = status.connectStatus;

            const actor = this._statusPopup.get_label_actor();
            if (!actor) return;
            actor.set_text(status.connectStatus);

            this._statusPopup.menu.removeAll();

            let hasItems = false;
            let statusToDisplay = [`country`, `city`, `currentServer`, `serverIP`, `transfer`, `uptime`];
            statusToDisplay.forEach(key => {
                if (status[key]) {
                    const label = key.replace(/([A-Z]+)/g, ` $1`).replace(/([A-Z][a-z])/g, ` $1`).replace(/^./, e => e.toUpperCase());
                    const menuItem = new PopupMenu.PopupMenuItem(label + `: ` + status[key]);
                    this._statusPopup.menu.addMenuItem(menuItem);
                    hasItems = true;
                }
            })

            if (!this._isLoggedIn) {
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
            this._commonFavorite.showHide(status.currentState.showLists && this._extSettings.get_boolean(`commonfavorite`));

            this._loginMenuItem.actor.visible = !status.loggedin && this._extSettings.get_boolean(`showlogin`);
            this._logoutMenuItem.actor.visible = status.loggedin && this._extSettings.get_boolean(`showlogout`);
        }

        async _connect() {
            this._isDisconnected = true;
            this._vpn.connectVpn().then(() => {
                // Set an override on the status as the command line status takes a while to catch up
                this._isDisconnected = false;
                this._overrideRefresh(Constants.status.connecting)
            }).catch(e => log(e, `Gnordvpn: unable to connect to vpn`));
        }

        async _disconnect() {
            // Run the disconnect command
            this._vpn.disconnectVpn().then(() => {
                // Set an override on the status as the command line status takes a while to catch up
                this._overrideRefresh(Constants.status.disconnecting)
                this._isDisconnected = true;
            }).catch(e => log(e, `Gnordvpn: unable to disconnect`));
        }

        async _login() {
            this._vpn.loginVpn()
            this._overrideRefresh(Constants.status.login);
        }

        async _logout() {
            this._vpn.logoutVpn().then(() => {
                // Set an override on the status as the command line status takes a while to catch up
                this._overrideRefresh(Constants.status.logout)
            });
        }

        _clearTimeout() {
            // Remove the refresh timer if active
            if (this._timeout) {
                GLib.Source.remove(this._timeout);
                this._timeout = undefined;
            }
        }

        _openSettings() {
            try {
                this._extension.openPreferences();
            } catch (e) {
                log(e, `Gnordvpn: Error opening preferences`);
            }
        }

        async _buildIndicatorMenu() {
            try {
                this._statusPopup = new PopupMenu.PopupSubMenuMenuItem(`Checking...`);
                this._statusPopup.menu.connect(`open-state-changed`, (actor, event) => this._setQuickRefresh(event));
                this.menu.addMenuItem(this._statusPopup);

                this._statusLabel = new St.Label({text: `Checking...`, y_expand: false, style_class: `statuslabel`});
                this.menu.box.add(this._statusLabel);

                // Optionally add `Update` status
                this._updateMenuLabel = new St.Label({visible: false, style_class: `updatelabel`});
                this.menu.box.add(this._updateMenuLabel);

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // Add `Connect` menu item
                this._connectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.connect);
                const connectMenuItemClickId = this._connectMenuItem.connect(`activate`, () => this._connect().catch(e => log(e, `Gnordvpn: Unable to connect`)));
                this._signals.register(connectMenuItemClickId, () => this._connectMenuItem.disconnect(connectMenuItemClickId));
                this.menu.addMenuItem(this._connectMenuItem);

                // Add `Disconnect` menu item
                this._disconnectMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.disconnect);
                const disconnectMenuItemClickId = this._disconnectMenuItem.connect(`activate`, () => this._disconnect().catch(e => log(e, `Gnordvpn: Unable to disconnect`)));
                this._signals.register(disconnectMenuItemClickId, () => this._disconnectMenuItem.disconnect(disconnectMenuItemClickId));
                this.menu.addMenuItem(this._disconnectMenuItem);

                this._commonFavorite.build();
                this.menu.addMenuItem(this._commonFavorite.menu);

                if (this._extSettings.get_boolean(`commonfavorite`)) this._commonFavorite.menu.show();
                else this._commonFavorite.menu.hide();

                this._countryMenu.tryBuild();
                this.menu.addMenuItem(this._countryMenu.menu);

                this._cityMenu.tryBuild();
                this.menu.addMenuItem(this._cityMenu.menu);

                this._serverMenu.tryBuild();
                this.menu.addMenuItem(this._serverMenu.menu);

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // Add `Settings` menu item
                const settingsMenuItem = new PopupMenu.PopupMenuItem(`Settings`);
                this.menu.addMenuItem(settingsMenuItem);
                settingsMenuItem.connect(`activate`, this._openSettings.bind(this));

                // Add `Login` menu item
                this._loginMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.login);
                const loginMenuItemClickId = this._loginMenuItem.connect(`activate`, () => this._login().catch(e => log(e, `Gnordvpn: Unable to login`)));
                this._signals.register(loginMenuItemClickId, () => this._loginMenuItem.disconnect(loginMenuItemClickId));
                this.menu.addMenuItem(this._loginMenuItem);

                // Add `Logout` menu item
                this._logoutMenuItem = new PopupMenu.PopupMenuItem(Constants.menus.logout);
                const logoutMenuItemClickId = this._logoutMenuItem.connect(`activate`, () => this._logout().catch(e => log(e, `Gnordvpn: Unable to logout`)));
                this._signals.register(logoutMenuItemClickId, () => this._logoutMenuItem.disconnect(logoutMenuItemClickId));
                this.menu.addMenuItem(this._logoutMenuItem);

                this._panelIcon.build();
                this.add_actor(this._panelIcon.button());

                this._panelIcon.button().connect(`button-press-event`, (actor, event) => {
                    //Only checking login state when clicking on menu
                    //Cannot check periodically because:
                    //If checking with `nordvpn account` it fetches from a server that limit request
                    //If checking with `nordvpn login` it generate a new url, preventing the use from login in
                    this._isLoggedIn = this._vpn.checkLogin();
                    this._refresh();
                });

                this._isLoggedIn = this._vpn.checkLogin();
            } catch (e) {
                log(e, `gnordvpn: unable to build indicator menu`);
            }
        }

        _setTimeout(timeoutDuration) {
            // Refresh after an interval
            this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeoutDuration, () => {
                this._refresh().catch(e => log(e, `Gnordvpn: Unable to refresh`));
                return GLib.SOURCE_REMOVE; // Ensure the timeout is only run once
            });
        }

        enable() {
            try {
                this._moveIndicator();
                this._connectChanged();
                this._vpn = new Vpn(this._extSettings);
                this._signals = new Signals();
                this._commonFavorite = new CommonFavorite(this._overrideRefresh.bind(this), this._extSettings);
                this._countryMenu = new ConnectionMenu(`Countries`, `countries`, Constants.favorites.favoriteCountries, this._overrideRefresh.bind(this), this._extSettings);
                this._cityMenu = new ConnectionMenu(`Cities`, `cities`, Constants.favorites.favoriteCities, this._overrideRefresh.bind(this), this._extSettings);
                this._serverMenu = new ConnectionMenu(`Servers`, `servers`, Constants.favorites.favoriteServers, this._overrideRefresh.bind(this), this._extSettings);
                this._panelIcon = new PanelIcon(this._extSettings);

                this._buildIndicatorMenu().then(() => {
                    this._refresh().then(() => {
                        this._vpn.applySettingsToNord();
                    }).catch(e => log(e, `Gnordvpn: unable to refresh`));
                }).catch(e => log(e, `Gnordvpn: unable to build indicator menu`));
            } catch (e) {
                log(e, `gnordvpn: unable to build indicator menu and refresh`);
            }
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

        getPanelPosition() {
            return this._extSettings.get_string(`panel-position`)
        }

        getName() {
            return this._indicatorName;
        }

        _moveIndicator() {
            let position = this._extSettings.get_string(`panel-position`);

            let box;
            if (position === `left`) {
                box = Main.panel._leftBox;
            } else if (position === `center`) {
                box = Main.panel._centerBox;
            } else {
                box = Main.panel._rightBox;
            }

            // Remove the indicator from its current parent
            this.get_parent().remove_actor(this);

            // Add it to the new box
            box.add(this);
        }
    });