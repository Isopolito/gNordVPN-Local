`use strict`;

const CMD_VPNSTATUS = `nordvpn status`;
const CMD_COUNTRIES = `nordvpn countries`;
const CMD_CONNECT = "nordvpn c";
const CMD_DISCONNECT = "nordvpn d";

var Vpn = class Vpn {
    constructor(executorFuncSync, executorFuncAsync) {
        this._executorFuncSync = executorFuncSync;
        this._executorFuncAsync = executorFuncAsync;
        
        if (typeof this._executorFuncSync !== `function` || typeof this._executorFuncAsync !== 'function') {
            throw `parameters executorFuncSync and executorFuncAsync must be a function for running commands against the OS`;
        }
    }
    
    getStatus() {
        // Read the VPN status from the command line
        const [ok, standardOut, standardError, exitStatus] = this._executorFuncSync(CMD_VPNSTATUS);

        // Convert Uint8Array object to string and split up the different messages
        const allStatusMessages = standardOut.toString().split(`\n`);
        
        // Grab the message for an available update
        const updateMessage = allStatusMessages[0].includes('new version')
            ? allStatusMessages.shift(1)
            : null;

        // Determine the correct state from the "Status: xxxx" line
        // TODO: use results from vpn command to give details of error
        let connectStatus = (allStatusMessages[0].match(/Status: \w+/) || [''])[0]
        
        return {
            updateMessage,
            connectStatus,
            country: allStatusMessages[2].replace("Country: ", "").toUpperCase(),
            serverNumber: allStatusMessages[1].match(/\d+/),
        }
    }
    
    connectVpn(country) {
        if (country) {
            this._executorFuncAsync(`${CMD_CONNECT} ${country}`);
        } else {
            this._executorFuncAsync(CMD_CONNECT);
        }
    }
    
    disconnectVpn() {
        this._executorFuncAsync(CMD_DISCONNECT);
    }
    
    getCountries() {
        const [ok, standardOut, standardError, exitStatus] = this._executorFuncSync(CMD_COUNTRIES);
        const countries = standardOut.toString().replace(/\s+/g, ` `).split(` `);
        countries.sort();
        
        return countries;
    }
};