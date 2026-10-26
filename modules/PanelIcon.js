import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Constants from './constants.js';
import * as PanelText from './PanelText.js';

export default class PanelIcon {
    constructor(settings) {
        this._settings = settings;

        this.uiMap = {};
        this.commonStyle = "";
        this.updateStyle();
    }

    updateStyle() {
        let savedStyle = this._settings.get_value('panel-styles').deep_unpack();

        this.uiMap = {};
        Object.keys(savedStyle).forEach(key => {
            this.uiMap[Constants.states[key]] = savedStyle[key];
        });

        this.commonStyle = this._settings.get_string(`common-panel-style`);
    }

    // Panel text template for a state name, or undefined if the state has no style.
    getTemplate(stateName) {
        return this.uiMap[stateName]?.panelText;
    }

    update(status, uptimeSec) {
        if (!status || this._label.isDisposed) return;

        let config = this.uiMap[status.currentState.stateName];
        let msg = config.panelText
        if (status.currentState.stateName === Constants.states.CONNECTED)
            msg = PanelText.render(msg, status, {uptimeSec});

        this._label.text = msg || "Style Missing MSG";
        let style = this.commonStyle;
        style += config.css;
        this._label.set_style(style); 
    }

    button() {
        return this._button;
    }

    build() {
        this._button = new St.Bin({
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: false,
            track_hover: true
        });

        this._label = new St.Label();
        this._label.connect('destroy', () => this._label.isDisposed = true);
        this._button.set_child(this._label);
    }
}