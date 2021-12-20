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
    this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
    this.vpn = new Vpn();

    const prefsWidget = new Gtk.Grid({
        margin: 18,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    // Add a simple title and add it to the prefsWidget
    const title = new Gtk.Label({
        label: `<b>${Me.metadata.name} Preferences</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    prefsWidget.attach(title, 0, 0, 2, 1);

    // autoconnect
    const toggleLabel = new Gtk.Label({
        label: `Autoconnect to VPN on startup:`,
        halign: Gtk.Align.START,
        visible: true
    });
    prefsWidget.attach(toggleLabel, 0, 1, 1, 1);

    const toggle = new Gtk.Switch({
        active: this.settings.get_boolean(`autoconnect`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(toggle, 1, 1, 1, 1);

    this.settings.bind(
        `autoconnect`,
        toggle,
        `active`,
        Gio.SettingsBindFlags.DEFAULT
    );
    
    // CyberSec
    const cybersecLabel = new Gtk.Label({
        label: `Enable CyberSec:`,
        halign: Gtk.Align.START,
        visible: true
    });
    prefsWidget.attach(cybersecLabel, 0, 2, 1, 1);

    const cyberSecToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`cybersec`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(cyberSecToggle, 1, 2, 1, 1);

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
    prefsWidget.attach(firewallLabel, 0, 3, 1, 1);

    const firewallToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`firewall`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(firewallToggle, 1, 3, 1, 1);

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
    prefsWidget.attach(killswitchLabel, 0, 4, 1, 1);

    const killswitchToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`killswitch`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(killswitchToggle, 1, 4, 1, 1);

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
    prefsWidget.attach(obfuscateLabel, 0, 5, 1, 1);

    const obfuscateToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`obfuscate`),
        halign: Gtk.Align.END,
        visible: true
    });
    prefsWidget.attach(obfuscateToggle, 1, 5, 1, 1);

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
    prefsWidget.attach(protocolLabel, 0, 6, 1, 1);

    let model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    let cbox = new Gtk.ComboBox({model: model});
    let renderer = new Gtk.CellRendererText();
    cbox.pack_start(renderer, true);
    cbox.add_attribute(renderer, 'text', 1);

    model.set(model.append(), [0, 1], ['udp', 'UDP']);
    model.set(model.append(), [0, 1], ['tcp', 'TCP']);

    cbox.set_active(0); // set value

    cbox.connect('changed', function(entry) {
        let [success, iter] = cbox.get_active_iter();
        if (!success) return;
        let myValue = model.get_value(iter, 0); // get value
    });

    cbox.show();
    prefsWidget.attach(cbox, 1, 6, 1, 1);
    
    // Reset to defaults
    const defaults = new Gtk.Button({ 
        label: `Reset To Defaults`,
        visible: true
    });
    defaults.connect(`clicked`, () => {
        this.vpn.setDefaults();
    });
    prefsWidget.attach(defaults, 3, 7, 1, 1);

    return prefsWidget;
}
