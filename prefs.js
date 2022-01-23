`use strict`;

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Vpn = Me.imports.modules.Vpn.Vpn;

function init() {
}

function buildPrefsWidget() {
    this.vpn = new Vpn();
    this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
    this.vpn.setSettingsFromNord();

    const prefsWidget = new Gtk.Grid({
        margin_start: 18,
        margin_top: 10,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    const title = new Gtk.Label({
        label: `<b>Preferences</b> (changes applied on close)`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    prefsWidget.attach(title, 1, 0, 2, 1);

    // autoconnect
    const toggleLabel = new Gtk.Label({
        label: `Autoconnect to VPN on startup:`,
        halign: Gtk.Align.START,
        visible: true
    });
    prefsWidget.attach(toggleLabel, 0, 1, 1, 1);

    const autoConnectToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`autoconnect`),
        halign: Gtk.Align.END,
        visible: true
    });
    
    prefsWidget.attach(autoConnectToggle, 1, 1, 1, 1);
    this.settings.bind(
        `autoconnect`,
        autoConnectToggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );

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
    prefsWidget.attach(cybersecLabel, 0, 3, 1, 1);

    const cyberSecToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`cybersec`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(cyberSecToggle, 1, 3, 1, 1);

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
    prefsWidget.attach(firewallLabel, 0, 4, 1, 1);

    const firewallToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`firewall`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(firewallToggle, 1, 4, 1, 1);

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
    prefsWidget.attach(killswitchLabel, 0, 5, 1, 1);

    const killswitchToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`killswitch`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(killswitchToggle, 1, 5, 1, 1);

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
    prefsWidget.attach(obfuscateLabel, 0, 6, 1, 1);

    const obfuscateToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`obfuscate`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(obfuscateToggle, 1, 6, 1, 1);

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
    prefsWidget.attach(protocolLabel, 0, 7, 1, 1);

    let protoModel = new Gtk.ListStore();
    protoModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    let protoCbox = new Gtk.ComboBox({model: protoModel});
    let protoRenderer = new Gtk.CellRendererText();
    protoCbox.pack_start(protoRenderer, true);
    protoCbox.add_attribute(protoRenderer, 'text', 1);

    protoModel.set(protoModel.append(), [0, 1], ['UDP', 'UDP']);
    protoModel.set(protoModel.append(), [0, 1], ['TCP', 'TCP']);

    let protocol = this.settings.get_string(`protocol`);
    protoCbox.set_active(protocol === 'UDP' ? 0 : 1);
    
    protoCbox.connect('changed', function(entry) {
        let [success, iter] = protoCbox.get_active_iter();
        if (!success) return;
        let protocol = protoModel.get_value(iter, 0);
        this.settings.set_string(`protocol`, protocol);
    }.bind(this));

    protoCbox.show();
    prefsWidget.attach(protoCbox, 1, 7, 1, 1);
    
    // Technology
    const techLabel = new Gtk.Label({
        label: `Select Technology:`,
        halign: Gtk.Align.START,
        visible: true
    });
    prefsWidget.attach(techLabel, 0, 8, 1, 1);

    let techModel = new Gtk.ListStore();
    techModel.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    let techCbox = new Gtk.ComboBox({model: techModel});
    let techRenderer = new Gtk.CellRendererText();
    techCbox.pack_start(techRenderer, true);
    techCbox.add_attribute(techRenderer, 'text', 1);

    techModel.set(techModel.append(), [0, 1], ['OPENVPN', 'OpenVpn']);
    techModel.set(techModel.append(), [0, 1], ['NORDLYNX', 'NordLynx']);

    let tech = this.settings.get_string(`technology`);
    
    techCbox.set_active(tech === 'OPENVPN' ? 0 : 1);

    techCbox.connect('changed', function(entry) {
        let [success, iter] = techCbox.get_active_iter();
        if (!success) return;
        let tech = techModel.get_value(iter, 0);
        this.settings.set_string(`technology`, tech);
    }.bind(this));

    techCbox.show();
    prefsWidget.attach(techCbox, 1, 8, 1, 1);
   
    // Reset to defaults
    const defaults = new Gtk.Button({
        label: `Reset To Defaults`,
        visible: true
    });
    defaults.connect(`clicked`, () => {
        this.vpn.setToDefaults();
    });
    prefsWidget.attach(defaults, 0, 9, 1, 1);

    // Apply settings when prefs window is closed
    prefsWidget.connect('unmap', function() {
        this.vpn.applySettingsToNord();
    }.bind(this));
    
    return prefsWidget;
}