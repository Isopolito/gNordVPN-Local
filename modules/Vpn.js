`use strict`;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

const CMD_VPNSTATUS = `nordvpn status`;
const CMD_COUNTRIES = `nordvpn countries`;
const CMD_CITIES = `nordvpn cities`;
const CMD_SETTINGS = `nordvpn s`;
const CMD_FETCH_SETTINGS = `nordvpn settings`;
const CMD_CONNECT = "nordvpn c";
const CMD_DISCONNECT = "nordvpn d";

var Vpn = class Vpn {
    constructor() {
        this.executeCommandSync = GLib.spawn_command_line_sync;
        this.executeCommandAsync = GLib.spawn_command_line_async;
        this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);
    }
    
    _stringStartsWithCapitalLetter = country => country && country.charCodeAt(0) >= 65 && country.charCodeAt(0) <= 90;
    
    _getString = (data) => {
        if (data instanceof Uint8Array) {
            return imports.byteArray.toString(data);
        } else {
            return data.toString();
        }
    }

    _resolveSettingsValue(text) {
        if (!text) return;
        const normalizedText = text.trim();

        if (normalizedText === `enabled`) return true;
        if (normalizedText === `disabled`) return false;

        return normalizedText;
    }

    _resolveSettingsKey(text) {
        if (!text) return;
        const normalizedText = text.trim().toLowerCase()

        if (normalizedText === `firewall`) return `firewall`;
        if (normalizedText.includes(`tech`)) return `technology`;
        if (normalizedText === `protocol`)return `protocol`;
        if (normalizedText === `kill switch`) return `killswitch`;
        if (normalizedText === `cybersec`) return `cybersec`;
        if (normalizedText === `obfuscate`) return `obfuscate`;
        if (normalizedText === `notify`) return `notify`;
        if (normalizedText === `auto-connect`) return `autoconnect`;
        
        // Currently these settings are not supported in this extension
        //if (normalizedText === `ipv6`) return `ipv6`;
        //if (normalizedText === `dns`) return `dns`;
        
        return null;
    }
    
    setSettingsFromNord() {
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_FETCH_SETTINGS);
        const normalizedOut = this._getString(standardOut);

        for (const line of normalizedOut.split(`\n`)) {
            let parts = line.split(`:`);
            const settingName = this._resolveSettingsKey(parts[0]);
            const settingValue = this._resolveSettingsValue(parts[1]);
            if (!settingName || settingValue === undefined) continue;

            if (settingName === `protocol` || settingName === 'technology') {
                this.settings.set_string(settingName, settingValue);
            } else {
                this.settings.set_boolean(settingName, settingValue);
            }
        }
    }

    applySettingsToNord() {
        this.executeCommandSync(`${CMD_SETTINGS} firewall ${this.settings.get_boolean(`firewall`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} autoconnect ${this.settings.get_boolean(`autoconnect`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} cybersec ${this.settings.get_boolean(`cybersec`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} killswitch ${this.settings.get_boolean(`killswitch`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} obfuscate ${this.settings.get_boolean(`obfuscate`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} ipv6 ${this.settings.get_boolean(`ipv6`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} notify ${this.settings.get_boolean(`notify`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} protocol ${this.settings.get_string(`protocol`)}`);
        this.executeCommandSync(`${CMD_SETTINGS} technology ${this.settings.get_string(`technology`)}`);
        
        // TODO: Why is this 2nd call to firewall needed to make things work?
        this.executeCommandSync(`${CMD_SETTINGS} firewall ${this.settings.get_boolean(`firewall`)}`);
    }
    
   setToDefaults() {
        this.executeCommandAsync(`${CMD_SETTINGS} defaults`);
    }
    
    getStatus() {
        // Read the VPN status from the command line
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_VPNSTATUS);

        // Convert Uint8Array object to string and split up the different messages
        const allStatusMessages = this._getString(standardOut).split(`\n`);

        // Grab the message for an available update
        const updateMessage = allStatusMessages[0].includes(`new version`)
            ? allStatusMessages.shift(1)
            : null;

        // Determine the correct state from the "Status: xxxx" line
        // TODO: use results from vpn command to give details of error
        let connectStatus = (allStatusMessages[0].match(/Status: \w+/) || [``])[0]

        return {
            connectStatus,
            'currentServer': allStatusMessages.length > 1 && allStatusMessages[1].replace("Current server: ", ""),
            'country': allStatusMessages.length > 2 && allStatusMessages[2].replace("Country: ", ""),
            'city': allStatusMessages.length > 3 && allStatusMessages[3].replace("City: ", ""),
            'serverIP': allStatusMessages.length > 4 && allStatusMessages[4].replace("Server IP: ", ""),
            'currentTechnology': allStatusMessages.length > 5 && allStatusMessages[5].replace("Current technology: ", ""),
            'currentProtocol': allStatusMessages.length > 6 && allStatusMessages[6].replace("Current protocol: ", ""),
            'transfer': allStatusMessages.length > 7 && allStatusMessages[7].replace("Transfer: ", ""),
            'uptime': allStatusMessages.length > 8 && allStatusMessages[8].replace("Uptime: ", ""),
            'serverNumber': allStatusMessages.length > 1 && allStatusMessages[1].match(/\d+/),
            updateMessage,
        }
    }

    connectVpn(query) {
        if (query) {
            this.executeCommandAsync(`${CMD_CONNECT} ${query}`);
        } else {
            this.executeCommandAsync(CMD_CONNECT);
        }
    }

    disconnectVpn() {
        this.executeCommandAsync(CMD_DISCONNECT);
    }

    getConectionList(connectionType){
        switch(connectionType) {
          case 'countries':
            return this.getCountries();
          case 'cities':
            return this.getCities();
        } 
        return null;
    }
    getCountries() {
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_COUNTRIES);

        const countries = this._getString(standardOut)
            .replace(/A new version.*?\./g, ``)
            .replace(/\s+/g, ` `)
            .split(` `)
            .sort();

        let processedCountries = {};
        for (let i = 3; i < countries.length; i++) {
            // All countries should be capitalized in output
            if (!this._stringStartsWithCapitalLetter(countries[i])) continue;
            if (countries[i].startsWith("A new version")) continue;

            let c = countries[i].replace(",", "");
            processedCountries[c.replace(/_/g, " ")] = c;
        }

        // If the list of countries from NordVpn cli is less then 5 there's most likely a problem with the connection.
        // Better to return nothing so calling code can handle appropriately rather than a list of error message words
        if (Object.keys(processedCountries).length < 5) return null;

        return processedCountries;
    }

    getCities() {

        let citiesMax = this.settings.get_value('number-cities-per-countries').unpack();
        let citiesSaved = this.settings.get_value('countries-selected-for-cities').deep_unpack();

        let processedCities = {};

        for(let i=0; i<citiesSaved.length; i++){

            const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(`${CMD_CITIES} ${citiesSaved[i]}`);

            const cities = this._getString(standardOut)
                .replace(/A new version.*?\./g, ``)
                .replace(/\s+/g, ` `)
                .split(` `)
                .sort();

            for (let j = 3; j < cities.length; j++) {
                if(j-3>citiesMax) break;
                // All cities should be capitalized in output
                if (!this._stringStartsWithCapitalLetter(cities[j])) continue;
                if (cities[j].startsWith("A new version")) continue;

                let c = (citiesSaved[i]+", "+cities[j].replace(",", "")).replace(/_/g, " ");
                let d = cities[j].replace(",", "");
                processedCities[c] = d;
            }
        }

        return processedCities;
    }
    
};