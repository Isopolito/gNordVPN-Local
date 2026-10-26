import {parse} from '../../../modules/style/LegacyStyleParser.js';
import {compile} from '../../../modules/style/StyleCompiler.js';
import {GROUPS, STATE_KEYS, resolveState} from '../../../modules/style/AppearanceModel.js';
import {legacyGenerate} from '../../helpers/legacyStyles.js';

const uniformStyles = (css, text = 't') => Object.fromEntries(STATE_KEYS.map(key => [key, {panelText: text, css}]));

describe('LegacyStyleParser.parse', () => {
    it('recognises the common shape declarations', () => {
        const model = parse(uniformStyles(''), 'font-weight: bold; border-radius: 5px; padding: 3px 10px 0; margin: 3px 0px 3px 0px; border: 1px solid white;');
        expect(model.shape.corner).toBe('rounded');
        expect(model.shape.bold).toBe(true);
        expect(model.shape.border).toEqual({enabled: true, color: 'white'});
        expect(model.shape.padding).toEqual({top: '3px', right: '10px', bottom: '0', left: '10px'});
        expect(model.advanced.common).toBe('');
    });

    it('keeps a repeated recognised property verbatim and in order so the cascade survives', () => {
        const model = parse(uniformStyles(''), 'border-radius: 12px; border-radius: 5px; font-weight: bold;');
        expect(model.shape.corner).toBe('square');
        expect(model.shape.bold).toBe(true);
        expect(model.advanced.common).toBe('border-radius: 12px; border-radius: 5px;');
        const css = compile(model).commonCss;
        expect(css.lastIndexOf('border-radius: 5px;')).toBeGreaterThan(css.indexOf('border-radius: 12px;'));
        expect(css.endsWith('border-radius: 12px; border-radius: 5px;')).toBe(true);
    });

    it('detects a spacing preset only on an exact match', () => {
        expect(parse(uniformStyles(''), 'padding: 4px 10px 0; margin: 3px 0px 3px 0px;').shape.spacing).toBe('normal');
        expect(parse(uniformStyles(''), 'padding: 4px 10px 1px; margin: 3px 0px 3px 0px;').shape.spacing).toBe('custom');
    });

    it('maps each corner value', () => {
        const corner = (value) => parse(uniformStyles(''), `border-radius: ${value};`).shape.corner;
        expect(corner('100px')).toBe('pill');
        expect(corner('5px')).toBe('rounded');
        expect(corner('0')).toBe('square');
        expect(corner('0px')).toBe('square');
    });

    it('sends unrecognised values of recognised properties to advanced verbatim', () => {
        const model = parse(uniformStyles(''), 'border-radius: 12px; font-weight: 600; border: 2px dashed red; padding: 1px 2px 3px 4px 5px;');
        expect(model.advanced.common).toBe('border-radius: 12px; font-weight: 600; border: 2px dashed red; padding: 1px 2px 3px 4px 5px;');
        expect(model.shape.bold).toBe(false);
    });

    it('keeps a repeated recognised property instead of dropping it', () => {
        const model = parse(uniformStyles('color: red; color: blue;'), 'font-weight: bold; font-weight: bold;');
        expect(model.groups.error.fg).toBe('red');
        expect(model.advanced.states.ERROR).toBe('color: blue;');
        expect(model.advanced.common).toBe('font-weight: bold; font-weight: bold;');
        expect(model.shape.bold).toBe(false);
    });

    it('puts unknown per-state declarations in advanced.states only for those states', () => {
        const styles = uniformStyles('color: red;');
        styles.ERROR.css = 'color: red; text-decoration: underline;';
        const model = parse(styles, '');
        expect(model.advanced.states).toEqual({ERROR: 'text-decoration: underline;'});
    });

    it('uses the most common value in each group and overrides the odd ones out', () => {
        const styles = legacyGenerate('large', 'trafficLight').panelStyles;
        styles.RESTARTING.css = 'background-color: rgba(1,2,3,1); color: rgba(255,255,255,1);';
        styles.LOGGING_IN.css = 'background-color: rgba(1,2,3,1); color: rgba(255,255,255,1);';
        styles.LOGGING_OUT.css = 'background-color: rgba(9,9,9,1); color: rgba(255,255,255,1);';
        const model = parse(styles, '');
        // 3 of the 6 transitional states keep amber; amber is the earliest of the tied most-common values
        expect(model.groups.transitioning.bg).toBe('rgba(255,191,0,0.7)');
        expect(model.overrides.RESTARTING.bg).toBe('rgba(1,2,3,1)');
        expect(model.overrides.LOGGING_IN.bg).toBe('rgba(1,2,3,1)');
        expect(model.overrides.LOGGING_OUT.bg).toBe('rgba(9,9,9,1)');
        expect(resolveState(model, 'LOGGING_OUT').bg).toBe('rgba(9,9,9,1)');
        expect(model.overrides.CONNECTING?.bg).toBeUndefined();
    });

    it('needs no overrides for color when a theme is uniform per group', () => {
        const legacy = legacyGenerate('large', 'trafficLight');
        const model = parse(legacy.panelStyles, legacy.commonCss);
        Object.values(model.overrides).forEach(entry => expect(Object.keys(entry)).toEqual(['text']));
        expect(model.groups.error.bg).toBe(model.groups.disconnected.bg);
        expect(model.groups.loggedOut.bg).toBe('rgba(48,26,208,0.7)');
    });

    it('gives ERROR and LOGGED_OUT their own groups without overrides', () => {
        const legacy = legacyGenerate('small', 'outline');
        const model = parse(legacy.panelStyles, legacy.commonCss);
        expect(model.overrides.ERROR).toBeUndefined();
        expect(model.overrides.LOGGED_OUT).toBeUndefined();
        expect(model.groups.error.text).toBe('⚠');
        expect(model.groups.loggedOut.text).toBe('?');
    });

    it('treats a state with CSS but no colors as having none', () => {
        const styles = legacyGenerate('large', 'trafficLight').panelStyles;
        styles.ERROR.css = 'opacity: 0.5;';
        const out = compile(parse(styles, ''));
        expect(out.panelStyles.ERROR.css).toBe('opacity: 0.5;');
    });

    it.each([[null], [undefined], [{}], ['junk'], [[]]])('tolerates panel-styles of %p', (input) => {
        const model = parse(input, undefined);
        expect(Object.keys(model.groups)).toEqual(GROUPS);
        expect(compile(model).panelStyles.ERROR.panelText).toBe('ERROR');
    });
});
