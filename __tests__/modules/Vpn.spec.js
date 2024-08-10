import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('gi://Gio', () => ({
    _promisify: jest.fn(),
    Subprocess: {
        prototype: {
            communicate_utf8_async: jest.fn()
        }
    }
}), { virtual: true });

jest.mock('gi://Soup', () => ({
    Session: {
        new: jest.fn().mockReturnValue({
            send_and_read: jest.fn().mockReturnValue({
                get_data: jest.fn().mockReturnValue(new Uint8Array())
            })
        })
    },
    Message: { new: jest.fn() },
    Status: { OK: 200 },
    get_major_version: jest.fn().mockReturnValue(3)
}), { virtual: true });

jest.mock('../../modules/ProcCom.js', () => {
    return {
        default: class {
            constructor() {}
            execCommunicateSync() { return [true, '', '', 0]; }
            execCommunicateAsync() { return Promise.resolve(''); }
        }
    };
});

// Import the real Vpn class
import Vpn from '../../modules/Vpn.js';

describe('Vpn _processCityCountryOutput tests', () => {
    let vpn;

    beforeEach(() => {
        const mockSettings = {
            set_string: jest.fn(),
            set_boolean: jest.fn(),
            get_boolean: jest.fn(),
            get_string: jest.fn(),
            get_value: jest.fn().mockReturnValue({ unpack: () => 5, deep_unpack: () => ['country1', 'country2'] }),
        };
        vpn = new Vpn(mockSettings);
    });

    test('processes clean country output correctly', () => {
        const input = `Albania
Australia
Brazil
Canada
United_States`;
        const expected = ['Albania', 'Australia', 'Brazil', 'Canada', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('handles leading junk characters', () => {
        const input = `***Albania
---Australia
>>>Brazil
   Canada
...United_States`;
        const expected = ['Albania', 'Australia', 'Brazil', 'Canada', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('handles ANSI color codes', () => {
        const input = `\x1b[32mAlbania\x1b[0m
\x1b[31mAustralia\x1b[0m
Brazil
Canada
United_States`;
        const expected = ['Albania', 'Australia', 'Brazil', 'Canada', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('filters out invalid country/city names', () => {
        const input = `Valid_Name
invalid name
123NotACountry
Another_Valid_Name`;
        const expected = ['Another_Valid_Name', 'Valid_Name'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('handles empty input', () => {
        expect(vpn._processCityCountryOutput('')).toEqual([]);
    });

    test('preserves names with underscores', () => {
        const input = `United_States
New_Zealand
South_Korea`;
        const expected = ['New_Zealand', 'South_Korea', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('handles input with extra whitespace', () => {
        const input = `  Canada  

  Mexico\t
United_States  `;
        const expected = ['Canada', 'Mexico', 'United_States'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('sorts output alphabetically', () => {
        const input = `France
Canada
Brazil
Australia`;
        const expected = ['Australia', 'Brazil', 'Canada', 'France'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('handles names with apostrophes and hyphens', () => {
        const input = `Cote_d'Ivoire
Bosnia_and_Herzegovina
Guinea-Bissau`;
        const expected = ['Bosnia_and_Herzegovina', "Cote_d'Ivoire", 'Guinea-Bissau'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });

    test('handles mixed case input', () => {
        const input = `FRANCE
germany
iTALY
SpAiN`;
        const expected = ['FRANCE', 'germany', 'iTALY', 'SpAiN'];
        expect(vpn._processCityCountryOutput(input)).toEqual(expected);
    });
});