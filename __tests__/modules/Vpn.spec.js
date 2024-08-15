import VpnUtils from '../../modules/VpnUtils.js';

describe('VpnUtils', () => {
    let vpnUtils;

    beforeEach(() => {
        vpnUtils = new VpnUtils();
    });

    describe('processCityCountryOutput', () => {
        it('should process country output correctly', () => {
            const input = `Albania                            Algeria                            Andorra                            Argentina                          Armenia
Australia                          Austria                            Azerbaijan                         Bahamas                            Bangladesh
Belgium                            Belize                             Bermuda                            Bhutan                             Bolivia
Bosnia_And_Herzegovina             Brazil                             Brunei_Darussalam                  Bulgaria                           Cambodia`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Albania');
            expect(result).toContain('Algeria');
            expect(result).toContain('Bosnia_And_Herzegovina');
            expect(result).toContain('Brunei_Darussalam');
            expect(result.length).toBeGreaterThan(5);
        });

        it('should process city output correctly', () => {
            const input = `Atlanta           Buffalo           Charlotte         Chicago           Dallas            Denver            Kansas_City       Los_Angeles       Manassas          Miami
New_York          Phoenix           Saint_Louis       Salt_Lake_City    San_Francisco     Seattle`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Atlanta');
            expect(result).toContain('Kansas_City');
            expect(result).toContain('Salt_Lake_City');
            expect(result.length).toBe(16);
        });

        it('should handle empty input', () => {
            expect(vpnUtils.processCityCountryOutput('')).toEqual([]);
        });

        it('should handle input with only whitespace', () => {
            expect(vpnUtils.processCityCountryOutput('   \n   \t   ')).toEqual([]);
        });

        it('should ignore color formatting', () => {
            const input = '\u001b[94mAlbania\u001b[0m                            Australia                          \u001b[94mAustria\u001b[0m';
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Albania');
            expect(result).toContain('Australia');
            expect(result).toContain('Austria');
            expect(result.length).toBe(3);
        });

        it('should preserve underscores', () => {
            const input = 'New_York          Salt_Lake_City    Trinidad_And_Tobago';
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('New_York');
            expect(result).toContain('Salt_Lake_City');
            expect(result).toContain('Trinidad_And_Tobago');
        });

        it('should handle mixed country and city input', () => {
            const input = `United_States                      Canada
New_York          Toronto          Vancouver         Los_Angeles`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('United_States');
            expect(result).toContain('Canada');
            expect(result).toContain('New_York');
            expect(result).toContain('Los_Angeles');
            expect(result.length).toBe(6);
        });

        it('should remove the "Virtual location servers" line if present', () => {
            const input = `Albania                            Australia
* Virtual location servers
Austria`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Albania');
            expect(result).toContain('Australia');
            expect(result).toContain('Austria');
            expect(result).not.toContain('Virtual location servers');
            expect(result.length).toBe(3);
        });
    });

    // Add tests for getString, resolveSettingsValue, and resolveSettingsKey methods
    describe('getString', () => {
        it('should handle Uint8Array input', () => {
            const input = new TextEncoder().encode('Hello, world!');
            expect(vpnUtils.getString(input)).toBe('Hello, world!');
        });

        it('should handle string input', () => {
            expect(vpnUtils.getString('Hello, world!')).toBe('Hello, world!');
        });
    });

    describe('resolveSettingsValue', () => {
        it('should return true for "enabled"', () => {
            expect(vpnUtils.resolveSettingsValue('enabled')).toBe(true);
        });

        it('should return false for "disabled"', () => {
            expect(vpnUtils.resolveSettingsValue('disabled')).toBe(false);
        });

        it('should return trimmed text for other values', () => {
            expect(vpnUtils.resolveSettingsValue('  some setting  ')).toBe('some setting');
        });
    });

    describe('resolveSettingsKey', () => {
        it('should resolve known settings keys', () => {
            expect(vpnUtils.resolveSettingsKey('firewall')).toBe('firewall');
            expect(vpnUtils.resolveSettingsKey('technology')).toBe('technology');
            expect(vpnUtils.resolveSettingsKey('kill switch')).toBe('killswitch');
            expect(vpnUtils.resolveSettingsKey('threat protection lite')).toBe('cybersec');
        });

        it('should return null for unknown keys', () => {
            expect(vpnUtils.resolveSettingsKey('unknown setting')).toBeNull();
        });
    });
});