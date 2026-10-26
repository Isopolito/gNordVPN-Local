import {parseUptimeSec, formatUptime, usesLiveUptime, render} from '../../modules/PanelText.js';

const status = (overrides = {}) => ({
    country: 'United States', city: 'New York', currentServer: 'us8247.nordvpn.com', serverNumber: ['8247'],
    serverIp: '1.2.3.4', currentTech: 'NORDLYNX', currentProtocol: 'UDP',
    transfer: '1.5 MiB received, 200.0 KiB sent', uptime: '1 hour 5 minutes 3 seconds', ...overrides,
});

describe('PanelText.parseUptimeSec', () => {
    it.each([
        ['12 minutes 40 seconds', 760],
        ['1 hour 5 minutes 3 seconds', 3903],
        ['1 day 2 hours 3 minutes 4 seconds', 93784],
        ['2 days', 172800],
        ['1 minute', 60],
        ['1 second', 1],
        ['3 hours 1 second', 10801],
        ['5 hours', 18000],
    ])('parses %j as %i seconds', (text, expected) => {
        expect(parseUptimeSec(text)).toBe(expected);
    });

    it.each(['N/A', '', undefined, null, 42])('returns null for %j', (text) => {
        expect(parseUptimeSec(text)).toBeNull();
    });
});

describe('PanelText.formatUptime', () => {
    it.each([
        [0, '0 seconds'],
        [1, '1 second'],
        [59, '59 seconds'],
        [60, '1 minute'],
        [3903, '1 hour 5 minutes 3 seconds'],
        [93784, '1 day 2 hours 3 minutes 4 seconds'],
        [172800, '2 days'],
    ])('formats %i as %j', (sec, expected) => {
        expect(formatUptime(sec)).toBe(expected);
    });

    it('round-trips through parseUptimeSec', () => {
        for (const sec of [0, 1, 59, 60, 61, 3599, 3600, 3661, 86399, 86400, 90061, 1_000_000]) {
            expect(parseUptimeSec(formatUptime(sec))).toBe(sec);
        }
    });

    it('round-trips nordvpn text', () => {
        for (const text of ['12 minutes 40 seconds', '1 hour 5 minutes 3 seconds', '1 day 2 hours 3 minutes 4 seconds'])
            expect(formatUptime(parseUptimeSec(text))).toBe(text);
    });
});

describe('PanelText.usesLiveUptime', () => {
    it.each(['{uptime}', '{uptimeHr}', 'a {uptimeMin} b', '{city} {uptimeSec}'])('true for %j', (t) => {
        expect(usesLiveUptime(t)).toBe(true);
    });
    it.each(['{city}, {country}', 'uptime', '{uptimeX}', '', undefined])('false for %j', (t) => {
        expect(usesLiveUptime(t)).toBe(false);
    });
});

describe('PanelText.render', () => {
    it.each([
        ['{country}', 'United States'],
        ['{COUNTRY}', 'UNITED STATES'],
        ['{ctry}', 'US'],
        ['{city}', 'New York'],
        ['{CITY}', 'NEW YORK'],
        ['{number}', '8247'],
        ['{server}', 'us8247.nordvpn.com'],
        ['{ip}', '1.2.3.4'],
        ['{tech}', 'NORDLYNX'],
        ['{protocol}', 'UDP'],
        ['{transfer}', '1.5 MiB received, 200.0 KiB sent'],
        ['{transferUp}', '200.0 KiB'],
        ['{transferDown}', '1.5 MiB'],
        ['{uptime}', '1 hour 5 minutes 3 seconds'],
        ['{uptimeHr}', '01'],
        ['{uptimeMin}', '05'],
        ['{uptimeSec}', '03'],
    ])('renders %s', (token, expected) => {
        expect(render(token, status())).toBe(expected);
    });

    it('renders the real ip and tech values, not undefined', () => {
        const out = render('{ip} {tech}', status());
        expect(out).toBe('1.2.3.4 NORDLYNX');
        expect(out).not.toContain('undefined');
    });

    it('renders a singular hour (previously 00)', () => {
        expect(render('{uptimeHr}', status({uptime: '1 hour'}))).toBe('01');
    });

    it('includes days x 24 in {uptimeHr}', () => {
        expect(render('{uptimeHr}:{uptimeMin}:{uptimeSec}', status({uptime: '2 days 3 hours 4 minutes 5 seconds'}))).toBe('51:04:05');
    });

    it('pads missing uptime parts with 00', () => {
        expect(render('{uptimeHr}:{uptimeMin}:{uptimeSec}', status({uptime: '40 seconds'}))).toBe('00:00:40');
    });

    it('renders 00 and the raw text when uptime is missing', () => {
        const s = status({uptime: 'N/A'});
        expect(render('{uptime} {uptimeHr}:{uptimeMin}:{uptimeSec}', s)).toBe('N/A 00:00:00');
    });

    it('uses uptimeSec in place of the polled uptime', () => {
        const out = render('{uptime} {uptimeHr}:{uptimeMin}:{uptimeSec}', status(), {uptimeSec: 3904});
        expect(out).toBe('1 hour 5 minutes 4 seconds 01:05:04');
    });

    it('defaults transfer parts to 0 B when there is no transfer', () => {
        expect(render('{transferUp}/{transferDown}', status({transfer: 'N/A'}))).toBe('0 B/0 B');
    });

    it('leaves unknown tokens and plain text alone and replaces repeats', () => {
        expect(render('{city} {nope} {city} !', status())).toBe('New York {nope} New York !');
    });

    it('does not treat $ in values as a replacement pattern', () => {
        expect(render('{city}', status({city: "A$&B"}))).toBe('A$&B');
    });
});
