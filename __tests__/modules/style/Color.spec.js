import {colorsEqual, parseColor} from '../../../modules/style/Color.js';

describe('Color', () => {
    it('parses rgb, rgba, hex and common names', () => {
        expect(parseColor('rgba(255, 255, 255, 1)')).toEqual([255, 255, 255, 1]);
        expect(parseColor('rgb(1,2,3)')).toEqual([1, 2, 3, 1]);
        expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
        expect(parseColor('White')).toEqual([255, 255, 255, 1]);
        expect(parseColor('rgba(0,0,0,.5)')).toEqual([0, 0, 0, 0.5]);
        expect(parseColor('banana')).toBeNull();
        expect(parseColor('rgb(300,0,0)')).toBeNull();
    });

    it('compares equivalent representations as equal', () => {
        expect(colorsEqual('rgba(255, 255, 255, 1)', 'rgba(255,255,255,1)')).toBe(true);
        expect(colorsEqual('rgb(255,255,255)', 'rgba(255,255,255,1)')).toBe(true);
        expect(colorsEqual('white', 'rgba(255,255,255,1)')).toBe(true);
        expect(colorsEqual('rgba(0,0,0,0.7)', 'rgba(0,0,0,0.8)')).toBe(false);
    });

    it('falls back to trimmed lowercase text for unparseable values', () => {
        expect(colorsEqual(' Foo ', 'foo')).toBe(true);
        expect(colorsEqual('foo', 'bar')).toBe(false);
        expect(colorsEqual('foo', 'white')).toBe(false);
    });
});
