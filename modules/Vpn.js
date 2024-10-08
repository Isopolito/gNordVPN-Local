import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import ProcCom from './ProcCom.js';
import VpnUtils from './VpnUtils.js';

const CMD_VPNSTATUS = `nordvpn status`;
const CMD_VPNACCOUNT = `nordvpn account`;
const CMD_COUNTRIES = `nordvpn countries`;
const CMD_CITIES = `nordvpn cities`;
const CMD_SETTINGS = `nordvpn s`;
const CMD_FETCH_SETTINGS = `nordvpn settings`;
const CMD_AUTOCONNECT_ON = `nordvpn set autoconnect on `;
const CMD_AUTOCONNECT_OFF = `nordvpn set autoconnect off`;
const CMD_CONNECT = `nordvpn c`;
const CMD_DISCONNECT = `nordvpn d`;
const CMD_LOGIN = `nordvpn login`;
const CMD_LOGOUT = `nordvpn logout`;

export default class Vpn {
    constructor(settings) {
        this._settings = settings
        this._procCom = new ProcCom();
        this._vpnUtils = new VpnUtils();
        this._session = Soup.Session.new();
        this._soupVersion = Soup.get_major_version();
        this._lastConnectedAt = 0;
    }

    _httpGet = (url) => {
        const msg = Soup.Message.new(`GET`, url);
        if (this._soupVersion < 2) {
            this._session.send(msg, null);
            return JSON.parse(this._vpnUtils.getString(msg.response_body.data));
        } else if (this._soupVersion >= 2 && this._soupVersion < 3) {
            this._session.send_message(msg);
            return JSON.parse(this._vpnUtils.getString(msg.response_body.data));
        } else if (this._soupVersion >= 3) {
            let bytes = this._session.send_and_read(msg, null);
            if (msg.get_status() === Soup.Status.OK) {
                let decoder = new TextDecoder('utf-8');
                return JSON.parse(decoder.decode(bytes.get_data()));
            } else {
                log(`gnordvpn: error (${msg.get_reason_phrase()}) calling URL ${url}`);
                return null;
            }
        }
    }

    _execSyncIfVpnOn(command) {
        if (!this.isNordVpnRunning()) return ``;

        const [ok, standardOut, standardError, exitStatus] = this._procCom.execCommunicateSync(command);
        return this._vpnUtils.getString(standardOut);
    }

    isNordVpnRunning() {
        try {
            const [ok, standardOut, standardError, exitStatus] = this._procCom.execCommunicateSync(CMD_VPNSTATUS);
            return exitStatus === 0;
        } catch {
            return false;
        }
    }

    setSettingsFromNord() {
        const standardOut = this._execSyncIfVpnOn(CMD_FETCH_SETTINGS);
        for (const line of standardOut.split(`\n`)) {
            let parts = line.split(`:`);
            const settingName = this._vpnUtils.resolveSettingsKey(parts[0]);
            const settingValue = this._vpnUtils.resolveSettingsValue(parts[1]);
            if (!settingName || settingValue === undefined) continue;

            if (settingName === `protocol` || settingName === 'technology') {
                this._settings.set_string(settingName, settingValue);
            } else {
                this._settings.set_boolean(settingName, settingValue);
            }
        }
    }

    applySettingsToNord() {
        if (!this.isNordVpnRunning()) return;

        this._procCom.execCommunicateSync(`${CMD_SETTINGS} firewall ${this._settings.get_boolean(`firewall`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} analytics ${this._settings.get_boolean(`analytics`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} autoconnect ${this._settings.get_boolean(`autoconnect`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} cybersec ${this._settings.get_boolean(`cybersec`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} killswitch ${this._settings.get_boolean(`killswitch`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} obfuscate ${this._settings.get_boolean(`obfuscate`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} ipv6 ${this._settings.get_boolean(`ipv6`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} notify ${this._settings.get_boolean(`notify`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} protocol ${this._settings.get_string(`protocol`)}`);
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} technology ${this._settings.get_string(`technology`)}`);

        // TODO: Why is this 2nd call to firewall needed to make things work?
        this._procCom.execCommunicateSync(`${CMD_SETTINGS} firewall ${this._settings.get_boolean(`firewall`)}`);
    }

    async setToDefaults() {
        return this._execAsync(`${CMD_SETTINGS} defaults`);
    }

    getAccount() {
        const standardOut = this._execSyncIfVpnOn(CMD_VPNACCOUNT);
        const allAccountMessages = standardOut.split(`\n`);

        let emailAddress;
        let vpnService;
        if (allAccountMessages.length > 2 && allAccountMessages[1].includes(`Email`)) {
            emailAddress = allAccountMessages[1].replace(`Email Address: `, ``);
            vpnService = allAccountMessages[2].replace(`VPN Service: `, ``)
        }

        return {emailAddress, vpnService};
    }

    checkLogin() {
        const [ok, standardOut, err, exitStatus] = this._procCom.execCommunicateSync(CMD_LOGIN);
        return this._vpnUtils.getString(standardOut)
            .replace(/\s+/g, ` `)
            .includes('You are already logged in.');
    }

    async getStatus() {
        let connectStatus, updateMessage, country, serverNumber, city, serverIp,
            currentTech, currentProtocol, transfer, uptime, currentServer;

        const standardOut = await this._procCom.execCommunicateAsync(CMD_VPNSTATUS);
        if (standardOut) {
            const allStatusMessages = standardOut.split(`\n`);

            // NOTE that some of these message formats change across versions, old message formats are left in for backwards compatibility
            for (const msg of allStatusMessages) {
                if (msg.includes(`Status:`)) connectStatus = (msg.match(/Status: \w+/) || [``])[0];
                else if (msg.includes(`Country:`)) country = msg.replace(`Country: `, ``).toUpperCase();
                else if (msg.includes(`City:`)) city = msg.replace(`City: `, ``);
                else if (msg.includes(`Server IP:`)) serverIp = msg.replace(`Server IP: `, ``);
                else if (msg.includes(`IP:`)) serverIp = msg.replace(`IP: `, ``);
                else if (msg.includes(`Current protocol:`)) currentProtocol = msg.replace(`Current protocol: `, ``);
                else if (msg.includes(`Current technology:`)) currentTech = msg.replace(`Current technology: `, ``);
                else if (msg.includes(`Transfer:`)) transfer = msg.replace(`Transfer: `, ``);
                else if (msg.includes(`Uptime:`)) uptime = msg.replace(`Uptime: `, ``);
                else if (msg.includes(`new version`)) updateMessage = msg;
                else if (msg.includes(`Current server:`)) {
                    serverNumber = msg.match(/\d+/);
                    currentServer = msg.replace(`Current server: `, ``)
                } else if (msg.includes(`Hostname:`)) {
                    serverNumber = msg.match(/\d+/);
                    currentServer = msg.replace(`Hostname: `, ``)
                }
            }
        }

        return {
            connectStatus: connectStatus || 'N/A',
            updateMessage,
            country: country || 'N/A',
            city: city || 'N/A',
            serverNumber: serverNumber || 'N/A',
            currentServer: currentServer || 'N/A',
            serverIp: serverIp || 'N/A',
            currentTech: currentTech || 'N/A',
            currentProtocol: currentProtocol || 'N/A',
            transfer: transfer || 'N/A',
            uptime: uptime || 'N/A'
        }
    }

    connectVpn(query) {
        // Throttle connection attempts to prevent freezes
        if ((Date.now() - this._lastConnectedAt) < 9000) return;
        this._lastConnectedAt = Date.now();

        if (query) {
            this._procCom.execCommunicateSync(CMD_AUTOCONNECT_OFF);
            this._procCom.execCommunicateSync(`${CMD_AUTOCONNECT_ON} ${query}`);
            return this._procCom.execCommunicateAsync(`${CMD_CONNECT} ${query}`);
        } else {
            return this._procCom.execCommunicateAsync(CMD_CONNECT);
        }
    }

    disconnectVpn() {
        return this._procCom.execCommunicateAsync(CMD_DISCONNECT);
    }

    loginVpn() {
        const standardOut = this._execSyncIfVpnOn(CMD_LOGIN);

        const ref = `Continue in the browser: `;
        let url = standardOut.replace(/\s+/g, ` `);
        url = url.substring(url.indexOf(ref) + ref.length).trim();

        Gio.app_info_launch_default_for_uri(url, null);
    }

    logoutVpn() {
        return this._execAsync(CMD_LOGOUT);
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
            let countriesMap;
            try {
                let data = this._httpGet(`https://api.nordvpn.com/v1/servers/countries`);
                countriesMap = data.reduce((acc, v) => {
                    acc[v['name']] = v['id'];
                    return acc;
                }, {});
            } catch (e) {
                return [null, null];
            }

            return countriesMap;
        }

        const standardOut = this._execSyncIfVpnOn(CMD_COUNTRIES);
        const countries = this._vpnUtils.processCityCountryOutput(standardOut);

        let processedCountries = {};
        for (let country of countries) {
            processedCountries[country.replace(/_/g, ` `)] = country;
        }

        // If the list of countries from NordVpn cli is less then 5 there's most likely a problem with the connection.
        // Better to return nothing so calling code can handle appropriately rather than a list of error message words
        if (Object.keys(processedCountries).length < 5) return null;
        return processedCountries;
    }

    getCities() {
        let citiesMax = this._settings.get_value('number-cities-per-countries').unpack() - 1;
        let citiesSaved = this._settings.get_value('countries-selected-for-cities').deep_unpack();

        let processedCities = {};

        for (let i = 0; i < citiesSaved.length; i++) {
            const [ok, standardOut, standardError, exitStatus] = this._procCom.execCommunicateSync(`${CMD_CITIES} ${citiesSaved[i]}`);
            const cities = this._vpnUtils.processCityCountryOutput(this._vpnUtils.getString(standardOut));

            for (let j = 0; j < cities.length; j++) {
                if (j > citiesMax) break;
                let c = (citiesSaved[i] + `, ` + cities[j].replace(`,`, ``)).replace(/_/g, ` `);
                let d = cities[j].replace(`,`, ``);
                processedCities[c] = d;
            }
        }

        return processedCities;
    }

    getServers() {
        // Using nordvpn undocumented public api since the app does not give that information
        // Useful source: https://sleeplessbeastie.eu/2019/02/18/how-to-use-public-nordvpn-api/
        let countriesMax = this._settings.get_value('number-servers-per-countries').unpack();
        let countriesSaved = this._settings.get_value('countries-selected-for-servers').deep_unpack();

        let url = `https://api.nordvpn.com/v1/servers/recommendations?limit=` + countriesMax
        let technology = this._settings.get_string(`technology`);
        if (technology === 'NORDLYNX') {
            url += `&filters[servers_technologies][identifier]=wireguard_udp`;

        } else if (technology === 'OPENVPN') {
            let obfuscate = this._settings.get_boolean(`obfuscate`);
            let protocol = this._settings.get_string(`protocol`);

            if (protocol === `UDP`) {
                if (obfuscate) url += `&filters[servers_technologies][identifier]=openvpn_xor_udp`;
                else url += `&filters[servers_technologies][identifier]=openvpn_udp`;
            } else if (protocol === `TCP`) {
                if (obfuscate) url += `&filters[servers_technologies][identifier]=openvpn_xor_tcp`;
                else url += `&filters[servers_technologies][identifier]=openvpn_tcp`;
            }
        }

        url += `&filters[servers_groups][identifier]=legacy_standard`;

        let servers = {}
        try {
            for (let i = 0; i < countriesSaved.length; i++) {
                let data = this._httpGet(url + `&filters[country_id]=` + countriesSaved[i]);
                data.forEach(e => {
                    servers[e['name']] = e['hostname'].replace('.nordvpn.com', '');
                });
            }
        } catch (e) {
            log(e, `gnordvpn: error getting servers`);
            return null;
        }

        return servers;

        // TODO: For future version still need to proof out making http calls async
        // this.session.send_async(this.message, null, (session,result) => {
        //     let input_stream = session.send_finish(result);

        //     let data_input_stream = Gio.DataInputStream.new(input_stream);
        //     let out = data_input_stream.read_line(null);
        // });
        // let data = this.message.response_body_data.get_data();
    }
}