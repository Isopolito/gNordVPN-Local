const St = imports.gi.St;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Constants = Me.imports.modules.constants;

var PanelIcon = class PanelIcon {
    constructor() {
        this.settings = ExtensionUtils.getSettings(`org.gnome.shell.extensions.gnordvpn-local`);

        this.uiMap = {};
        this.commonStyle = "";
        this.updateStyle();
    }

    updateStyle() {
        let savedStyle = this.settings.get_value('panel-styles').deep_unpack();

        this.uiMap = {};
        Object.keys(savedStyle).forEach(key => {
            this.uiMap[Constants.states[key]] = savedStyle[key];
        });

        this.commonStyle = this.settings.get_string(`common-panel-style`);
    }

    update(status) {
        let config = this.uiMap[status.currentState.stateName];

        let msg = config.panelText
        if (status.currentState.stateName == 'Status: Connected')
            msg = msg.replaceAll('{country}',      status.country)
                     .replaceAll('{COUNTRY}',      status.country.toUpperCase())
                     .replaceAll('{ctry}',         status.currentServer.replace(/(\d|.nordvpn.com)/g, '').toUpperCase())
                     .replaceAll('{city}',         status.city)
                     .replaceAll('{CITY}',         status.city.toUpperCase())
                     .replaceAll('{number}',       status.serverNumber)
                     .replaceAll('{server}',       status.currentServer)
                     .replaceAll('{ip}',           status.serverIP)
                     .replaceAll('{tech}',         status.currentTechnology)
                     .replaceAll('{protocol}',     status.currentProtocol)
                     .replaceAll('{transfer}',     status.transfer)
                     .replaceAll('{transferUp}',   (status.transfer?.match(/\d+.\d+ [a-zA-z]+ sent/g)     || ['0 B'])[0]?.replace(' sent', '') )
                     .replaceAll('{transferDown}', (status.transfer?.match(/\d+.\d+ [a-zA-z]+ received/g) || ['0 B'])[0]?.replace(' received', '') )
                     .replaceAll('{uptime}',       status.uptime)
                     .replaceAll('{uptimeHr}',     (status.uptime?.match(/\d+ hours/g)   || ['00'])[0]?.replace(' hours',   '')?.padStart(2, '0') )
                     .replaceAll('{uptimeMin}',    (status.uptime?.match(/\d+ minutes/g) || ['00'])[0]?.replace(' minutes', '')?.padStart(2, '0') )
                     .replaceAll('{uptimeSec}',    (status.uptime?.match(/\d+ seconds/g) || ['00'])[0]?.replace(' seconds', '')?.padStart(2, '0') );

        this._label.text = msg || "Style Missing MSG";
        let style = this.commonStyle;
        style += config.css;
        this._label.set_style(style); 
    }

    button() {
        return this._button;
    }

    build() {
        this._button = new St.Bin({
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: false,
            track_hover: true
        });

        this._label = new St.Label();
        this._button.set_child(this._label);
    }
}