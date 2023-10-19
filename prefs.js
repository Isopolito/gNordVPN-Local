import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk ';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Vpn from './modules/Vpn.js';
import * as StylesManager from './modules/prefs/StylesManager.js';
import * as ResetManager from './modules/prefs/ResetManager.js';

export default class GnordVpnPrefs extends ExtensionPreferences {
    constructor() {
        super();
        this._vpn = new Vpn();
        this._settings = this.getSettings();
        this._resetManager = new ResetManager();
        this._stylesManager = new StylesManager();
        this._techCbox = null;
        this._protoCbox = null;
        this._normalRender = null;
        this._countryMapWithID = null;
        this._countryNames = null;
        this._cityScroll = null;
        this._countryMap = null;
    }

    _createGeneralPage() {
        const generalGrid = new Gtk.Grid({
            column_spacing: 12, row_spacing: 12, margin_top: 10, margin_bottom: 10, margin_start: 10, margin_end: 10
        });

        // Panel Position Label and ComboBox
        const panelPositionLabel = new Gtk.Label({label: "Select Panel Position:", halign: Gtk.Align.START});
        generalGrid.attach(panelPositionLabel, 0, 0, 1, 1);

        const panelPositionCombo = new Gtk.ComboBoxText();
        panelPositionCombo.append("left", "Left");
        panelPositionCombo.append("center", "Center");
        panelPositionCombo.append("right", "Right");
        generalGrid.attach(panelPositionCombo, 1, 0, 1, 1);

        let initialPosition = this._settings.get_string('panel-position');
        panelPositionCombo.set_active_id(initialPosition);

        panelPositionCombo.connect('changed', () => {
            const newPosition = panelPositionCombo.get_active_id();
            this._settings.set_string('panel-position', newPosition);
        });

        // Common Favorite Toggle
        const commonFavLabel = new Gtk.Label({label: "Display a common favorite tab:", halign: Gtk.Align.START});
        const commonFavToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`commonfavorite`),
            halign: Gtk.Align.START,
            visible: true
        });
        this._settings.bind(`commonfavorite`, commonFavToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        commonFavToggle.set_hexpand(false);  // Don't expand horizontally
        generalGrid.attach(commonFavLabel, 0, 2, 1, 1);
        generalGrid.attach(commonFavToggle, 1, 2, 1, 1);

        // Reset All Settings Button
        const resetAll = new Gtk.Button({label: "Reset All Settings"});
        generalGrid.attach(resetAll, 0, 3, 2, 1);

        return {generalGrid, resetAll};
    }

    _createAccountsPage() {
        const accountsGrid = new Gtk.Grid({
            column_spacing: 12, row_spacing: 12, margin_top: 10, margin_bottom: 10, margin_start: 10, margin_end: 10
        });

        // Show Login Toggle
        const showLoginLabel = new Gtk.Label({label: "Show login button in menu:", halign: Gtk.Align.START});
        const showLoginToggle = new Gtk.Switch({active: this._settings.get_boolean('showlogin'), halign: Gtk.Align.START});
        this._settings.bind('showlogin', showLoginToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        accountsGrid.attach(showLoginLabel, 0, 0, 1, 1);
        accountsGrid.attach(showLoginToggle, 1, 0, 1, 1);

        // Show Logout Toggle
        const showLogoutLabel = new Gtk.Label({label: "Show logout button in menu:", halign: Gtk.Align.START});
        const showLogoutToggle = new Gtk.Switch({active: this._settings.get_boolean('showlogout'), halign: Gtk.Align.START});
        this._settings.bind('showlogout', showLogoutToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        accountsGrid.attach(showLogoutLabel, 0, 1, 1, 1);
        accountsGrid.attach(showLogoutToggle, 1, 1, 1, 1);

        // Account Information
        const accountInfo = new Gtk.Label({
            label: "<b>Account Information</b>",
            use_markup: true,
            halign: Gtk.Align.START
        });
        accountsGrid.attach(accountInfo, 0, 2, 2, 1);

        const accountEmailLabel = new Gtk.Label({label: "Account email:", halign: Gtk.Align.START});
        const accountEmail = new Gtk.Label({halign: Gtk.Align.START});
        accountsGrid.attach(accountEmailLabel, 0, 3, 1, 1);
        accountsGrid.attach(accountEmail, 1, 3, 1, 1);

        const accountStatusLabel = new Gtk.Label({label: "Account status:", halign: Gtk.Align.START});
        const accountStatus = new Gtk.Label({halign: Gtk.Align.START});
        accountsGrid.attach(accountStatusLabel, 0, 4, 1, 1);
        accountsGrid.attach(accountStatus, 1, 4, 1, 1);

        const loginButton = new Gtk.Button({label: "Login"});
        loginButton.connect('clicked', () => this._vpn.loginVpn());
        loginButton.set_sensitive(false);
        accountsGrid.attach(loginButton, 0, 5, 1, 1);

        const logoutButton = new Gtk.Button({label: "Logout"});
        logoutButton.connect('clicked', () => this._vpn.logoutVpn());
        logoutButton.set_sensitive(false);
        accountsGrid.attach(logoutButton, 1, 5, 1, 1);

        const refreshAccountButton = new Gtk.Button({label: "Refresh"});
        const refreshAccount = () => {
            let account = this._vpn.getAccount();
            let loggedIn = !!account.emailAddress;
            accountEmail.set_text(account.emailAddress || "");
            accountStatus.set_text(account.vpnService || "");
            loginButton.set_sensitive(!loggedIn);
            logoutButton.set_sensitive(loggedIn);
        };
        refreshAccountButton.connect('clicked', refreshAccount);
        accountsGrid.attach(refreshAccountButton, 0, 6, 1, 1);

        // Initialize account information
        refreshAccount();
        return accountsGrid;
    }

    _createConnectionsPage() {
        const connectionsGrid = new Gtk.Grid({
            margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
        });

        // Technology
        const techLabel = new Gtk.Label({
            label: `Select Technology:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(techLabel, 0, 0, 1, 1);

        let techModel = new Gtk.ListStore();
        techModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
        this._techCbox = new Gtk.ComboBox({model: techModel});
        let techRenderer = new Gtk.CellRendererText();
        this._techCbox.pack_start(techRenderer, true);
        this._techCbox.add_attribute(techRenderer, 'text', 1);
        techModel.set(techModel.append(), [0, 1], ['OPENVPN', 'OpenVpn']);
        techModel.set(techModel.append(), [0, 1], ['NORDLYNX', 'NordLynx']);
        let tech = this._settings.get_string(`technology`);
        this._techCbox.set_active(tech === 'OPENVPN' ? 0 : 1);
        this._techCbox.connect('changed', (entry) => {
            let [success, iter] = this._techCbox.get_active_iter();
            if (!success) return;
            let tech = techModel.get_value(iter, 0);
            this._settings.set_string(`technology`, tech);
            onTechChange(tech);
        });
        this._techCbox.show();
        connectionsGrid.attach(this._techCbox, 1, 0, 1, 1);

        // Autoconnect Toggle
        const autoConnectLabel = new Gtk.Label({label: "Autoconnect to VPN on startup:", halign: Gtk.Align.START});
        const autoConnectToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`autoconnect`),
            halign: Gtk.Align.END,
            visible: true
        });
        this._settings.bind(`autoconnect`, autoConnectToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        autoConnectToggle.connect('state-set', (widget, state) => this._settings.set_boolean('autoconnect', state));
        autoConnectToggle.set_hexpand(false);  // Don't expand horizontally
        connectionsGrid.attach(autoConnectLabel, 0, 1, 1, 1);
        connectionsGrid.attach(autoConnectToggle, 1, 1, 1, 1);

        // CyberSec
        const cybersecLabel = new Gtk.Label({
            label: `Enable CyberSec:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(cybersecLabel, 0, 2, 1, 1);

        const cyberSecToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`cybersec`),
            halign: Gtk.Align.END,
            visible: true
        });
        connectionsGrid.attach(cyberSecToggle, 1, 2, 1, 1);
        this._settings.bind(`cybersec`, cyberSecToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        // Firewall
        const firewallLabel = new Gtk.Label({
            label: `Enable Firewall:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(firewallLabel, 0, 3, 1, 1);

        const firewallToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`firewall`),
            halign: Gtk.Align.END,
            visible: true
        });
        connectionsGrid.attach(firewallToggle, 1, 3, 1, 1);
        this._settings.bind(`firewall`, firewallToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        // Killswitch
        const killswitchLabel = new Gtk.Label({
            label: `Enable Killswitch:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(killswitchLabel, 0, 4, 1, 1);

        const killswitchToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`killswitch`),
            halign: Gtk.Align.END,
            visible: true
        });
        connectionsGrid.attach(killswitchToggle, 1, 4, 1, 1);
        this._settings.bind(`killswitch`, killswitchToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        // Obfuscate
        const obfuscateLabel = new Gtk.Label({
            label: `Enable Obfuscate:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(obfuscateLabel, 0, 5, 1, 1);

        const obfuscateToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`obfuscate`),
            halign: Gtk.Align.END,
            visible: true
        });
        connectionsGrid.attach(obfuscateToggle, 1, 5, 1, 1);
        this._settings.bind(`obfuscate`, obfuscateToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        // Analytics
        const analyticsLabel = new Gtk.Label({
            label: `Enable Analyics (send anonymous usage to NordVpn):`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(analyticsLabel, 0, 6, 1, 1);

        const analyticsToggle = new Gtk.Switch({
            active: this._settings.get_boolean(`analytics`),
            halign: Gtk.Align.END,
            visible: true
        });
        connectionsGrid.attach(analyticsToggle, 1, 6, 1, 1);
        this._settings.bind(`analytics`, analyticsToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        // Ipv6
        const ipv6Label = new Gtk.Label({
            label: `Enable IPv6:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(ipv6Label, 0, 7, 1, 1);

        const ipV6Toggle = new Gtk.Switch({
            active: this._settings.get_boolean(`ipv6`),
            halign: Gtk.Align.END,
            visible: true
        });
        connectionsGrid.attach(ipV6Toggle, 1, 7, 1, 1);
        this._settings.bind(`ipv6`, ipV6Toggle, `active`, Gio.SettingsBindFlags.DEFAULT);

        // Protocol
        const protocolLabel = new Gtk.Label({
            label: `Select Protocol:`,
            halign: Gtk.Align.START,
            visible: true
        });
        connectionsGrid.attach(protocolLabel, 0, 8, 1, 1);

        let protoModel = new Gtk.ListStore();
        protoModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
        this._protoCbox = new Gtk.ComboBox({model: protoModel});
        let protoRenderer = new Gtk.CellRendererText();
        this._protoCbox.pack_start(protoRenderer, true);
        this._protoCbox.add_attribute(protoRenderer, 'text', 1);
        protoModel.set(protoModel.append(), [0, 1], ['UDP', 'UDP']);
        protoModel.set(protoModel.append(), [0, 1], ['TCP', 'TCP']);
        let protocol = this._settings.get_string(`protocol`);
        this._protoCbox.set_active(protocol === 'UDP' ? 0 : 1);
        this._protoCbox.connect('changed', (entry) => {
            let [success, iter] = this._protoCbox.get_active_iter();
            if (!success) return;
            let protocol = protoModel.get_value(iter, 0);
            this._settings.set_string(`protocol`, protocol);
        });
        this._protoCbox.show();
        connectionsGrid.attach(this._protoCbox, 1, 8, 1, 1);

        // Reset connection settings
        const resetConnection = new Gtk.Button({
            label: `Reset Connection Settings`,
            visible: true
        });
        connectionsGrid.attach(resetConnection, 0, 9, 1, 1);

        function onTechChange(tech) {
            const isOpenVpn = tech === 'OPENVPN';
            if (isOpenVpn) {
                obfuscateToggle.sensitive = true;
                this._protoCbox.sensitive = true;
            } else {
                obfuscateToggle.sensitive = false;
                this._protoCbox.sensitive = false;
            }
        }

        onTechChange(tech);
        return {connectionsGrid, resetConnection};
    }

    _createConnectionsSaveFooter() {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            visible: true,
        });

        const button = new Gtk.Button({
            label: "Apply",
            visible: true,
        });

        // Set custom style
        button.get_style_context().add_class('suggested-action');

        // Adjust the width by setting size request
        button.set_size_request(80, -1);

        // Add some margin to the button for spacing
        button.margin_top = 20;

        button.connect('clicked', () => this._vpn.applySettingsToNord());

        box.append(button);  // Use append() in GTK 4

        return box;
    }

    _createCitiesPage() {
        const cityGrid = new Gtk.Grid({
            margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
        });

        const maxCityPerCountryLabel = new Gtk.Label({
            label: `Max cities per country displayed:`, halign: Gtk.Align.START, visible: true
        });
        cityGrid.attach(maxCityPerCountryLabel, 0, 0, 1, 1);

        const maxCityPerCountryInput = new Gtk.SpinButton();
        maxCityPerCountryInput.set_sensitive(true);
        maxCityPerCountryInput.set_range(0, 10000);
        maxCityPerCountryInput.set_value(0);
        maxCityPerCountryInput.set_increments(1, 2);

        cityGrid.attach(maxCityPerCountryInput, 1, 0, 1, 1);

        this._settings.bind(`number-cities-per-countries`, maxCityPerCountryInput, `value`, Gio.SettingsBindFlags.DEFAULT);

        const citySelectLabel = new Gtk.Label({
            label: `Select countries for cities tab:\n<small>Hold down CTRL to select multiple</small>`,
            use_markup: true,
            halign: Gtk.Align.START,
            visible: true
        });
        cityGrid.attach(citySelectLabel, 0, 1, 1, 1);

        let cityStore = new Gtk.TreeStore();
        cityStore.set_column_types([GObject.TYPE_STRING]);

        let cityColumnRenderer = new Gtk.CellRendererText();
        cityColumnRenderer.height = 30;
        let cityColumn = new Gtk.TreeViewColumn({
            title: "Countries",
            expand: true,
            min_width: 200
        });
        cityColumn.pack_start(cityColumnRenderer, true);
        cityColumn.add_attribute(cityColumnRenderer, "text", 0);

        let cityTreeView = new Gtk.TreeView({
            model: cityStore
        });
        cityTreeView.insert_column(cityColumn, 0);
        cityTreeView.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE);

        let cityTreeIterMap = {};
        let cityCountries = this._settings.get_value('countries-selected-for-cities').deep_unpack();
        if (this._countryNames) {
            this._countryNames.forEach(country => {
                let iter = cityStore.append(null);
                cityStore.set(iter, [0], [country]);
                cityTreeIterMap[country] = iter;

                if (cityCountries.includes(this._countryMap[country])) {
                    cityTreeView.get_selection().select_iter(iter);
                }
            });
        }

        cityTreeView.get_selection().connect('changed', (w) => {
            let [cityPathList, cityStore] = cityTreeView.get_selection().get_selected_rows();

            let selected = [];
            cityPathList.forEach(path => {
                let model = cityTreeView.get_model();
                let [ok, iter] = model.get_iter(path);
                selected.push(this._countryMap[model.get_value(iter, 0)]);
            });

            this._settings.set_value('countries-selected-for-cities', new GLib.Variant('as', selected));
        });

        this._cityScroll = new Gtk.ScrolledWindow();
        this._cityScroll.set_child(cityTreeView);
        this._cityScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this._cityScroll.set_min_content_height(400);

        cityGrid.attach(this._cityScroll, 1, 1, 1, 1);

        return {cityGrid, cityTreeView, cityTreeIterMap};
    }

    _createServersPage() {
        const serverGrid = new Gtk.Grid({
            margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
        });

        const maxServerPerCountryLabel = new Gtk.Label({
            label: `Max servers per country displayed:`, halign: Gtk.Align.START, visible: true
        });
        serverGrid.attach(maxServerPerCountryLabel, 0, 0, 1, 1);

        const maxServerPerCountryInput = new Gtk.SpinButton();
        maxServerPerCountryInput.set_sensitive(true);
        maxServerPerCountryInput.set_range(0, 10000);
        maxServerPerCountryInput.set_value(0);
        maxServerPerCountryInput.set_increments(1, 2);

        serverGrid.attach(maxServerPerCountryInput, 1, 0, 1, 1);

        this._settings.bind(`number-servers-per-countries`, maxServerPerCountryInput, `value`, Gio.SettingsBindFlags.DEFAULT);

        const serverSelectLabel = new Gtk.Label({
            label: `Select countries to list in servers tab:\n<small>Hold down CTRL to select multiple</small>`,
            use_markup: true,
            halign: Gtk.Align.START,
            visible: true
        });
        serverGrid.attach(serverSelectLabel, 0, 1, 1, 1);

        let serverStore = new Gtk.TreeStore();
        serverStore.set_column_types([GObject.TYPE_STRING]);

        let serverColumn = new Gtk.TreeViewColumn({
            title: "Countries",
            expand: true,
            min_width: 200
        });
        serverColumn.pack_start(this._normalRender, true);
        serverColumn.add_attribute(this._normalRender, "text", 0);

        let serverTreeView = new Gtk.TreeView({
            model: serverStore
        });
        serverTreeView.insert_column(serverColumn, 0);
        serverTreeView.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE);

        let serverTreeIterMap = {}
        let serverCountries = this._settings.get_value('countries-selected-for-servers').deep_unpack();
        if (this._countryNames) {
            this._countryNames.forEach(country => {
                let iter = serverStore.append(null);
                serverStore.set(iter, [0], [country]);
                serverTreeIterMap[country] = iter;

                if (serverCountries.includes(this._countryMapWithID[country])) {
                    serverTreeView.get_selection().select_iter(iter);
                }
            });
        }

        serverTreeView.get_selection().connect('changed', (w) => {
            let [serverPathList, serverStore] = serverTreeView.get_selection().get_selected_rows();

            let selected = [];
            serverPathList.forEach(path => {
                let model = serverTreeView.get_model();
                let [ok, iter] = model.get_iter(path);
                selected.push(this._countryMapWithID[model.get_value(iter, 0)]);
            });

            this._settings.set_value('countries-selected-for-servers', new GLib.Variant('ai', selected));
        });

        this._serverScroll = new Gtk.ScrolledWindow();
        this._serverScroll.set_child(serverTreeView);
        this._serverScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this._serverScroll.set_min_content_height(150);
        this._serverScroll.set_min_content_height(400);

        serverGrid.attach(this._serverScroll, 1, 1, 1, 1);

        return {serverGrid, serverTreeView, serverTreeIterMap};
    }

    fillPreferencesWindow(window) {
        this._vpn.setSettingsFromNord();

        // *** GENERAL
        const generalPage = new Adw.PreferencesPage();
        generalPage.set_title("General");
        generalPage.set_icon_name("emblem-system-symbolic");
        const generalGroup = new Adw.PreferencesGroup();
        const {generalGrid, resetAll} = this._createGeneralPage();
        generalGroup.add(generalGrid);
        generalPage.add(generalGroup);
        window.add(generalPage);

        // *** ACCOUNTS
        const accountsPage = new Adw.PreferencesPage();
        accountsPage.set_title("Account");
        accountsPage.set_icon_name("user-home-symbolic");
        const accountsGroup = new Adw.PreferencesGroup();
        accountsGroup.add(this._createAccountsPage());
        accountsPage.add(accountsGroup);
        window.add(accountsPage);

        // *** STYLES
        const stylesPage = new Adw.PreferencesPage();
        stylesPage.set_title("Styles");
        stylesPage.set_icon_name("edit-select-all-symbolic");
        const stylesGroup = new Adw.PreferencesGroup();
        stylesGroup.add(this._stylesManager.createStylesPage());
        stylesPage.add(stylesGroup);
        window.add(stylesPage);

        // *** CONNECTIONS
        const connectionsPage = new Adw.PreferencesPage();
        connectionsPage.set_title("Connection");
        connectionsPage.set_icon_name("network-server-symbolic");
        const connectionsGroup = new Adw.PreferencesGroup();
        const {connectionsGrid, resetConnection} = this._createConnectionsPage();
        connectionsGroup.add(connectionsGrid);
        connectionsGroup.add(this._createConnectionsSaveFooter());
        connectionsPage.add(connectionsGroup);
        window.add(connectionsPage);

        this._countryMap = this._vpn.getCountries();
        this._normalRender = new Gtk.CellRendererText();
        this._countryMapWithID = this._vpn.getCountries(true);
        this._countryNames = Common.safeObjectKeys(this._countryMap);

        // *** CITIES
        const cityPage = new Adw.PreferencesPage();
        cityPage.set_title("Cities");
        cityPage.set_icon_name("document-open-symbolic");
        const cityGroup = new Adw.PreferencesGroup();
        const {cityGrid, cityTreeView, cityTreeIterMap} = this._createCitiesPage();
        cityGroup.add(cityGrid);
        cityPage.add(cityGroup);
        window.add(cityPage);

        // *** SERVERS
        const serverPage = new Adw.PreferencesPage();
        serverPage.set_title("Servers");
        serverPage.set_icon_name("network-workgroup-symbolic");
        const serverGroup = new Adw.PreferencesGroup();
        const {serverGrid, serverTreeView, serverTreeIterMap} = this._createServersPage();
        serverGroup.add(serverGrid);
        serverPage.add(serverGroup);
        window.add(serverPage);

        resetAll.connect('clicked', () => {
            this._resetManager.resetAllSettings(this._settings, this._protoCbox, this._techCbox, cityTreeView, cityTreeIterMap, serverTreeView, serverTreeIterMap);
        });

        resetConnection.connect('clicked', () => {
            this._resetManager.resetConnectionSettings(this._settings, this._protoCbox, this._techCbox);
        });

        return window;
    }
}