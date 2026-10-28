import {jest} from '@jest/globals';
import Signals from '../../modules/Signals.js';

globalThis.log = () => {};
globalThis.logError = () => {};

describe('Signals', () => {
    it('disconnectAll runs every registered callback and clears them', () => {
        const s = new Signals();
        const a = jest.fn(), b = jest.fn();
        s.register(1, a);
        s.register(2, b);
        s.disconnectAll();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        s.disconnectAll();
        expect(a).toHaveBeenCalledTimes(1);
    });

    it('disconnectAll keeps going when a callback throws', () => {
        const s = new Signals();
        const b = jest.fn();
        s.register(1, () => { throw new Error('boom'); });
        s.register(2, b);
        s.disconnectAll();
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('disconnect takes an array of ids and only runs those callbacks', () => {
        const s = new Signals();
        const a = jest.fn(), b = jest.fn(), c = jest.fn();
        s.register(1, a); s.register(2, b); s.register(3, c);
        s.disconnect([1, 3]);
        expect(a).toHaveBeenCalledTimes(1);
        expect(c).toHaveBeenCalledTimes(1);
        expect(b).not.toHaveBeenCalled();
        s.disconnectAll();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('disconnect accepts a single id and ignores unknown ids', () => {
        const s = new Signals();
        const a = jest.fn();
        s.register(7, a);
        s.disconnect(99);
        s.disconnect(7);
        expect(a).toHaveBeenCalledTimes(1);
    });

    it('register replaces and disconnects an existing callback for the same id', () => {
        const s = new Signals();
        const a = jest.fn(), b = jest.fn();
        s.register(1, a);
        s.register(1, b);
        expect(a).toHaveBeenCalledTimes(1);
        s.disconnectAll();
        expect(b).toHaveBeenCalledTimes(1);
    });
});
