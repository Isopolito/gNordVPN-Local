import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import VpnIndicator from './modules/VpnIndicator.js';

export default class GnordVpnExtension extends Extension {
    constructor() {
        super();
        this._isExtensionEnabled = false;
    }
    enable() {
        if (this._isExtensionEnabled) return;
        this._isExtensionEnabled = true;

        this._vpnIndicator = new VpnIndicator();
        this._vpnIndicator.enable();

        Main.panel.addToStatusArea(indicatorName, this._vpnIndicator, 0, this._vpnIndicator._settings.get_string(`panel-position`));
    }

    disable() {
        if (this._vpnIndicator) {
            this._vpnIndicator.disable();
            this._vpnIndicator.destroy();
            this._vpnIndicator = null;
        }

        this._isExtensionEnabled = false;
    }
}