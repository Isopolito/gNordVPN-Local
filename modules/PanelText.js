// Pure helpers for the panel label: uptime parsing/formatting and template token substitution.

const UNITS = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
];

const LIVE_UPTIME_TOKENS = /\{uptime(?:Hr|Min|Sec)?\}/;

// Parses nordvpn's uptime text ("1 day 2 hours 1 minute 5 seconds"). Any subset of units may be
// present, singular or plural. Returns whole seconds, or null when no unit is found (e.g. "N/A").
export function parseUptimeSec(str) {
    if (typeof str !== 'string') return null;
    let total = 0;
    let found = false;
    for (const [unit, secs] of UNITS) {
        const match = str.match(new RegExp(`(\\d+)\\s*${unit}s?\\b`, 'i'));
        if (!match) continue;
        total += parseInt(match[1], 10) * secs;
        found = true;
    }
    return found ? total : null;
}

// Formats seconds the way nordvpn prints uptime: zero units are left out and units are singular
// at exactly 1. Zero seconds is "0 seconds".
export function formatUptime(sec) {
    let left = Math.max(0, Math.floor(sec));
    const parts = [];
    for (const [unit, secs] of UNITS) {
        const count = Math.floor(left / secs);
        left -= count * secs;
        if (count > 0) parts.push(`${count} ${unit}${count === 1 ? '' : 's'}`);
    }
    return parts.length ? parts.join(' ') : '0 seconds';
}

export function usesLiveUptime(template) {
    return LIVE_UPTIME_TOKENS.test(template ?? '');
}

const pad2 = (n) => String(n).padStart(2, '0');
const orNA = (v) => (v === undefined || v === null ? 'N/A' : String(v));

// Replaces the {tokens} in a panel template. uptimeSec overrides the polled status.uptime so the
// local clock can drive the uptime tokens between polls.
export function render(template, status, {uptimeSec} = {}) {
    const secs = uptimeSec ?? parseUptimeSec(status.uptime);
    const transfer = status.transfer;
    const server = orNA(status.currentServer);
    const country = orNA(status.country);
    const city = orNA(status.city);

    const tokens = {
        country,
        COUNTRY: country.toUpperCase(),
        ctry: server.replace(/(\d|.nordvpn.com)/g, '').toUpperCase(),
        city,
        CITY: city.toUpperCase(),
        number: orNA(status.serverNumber),
        server,
        ip: orNA(status.serverIp),
        tech: orNA(status.currentTech),
        protocol: orNA(status.currentProtocol),
        transfer: orNA(transfer),
        transferUp: (transfer?.match?.(/\d+.\d+ [a-zA-z]+ sent/g) || ['0 B'])[0].replace(' sent', ''),
        transferDown: (transfer?.match?.(/\d+.\d+ [a-zA-z]+ received/g) || ['0 B'])[0].replace(' received', ''),
        uptime: secs === null ? orNA(status.uptime) : formatUptime(secs),
        uptimeHr: secs === null ? '00' : pad2(Math.floor(secs / 3600)),
        uptimeMin: secs === null ? '00' : pad2(Math.floor((secs % 3600) / 60)),
        uptimeSec: secs === null ? '00' : pad2(secs % 60),
    };

    // One pass, so a substituted value is never scanned for tokens again.
    return template.replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(tokens, name) ? tokens[name] : whole));
}
