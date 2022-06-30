// noinspection ES6ConvertVarToLetConst
'use strict';
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Constants = Me.imports.modules.constants;

var StateManager = class StateManager {
    constructor() {
        this.STATE_OVERRIDE_UNSET = -1;
        this.stateOverride = undefined;
        this.stateOverrideCounter = 0;

        this.quickRefresh = false;
        this.QUICK_REFRESH_TIMEOUT = 1;

        this.STATE_OVERRIDE_DURATION = 10

        this.states = {};
        this.states[Constants.states['CONNECTED']] = {
            "stateName": Constants.states['CONNECTED'],
            "canConnect": false,     // Connect menu item enabled true/false
            "canDisconnect": true,   // Disconnect menu item enabled true/false
            "showLists": true,       // Show the reconnect list (country, city, ...)
            "refreshTimeout": 30,    // Seconds to refresh when this is the status
            "overrideId": this.STATE_OVERRIDE_UNSET,
            "clearsOverrideId": 1    // Clears a status override with this ID
        };
        this.states[Constants.states['CONNECTING']] = {
            "stateName": Constants.states['CONNECTING'],
            "canConnect": false,
            "canDisconnect": true,
            "showLists": true,
            "refreshTimeout": 1,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "overrideId": 1          // Allows an override of this state to be cleared by a state with clearsOverrideId of the same ID
        };
        this.states[Constants.states['DISCONNECTED']] = {
            "stateName": Constants.states['DISCONNECTED'],
            "canConnect": true,
            "canDisconnect": false,
            "showLists": true,
            "refreshTimeout": 10,
            "overrideId": this.STATE_OVERRIDE_UNSET,
            "clearsOverrideId": 2
        };
        this.states[Constants.states['DISCONNECTING']] = {
            "stateName": Constants.states['DISCONNECTING'],
            "canConnect": true,
            "canDisconnect": false,
            "showLists": true,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "refreshTimeout": 1,
            "overrideId": 2
        };
        this.states[Constants.states['RECONNECTING']] = {
            "stateName": Constants.states['RECONNECTING'],
            "canConnect": false,
            "canDisconnect": true,
            "showLists": true,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "overrideId": this.STATE_OVERRIDE_UNSET,
            "refreshTimeout": 2
        };
        this.states[Constants.states['RESTARTING']] = {
            "stateName": Constants.states['RESTARTING'],
            "canConnect": false,
            "canDisconnect": true,
            "showLists": true,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "overrideId": this.STATE_OVERRIDE_UNSET,
            "refreshTimeout": 10
        };
        this.states[Constants.states['ERROR']] = {
            "stateName": Constants.states['ERROR'],
            "canConnect": true,
            "canDisconnect": true,
            "showLists": true,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "overrideId": this.STATE_OVERRIDE_UNSET,
            "refreshTimeout": 5
        };
        this.states[Constants.states['LOGGED_OUT']] = {
            "stateName": Constants.states['LOGGED_OUT'],
            "canConnect": false,
            "canDisconnect": false,
            "showLists": false,
            "refreshTimeout": 10,
            "overrideId": this.STATE_OVERRIDE_UNSET,
            "clearsOverrideId": 3,
        };
        this.states[Constants.states['LOGGING_IN']] = {
            "stateName": Constants.states['LOGGING_IN'],
            "canConnect": false,
            "canDisconnect": false,
            "showLists": false,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "refreshTimeout": 1,
            "overrideId": 2,
        };
        this.states[Constants.states['LOGGING_OUT']] = {
            "stateName": Constants.states['LOGGING_OUT'],
            "canConnect": false,
            "canDisconnect": false,
            "showLists": false,
            "clearsOverrideId": this.STATE_OVERRIDE_UNSET,
            "refreshTimeout": 1,
            "overrideId": 3,
        };
    }

    setQuickRefresh(quick) {
        this.quickRefresh = quick;
    }

    refreshOverride(state, overrideKeys) {
        this.stateOverride = this.states[state];
        this.stateOverride.overrideKeys = overrideKeys;
        this.stateOverrideCounter = 0;
    }

    resolveState(status) {
        let vpnState = this.states[status.connectStatus] || this.states.ERROR;
        if (!status.loggedin) vpnState = this.states['LOGGED OUT'];

        // If a state override is active, increment it and override the state if appropriate
        if (this.stateOverride) {
            this.stateOverrideCounter += 1;

            let overrideFromKey = (this.stateOverride.overrideKeys && (
                                  (this.stateOverride.overrideKeys[0] === 'countries' && this.stateOverride.overrideKeys[1].replace(/_/g, " ") === status.country) || 
                                  (this.stateOverride.overrideKeys[0] === 'cities'    && this.stateOverride.overrideKeys[1].replace(/_/g, " ") === status.city) || 
                                  (this.stateOverride.overrideKeys[0] === 'servers'   && this.stateOverride.overrideKeys[1] === status.currentServer.replace('.nordvpn.com',''))))

            if (this.stateOverrideCounter > this.STATE_OVERRIDE_DURATION || 
              (vpnState.clearsOverrideId == this.stateOverride.overrideId) || overrideFromKey) {
                // State override expired or cleared by current state, remove it
                this.stateOverride = undefined;
                this.stateOverrideCounter = 0;

            } else { 
               // State override still active
                vpnState = this.stateOverride;
            }
        } 
        
        return {...vpnState, 'refreshTimeout': this.quickRefresh ? this.QUICK_REFRESH_TIMEOUT : vpnState['refreshTimeout'] };
    }
}

