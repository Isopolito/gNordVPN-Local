// noinspection ES6ConvertVarToLetConst

'use strict';

const STATE_OVERRIDE_UNSET = -1;
var stateOverride = undefined;
var stateOverrideCounter = 0;

var STATE_OVERRIDE_DURATION = 10

var refreshOverride = function(state) {
    stateOverride = states[state];
    stateOverrideCounter = 0;
}

var resolveState = function(status) {
    let vpnState = states[status.connectStatus] || states.ERROR;

    // If a state override is active, increment it and override the state if appropriate
    if (stateOverride) {
        stateOverrideCounter += 1;
        if (stateOverrideCounter <= STATE_OVERRIDE_DURATION && (vpnState.clearsOverrideId != stateOverride.overrideId)) {
            // State override still active
            vpnState = stateOverride;
        } else {
            // State override expired or cleared by current state, remove it
            stateOverride = undefined;
            stateOverrideCounter = 0;
        }
    } 
    
    return vpnState;
}

var states = {
    "Status: Connected": {
        "panelShowServer": true, // Indicates the panel text is built up with the country and ID of the VPN server
        "styleClass": "green",   // CSS class for panel button
        "canConnect": false,     // Connect menu item enabled true/false
        "canDisconnect": true,   // Disconnect menu item enabled true/false
        "refreshTimeout": 30,    // Seconds to refresh when this is the status
        "overrideId": STATE_OVERRIDE_UNSET,
        "clearsOverrideId": 1    // Clears a status override with this ID
    },
    "Status: Connecting": {
        "panelText": "CONNECTING...", // Static panel button text
        "styleClass": "amber",
        "canConnect": false,
        "canDisconnect": true,
        "refreshTimeout": 1,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": 1               // Allows an override of this state to be cleared by a state with clearsOverrideId of the same ID
    },
    "Status: Disconnected": {
        "panelText": "UNPROTECTED",
        "styleClass": "red",
        "canConnect": true,
        "canDisconnect": false,
        "refreshTimeout": 10,
        "overrideId": STATE_OVERRIDE_UNSET,
        "clearsOverrideId": 2
    },
    "Status: Disconnecting": {
        "panelText": "DISCONNECTING...",
        "styleClass": "amber",
        "canConnect": true,
        "canDisconnect": false,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout": 1,
        "overrideId": 2
    },
    "Status: Reconnecting": {
        "panelText": "RECONNECTING...",
        "styleClass": "amber",
        "canConnect": false, "canDisconnect": true,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout": 2
    },
    "Status: Restarting": {
        "panelText": "RESTARTING...",
        "styleClass": "amber",
        "canConnect": false,
        "canDisconnect": true,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout": 10
    },
    "ERROR": {
        "panelText": "ERROR",
        "styleClass": "red",
        "canConnect": true,
        "canDisconnect": true,
        "clearsOverrideId": STATE_OVERRIDE_UNSET,
        "overrideId": STATE_OVERRIDE_UNSET,
        "refreshTimeout": 5
    }
};