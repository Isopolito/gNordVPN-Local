import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import GnordVpnPrefs from './modules/prefs/GnordVpnPrefs.js';

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const prefs = new GnordVpnPrefs(this.getSettings(`org.gnome.shell.extensions.gnordvpn-local`));
        return prefs.fillPreferencesWindow(window);
    }
}