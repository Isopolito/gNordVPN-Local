import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '../../../modules/style/LegacyStyleParser.js';
import {compile, normalizeDeclarations, sameStyles} from '../../../modules/style/StyleCompiler.js';
import {STATE_KEYS} from '../../../modules/style/AppearanceModel.js';
import {LEGACY_SIZES, LEGACY_THEMES, legacyGenerate} from '../../helpers/legacyStyles.js';
import {loadSchema, parseVariantText} from '../../helpers/FakeSettings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, '../../fixtures/panel-live.json'), 'utf8'));

// Same text and same set of CSS declarations for every state and for the common CSS.
function expectSameStyles(actual, expected) {
    expect(normalizeDeclarations(actual.commonCss)).toEqual(normalizeDeclarations(expected.commonCss));
    STATE_KEYS.forEach(key => {
        expect(actual.panelStyles[key].panelText).toBe(expected.panelStyles[key].panelText);
        expect(normalizeDeclarations(actual.panelStyles[key].css)).toEqual(normalizeDeclarations(expected.panelStyles[key].css));
    });
}

const roundTrip = (legacy) => compile(parse(legacy.panelStyles, legacy.commonCss));

describe('legacy round trip', () => {
    const combos = LEGACY_SIZES.flatMap(size => Object.keys(LEGACY_THEMES).map(theme => [size, theme]));

    it.each(combos)('size %s with theme %s survives compile(parse(legacy))', (size, theme) => {
        const legacy = legacyGenerate(size, theme);
        expectSameStyles(roundTrip(legacy), legacy);
        expect(sameStyles(roundTrip(legacy), legacy)).toBe(true);
    });

    it('round-trips the schema default panel-styles and common-panel-style', () => {
        const schema = loadSchema();
        const legacy = {
            panelStyles: parseVariantText(schema.keys['panel-styles'].defaultText),
            commonCss: parseVariantText(schema.keys['common-panel-style'].defaultText),
        };
        expect(Object.keys(legacy.panelStyles)).toHaveLength(10);
        expectSameStyles(roundTrip(legacy), legacy);
    });

    // Captured from the author's desktop with gsettings (see the plan, phase 2a).
    it('round-trips the author\'s live panel-styles and common-panel-style', () => {
        expectSameStyles(roundTrip(fixture), fixture);
    });

    it('keeps the live fixture\'s custom padding as custom spacing', () => {
        const model = parse(fixture.panelStyles, fixture.commonCss);
        expect(model.shape.spacing).toBe('custom');
        expect(model.shape.padding).toEqual({top: '0px', right: '13px', bottom: '0', left: '13px'});
        expect(model.shape.border).toEqual({enabled: true, color: 'white'});
    });

    it('is stable: parsing the compiled output gives the same model', () => {
        const legacy = legacyGenerate('extraLarge', 'outline');
        const model = parse(legacy.panelStyles, legacy.commonCss);
        const compiled = compile(model);
        expect(parse(compiled.panelStyles, compiled.commonCss)).toEqual(model);
    });

    it('is stable with advanced common and state CSS (common copy is not re-read as state advanced)', () => {
        const model = parse(legacyGenerate('extraLarge', 'outline').panelStyles, legacyGenerate('extraLarge', 'outline').commonCss);
        model.advanced.common = 'color: black; opacity: 0.9;';
        model.advanced.states.CONNECTED = 'letter-spacing: 1px;';
        const compiled = compile(model);
        expect(parse(compiled.panelStyles, compiled.commonCss)).toEqual(model);
    });
});
