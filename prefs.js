`use strict`;

const {Adw} = imports.gi;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Vpn = Me.imports.modules.Vpn.Vpn;
const Constants = Me.imports.modules.constants;
const Common = Me.imports.modules.common;

function init() {
}

function resetAllSetting(settings, protoCbox, techCbox, cityTreeView, cityTreeIterMap, serverTreeView, serverTreeIterMap) {
    resetGeneralSetting(settings);
    resetAccountSetting(settings);
    resetConnectionSetting(settings, protoCbox, techCbox);
    resetCitySetting(settings, cityTreeView, cityTreeIterMap);
    resetServerSetting(settings, serverTreeView, serverTreeIterMap);
}

function resetGeneralSetting(settings) {
    resetSetting(settings, ['autoconnect', 'commonfavorite']);
}

function resetAccountSetting(settings) {
    resetSetting(settings, ['showlogin', 'showlogout']);
}

function resetConnectionSetting(settings, protoCbox, techCbox) {
    resetSetting(settings, ['cybersec', 'firewall', 'killswitch', 'obfuscate', 'notify', 'ipv6', 'protocol', 'technology']);

    let protocol = settings.get_string(`protocol`);
    protoCbox.set_active(protocol === 'UDP' ? 0 : 1);

    let tech = settings.get_string(`technology`);
    techCbox.set_active(tech === 'OPENVPN' ? 0 : 1);
}

function resetCitySetting(settings, cityTreeView, cityTreeIterMap) {
    resetSetting(settings, ['number-cities-per-countries', 'countries-selected-for-cities']);

    let cityCountries = this.settings.get_value('countries-selected-for-cities').deep_unpack();

    cityTreeView.get_selection().unselect_all();
    cityCountries.forEach(country => {
        cityTreeView.get_selection().select_iter(cityTreeIterMap[country.replace(/_/g, " ")]);
    })
}

function resetServerSetting(settings, serverTreeView, serverTreeIterMap) {
    resetSetting(settings, ['number-servers-per-countries', 'countries-selected-for-servers']);

    let serverCountries = this.settings.get_value('countries-selected-for-servers').deep_unpack();

    serverTreeView.get_selection().unselect_all();
    serverCountries.forEach(server => {
        serverTreeView.get_selection().select_iter(serverTreeIterMap[server.replace(/_/g, " ")]);
    })
}

function resetSetting(settings, keys) {
    keys.forEach(key => {
        settings.set_value(key, settings.get_default_value(key));
    })
}

function createStylesPageOld() {
    const stylePage = new Gtk.Grid({
        margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
    });

    const monoLabel = new Gtk.Label({
        label: `Build as monochrome:`, halign: Gtk.Align.START, visible: true
    });
    stylePage.attach(monoLabel, 0, 0, 1, 1);

    const monoToggle = new Gtk.Switch({
        active: false, halign: Gtk.Align.END, visible: true
    });
    stylePage.attach(monoToggle, 1, 0, 1, 1);

    const altLabel = new Gtk.Label({
        label: `Build with alt style:`, halign: Gtk.Align.START, visible: true
    });
    stylePage.attach(altLabel, 0, 1, 1, 1);

    const altToggle = new Gtk.Switch({
        active: false, halign: Gtk.Align.END, visible: true
    });
    stylePage.attach(altToggle, 1, 1, 1, 1);


    const loadDefault = new Gtk.Label({
        label: '<b>Build default: </b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(loadDefault, 0, 2, 1, 1);


    const styleSmall = new Gtk.Button({
        label: `Small default`, visible: true
    });
    stylePage.attach(styleSmall, 1, 2, 1, 1);

    const styleMedium = new Gtk.Button({
        label: `Medium default`, visible: true
    });
    stylePage.attach(styleMedium, 2, 2, 1, 1);

    const styleLarge = new Gtk.Button({
        label: `Large default`, visible: true
    });
    stylePage.attach(styleLarge, 3, 2, 1, 1);

    const styleExtraLarge = new Gtk.Button({
        label: `Extra Large default`, visible: true
    });
    stylePage.attach(styleExtraLarge, 4, 2, 1, 1);

    const customStyle = new Gtk.Label({
        label: '<b>Edit style</b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(customStyle, 0, 3, 1, 1);

    const displayMsg = new Gtk.Label({
        label: '<b>Display Msg</b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(displayMsg, 1, 4, 1, 1);

    const textColor = new Gtk.Label({
        label: '<b>CSS Style</b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(textColor, 2, 4, 1, 1);

    let row = 5;
    let styleItems = [];
    Common.safeObjectKeys(Constants.states).forEach(state => {
        const label = new Gtk.Label({
            label: state, halign: Gtk.Align.START, visible: true
        });
        stylePage.attach(label, 0, row, 1, 1);

        const format = new Gtk.Entry();
        stylePage.attach(format, 1, row, 1, 1);

        const css = new Gtk.Entry();
        stylePage.attach(css, 2, row++, 3, 1);

        styleItems.push({state, format, css});
    });

    const commonCsslabel = new Gtk.Label({
        label: "Common CSS", halign: Gtk.Align.START, visible: true
    });
    stylePage.attach(commonCsslabel, 0, row, 1, 1);

    const commonCss = new Gtk.Entry();
    let cps = this.settings.get_string(`common-panel-style`);
    commonCss.get_buffer().set_text(cps, cps.length)
    commonCss.connect(`changed`, () => {
        let gv = new GLib.Variant("s", commonCss.get_buffer().get_text());
        log(JSON.stringify(commonCss.get_buffer().get_text()));
        settings.set_value(`common-panel-style`, gv);
    });

    stylePage.attach(commonCss, 1, row++, 4, 1);

    let savedStyle = this.settings.get_value('panel-styles').deep_unpack();
    loadStyle(savedStyle, styleItems)

    const connectedKeyLabel = new Gtk.Label({
        label: `<b>* Available keys for CONNECTED: {country},{COUNTRY},{ctry},{city},{CITY},{number},{server},{ip},{tech},{protocol},{transfer},{transferUp},{transferDown},{uptime},{uptimeHr},{uptimeMin},{uptimeSec}</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true,
    });
    connectedKeyLabel.set_selectable(true);
    stylePage.attach(connectedKeyLabel, 0, row++, 5, 1);

    const styleSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    });

    stylePage.attach(styleSaveLabel, 0, row, 2, 1);

    styleExtraLarge.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{city}, {country}  -  {uptimeHr}:{uptimeMin}:{uptimeSec}  -  ↑{transferUp} ↓{transferDown}',
            'CONNECTING': 'VPN CONNECTING',
            'DISCONNECTED': 'VPN DISCONNECTED',
            'DISCONNECTING': 'VPN DISCONNECTING ',
            'RECONNECTING': 'VPN RECONNECTING',
            'RESTARTING': 'VPN RESTARTING',
            'ERROR': 'VPN ERROR',
            'LOGGED_OUT': 'VPN LOGGED OUT',
            'LOGGING_IN': 'VPN LOGGING IN',
            'LOGGING_OUT': 'VPN LOGGING OUT',
        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleLarge.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{country} #{number}',
            'CONNECTING': 'CONNECTING',
            'DISCONNECTED': 'DISCONNECTED',
            'DISCONNECTING': 'DISCONNECTING',
            'RECONNECTING': 'RECONNECTING',
            'RESTARTING': 'RESTARTING',
            'ERROR': 'ERROR',
            'LOGGED_OUT': 'LOGGED OUT',
            'LOGGING_IN': 'LOGGING IN',
            'LOGGING_OUT': 'LOGGING OUT',
        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleMedium.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{ctry}#{number}',
            'CONNECTING': '...',
            'DISCONNECTED': 'OFF',
            'DISCONNECTING': '...',
            'RECONNECTING': '...',
            'RESTARTING': '...',
            'ERROR': 'ERR',
            'LOGGED_OUT': 'OUT',
            'LOGGING_IN': '...',
            'LOGGING_OUT': '...',

        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleSmall.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{ctry}',
            'CONNECTING': '.',
            'DISCONNECTED': '∅',
            'DISCONNECTING': '.',
            'RECONNECTING': '.',
            'RESTARTING': '.',
            'ERROR': '⚠',
            'LOGGED_OUT': '?',
            'LOGGING_IN': '.',
            'LOGGING_OUT': '.',
        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleItems.forEach(item => {
        item.format.connect(`changed`, () => {
            saveStyle(styleItems);
        });
        item.css.connect(`changed`, () => {
            saveStyle(styleItems);
        });
    });

    return stylePage;
}

function connectStyleButtons(styleExtraLarge, monoToggle, altToggle, commonCss, styleItems, styleLarge, styleMedium, styleSmall) {
    styleExtraLarge.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{city}, {country}  -  {uptimeHr}:{uptimeMin}:{uptimeSec}  -  ↑{transferUp} ↓{transferDown}',
            'CONNECTING': 'VPN CONNECTING',
            'DISCONNECTED': 'VPN DISCONNECTED',
            'DISCONNECTING': 'VPN DISCONNECTING ',
            'RECONNECTING': 'VPN RECONNECTING',
            'RESTARTING': 'VPN RESTARTING',
            'ERROR': 'VPN ERROR',
            'LOGGED_OUT': 'VPN LOGGED OUT',
            'LOGGING_IN': 'VPN LOGGING IN',
            'LOGGING_OUT': 'VPN LOGGING OUT',
        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleLarge.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{country} #{number}',
            'CONNECTING': 'CONNECTING',
            'DISCONNECTED': 'DISCONNECTED',
            'DISCONNECTING': 'DISCONNECTING',
            'RECONNECTING': 'RECONNECTING',
            'RESTARTING': 'RESTARTING',
            'ERROR': 'ERROR',
            'LOGGED_OUT': 'LOGGED OUT',
            'LOGGING_IN': 'LOGGING IN',
            'LOGGING_OUT': 'LOGGING OUT',
        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleMedium.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{ctry}#{number}',
            'CONNECTING': '...',
            'DISCONNECTED': 'OFF',
            'DISCONNECTING': '...',
            'RECONNECTING': '...',
            'RESTARTING': '...',
            'ERROR': 'ERR',
            'LOGGED_OUT': 'OUT',
            'LOGGING_IN': '...',
            'LOGGING_OUT': '...',

        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleSmall.connect(`clicked`, () => {
        let panelTexts = {
            'CONNECTED': '{ctry}',
            'CONNECTING': '.',
            'DISCONNECTED': '∅',
            'DISCONNECTING': '.',
            'RECONNECTING': '.',
            'RESTARTING': '.',
            'ERROR': '⚠',
            'LOGGED_OUT': '?',
            'LOGGING_IN': '.',
            'LOGGING_OUT': '.',
        }
        loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
    });

    styleItems.forEach(item => {
        item.format.connect(`changed`, () => {
            saveStyle(styleItems);
        });
        item.css.connect(`changed`, () => {
            saveStyle(styleItems);
        });
    });
}

function createBuildSection() {
    const stylePage = new Gtk.Grid({
        margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
    });

    const monoLabel = new Gtk.Label({
        label: `Build as monochrome:`, halign: Gtk.Align.START, visible: true
    });
    stylePage.attach(monoLabel, 0, 0, 1, 1);

    const monoToggle = new Gtk.Switch({
        active: false, halign: Gtk.Align.END, visible: true
    });
    stylePage.attach(monoToggle, 1, 0, 1, 1);

    const altLabel = new Gtk.Label({
        label: `Build with alt style:`, halign: Gtk.Align.START, visible: true
    });
    stylePage.attach(altLabel, 0, 1, 1, 1);

    const altToggle = new Gtk.Switch({
        active: false, halign: Gtk.Align.END, visible: true
    });
    stylePage.attach(altToggle, 1, 1, 1, 1);

    const loadDefault = new Gtk.Label({
        label: '<b>Build default: </b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(loadDefault, 0, 2, 1, 1);

    const styleSmall = new Gtk.Button({
        label: `Small default`, visible: true
    });
    stylePage.attach(styleSmall, 1, 2, 1, 1);

    const styleMedium = new Gtk.Button({
        label: `Medium default`, visible: true
    });
    stylePage.attach(styleMedium, 2, 2, 1, 1);

    const styleLarge = new Gtk.Button({
        label: `Large default`, visible: true
    });
    stylePage.attach(styleLarge, 3, 2, 1, 1);

    const styleExtraLarge = new Gtk.Button({
        label: `Extra Large default`, visible: true
    });
    stylePage.attach(styleExtraLarge, 4, 2, 1, 1);
    return {stylePage, monoToggle, altToggle, styleSmall, styleMedium, styleLarge, styleExtraLarge};
}

function createEditStyleSection(stylePage) {
    const customStyle = new Gtk.Label({
        label: '<b>Edit style</b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(customStyle, 0, 3, 1, 1);

    const displayMsg = new Gtk.Label({
        label: '<b>Display Msg</b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(displayMsg, 1, 4, 1, 1);

    const textColor = new Gtk.Label({
        label: '<b>CSS Style</b>', halign: Gtk.Align.START, use_markup: true, visible: true
    });
    stylePage.attach(textColor, 2, 4, 1, 1);

    let row = 5;
    let styleItems = [];
    Common.safeObjectKeys(Constants.states).forEach(state => {
        const label = new Gtk.Label({
            label: state, halign: Gtk.Align.START, visible: true
        });
        stylePage.attach(label, 0, row, 1, 1);

        const format = new Gtk.Entry();
        stylePage.attach(format, 1, row, 1, 1);

        const css = new Gtk.Entry();
        stylePage.attach(css, 2, row++, 3, 1);

        styleItems.push({state, format, css});
    });

    const commonCsslabel = new Gtk.Label({
        label: "Common CSS", halign: Gtk.Align.START, visible: true
    });
    stylePage.attach(commonCsslabel, 0, row, 1, 1);

    const commonCss = new Gtk.Entry();
    let cps = this.settings.get_string(`common-panel-style`);
    commonCss.get_buffer().set_text(cps, cps.length)
    commonCss.connect(`changed`, () => {
        let gv = new GLib.Variant("s", commonCss.get_buffer().get_text());
        log(JSON.stringify(commonCss.get_buffer().get_text()));
        settings.set_value(`common-panel-style`, gv);
    });

    stylePage.attach(commonCss, 1, row++, 4, 1);

    let savedStyle = this.settings.get_value('panel-styles').deep_unpack();
    loadStyle(savedStyle, styleItems)

    const connectedKeyLabel = new Gtk.Label({
        label: `<b>* Available keys for CONNECTED: {country},{COUNTRY},{ctry},{city},{CITY},{number},{server},{ip},{tech},{protocol},{transfer},{transferUp},{transferDown},{uptime},{uptimeHr},{uptimeMin},{uptimeSec}</b>`,
        halign: Gtk.Align.START,
        use_markup: true,
        visible: true,
    });
    connectedKeyLabel.set_selectable(true);
    stylePage.attach(connectedKeyLabel, 0, row++, 5, 1);
    return {row, styleItems, commonCss};
}

function createStylesPage() {
    const {
        stylePage,
        monoToggle,
        altToggle,
        styleSmall,
        styleMedium,
        styleLarge,
        styleExtraLarge
    } = createBuildSection();

    let {row, styleItems, commonCss} = createEditStyleSection.call(this, stylePage);

    connectStyleButtons(styleExtraLarge, monoToggle, altToggle, commonCss, styleItems, styleLarge, styleMedium, styleSmall);

    const styleSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    });

    stylePage.attach(styleSaveLabel, 0, row, 2, 1);

    return stylePage;
}

function saveStyle(styleItems) {

    let data = {};
    let invalid = false;
    styleItems.every(item => {
        data[item.state] = {};
        data[item.state].panelText = item.format.get_buffer().get_text();
        data[item.state].css = item.css.get_buffer().get_text();

        return true;
    });

    this.settings.set_value('panel-styles', new GLib.Variant('a{sa{ss}}', data));
}

function loadStyle(data, styleItems) {
    styleItems.forEach(item => {
        let panelText = data[item.state].panelText;
        item.format.get_buffer().set_text(panelText, panelText.length);

        let css = data[item.state].css;
        item.css.get_buffer().set_text(css, css.length);
    })
}

function loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems) {
    let styleCss = {
        'CONNECTED': {css: 'background-color: rgba(0,255,0,0.7); color: rgba(255,255,255,1);'},
        'CONNECTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
        'DISCONNECTED': {css: 'background-color: rgba(255,0,0,0.7); color: rgba(255,255,255,1);'},
        'DISCONNECTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
        'RECONNECTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
        'RESTARTING': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
        'ERROR': {css: 'background-color: rgba(255,0,0,0.7); color: rgba(255,255,255,1);'},
        'LOGGED_OUT': {css: 'background-color: rgba(48,26,208,0.7); color: rgba(255,255,255,1);'},
        'LOGGING_IN': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
        'LOGGING_OUT': {css: 'background-color: rgba(255,191,0,0.7); color: rgba(255,255,255,1);'},
    };

    let styleAltCss = {
        'CONNECTED': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(0,255,0,0.7);'},
        'CONNECTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
        'DISCONNECTED': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,0,0,0.7);'},
        'DISCONNECTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
        'RECONNECTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
        'RESTARTING': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
        'ERROR': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,0,0,0.7);'},
        'LOGGED_OUT': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(48,26,208,0.7);'},
        'LOGGING_IN': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
        'LOGGING_OUT': {css: 'background-color: rgba(0,0,0,0.7); color: rgba(255,191,0,0.7);'},
    }

    let monoCss = "background-color: rgba(255,255,255,0.7); color: rgba(0,0,0,1);";
    let altMonoCss = "background-color: rgba(0,0,0,0.7); color: rgba(255,255,255,1);";

    let ccss = "font-weight: bold; border-radius: 100px; padding: 4px 10px 0; margin: 3px 0px 3px 0px;";
    let altCcss = "font-weight: bold; border-radius: 5px; padding: 3px 10px 0; margin: 3px 0px 3px 0px; border: 1px solid white;";

    let isMono = monoToggle.get_active();
    let isAlt = altToggle.get_active();
    let style = isAlt ? styleAltCss : styleCss;
    Common.safeObjectKeys(style).forEach(key => {
        if (isMono) style[key].css = isAlt ? altMonoCss : monoCss;
        style[key].panelText = panelTexts[key];
    });

    let _ccss = altToggle.get_active() ? altCcss : ccss;
    commonCss.get_buffer().set_text(_ccss, _ccss.length);

    loadStyle(style, styleItems);
}

function createGeneralPage() {
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

    let initialPosition = this.settings.get_string('panel-position');
    panelPositionCombo.set_active_id(initialPosition);

    panelPositionCombo.connect('changed', function () {
        const newPosition = panelPositionCombo.get_active_id();
        this.settings.set_string('panel-position', newPosition);
    }.bind(this));

    // Autoconnect Toggle
    const autoConnectLabel = new Gtk.Label({label: "Autoconnect to VPN on startup:", halign: Gtk.Align.START});
    const autoConnectToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`autoconnect`),
        halign: Gtk.Align.START,
        visible: true
    });
    this.settings.bind(`autoconnect`, autoConnectToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

    autoConnectToggle.connect('state-set', (widget, state) => {
        this.settings.set_boolean('autoconnect', state);
        log(`Set autoconnect to: ${state}`);
        log(`Retrieved autoconnect as: ${this.settings.get_boolean('autoconnect')}`);
    });

    autoConnectToggle.set_hexpand(false);  // Don't expand horizontally
    generalGrid.attach(autoConnectLabel, 0, 1, 1, 1);
    generalGrid.attach(autoConnectToggle, 1, 1, 1, 1);

    // Common Favorite Toggle
    const commonFavLabel = new Gtk.Label({label: "Display a common favorite tab:", halign: Gtk.Align.START});
    const commonFavToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`commonfavorite`),
        halign: Gtk.Align.START,
        visible: true
    });
    this.settings.bind(`commonfavorite`, commonFavToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

    commonFavToggle.set_hexpand(false);  // Don't expand horizontally
    generalGrid.attach(commonFavLabel, 0, 2, 1, 1);
    generalGrid.attach(commonFavToggle, 1, 2, 1, 1);

    // Reset All Settings Button
    const resetAll = new Gtk.Button({label: "Reset All Settings"});
    generalGrid.attach(resetAll, 0, 3, 2, 1);

    // Changes Applied on Close Label
    const changesAppliedLabel = new Gtk.Label({
        label: "<b>* Changes applied on close</b>", use_markup: true, halign: Gtk.Align.START
    });
    generalGrid.attach(changesAppliedLabel, 0, 4, 2, 1);

    return {generalGrid, resetAll};
}

function createAccountsPage() {
    const accountsGrid = new Gtk.Grid({
        column_spacing: 12, row_spacing: 12, margin_top: 10, margin_bottom: 10, margin_start: 10, margin_end: 10
    });

    // Show Login Toggle
    const showLoginLabel = new Gtk.Label({label: "Show login button in menu:", halign: Gtk.Align.START});
    const showLoginToggle = new Gtk.Switch({active: this.settings.get_boolean('showlogin'), halign: Gtk.Align.START});
    this.settings.bind('showlogin', showLoginToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    accountsGrid.attach(showLoginLabel, 0, 0, 1, 1);
    accountsGrid.attach(showLoginToggle, 1, 0, 1, 1);

    // Show Logout Toggle
    const showLogoutLabel = new Gtk.Label({label: "Show logout button in menu:", halign: Gtk.Align.START});
    const showLogoutToggle = new Gtk.Switch({active: this.settings.get_boolean('showlogout'), halign: Gtk.Align.START});
    this.settings.bind('showlogout', showLogoutToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    accountsGrid.attach(showLogoutLabel, 0, 1, 1, 1);
    accountsGrid.attach(showLogoutToggle, 1, 1, 1, 1);

    // Account Information
    const accountInfo = new Gtk.Label({label: "<b>Account Information</b>", use_markup: true, halign: Gtk.Align.START});
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
    loginButton.connect('clicked', () => {
        this.vpn.loginVpn();
    });
    loginButton.set_sensitive(false);
    accountsGrid.attach(loginButton, 0, 5, 1, 1);

    const logoutButton = new Gtk.Button({label: "Logout"});
    logoutButton.connect('clicked', () => {
        this.vpn.logoutVpn();
    });
    logoutButton.set_sensitive(false);
    accountsGrid.attach(logoutButton, 1, 5, 1, 1);

    const refreshAccountButton = new Gtk.Button({label: "Refresh"});
    const refreshAccount = () => {
        let account = this.vpn.getAccount();
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

    // Changes Applied on Close Label
    const changesAppliedLabel = new Gtk.Label({
        label: "<b>* Changes applied on close</b>",
        use_markup: true,
        halign: Gtk.Align.START
    });
    accountsGrid.attach(changesAppliedLabel, 0, 7, 2, 1);

    return accountsGrid;
}

function createConnectionsPage() {
    const connectionPage = new Gtk.Grid({
        margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
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
        label: `Enable CyberSec:`, halign: Gtk.Align.START, visible: true
    });
    connectionPage.attach(cybersecLabel, 0, 0, 1, 1);

    const cyberSecToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`cybersec`), halign: Gtk.Align.END, visible: true
    });
    connectionPage.attach(cyberSecToggle, 1, 0, 1, 1);

    this.settings.bind(`cybersec`, cyberSecToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

    // Firewall
    const firewallLabel = new Gtk.Label({
        label: `Enable Firewall:`, halign: Gtk.Align.START, visible: true
    });
    connectionPage.attach(firewallLabel, 0, 1, 1, 1);

    const firewallToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`firewall`), halign: Gtk.Align.END, visible: true
    });
    connectionPage.attach(firewallToggle, 1, 1, 1, 1);

    this.settings.bind(`firewall`, firewallToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

    // Killswitch
    const killswitchLabel = new Gtk.Label({
        label: `Enable Killswitch:`, halign: Gtk.Align.START, visible: true
    });
    connectionPage.attach(killswitchLabel, 0, 2, 1, 1);

    const killswitchToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`killswitch`), halign: Gtk.Align.END, visible: true
    });
    connectionPage.attach(killswitchToggle, 1, 2, 1, 1);

    this.settings.bind(`killswitch`, killswitchToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

    // Obfuscate
    const obfuscateLabel = new Gtk.Label({
        label: `Enable Obfuscate:`, halign: Gtk.Align.START, visible: true
    });
    connectionPage.attach(obfuscateLabel, 0, 3, 1, 1);

    const obfuscateToggle = new Gtk.Switch({
        active: this.settings.get_boolean(`obfuscate`), halign: Gtk.Align.END, visible: true
    });
    connectionPage.attach(obfuscateToggle, 1, 3, 1, 1);

    this.settings.bind(`obfuscate`, obfuscateToggle, `active`, Gio.SettingsBindFlags.DEFAULT);

    // Protocol
    const protocolLabel = new Gtk.Label({
        label: `Select Protocol:`, halign: Gtk.Align.START, visible: true
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

    this.protoCbox.connect('changed', function (entry) {
        let [success, iter] = this.protoCbox.get_active_iter();
        if (!success) return;
        let protocol = protoModel.get_value(iter, 0);
        this.settings.set_string(`protocol`, protocol);
    }.bind(this));

    this.protoCbox.show();
    connectionPage.attach(this.protoCbox, 1, 4, 1, 1);

    // Technology
    const techLabel = new Gtk.Label({
        label: `Select Technology:`, halign: Gtk.Align.START, visible: true
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

    this.techCbox.connect('changed', function (entry) {
        let [success, iter] = this.techCbox.get_active_iter();
        if (!success) return;
        let tech = techModel.get_value(iter, 0);
        this.settings.set_string(`technology`, tech);
    }.bind(this));

    this.techCbox.show();
    connectionPage.attach(this.techCbox, 1, 5, 1, 1);


    // Reset connection settings
    const resetConnection = new Gtk.Button({
        label: `Reset Connection Settings`, visible: true
    });
    connectionPage.attach(resetConnection, 0, 6, 1, 1);

    const connectionSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    });
    connectionPage.attach(connectionSaveLabel, 0, 7, 2, 1);
    return {connectionPage, resetConnection};
}

function createCitiesPage() {
    const cityPage = new Gtk.Grid({
        margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
    });

    const maxCityPerCountryLabel = new Gtk.Label({
        label: `Max cities per country displayed:`, halign: Gtk.Align.START, visible: true
    });
    cityPage.attach(maxCityPerCountryLabel, 0, 0, 1, 1);

    const maxCityPerCountryInput = new Gtk.SpinButton();
    maxCityPerCountryInput.set_sensitive(true);
    maxCityPerCountryInput.set_range(0, 10000);
    maxCityPerCountryInput.set_value(0);
    maxCityPerCountryInput.set_increments(1, 2);

    cityPage.attach(maxCityPerCountryInput, 1, 0, 1, 1);

    this.settings.bind(`number-cities-per-countries`, maxCityPerCountryInput, `value`, Gio.SettingsBindFlags.DEFAULT);

    const citySelectLabel = new Gtk.Label({
        label: `Select countries to list in cities tab:`, halign: Gtk.Align.START, visible: true
    });
    cityPage.attach(citySelectLabel, 0, 1, 1, 1);

    let cityStore = new Gtk.TreeStore();
    cityStore.set_column_types([GObject.TYPE_STRING]);

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
    if (this.countrieNames) {
        this.countrieNames.forEach(country => {
            let iter = cityStore.append(null);
            cityStore.set(iter, [0], [country]);
            cityTreeIterMap[country] = iter;

            if (cityCountries.includes(this.countrieMap[country])) {
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
            selected.push(this.countrieMap[model.get_value(iter, 0)]);
        });

        settings.set_value('countries-selected-for-cities', new GLib.Variant('as', selected));
    });

    this.cityScroll = new Gtk.ScrolledWindow();
    this.cityScroll.set_child(cityTreeView);
    this.cityScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.cityScroll.set_min_content_height(150);

    cityPage.attach(this.cityScroll, 1, 1, 1, 1);

    const citySaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    });
    cityPage.attach(citySaveLabel, 0, 2, 2, 1);
    return {cityPage, cityTreeView, cityTreeIterMap};
}

function createServersPage() {
    const serverPage = new Gtk.Grid({
        margin_start: 18, margin_top: 10, column_spacing: 12, row_spacing: 12, visible: true
    });

    const maxServerPerCountryLabel = new Gtk.Label({
        label: `Max server per country displayed:`, halign: Gtk.Align.START, visible: true
    });
    serverPage.attach(maxServerPerCountryLabel, 0, 0, 1, 1);

    const maxServerPerCountryInput = new Gtk.SpinButton();
    maxServerPerCountryInput.set_sensitive(true);
    maxServerPerCountryInput.set_range(0, 10000);
    maxServerPerCountryInput.set_value(0);
    maxServerPerCountryInput.set_increments(1, 2);

    serverPage.attach(maxServerPerCountryInput, 1, 0, 1, 1);

    this.settings.bind(`number-servers-per-countries`, maxServerPerCountryInput, `value`, Gio.SettingsBindFlags.DEFAULT);

    const serverSelectLabel = new Gtk.Label({
        label: `Select countries to list in servers tab:`, halign: Gtk.Align.START, visible: true
    });
    serverPage.attach(serverSelectLabel, 0, 1, 1, 1);

    let serverStore = new Gtk.TreeStore();
    serverStore.set_column_types([GObject.TYPE_STRING]);

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
    if (this.countrieNames) {
        this.countrieNames.forEach(country => {
            let iter = serverStore.append(null);
            serverStore.set(iter, [0], [country]);
            serverTreeIterMap[country] = iter;

            if (serverCountries.includes(this.countrieMapWithID[country])) {
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
            selected.push(this.countrieMapWithID[model.get_value(iter, 0)]);
        });

        settings.set_value('countries-selected-for-servers', new GLib.Variant('ai', selected));
    });

    this.serverScroll = new Gtk.ScrolledWindow();
    this.serverScroll.set_child(serverTreeView);
    this.serverScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.serverScroll.set_min_content_height(150);

    serverPage.attach(this.serverScroll, 1, 1, 1, 1);

    const serverSaveLabel = new Gtk.Label({
        label: `<b>* Changes applied on close</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    });
    serverPage.attach(serverSaveLabel, 0, 2, 2, 1);
    return {serverPage, serverTreeView, serverTreeIterMap};
}

function fillPreferencesWindow(window) {
    //this.normalRender = new Adw.TextView();

    this.vpn = new Vpn();
    this.settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.gnordvpn-local');
    this.vpn.setSettingsFromNord();

    this.countryMap = this.vpn.getCountries();
    this.countryMapWithID = this.vpn.getCountries(true);
    this.countryNames = Common.safeObjectKeys(this.countryMap);

    // *** GENERAL
    const generalPage = new Adw.PreferencesPage();
    generalPage.set_title("General");
    generalPage.set_icon_name("emblem-system-symbolic");
    const generalGroup = new Adw.PreferencesGroup();
    const {generalGrid, resetAll} = createGeneralPage.call(this);
    generalGroup.add(generalGrid);
    generalPage.add(generalGroup);
    window.add(generalPage);

    // *** ACCOUNTS
    const accountsPage = new Adw.PreferencesPage();
    accountsPage.set_title("Account");
    accountsPage.set_icon_name("user-home-symbolic");
    const accountsGroup = new Adw.PreferencesGroup();
    const accountsGrid = createAccountsPage.call(this);
    accountsGroup.add(accountsGrid);
    accountsPage.add(accountsGroup);
    window.add(accountsPage);

    // *** STYLES
    const stylesPage = new Adw.PreferencesPage();
    stylesPage.set_title("Styles");
    stylesPage.set_icon_name("edit-select-all-symbolic");
    const stylesGroup = new Adw.PreferencesGroup();
    const stylesGrid = createStylesPage().call(this);
    stylesGroup.add(stylesGrid);
    stylesPage.add(stylesGroup);
    window.add(stylesPage);

    // Apply settings when prefs window is closed
    window.connect('hide', function () {
        this.vpn.applySettingsToNord();
    }.bind(this));

    // resetAll.connect('clicked', () => {
    //     resetAllSetting(this.settings, this.protoCbox, this.techCbox, cityTreeView, cityTreeIterMap, serverTreeView, serverTreeIterMap);
    // });

    // resetConnection.connect('clicked', () => {
    //     resetConnectionSetting(this.settings, this.protoCbox, this.techCbox);
    // });

    return window;
}

function buildPrefsWidgetOld() {
    this.normalRender = new Gtk.CellRendererText();

    this.vpn = new Vpn();
    this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
    this.vpn.setSettingsFromNord();

    this.countrieMap = this.vpn.getCountries();
    this.countrieMapWithID = this.vpn.getCountries(true);
    this.countrieNames = Common.safeObjectKeys(this.countrieMap);

    const notebook = new Gtk.Notebook()

    // *** GENERAL
    const {generalPage, resetAll} = createGeneralPage.call(this);
    notebook.append_page(generalPage, new Gtk.Label({
        label: `<b>General</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    }))

    // *** ACCOUNTS
    const accountPage = createAccountsPage.call(this);
    notebook.append_page(accountPage, new Gtk.Label({
        label: `<b>Account</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    }))

    // *** STYLES
    let stylePage = createStylesPage.call(this);
    notebook.append_page(stylePage, new Gtk.Label({
        label: `<b>Style</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    }))

    // *** CONNECTIONS
    const {connectionPage, resetConnection} = createConnectionsPage.call(this);
    notebook.append_page(connectionPage, new Gtk.Label({
        label: `<b>Connection</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    }))

    // *** CITIES
    let {cityPage, cityTreeView, cityTreeIterMap} = createCitiesPage.call(this);
    notebook.append_page(cityPage, new Gtk.Label({
        label: `<b>City</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    }))

    // *** SERVERS
    let {serverPage, serverTreeView, serverTreeIterMap} = createServersPage.call(this);
    notebook.append_page(serverPage, new Gtk.Label({
        label: `<b>Server</b>`, halign: Gtk.Align.START, use_markup: true, visible: true
    }))

    // Apply settings when prefs window is closed
    notebook.connect('unmap', function () {
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
