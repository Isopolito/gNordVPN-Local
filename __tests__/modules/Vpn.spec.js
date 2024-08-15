import VpnUtils from '../../modules/VpnUtils.js';

describe('VpnUtils', () => {
    let vpnUtils;

    beforeEach(() => {
        vpnUtils = new VpnUtils();
    });

    describe('processCityCountryOutput', () => {
        it('should process country output correctly', () => {
            const input = `Albania\nAlgeria\nAndorra\nArgentina\nArmenia\nBosnia_And_Herzegovina\nBrunei_Darussalam`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Albania');
            expect(result).toContain('Algeria');
            expect(result).toContain('Bosnia_And_Herzegovina');
            expect(result).toContain('Brunei_Darussalam');
            expect(result.length).toBeGreaterThan(5);
        });

        it('should process city output correctly', () => {
            const input = `Atlanta\nBuffalo\nCharlotte\nChicago\nDallas\nDenver\nKansas_City\nLos_Angeles\nManassas\nMiami\nSalt_Lake_City`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Atlanta');
            expect(result).toContain('Kansas_City');
            expect(result).toContain('Salt_Lake_City');
            expect(result.length).toBe(11);
        });

        it('should handle empty input', () => {
            const result = vpnUtils.processCityCountryOutput('');
            expect(result).toEqual([]);
        });

        it('should handle input with only whitespace', () => {
            const result = vpnUtils.processCityCountryOutput('   \n   \t   ');
            expect(result).toEqual([]);
        });

        // TODO: Get this working
        // it('should ignore color formatting', () => {
        //     const input = '[94mIsle_Of_Man[0m\nIsrael\nItaly\n[94mJamaica[0m\nJapan\n[94mJersey[0m\n[94mKazakhstan[0m\n[94mKenya[0m\n[94mLao_Peoples_Democratic_Republic[0m'
        //     const result = vpnUtils.processCityCountryOutput(input);
        //     expect(result).toContain('Isle_Of_Man');
        //     expect(result).toContain('Italy');
        //     expect(result).toContain('Kenya');
        //     expect(result.length).toBe(3);
        // });

        it('should preserve underscores', () => {
            const input = 'New_York\nSalt_Lake_City\nTrinidad_And_Tobago';
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('New_York');
            expect(result).toContain('Salt_Lake_City');
            expect(result).toContain('Trinidad_And_Tobago');
        });

        it('should remove the "Virtual location servers" line if present', () => {
            const input = `Albania\nAustralia\n* Virtual location servers\nAustria`;
            const result = vpnUtils.processCityCountryOutput(input);
            expect(result).toContain('Albania');
            expect(result).toContain('Australia');
            expect(result).toContain('Austria');
            expect(result).not.toContain('Virtual location servers');
            expect(result.length).toBe(3);
        });
    });

    describe('getString', () => {
        it('should handle Uint8Array input', () => {
            const input = new TextEncoder().encode('Hello, world!');
            const result = vpnUtils.getString(input);
            expect(result).toBe('Hello, world!');
        });

        it('should handle string input', () => {
            const result = vpnUtils.getString('Hello, world!');
            expect(result).toBe('Hello, world!');
        });
    });

    describe('resolveSettingsValue', () => {
        it('should return true for "enabled"', () => {
            const result = vpnUtils.resolveSettingsValue('enabled');
            expect(result).toBe(true);
        });

        it('should return false for "disabled"', () => {
            const result = vpnUtils.resolveSettingsValue('disabled');
            expect(result).toBe(false);
        });

        it('should return trimmed text for other values', () => {
            const result = vpnUtils.resolveSettingsValue('  some setting  ');
            expect(result).toBe('some setting');
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
            const result = vpnUtils.resolveSettingsKey('unknown setting');
            expect(result).toBeNull();
        });
    });
});