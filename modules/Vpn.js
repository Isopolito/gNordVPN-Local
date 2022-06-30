`use strict`;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

// Force version 2.x to avoid compatibility issues with certain distros that are using Soup 3.x by default
imports.gi.versions.Soup = "2.4";
const Soup = imports.gi.Soup;

const CMD_VPNSTATUS = `nordvpn status`;
const CMD_VPNACCOUNT = `nordvpn account`;
const CMD_COUNTRIES = `nordvpn countries`;
const CMD_CITIES = `nordvpn cities`;
const CMD_SETTINGS = `nordvpn s`;
const CMD_FETCH_SETTINGS = `nordvpn settings`;
const CMD_CONNECT = "nordvpn c";
const CMD_DISCONNECT = "nordvpn d";
const CMD_LOGIN = "nordvpn login";
const CMD_LOGOUT = "nordvpn logout";

var Vpn = class Vpn {
    constructor() {
        this.executeCommandSync = GLib.spawn_command_line_sync;
        this.executeCommandAsync = GLib.spawn_command_line_async;
        this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);

        this.session = Soup.Session.new();
    }

    // Remove the junk that shows up from messages in the nordvpn output
    _processCityCountryOutput = (input) => {
        const match = input.match(/(^\w+?,\s(\w+?,\s)+?(\w+?$)|^\s*?\w+?\s*?$)/gm);
        return match && match.length === 1
            ? match[0].split(',').map(c => c.trim()).sort()
            : [];
    }

    _getString = (data) => {
        return data instanceof Uint8Array
            ? imports.byteArray.toString(data)
            : data.toString();
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
        if (normalizedText === `protocol`) return `protocol`;
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

    getAccount() {
        // Read the VPN status from the command line
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_VPNACCOUNT);
        const allAccountMessages = this._getString(standardOut).split(`\n`);

        let emailAddress;
        let vpnService;
        if (allAccountMessages.length > 2 && allAccountMessages[1].includes(`Email`)) {
            emailAddress = allAccountMessages[1].replace("Email Address: ", "");
            vpnService = allAccountMessages[2].replace("VPN Service: ", "")
        }

        return {emailAddress, vpnService};
    }

    checkLogin() {
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_LOGIN);
        return this._getString(standardOut).replace(/\s+/g, ` `).includes('You are already logged in.');
    }

    getStatus() {
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_VPNSTATUS);

        const allStatusMessages = this._getString(standardOut).split(`\n`);
        let connectStatus, updateMessage, country, serverNumber, city, serverIp, currentTech, currentProtocol, transfer,
            uptime, currentServer;
        for (const msg of allStatusMessages) {
            if (msg.includes("Status:")) connectStatus = (msg.match(/Status: \w+/) || [``])[0];
            else if (msg.includes("Country:")) country = msg.replace("Country: ", "").toUpperCase();
            else if (msg.includes("City:")) city = msg.replace("City: ", "");
            else if (msg.includes("Server IP:")) serverIp = msg.replace("Server IP: ", "");
            else if (msg.includes("Current protocol:")) currentProtocol = msg.replace("Current protocol: ", "");
            else if (msg.includes("Current technology:")) currentTech = msg.replace("Current technology: ", "");
            else if (msg.includes("Transfer:")) transfer = msg.replace("Transfer: ", "");
            else if (msg.includes("Uptime:")) uptime = msg.replace("Uptime: ", "");
            else if (msg.includes("new version")) updateMessage = msg;
            else if (msg.includes("Current server:")) {
                serverNumber = msg.match(/\d+/);
                currentServer = msg.replace("Current server: ", "")
            }
        }

        return {
            connectStatus,
            updateMessage,
            country,
            city,
            serverNumber,
            currentServer,
            serverIp,
            currentTech,
            currentProtocol,
            transfer,
            uptime
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

    loginVpn() {
        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_LOGIN);

        const ref = "Continue in the browser: ";
        let url = this._getString(standardOut).replace(/\s+/g, ` `);
        url = url.substring(url.indexOf(ref) + ref.length).trim();

        Gio.app_info_launch_default_for_uri(url, null);
    }

    logoutVpn() {
        this.executeCommandAsync(CMD_LOGOUT);
    }

    getConnectionList(connectionType) {
        switch (connectionType) {
            case 'countries':
                return this.getCountries();
            case 'cities':
                return this.getCities();
            case 'servers':
                return this.getServers();
        }
        return null;
    }

    getCountries(withId = false) {
        if (withId) {
            this.message = Soup.Message.new("GET", "https://api.nordvpn.com/v1/servers/countries");
            this.session.send_message(this.message);
            let countrieNames, countrieMap;
            try {
                let data = JSON.parse(this.message.response_body_data.get_data());
                countrieMap = data.reduce((acc, v) => {
                    acc[v['name']] = v['id'];
                    return acc;
                }, {});
            } catch (e) {
                return [null, null];
            }

            return countrieMap;
        }

        const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(CMD_COUNTRIES);
        const countries = this._processCityCountryOutput(this._getString(standardOut));
        
        let processedCountries = {};
        for (let country of countries) {
            processedCountries[country.replace(/_/g, " ")] = country;
        }

        // If the list of countries from NordVpn cli is less then 5 there's most likely a problem with the connection.
        // Better to return nothing so calling code can handle appropriately rather than a list of error message words
        if (Object.keys(processedCountries).length < 5) return null;

        return processedCountries;
    }

    getCities() {
        let citiesMax = this.settings.get_value('number-cities-per-countries').unpack() - 1;
        let citiesSaved = this.settings.get_value('countries-selected-for-cities').deep_unpack();

        let processedCities = {};

        for (let i = 0; i < citiesSaved.length; i++) {
            const [ok, standardOut, standardError, exitStatus] = this.executeCommandSync(`${CMD_CITIES} ${citiesSaved[i]}`);
            const cities = this._processCityCountryOutput(this._getString(standardOut));
            
            for (let j = 0; j < cities.length; j++) {
                if (j > citiesMax) break;
                let c = (citiesSaved[i] + ", " + cities[j].replace(",", "")).replace(/_/g, " ");
                let d = cities[j].replace(",", "");
                processedCities[c] = d;
            }
        }

        return processedCities;
    }

    getServers() {
        //Using nordvpn undocumented public api since the app does not give that information
        //Usefull source: https://sleeplessbeastie.eu/2019/02/18/how-to-use-public-nordvpn-api/

        let countriesMax = this.settings.get_value('number-servers-per-countries').unpack();
        let countriesSaved = this.settings.get_value('countries-selected-for-servers').deep_unpack();

        let url = "https://api.nordvpn.com/v1/servers/recommendations?limit=" + countriesMax
        let technology = this.settings.get_string(`technology`);
        if (technology == 'NORDLYNX') {
            url += "&filters[servers_technologies][identifier]=wireguard_udp";

        } else if (technology == 'OPENVPN') {
            let obfuscate = this.settings.get_boolean(`obfuscate`);
            let protocol = this.settings.get_string(`protocol`);

            if (protocol == "UDP") {
                if (obfuscate) url += "&filters[servers_technologies][identifier]=openvpn_xor_udp";
                else url += "&filters[servers_technologies][identifier]=openvpn_udp";
            } else if (protocol == "TCP") {
                if (obfuscate) url += "&filters[servers_technologies][identifier]=openvpn_xor_tcp";
                else url += "&filters[servers_technologies][identifier]=openvpn_tcp";
            }
        }

        url += "&filters[servers_groups][identifier]=legacy_standard";

        let servers = {}
        try {
            for (let i = 0; i < countriesSaved.length; i++) {
                this.message = Soup.Message.new("GET", url + "&filters[country_id]=" + countriesSaved[i]);
                this.session.send_message(this.message);
                let data = this.message.response_body_data.get_data();
                JSON.parse(this._getString(data)).forEach(e => {
                    servers[e['name']] = e['hostname'].replace('.nordvpn.com', '');
                });
            }
        } catch (e) {
            return null;
        }

        return servers;

        //TODO maybe async      
        // this.session.send_async(this.message, null, (session,result) => {
        //     let input_stream = session.send_finish(result);

        //     let data_input_stream = Gio.DataInputStream.new(input_stream);
        //     let out = data_input_stream.read_line(null);
        // });
        // let data = this.message.response_body_data.get_data();
    }
};
