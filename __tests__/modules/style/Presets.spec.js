import {SIZE_PRESETS, THEME_PRESETS, applySize, applyTheme, buildPreset} from '../../../modules/style/Presets.js';
import {compile, normalizeDeclarations} from '../../../modules/style/StyleCompiler.js';
import {STATE_KEYS, defaultModel, normalize, resolveState} from '../../../modules/style/AppearanceModel.js';
import {LEGACY_SIZES, LEGACY_THEMES, LEGACY_PANEL_TEXTS, legacyGenerate} from '../../helpers/legacyStyles.js';

describe('presets reproduce the old StylesManager output', () => {
    const combos = LEGACY_SIZES.flatMap(size => Object.keys(LEGACY_THEMES).map(theme => [size, theme]));

    it('has the same sizes and themes as the old buttons and switches', () => {
        expect(Object.keys(SIZE_PRESETS).sort()).toEqual([...LEGACY_SIZES].sort());
        expect(Object.keys(THEME_PRESETS).sort()).toEqual(Object.keys(LEGACY_THEMES).sort());
    });

    it.each(LEGACY_SIZES)('size %s has exactly the old panel texts', (size) => {
        expect(SIZE_PRESETS[size].panelTexts).toEqual(LEGACY_PANEL_TEXTS[size]);
    });

    it.each(combos)('size %s with theme %s compiles to the old output', (size, theme) => {
        const legacy = legacyGenerate(size, theme);
        const out = compile(buildPreset(size, theme));
        expect(normalizeDeclarations(out.commonCss)).toEqual(normalizeDeclarations(legacy.commonCss));
        STATE_KEYS.forEach(key => {
            expect(out.panelStyles[key].panelText).toBe(legacy.panelStyles[key].panelText);
            expect(normalizeDeclarations(out.panelStyles[key].css)).toEqual(normalizeDeclarations(legacy.panelStyles[key].css));
        });
    });

    it.each(combos)('size %s then theme %s equals theme then size', (size, theme) => {
        const base = defaultModel();
        expect(applyTheme(applySize(base, size), theme)).toEqual(applySize(applyTheme(base, theme), size));
    });

    it('produces valid models', () => {
        combos.forEach(([size, theme]) => {
            const model = buildPreset(size, theme);
            expect(normalize(model)).toEqual(model);
        });
    });
});

describe('applySize', () => {
    it('keeps distinct transitional labels with text overrides', () => {
        const model = applySize(defaultModel(), 'extraLarge');
        expect(resolveState(model, 'CONNECTING').text).toBe('VPN CONNECTING');
        expect(resolveState(model, 'DISCONNECTING').text).toBe('VPN DISCONNECTING ');
        expect(resolveState(model, 'LOGGING_OUT').text).toBe('VPN LOGGING OUT');
    });

    it('touches only text', () => {
        const before = defaultModel();
        before.overrides.ERROR = {bg: 'pink', text: 'old'};
        before.advanced.common = 'opacity: 1;';
        const after = applySize(before, 'small');
        expect(after.shape).toEqual(before.shape);
        expect(after.advanced).toEqual(before.advanced);
        expect(after.overrides.ERROR).toEqual({bg: 'pink'});
        GROUPS_COLORS(before, after);
    });

    it('does not mutate its input and rejects unknown presets', () => {
        const before = defaultModel();
        const snapshot = JSON.stringify(before);
        applySize(before, 'medium');
        expect(JSON.stringify(before)).toBe(snapshot);
        expect(() => applySize(before, 'huge')).toThrow();
    });
});

function GROUPS_COLORS(before, after) {
    Object.keys(before.groups).forEach(group => {
        expect(after.groups[group].bg).toBe(before.groups[group].bg);
        expect(after.groups[group].fg).toBe(before.groups[group].fg);
    });
}

describe('applyTheme', () => {
    it('touches shape and colors but not text or advanced CSS', () => {
        const before = applySize(defaultModel(), 'extraLarge');
        before.advanced.states.ERROR = 'opacity: 1;';
        before.overrides.ERROR = {bg: 'pink', text: 'custom'};
        const after = applyTheme(before, 'mono');
        expect(after.advanced).toEqual(before.advanced);
        expect(after.overrides.ERROR).toEqual({text: 'custom'});
        expect(resolveState(after, 'CONNECTING').text).toBe('VPN CONNECTING');
        expect(resolveState(after, 'ERROR').bg).toBe('rgba(255,255,255,0.7)');
    });

    it('marks the outline spacing as custom and the others as normal', () => {
        expect(applyTheme(defaultModel(), 'outline').shape.spacing).toBe('custom');
        expect(applyTheme(defaultModel(), 'trafficLight').shape.spacing).toBe('normal');
    });

    it('does not mutate its input or share preset objects, and rejects unknown presets', () => {
        const before = defaultModel();
        const after = applyTheme(before, 'outline');
        after.shape.padding.top = 'changed';
        expect(THEME_PRESETS.outline.shape.padding.top).toBe('3px');
        expect(before.shape.padding.top).toBe('4px');
        expect(() => applyTheme(before, 'neon')).toThrow();
    });
});
