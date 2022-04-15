`use strict`;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Vpn = Me.imports.modules.Vpn.Vpn;

function init() {
}


function resetAllSetting(settings, protoCbox, techCbox, cityTreeView, cityTreeIterMap, serverTreeView, serverTreeIterMap){
    resetGeneralSetting(settings);
    resetConnectionSetting(settings, protoCbox, techCbox);
    resetCitySetting(settings, cityTreeView, cityTreeIterMap);
    resetServerSetting(settings, serverTreeView, serverTreeIterMap);
}

function resetGeneralSetting(settings){
    resetSetting(settings, ['autoconnect', 'commonfavorite']);
}


function resetConnectionSetting(settings, protoCbox, techCbox) {
    resetSetting(settings, ['cybersec','firewall','killswitch','obfuscate','notify','ipv6', 'protocol', 'technology']);

    let protocol = settings.get_string(`protocol`);
    protoCbox.set_active(protocol === 'UDP' ? 0 : 1);

    let tech = settings.get_string(`technology`);
    techCbox.set_active(tech === 'OPENVPN' ? 0 : 1);
}

function resetCitySetting(settings, cityTreeView, cityTreeIterMap){
    resetSetting(settings, ['number-cities-per-countries', 'countries-selected-for-cities']);

    let cityCountries = this.settings.get_value('countries-selected-for-cities').deep_unpack();
    
    cityTreeView.get_selection().unselect_all();
    cityCountries.forEach(country => {
        cityTreeView.get_selection().select_iter(cityTreeIterMap[country.replace(/_/g, " ")]);
    })

}

function resetServerSetting(settings, serverTreeView, serverTreeIterMap){
    resetSetting(settings, ['number-servers-per-countries', 'countries-selected-for-servers']);

    let serverCountries = this.settings.get_value('countries-selected-for-servers').deep_unpack();

    serverTreeView.get_selection().unselect_all();
    serverCountries.forEach(server => {
        serverTreeView.get_selection().select_iter(serverTreeIterMap[server.replace(/_/g, " ")]);
    })
}

function resetSetting(settings, keys){
    keys.forEach(key => {
        settings.set_value(key, settings.get_default_value(key));
    })
}



function buildPrefsWidget() {
    this.normalRender = new Gtk.CellRendererText();

    this.vpn = new Vpn();
    this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
    this.vpn.setSettingsFromNord();

    this.countrieMap = this.vpn.getCountries();
    this.countrieMapWithID = this.vpn.getCountries(true);
    this.countrieNames = Object.keys(this.countrieMap);




    const notebook = new Gtk.Notebook()

    const generalPage = new Gtk.Grid({
        margin_start: 18,
        margin_top: 10,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    // autoconnect
    const toggleLabel = new Gtk.Label({
        label: `Autoconnect to VPN on startup:`,
        halign: Gtk.Align.START,
        visible: true
    });
    generalPage.attach(toggleLabel, 0, 0, 1, 1);

    const autoConnectToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`autoconnect`),
        halign: Gtk.Align.END,
        visible: true
    });
    generalPage.attach(autoConnectToggle, 1, 0, 1, 1);

    this.settings.bind(
        `autoconnect`,
        autoConnectToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );
    
    // common favorite
    const commonFavLabel = new Gtk.Label({
        label: `Display a common favorite tab:`,
        halign: Gtk.Align.START,
        visible: true
    });
    generalPage.attach(commonFavLabel, 0, 1, 1, 1);

    const commonFavToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`commonfavorite`),
        halign: Gtk.Align.END,
        visible: true
    });
    generalPage.attach(commonFavToggle, 1, 1, 1, 1);

    this.settings.bind(
        `commonfavorite`,
        commonFavToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );


    // Reset to defaults
    const resetAll = new Gtk.Button({
        label: `Reset All Settings`,
        visible: true
    });
    generalPage.attach(resetAll, 0, 2, 1, 1);


    const generalSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    generalPage.attach(generalSaveLabel, 0, 3, 2, 1);

    notebook.append_page(generalPage, new Gtk.Label({
        label: `<b>General</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    }))



    const connectionPage = new Gtk.Grid({
        margin_start: 18,
        margin_top: 10,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    // Currently a bug in nordvpn where notify doesn't reflect in settings output, hiding for now to 
    // not confuse people.
    // Notify
    // const notifyLabel = new Gtk.Label({
    //     label: `Enable Notify:`,
    //     halign: Gtk.Align.START,
    //     visible: true
    // });
    // prefsWidget.attach(notifyLabel, 0, 2, 1, 1);
    //
    // const notifyToggle = new Gtk.Switch({
    //     active: this.settings.get_boolean(`notify`),
    //     halign: Gtk.Align.END,
    //     visible: true
    // });
    // prefsWidget.attach(notifyToggle, 1, 2, 1, 1);
    //
    // this.settings.bind(
    //     `notify`,
    //     notifyToggle,
    //     `active`,
    //     Gio.SettingsBindFlags.DEFAULT
    // );

     // CyberSec
    const cybersecLabel = new Gtk.Label({
        label: `Enable CyberSec:`,
        halign: Gtk.Align.START,
        visible: true
    });
    connectionPage.attach(cybersecLabel, 0, 0, 1, 1);

    const cyberSecToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`cybersec`),
        halign: Gtk.Align.END,
        visible: true
    });
    connectionPage.attach(cyberSecToggle, 1, 0, 1, 1);

    this.settings.bind(
        `cybersec`,
        cyberSecToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );
    
    // Firewall
    const firewallLabel = new Gtk.Label({
        label: `Enable Firewall:`,
        halign: Gtk.Align.START,
        visible: true
    });
    connectionPage.attach(firewallLabel, 0, 1, 1, 1);

    const firewallToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`firewall`),
        halign: Gtk.Align.END,
        visible: true
    });
    connectionPage.attach(firewallToggle, 1, 1, 1, 1);

    this.settings.bind(
        `firewall`,
        firewallToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );
    
    // Killswitch
    const killswitchLabel = new Gtk.Label({
        label: `Enable Killswitch:`,
        halign: Gtk.Align.START,
        visible: true
    });
    connectionPage.attach(killswitchLabel, 0, 2, 1, 1);

    const killswitchToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`killswitch`),
        halign: Gtk.Align.END,
        visible: true
    });
    connectionPage.attach(killswitchToggle, 1, 2, 1, 1);

    this.settings.bind(
        `killswitch`,
        killswitchToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );

    // Obfuscate
    const obfuscateLabel = new Gtk.Label({
        label: `Enable Obfuscate:`,
        halign: Gtk.Align.START,
        visible: true
    });
    connectionPage.attach(obfuscateLabel, 0, 3, 1, 1);

    const obfuscateToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`obfuscate`),
        halign: Gtk.Align.END,
        visible: true
    });
    connectionPage.attach(obfuscateToggle, 1, 3, 1, 1);

    this.settings.bind(
        `obfuscate`,
        obfuscateToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );
    
    // Protocol
    const protocolLabel = new Gtk.Label({
        label: `Select Protocol:`,
        halign: Gtk.Align.START,
        visible: true
    });
    connectionPage.attach(protocolLabel, 0, 4, 1, 1);

    let protoModel = new Gtk.ListStore();
    protoModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    this.protoCbox = new Gtk.ComboBox({model: protoModel});
    let protoRenderer = new Gtk.CellRendererText();
    this.protoCbox.pack_start(protoRenderer, true);
    this.protoCbox.add_attribute(protoRenderer, 'text', 1);

    protoModel.set(protoModel.append(), [0, 1], ['UDP', 'UDP']);
    protoModel.set(protoModel.append(), [0, 1], ['TCP', 'TCP']);

    let protocol = this.settings.get_string(`protocol`);
    this.protoCbox.set_active(protocol === 'UDP' ? 0 : 1);
    
    this.protoCbox.connect('changed', function(entry) {
        let [success, iter] = this.protoCbox.get_active_iter();
        if (!success) return;
        let protocol = protoModel.get_value(iter, 0);
        this.settings.set_string(`protocol`, protocol);
    }.bind(this));

    this.protoCbox.show();
    connectionPage.attach(this.protoCbox, 1, 4, 1, 1);
    
    // Technology
    const techLabel = new Gtk.Label({
        label: `Select Technology:`,
        halign: Gtk.Align.START,
        visible: true
    });
    connectionPage.attach(techLabel, 0, 5, 1, 1);

    let techModel = new Gtk.ListStore();
    techModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    this.techCbox = new Gtk.ComboBox({model: techModel});
    let techRenderer = new Gtk.CellRendererText();
    this.techCbox.pack_start(techRenderer, true);
    this.techCbox.add_attribute(techRenderer, 'text', 1);

    techModel.set(techModel.append(), [0, 1], ['OPENVPN', 'OpenVpn']);
    techModel.set(techModel.append(), [0, 1], ['NORDLYNX', 'NordLynx']);

    let tech = this.settings.get_string(`technology`);
    this.techCbox.set_active(tech === 'OPENVPN' ? 0 : 1);

    this.techCbox.connect('changed', function(entry) {
        let [success, iter] = this.techCbox.get_active_iter();
        if (!success) return;
        let tech = techModel.get_value(iter, 0);
        this.settings.set_string(`technology`, tech);
    }.bind(this));

    this.techCbox.show();
    connectionPage.attach(this.techCbox, 1, 5, 1, 1);


    // Reset connection settings
    const resetConnection = new Gtk.Button({
        label: `Reset Connection Settings`,
        visible: true
    });
    connectionPage.attach(resetConnection, 0, 6, 1, 1);


    const connectionSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    connectionPage.attach(connectionSaveLabel, 0, 7, 2, 1);

    notebook.append_page(connectionPage, new Gtk.Label({
        label: `<b>Connection</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    }))








    const cityPage = new Gtk.Grid({
        margin_start: 18,
        margin_top: 10,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    const maxCityPerCountryLabel = new Gtk.Label({
        label: `Max cities per country displayed:`,
        halign: Gtk.Align.START,
        visible: true
    });
    cityPage.attach(maxCityPerCountryLabel, 0, 0, 1, 1);

    const maxCityPerCountryInput = new Gtk.SpinButton();
    maxCityPerCountryInput.set_sensitive(true);
    maxCityPerCountryInput.set_range(0, 10000);
    maxCityPerCountryInput.set_value(0);
    maxCityPerCountryInput.set_increments(1, 2);

    cityPage.attach(maxCityPerCountryInput, 1, 0, 1, 1);

    this.settings.bind(
        `number-cities-per-countries`,
        maxCityPerCountryInput,
        `value`,
        Gio.SettingsBindFlags.DEFAULT
    );


    const citySelectLabel = new Gtk.Label({
        label: `Select countries to list in cities tab:`,
        halign: Gtk.Align.START,
        visible: true
    });
    cityPage.attach(citySelectLabel, 0, 1, 1, 1);

    let cityStore = new Gtk.TreeStore();
    cityStore.set_column_types([
        GObject.TYPE_STRING
    ]);

    let cityColumn = new Gtk.TreeViewColumn({
        title: "Countries"
    });
    cityColumn.pack_start(this.normalRender, true);
    cityColumn.add_attribute(this.normalRender, "text", 0);

    let cityTreeView = new Gtk.TreeView({
        model: cityStore
    });
    cityTreeView.insert_column(cityColumn, 0);
    cityTreeView.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE);

    let cityTreeIterMap = {}
    let cityCountries = this.settings.get_value('countries-selected-for-cities').deep_unpack();
    if(this.countrieNames){
        this.countrieNames.forEach(country => {
            let iter = cityStore.append(null);
            cityStore.set(iter, [0], [country]);
            cityTreeIterMap[country] = iter;

            if(cityCountries.includes(this.countrieMap[country])){
                cityTreeView.get_selection().select_iter(iter);
            }
        });
    }

    cityTreeView.get_selection().connect('changed', (w) => {
        let [ cityPathList, cityStore ] = cityTreeView.get_selection().get_selected_rows();
        
        let selected = [];
        cityPathList.forEach(path => {
            let model = cityTreeView.get_model();
            let [ok, iter] = model.get_iter(path);
            selected.push(this.countrieMap[model.get_value(iter, 0)]);
        });

        settings.set_value('countries-selected-for-cities', new GLib.Variant('as', selected));
    });

    this.cityScroll = new Gtk.ScrolledWindow();
    this.cityScroll.set_child(cityTreeView);
    this.cityScroll.set_policy (Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.cityScroll.set_min_content_height(150);

    cityPage.attach(this.cityScroll, 1, 1, 1, 1);



    const citySaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    cityPage.attach(citySaveLabel, 0, 2, 2, 1);


    notebook.append_page(cityPage, new Gtk.Label({
        label: `<b>City</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    }))









    const serverPage = new Gtk.Grid({
        margin_start: 18,
        margin_top: 10,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    const maxServerPerCountryLabel = new Gtk.Label({
        label: `Max server per country displayed:`,
        halign: Gtk.Align.START,
        visible: true
    });
    serverPage.attach(maxServerPerCountryLabel, 0, 0, 1, 1);

    const maxServerPerCountryInput = new Gtk.SpinButton();
    maxServerPerCountryInput.set_sensitive(true);
    maxServerPerCountryInput.set_range(0, 10000);
    maxServerPerCountryInput.set_value(0);
    maxServerPerCountryInput.set_increments(1, 2);

    serverPage.attach(maxServerPerCountryInput, 1, 0, 1, 1);

    this.settings.bind(
        `number-servers-per-countries`,
        maxServerPerCountryInput,
        `value`,
        Gio.SettingsBindFlags.DEFAULT
    );


    const serverSelectLabel = new Gtk.Label({
        label: `Select countries to list in servers tab:`,
        halign: Gtk.Align.START,
        visible: true
    });
    serverPage.attach(serverSelectLabel, 0, 1, 1, 1);

    let serverStore = new Gtk.TreeStore();
    serverStore.set_column_types([
        GObject.TYPE_STRING
    ]);

    let serverColumn = new Gtk.TreeViewColumn({
        title: "Countries"
    });
    serverColumn.pack_start(this.normalRender, true);
    serverColumn.add_attribute(this.normalRender, "text", 0);

    let serverTreeView = new Gtk.TreeView({
        model: serverStore
    });
    serverTreeView.insert_column(serverColumn, 0);
    serverTreeView.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE);
    
    let serverTreeIterMap = {}
    let serverCountries = settings.get_value('countries-selected-for-servers').deep_unpack();
    if(this.countrieNames){
        this.countrieNames.forEach(country => {
            let iter = serverStore.append(null);
            serverStore.set(iter, [0], [country]);
            serverTreeIterMap[country] = iter;

            if(serverCountries.includes(this.countrieMapWithID[country])){
                serverTreeView.get_selection().select_iter(iter);
            }
        });
    }

    serverTreeView.get_selection().connect('changed', (w) => {
        let [ serverPathList, serverStore ] = serverTreeView.get_selection().get_selected_rows();
        
        let selected = [];
        serverPathList.forEach(path => {
            let model = serverTreeView.get_model();
            let [ok, iter] = model.get_iter(path);
            selected.push(this.countrieMapWithID[model.get_value(iter, 0)]);
        });

        settings.set_value('countries-selected-for-servers', new GLib.Variant('ai', selected));
    });

    this.serverScroll = new Gtk.ScrolledWindow();
    this.serverScroll.set_child(serverTreeView);
    this.serverScroll.set_policy (Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.serverScroll.set_min_content_height(150);

    serverPage.attach(this.serverScroll, 1, 1, 1, 1);



    const serverSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    serverPage.attach(serverSaveLabel, 0, 2, 2, 1);


    notebook.append_page(serverPage, new Gtk.Label({
        label: `<b>Server</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    }))










    // Apply settings when prefs window is closed
    notebook.connect('unmap', function() {
        this.vpn.applySettingsToNord();
    }.bind(this));



    resetAll.connect(`clicked`, () => { 
        resetAllSetting(this.settings, this.protoCbox, this.techCbox, cityTreeView, cityTreeIterMap, serverTreeView, serverTreeIterMap);
    });

    resetConnection.connect(`clicked`, () => {
        resetConnectionSetting(this.settings, this.protoCbox, this.techCbox);
    });
    
    return notebook;
}