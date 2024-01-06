import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import * as Common from '../common.js';
import * as Constants from '../constants.js';

export default class StylesManager {
    constructor(settings) {
        this._settings = settings;
    }

    createStylesPage() {
        let {
            stylePage,
            monoToggle,
            altToggle,
            styleSmall,
            styleMedium,
            styleLarge,
            styleExtraLarge
        } = this._createStylesBuildSection();

        let {row, styleItems, commonCss} = this._createStyleEditSection(stylePage);
        this._connectStylesButtons(styleExtraLarge, monoToggle, altToggle, commonCss, styleItems, styleLarge, styleMedium, styleSmall);

        return stylePage;
    }

    _connectStylesButtons(styleExtraLarge, monoToggle, altToggle, commonCss, styleItems, styleLarge, styleMedium, styleSmall) {
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

            this._settings.set_boolean(`extra-large-button`, true);
            this._loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
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

            this._settings.set_boolean(`extra-large-button`, false);
            this._loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
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

            this._settings.set_boolean(`extra-large-button`, false);
            this._loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
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

            this._settings.set_boolean(`extra-large-button`, false);
            this._loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems);
        });

        styleItems.forEach(item => {
            item.format.connect(`changed`, () => {
                this._saveStyle(styleItems);
            });
            item.css.connect(`changed`, () => {
                this._saveStyle(styleItems);
            });
        });
    }

    _createStylesBuildSection() {
        const stylePage = new Gtk.Grid({
            margin_start: 18,
            margin_top: 10,
            column_spacing: 12,
            row_spacing: 12,
            visible: true
        });

        const monoLabel = new Gtk.Label({label: `Build as monochrome:`, halign: Gtk.Align.START, visible: true});
        stylePage.attach(monoLabel, 0, 0, 1, 1);

        const monoToggle = new Gtk.Switch({active: false, halign: Gtk.Align.START, visible: true});
        stylePage.attach(monoToggle, 1, 0, 1, 1);

        const altLabel = new Gtk.Label({label: `Build with alt style:`, halign: Gtk.Align.START, visible: true});
        stylePage.attach(altLabel, 0, 1, 1, 1);

        const altToggle = new Gtk.Switch({active: false, halign: Gtk.Align.START, visible: true});
        stylePage.attach(altToggle, 1, 1, 1, 1);

        const loadDefault = new Gtk.Label({
            label: '<b>Build default: </b>',
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true
        });

        stylePage.attach(loadDefault, 0, 2, 1, 1);

        const styleSmall = new Gtk.Button({label: `Small default`, visible: true});
        stylePage.attach(styleSmall, 1, 2, 1, 1);

        const styleMedium = new Gtk.Button({label: `Medium default`, visible: true});
        stylePage.attach(styleMedium, 2, 2, 1, 1);

        const styleLarge = new Gtk.Button({label: `Large default`, visible: true});
        stylePage.attach(styleLarge, 3, 2, 1, 1);

        const styleExtraLarge = new Gtk.Button({label: `Extra Large default`, visible: true});
        styleExtraLarge.set_tooltip_text('Extra Large will cause the panel to refresh every 1 second');
        stylePage.attach(styleExtraLarge, 4, 2, 1, 1);

        return {stylePage, monoToggle, altToggle, styleSmall, styleMedium, styleLarge, styleExtraLarge};
    }

    _createStyleEditSection(stylePage) {
        const customStyle = new Gtk.Label({
            label: '<b>Edit style</b>',
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true
        });
        stylePage.attach(customStyle, 0, 3, 1, 1);

        const displayMsg = new Gtk.Label({
            label: '<b>Display Msg</b>',
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true
        });
        stylePage.attach(displayMsg, 1, 4, 1, 1);

        const textColor = new Gtk.Label({
            label: '<b>CSS Style</b>',
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true
        });
        stylePage.attach(textColor, 2, 4, 1, 1);

        let row = 5;
        let styleItems = [];
        Common.safeObjectKeys(Constants.states).forEach(state => {
            const label = new Gtk.Label({
                label: state,
                halign: Gtk.Align.START,
                visible: true
            });
            stylePage.attach(label, 0, row, 1, 1);

            const format = new Gtk.Entry();
            stylePage.attach(format, 1, row, 1, 1);

            const css = new Gtk.Entry();
            stylePage.attach(css, 2, row++, 3, 1);

            styleItems.push({state, format, css});
        });

        const commonCsslabel = new Gtk.Label({
            label: "Common CSS",
            halign: Gtk.Align.START,
            visible: true
        });
        stylePage.attach(commonCsslabel, 0, row, 1, 1);

        const commonCss = new Gtk.Entry();
        let cps = this._settings.get_string(`common-panel-style`);
        commonCss.get_buffer().set_text(cps, cps.length);
        commonCss.connect(`changed`, () => {
            let gv = new GLib.Variant("s", commonCss.get_buffer().get_text());
            this._settings.set_value(`common-panel-style`, gv);
        });

        stylePage.attach(commonCss, 1, row++, 4, 1);

        let savedStyle = this._settings.get_value('panel-styles').deep_unpack();
        this._loadStyle(savedStyle, styleItems);

        const connectedKeyLabel = new Gtk.Label({
            label: `<b>* Available keys for CONNECTED:</b> {country},{COUNTRY},{ctry},{city},{CITY},{number},{server},{ip},{tech},{protocol},\n{transfer},{transferUp},{transferDown},{uptime},{uptimeHr},{uptimeMin},{uptimeSec}`,
            halign: Gtk.Align.START,
            use_markup: true,
            visible: true,
        });
        connectedKeyLabel.set_selectable(true);
        stylePage.attach(connectedKeyLabel, 0, row++, 5, 1);

        return {row, styleItems, commonCss};
    }

    _saveStyle(styleItems) {

        let data = {};
        styleItems.every(item => {
            data[item.state] = {};
            data[item.state].panelText = item.format.get_buffer().get_text();
            data[item.state].css = item.css.get_buffer().get_text();

            return true;
        });

        this._settings.set_value('panel-styles', new GLib.Variant('a{sa{ss}}', data));
    }

    _loadStyle(data, styleItems) {
        styleItems.forEach(item => {
            let panelText = data[item.state].panelText;
            item.format.get_buffer().set_text(panelText, panelText.length);

            let css = data[item.state].css;
            item.css.get_buffer().set_text(css, css.length);
        })
    }

    _loadGeneratedStyle(panelTexts, monoToggle, altToggle, commonCss, styleItems) {
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

        this._loadStyle(style, styleItems);
    }
};