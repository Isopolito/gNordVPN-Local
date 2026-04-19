import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import ProcCom from './ProcCom.js';
import VpnUtils from './VpnUtils.js';
import Logger from './Logger.js';

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

const _log = new Logger('Vpn');

export default class Vpn {
    constructor(settings) {
        this._settings = settings
        this._procCom = new ProcCom();
        this._vpnUtils = new VpnUtils();
        this._session = Soup.Session.new();
        this._soupVersion = Soup.get_major_version();
        this._lastConnectedAt = 0;

        if (this._soupVersion >= 3) {
            Gio._promisify(Soup.Session.prototype, 'send_and_read_async');
        } else if (this._soupVersion >= 2) {
            Gio._promisify(Soup.Session.prototype, 'send_async');
            Gio._promisify(Gio.InputStream.prototype, 'read_bytes_async');
        }
    }

    async _httpGet(url) {
        const domain = url.replace(/^https?:\/\//, '').split('/')[0];
        const t = _log.startTimer();
        try {
            const msg = Soup.Message.new(`GET`, url);
            let result;
            if (this._soupVersion < 2) {
                // Soup < 2: keep sync
                this._session.send(msg, null);
                result = JSON.parse(this._vpnUtils.getString(msg.response_body.data));
                _log.endTimer(t, 'CALL', {cmd: domain, blocking: true, success: true});
            } else if (this._soupVersion >= 2 && this._soupVersion < 3) {
                const inputStream = await this._session.send_async(msg, GLib.PRIORITY_DEFAULT, null);
                const chunks = [];
                while (true) {
                    const chunk = await inputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null);
                    if (chunk.get_size() === 0) break;
                    chunks.push(chunk);
                }
                result = JSON.parse(new TextDecoder('utf-8').decode(this._concatBytes(chunks)));
                _log.endTimer(t, 'CALL', {cmd: domain, blocking: false, success: true});
            } else {
                const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
                if (msg.get_status() === Soup.Status.OK) {
                    result = JSON.parse(new TextDecoder('utf-8').decode(bytes.get_data()));
                    _log.endTimer(t, 'CALL', {cmd: domain, blocking: false, success: true});
                } else {
                    _log.endTimer(t, 'CALL', {cmd: domain, blocking: false, success: false});
                    log(`gNordVpn: error (${msg.get_reason_phrase()}) calling URL ${url}`);
                    return null;
                }
            }
            return result;
        } catch (e) {
            _log.endTimer(t, 'CALL', {cmd: domain, blocking: false, success: false});
            throw e;
        }
    }

    _concatBytes(chunks) {
        const totalLen = chunks.reduce((acc, c) => acc + c.get_size(), 0);
        const buf = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            buf.set(chunk.get_data(), offset);
            offset += chunk.get_size();
        }
        return buf;
    }

    _execSyncIfVpnOn(command) {
        if (!this.isNordVpnRunning()) return ``;

        const [ok, standardOut, standardError, exitStatus] = this._procCom.execCommunicateSync(command);
        return this._vpnUtils.getString(standardOut);
    }

    async _execAsyncIfRunning(command, running) {
        if (!running) return ``;
        return this._procCom.execCommunicateAsync(command);
    }

    isNordVpnRunning() {
        try {
            const [ok, standardOut, standardError, exitStatus] = this._procCom.execCommunicateSync(CMD_VPNSTATUS);
            const running = exitStatus === 0;
            _log.debug('isNordVpnRunning', {running});
            return running;
        } catch {
            _log.debug('isNordVpnRunning', {running: false, error: true});
            return false;
        }
    }

    async setSettingsFromNord() {
        // Use async status check to determine if nordvpnd is running — avoids blocking sync call.
        let running = false;
        try {
            await this._procCom.execCommunicateAsync(CMD_VPNSTATUS);
            running = true;
        } catch { /* nordvpnd not running */ }
        const standardOut = await this._execAsyncIfRunning(CMD_FETCH_SETTINGS, running);
        if (!standardOut) return;
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

        const t = _log.startTimer();
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
        _log.endTimer(t, 'SPAN', {operation: 'applySettingsToNord', subCalls: 11});
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

    async checkLogin() {
        try {
            await this._procCom.execCommunicateAsync(CMD_VPNACCOUNT);
            _log.debug('checkLogin', {loggedIn: true});
            return true;
        } catch (e) {
            // execCommunicateAsync throws new Error(stderr) when nordvpn exits non-zero
            // (not logged in). GIO spawn failures throw a GLib.Error with a numeric .code
            // property — re-throw those so callers can surface real infrastructure errors.
            if (e instanceof Error && e.code === undefined) {
                _log.debug('checkLogin', {loggedIn: false});
                return false;
            }
            throw e;
        }
    }

    async getStatus() {
        const t = _log.startTimer();
        let connectStatus, updateMessage, country, serverNumber, city, serverIp,
            currentTech, currentProtocol, transfer, uptime, currentServer;
        let running = false;

        try {
            const standardOut = await this._procCom.execCommunicateAsync(CMD_VPNSTATUS);
            // A successful (exit 0) response means nordvpnd is running.
            running = true;
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
        } catch (e) {
            // A plain Error with a string message means nordvpn ran but exited non-zero
            // (i.e. nordvpnd is not running). Any other error type (e.g. Gio.IOError from
            // a spawn failure) means something is genuinely broken — re-throw so _refresh()
            // can engage its exponential backoff instead of hammering a failing subprocess.
            if (!(e instanceof Error)) throw e;
            _log.warn('getStatus: nordvpnd not running or exited non-zero', {error: String(e)});
        }

        const resolved = connectStatus || 'N/A';
        _log.endTimer(t, 'SPAN', {operation: 'getStatus', connectStatus: resolved, running});

        return {
            running,
            connectStatus: resolved,
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

    async getConnectionList(connectionType, running = true) {
        switch (connectionType) {
            case 'countries': return this.getCountries(false, running);
            case 'cities':    return this.getCities(running);
            case 'servers':   return this.getServers(running);
        }
        return null;
    }

    async getCountries(withId = false, running = true) {
        if (withId) {
            let countriesMap;
            try {
                let data = await this._httpGet(`https://api.nordvpn.com/v1/servers/countries`);
                if (!data) return null;
                countriesMap = data.reduce((acc, v) => {
                    acc[v['name']] = v['id'];
                    return acc;
                }, {});
            } catch (e) {
                return null;
            }

            return countriesMap;
        }

        const standardOut = await this._execAsyncIfRunning(CMD_COUNTRIES, running);
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

    async getCities(running = true) {
        let citiesMax = this._settings.get_value('number-cities-per-countries').unpack() - 1;
        let citiesSaved = this._settings.get_value('countries-selected-for-cities').deep_unpack();

        let processedCities = {};

        for (let i = 0; i < citiesSaved.length; i++) {
            const standardOut = await this._execAsyncIfRunning(`${CMD_CITIES} ${citiesSaved[i]}`, running);
            const cities = this._vpnUtils.processCityCountryOutput(standardOut);

            for (let j = 0; j < cities.length; j++) {
                if (j > citiesMax) break;
                let c = (citiesSaved[i] + `, ` + cities[j].replace(`,`, ``)).replace(/_/g, ` `);
                let d = cities[j].replace(`,`, ``);
                processedCities[c] = d;
            }
        }

        return processedCities;
    }

    async getServers(running = true) {
        // getServers only uses the HTTP API — it works regardless of daemon state.
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
                let data = await this._httpGet(url + `&filters[country_id]=` + countriesSaved[i]);
                if (data) {
                    data.forEach(e => {
                        servers[e['name']] = e['hostname'].replace('.nordvpn.com', '');
                    });
                }
            }
        } catch (e) {
            log(e, `gNordVpn: error getting servers`);
            return null;
        }

        return servers;
    }
}
