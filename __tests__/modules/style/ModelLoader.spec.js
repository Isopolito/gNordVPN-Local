import {loadModel} from '../../../modules/style/ModelLoader.js';
import {parse} from '../../../modules/style/LegacyStyleParser.js';
import {compile} from '../../../modules/style/StyleCompiler.js';
import {serialize} from '../../../modules/style/AppearanceModel.js';
import {applyTheme, buildPreset} from '../../../modules/style/Presets.js';
import {legacyGenerate} from '../../helpers/legacyStyles.js';

const legacy = legacyGenerate('large', 'trafficLight');
const args = (appearanceJson) => ({appearanceJson, panelStyles: legacy.panelStyles, commonCss: legacy.commonCss});

describe('loadModel', () => {
    it('parses the legacy keys when panel-appearance is empty', () => {
        const {model, source} = loadModel(args(''));
        expect(source).toBe('legacy-empty');
        expect(model).toEqual(parse(legacy.panelStyles, legacy.commonCss));
    });

    it.each([['{not json'], ['[]'], ['{"version":9}'], ['"x"']])(
        'falls back to the parsed legacy model for malformed panel-appearance %p', (json) => {
            const {model, source} = loadModel(args(json));
            expect(source).toBe('legacy-malformed');
            expect(model).toEqual(parse(legacy.panelStyles, legacy.commonCss));
        });

    it('falls back for a non-string panel-appearance', () => {
        expect(loadModel(args(undefined)).source).toBe('legacy-empty');
        expect(loadModel(args(null)).source).toBe('legacy-empty');
    });

    it('uses panel-appearance when it compiles to what the legacy keys hold', () => {
        const stored = buildPreset('large', 'trafficLight');
        const {model, source} = loadModel({appearanceJson: serialize(stored), ...compile(stored)});
        expect(source).toBe('appearance');
        expect(model).toEqual(stored);
    });

    it('keeps advanced CSS and overrides that only panel-appearance can express', () => {
        const stored = buildPreset('large', 'trafficLight');
        stored.advanced.common = 'opacity: 0.9;';
        const {model, source} = loadModel({appearanceJson: serialize(stored), ...compile(stored)});
        expect(source).toBe('appearance');
        expect(model.advanced.common).toBe('opacity: 0.9;');
    });

    it('lets the legacy keys win when they disagree (grill Q1)', () => {
        const stored = applyTheme(buildPreset('large', 'trafficLight'), 'mono');
        const {model, source} = loadModel(args(serialize(stored)));
        expect(source).toBe('legacy-mismatch');
        expect(model).toEqual(parse(legacy.panelStyles, legacy.commonCss));
        expect(model.groups.connected.bg).toBe('rgba(0,255,0,0.7)');
    });

    it('ignores formatting-only differences between stored and legacy CSS', () => {
        const stored = buildPreset('large', 'trafficLight');
        const compiled = compile(stored);
        compiled.commonCss = 'font-weight:bold;border-radius:100px;padding:0px 10px 0 10px;margin:3px 0px;';
        const {source} = loadModel({appearanceJson: serialize(stored), ...compiled});
        expect(source).toBe('appearance');
    });

    it('never throws on garbage legacy values', () => {
        expect(() => loadModel({appearanceJson: '', panelStyles: null, commonCss: null})).not.toThrow();
    });
});
