import VpnUtils from '../../modules/VpnUtils.js';

describe('VpnUtils', () => {
    let vpnUtils;

    beforeEach(() => {
        vpnUtils = new VpnUtils();
    });

    describe('processCityCountryOutput', () => {
        it('processes country output', () => {
            const input = `Albania\nAlgeria\nAndorra\nArgentina\nArmenia\nBosnia_And_Herzegovina\nBrunei_Darussalam`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Albania');
            expect(result).toContain('Bosnia_And_Herzegovina');
            expect(result).toContain('Brunei_Darussalam');
            expect(result.length).toBe(7);
        });

        it('processes city output', () => {
            const input = `Atlanta\nBuffalo\nCharlotte\nChicago\nDallas\nDenver\nKansas_City\nLos_Angeles\nManassas\nMiami\nSalt_Lake_City`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Kansas_City');
            expect(result).toContain('Salt_Lake_City');
            expect(result.length).toBe(11);
        });

        it('returns an empty list for empty or whitespace-only input', () => {
            expect(vpnUtils.processCityCountryOutput('')).toEqual([]);
            expect(vpnUtils.processCityCountryOutput('   \n   \t   ')).toEqual([]);
        });

        it('preserves underscores', () => {
            const result = vpnUtils.processCityCountryOutput('New_York\nSalt_Lake_City\nTrinidad_And_Tobago');
            expect(result).toEqual(['New_York', 'Salt_Lake_City', 'Trinidad_And_Tobago']);
        });

        it('sorts the result alphabetically', () => {
            expect(vpnUtils.processCityCountryOutput('Zambia\nAlbania\nMexico')).toEqual(['Albania', 'Mexico', 'Zambia']);
        });

        it('removes the "Virtual location servers" line', () => {
            const result = vpnUtils.processCityCountryOutput(`Albania\nAustralia\n* Virtual location servers\nAustria`);
            expect(result).toEqual(['Albania', 'Australia', 'Austria']);
        });

        it('strips leading junk characters', () => {
            expect(vpnUtils.processCityCountryOutput('- Albania\nAlgeria')).toEqual(['Albania', 'Algeria']);
        });

        it('drops blank lines', () => {
            expect(vpnUtils.processCityCountryOutput('Algeria\nAlbania\n\n')).toEqual(['Albania', 'Algeria']);
        });

        // Current behaviour, not endorsed: the "remove colour formatting" regex uses `\e`, which in
        // a JS regex matches a literal "e", so ANSI escapes survive. (Existing TODO in the old spec.)
        it('does not currently remove ANSI colour codes', () => {
            const result = vpnUtils.processCityCountryOutput('\x1b[94mIsle_Of_Man\x1b[0m\nItaly');
            expect(result).toContain('Italy');
            expect(result).not.toContain('Isle_Of_Man');
        });
    });

    describe('getString', () => {
        it('decodes a Uint8Array', () => {
            expect(vpnUtils.getString(new TextEncoder().encode('Hello, world!'))).toBe('Hello, world!');
        });

        it('stringifies other input', () => {
            expect(vpnUtils.getString('Hello, world!')).toBe('Hello, world!');
        });
    });

    describe('resolveSettingsValue', () => {
        it('maps "enabled" to true and "disabled" to false', () => {
            expect(vpnUtils.resolveSettingsValue('enabled')).toBe(true);
            expect(vpnUtils.resolveSettingsValue(' disabled ')).toBe(false);
        });

        it('returns other values trimmed', () => {
            expect(vpnUtils.resolveSettingsValue('  NORDLYNX  ')).toBe('NORDLYNX');
        });

        it('returns undefined for empty/undefined input', () => {
            expect(vpnUtils.resolveSettingsValue(undefined)).toBeUndefined();
            expect(vpnUtils.resolveSettingsValue('')).toBeUndefined();
        });
    });

    describe('resolveSettingsKey', () => {
        it.each([
            ['firewall', 'firewall'],
            ['Technology', 'technology'],
            ['Current Technology', 'technology'],
            ['protocol', 'protocol'],
            ['Kill Switch', 'killswitch'],
            ['analytics', 'analytics'],
            ['Threat Protection Lite', 'cybersec'],
            ['obfuscate', 'obfuscate'],
            ['notify', 'notify'],
            ['Auto-connect', 'autoconnect'],
            ['IPv6', 'ipv6'],
        ])('maps %p to %p', (input, expected) => {
            expect(vpnUtils.resolveSettingsKey(input)).toBe(expected);
        });

        it('returns null for unsupported keys (e.g. dns)', () => {
            expect(vpnUtils.resolveSettingsKey('unknown setting')).toBeNull();
            expect(vpnUtils.resolveSettingsKey('DNS')).toBeNull();
        });

        it('returns undefined for empty input', () => {
            expect(vpnUtils.resolveSettingsKey('')).toBeUndefined();
            expect(vpnUtils.resolveSettingsKey(undefined)).toBeUndefined();
        });
    });
});
