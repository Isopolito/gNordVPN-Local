`use strict`;

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {
}

function buildPrefsWidget() {

    this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);

    let prefsWidget = new Gtk.Grid({
        margin: 18,
        column_spacing: 12,
        row_spacing: 12,
        visible: true
    });

    // Add a simple title and add it to the prefsWidget
    let title = new Gtk.Label({
        label: `<b>${Me.metadata.name} Preferences</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true
    });
    prefsWidget.attach(title, 0, 0, 2, 1);

    let toggleLabel = new Gtk.Label({
        label: `Autoconnect to VPN on startup:`,
        halign: Gtk.Align.START,
        visible: true
    });
    prefsWidget.attach(toggleLabel, 0, 1, 1, 1);

    let toggle = new Gtk.Switch({
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

    return prefsWidget;
}