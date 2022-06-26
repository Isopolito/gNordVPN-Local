`use strict`;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

const CMD_VPNSTATUS = `nordvpn status`;
const CMD_COUNTRIES = `nordvpn countries`;
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

    // TODO: use results from vpn command to give details of error
    getStatus() {
        // Read the VPN status from the command line
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_VPNSTATUS);

        // Convert Uint8Array object to string and split up the different messages
        const allStatusMessages = this._getString(standardOut).split(`\n`);
        let connectStatus, updateMessage, country, serverNumber;
        for (const msg of allStatusMessages) {
            if (msg.includes('Status:')) connectStatus = (msg.match(/Status: \w+/) || [``])[0];
            else if (msg.includes('Country:')) country = msg.replace("Country: ", "").toUpperCase();
            else if (msg.includes('Current server:')) serverNumber = msg.match(/\d+/);
            else if (msg.includes('new version')) updateMessage = msg;
        }

        return {
            updateMessage,
            connectStatus,
            country,
            serverNumber
        }
    }

    connectVpn(country) {
        if (country) {
            this.executeCommandAsync(`${CMD_CONNECT} ${country}`);
        } else {
            this.executeCommandAsync(CMD_CONNECT);
        }
    }

    disconnectVpn() {
        this.executeCommandAsync(CMD_DISCONNECT);
    }

    getCountries() {
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_COUNTRIES);

        const countries = this._getString(standardOut)
            .replace(/A new version.*?\./g, ``)
            .replace(/\s+/g, ` `)
            .split(` `)
            .sort();

        let processedCountries = [];
        for (let i = 3; i < countries.length; i++) {
            // All countries should be capitalized in output
            if (!this._stringStartsWithCapitalLetter(countries[i])) continue;
            if (countries[i].startsWith("A new version")) continue;

            processedCountries.push(countries[i].replace(",", ""));
        }

        // If the list of countries from NordVpn cli is less then 5 there's most likely a problem with the connection.
        // Better to return nothing so calling code can handle appropriately rather than a list of error message words
        if (processedCountries.length < 5) return null;
        return processedCountries;
    }
    
    getDisplayName(item) {
        return item?.replace(/_/g, " ");
    }
};