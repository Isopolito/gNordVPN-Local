'use strict';

var ResetManager = class ResetManager {
    resetAllSettings(settings, protoCbox, techCbox, cityTreeView, cityTreeIterMap, serverTreeView, serverTreeIterMap) {
        this._resetGeneralSetting(settings);
        this._resetAccountSetting(settings);
        this.resetConnectionSettings(settings, protoCbox, techCbox);
        this._resetCitySetting(settings, cityTreeView, cityTreeIterMap);
        this.resetServerSetting(settings, serverTreeView, serverTreeIterMap);
    }
    resetConnectionSettings(settings, protoCbox, techCbox) {
        this._resetSetting(settings, ['cybersec', 'firewall', 'killswitch', 'obfuscate', 'notify', 'ipv6', 'protocol', 'technology']);

        let protocol = settings.get_string(`protocol`);
        protoCbox.set_active(protocol === 'UDP' ? 0 : 1);

        let tech = settings.get_string(`technology`);
        techCbox.set_active(tech === 'OPENVPN' ? 0 : 1);
    }

    _resetGeneralSetting(settings) {
        this._resetSetting(settings, ['autoconnect', 'commonfavorite']);
    }

    _resetAccountSetting(settings) {
        this._resetSetting(settings, ['showlogin', 'showlogout']);
    }

    _resetCitySetting(settings, cityTreeView, cityTreeIterMap) {
        this._resetSetting(settings, ['number-cities-per-countries', 'countries-selected-for-cities']);

        let cityCountries = this.settings.get_value('countries-selected-for-cities').deep_unpack();

        cityTreeView.get_selection().unselect_all();
        cityCountries.forEach(country => {
            cityTreeView.get_selection().select_iter(cityTreeIterMap[country.replace(/_/g, " ")]);
        })
    }

    resetServerSetting(settings, serverTreeView, serverTreeIterMap) {
        this._resetSetting(settings, ['number-servers-per-countries', 'countries-selected-for-servers']);

        let serverCountries = this.settings.get_value('countries-selected-for-servers').deep_unpack();

        serverTreeView.get_selection().unselect_all();
        serverCountries.forEach(server => {
            serverTreeView.get_selection().select_iter(serverTreeIterMap[server.replace(/_/g, " ")]);
        })
    }

    _resetSetting(settings, keys) {
        keys.forEach(key => {
            settings.set_value(key, settings.get_default_value(key));
        })
    }
}
