import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import VpnIndicator from './modules/VpnIndicator.js';

export default class GnordVpnExtension extends Extension {
    _isExtensionEnabled = false;

    enable() {
        if (this._isExtensionEnabled) return;
        this._isExtensionEnabled = true;

        this._vpnIndicator = new VpnIndicator();
        this._vpnIndicator.enable();

        Main.panel.addToStatusArea(this._vpnIndicator.getName(), this._vpnIndicator, 0, this._vpnIndicator.getPanelPosition());
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