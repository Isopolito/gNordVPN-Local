import {compile, compileCommon, expandSides, normalizeDeclarations, sameStyles, splitDeclarations} from '../../../modules/style/StyleCompiler.js';
import {defaultModel, STATE_KEYS} from '../../../modules/style/AppearanceModel.js';
import {parse} from '../../../modules/style/LegacyStyleParser.js';
import {loadSchema, parseVariantText} from '../../helpers/FakeSettings.js';

describe('compile', () => {
    it('returns every state in the shape PanelIcon reads', () => {
        const {panelStyles} = compile(defaultModel());
        expect(Object.keys(panelStyles)).toEqual(STATE_KEYS);
        STATE_KEYS.forEach(key => expect(Object.keys(panelStyles[key]).sort()).toEqual(['css', 'panelText']));
    });

    it('reproduces the schema defaults', () => {
        const schema = loadSchema();
        const expectedStyles = parseVariantText(schema.keys['panel-styles'].defaultText);
        const expectedCommon = parseVariantText(schema.keys['common-panel-style'].defaultText);
        const compiled = compile(defaultModel());
        expect(sameStyles(compiled, {panelStyles: expectedStyles, commonCss: expectedCommon})).toBe(true);
        STATE_KEYS.forEach(key => expect(compiled.panelStyles[key]).toEqual(expectedStyles[key]));
    });

    it('maps corners to border-radius', () => {
        const css = (corner) => { const m = defaultModel(); m.shape.corner = corner; return compileCommon(m); };
        expect(css('pill')).toContain('border-radius: 100px;');
        expect(css('rounded')).toContain('border-radius: 5px;');
        expect(css('square')).toContain('border-radius: 0;');
    });

    it('emits bold and border only when enabled', () => {
        const model = defaultModel();
        model.shape.bold = false;
        expect(compileCommon(model)).not.toContain('font-weight');
        expect(compileCommon(model)).not.toContain('border:');
        model.shape.border = {enabled: true, color: 'red'};
        expect(compileCommon(model)).toContain('border: 1px solid red;');
    });

    it('compiles padding and margin from the spacing sides', () => {
        const model = defaultModel();
        model.shape.padding = {top: '1px', right: '2px', bottom: '3px', left: '4px'};
        model.shape.margin = {top: '5px', right: '5px', bottom: '5px', left: '5px'};
        const common = compileCommon(model);
        expect(common).toContain('padding: 1px 2px 3px 4px;');
        expect(common).toContain('margin: 5px;');
    });

    it('applies overrides and omits empty colors', () => {
        const model = defaultModel();
        model.overrides.ERROR = {bg: '', text: 'oops'};
        const {panelStyles} = compile(model);
        expect(panelStyles.ERROR).toEqual({panelText: 'oops', css: 'color: rgba(255,255,255,1);'});
    });

    it('appends advanced CSS last so it wins', () => {
        const model = defaultModel();
        model.advanced.common = 'padding: 9px;';
        model.advanced.states.CONNECTED = 'color: black;';
        const {panelStyles, commonCss} = compile(model);
        expect(commonCss.endsWith('padding: 9px;')).toBe(true);
        expect(panelStyles.CONNECTED.css.endsWith('color: black;')).toBe(true);
    });
});

describe('CSS helpers', () => {
    it('splits on semicolons outside parentheses and quotes', () => {
        expect(splitDeclarations('a: url(x;y); b: "p;q"; ; c: 1')).toEqual(['a: url(x;y)', 'b: "p;q"', 'c: 1']);
        expect(splitDeclarations('')).toEqual([]);
        expect(splitDeclarations(undefined)).toEqual([]);
    });

    it.each([
        ['4px', {top: '4px', right: '4px', bottom: '4px', left: '4px'}],
        ['1px 2px', {top: '1px', right: '2px', bottom: '1px', left: '2px'}],
        ['4px 10px 0', {top: '4px', right: '10px', bottom: '0', left: '10px'}],
        ['1px 2px 3px 4px', {top: '1px', right: '2px', bottom: '3px', left: '4px'}],
    ])('expands %s', (value, sides) => expect(expandSides(value)).toEqual(sides));

    it('does not expand more than four values', () => {
        expect(expandSides('1px 2px 3px 4px 5px')).toBeNull();
    });

    it('normalises whitespace, case, comma spacing, order and shorthand', () => {
        expect(normalizeDeclarations('Color: rgba(1, 2, 3, 1);  padding: 4px 10px 0'))
            .toEqual(normalizeDeclarations('padding:4px 10px 0 10px; color: rgba(1,2,3,1)'));
        expect(normalizeDeclarations('color: red')).not.toEqual(normalizeDeclarations('color: blue'));
    });

    it('normalizeDeclarations keeps the order of a repeated property but not of unrelated ones', () => {
        expect(normalizeDeclarations('color: red; color: blue')).not.toEqual(normalizeDeclarations('color: blue; color: red'));
        expect(normalizeDeclarations('color: red; padding: 1px; color: blue'))
            .toEqual(normalizeDeclarations('padding: 1px; color: red; color: blue'));
    });

    it('sameStyles notices a different text, color or common CSS', () => {
        const a = compile(defaultModel());
        const b = JSON.parse(JSON.stringify(a));
        expect(sameStyles(a, b)).toBe(true);
        b.panelStyles.ERROR.panelText = 'x';
        expect(sameStyles(a, b)).toBe(false);
        const c = JSON.parse(JSON.stringify(a));
        c.panelStyles.ERROR.css += ' opacity: 0.5;';
        expect(sameStyles(a, c)).toBe(false);
        const d = JSON.parse(JSON.stringify(a));
        d.commonCss = '';
        expect(sameStyles(a, d)).toBe(false);
    });
});

describe('unknown declarations survive compilation', () => {
    it('keeps an unrecognised per-state and common declaration verbatim', () => {
        const legacy = {
            panelStyles: Object.fromEntries(STATE_KEYS.map(key => [key, {panelText: 't', css: 'color: red; text-shadow: 0 0 2px rgba(0, 0, 0, 1);'}])),
            commonCss: 'font-weight: bold; letter-spacing: 2px; transition: all 1s;',
        };
        const model = parse(legacy.panelStyles, legacy.commonCss);
        expect(model.advanced.common).toBe('letter-spacing: 2px; transition: all 1s;');
        expect(model.advanced.states.CONNECTED).toBe('text-shadow: 0 0 2px rgba(0, 0, 0, 1);');
        const out = compile(model);
        expect(normalizeDeclarations(out.commonCss)).toContain('letter-spacing:2px');
        expect(normalizeDeclarations(out.commonCss)).toContain('transition:all 1s');
        expect(out.panelStyles.ERROR.css).toContain('text-shadow: 0 0 2px rgba(0, 0, 0, 1);');
    });
});
