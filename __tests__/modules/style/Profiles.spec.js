import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    MAX_NAME_LENGTH, cleanName, deleteProfile, findProfile, isValidName, parseProfiles, renameProfile,
    saveProfile, serializeProfiles,
} from '../../../modules/style/Profiles.js';
import {defaultModel, normalize} from '../../../modules/style/AppearanceModel.js';
import {buildPreset} from '../../../modules/style/Presets.js';
import {parse} from '../../../modules/style/LegacyStyleParser.js';

const live = JSON.parse(fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/panel-live.json'), 'utf8'));
const liveModel = parse(live.panelStyles, live.commonCss);

describe('Profiles', () => {
    it('cleans names: trims, caps length, rejects blanks and non-strings', () => {
        expect(cleanName('  Night  ')).toBe('Night');
        expect(cleanName('x'.repeat(100))).toHaveLength(MAX_NAME_LENGTH);
        expect([' ', '', null, 5].map(isValidName)).toEqual([false, false, false, false]);
        expect(isValidName(' a ')).toBe(true);
    });

    it('round trips save and serialise with the live fixture model', () => {
        const list = saveProfile([], 'Live', liveModel);
        const back = parseProfiles(serializeProfiles(list));
        expect(back).toEqual([{name: 'Live', model: normalize(liveModel)}]);
    });

    it('overwrites an existing name in place and appends new names', () => {
        let list = saveProfile([], 'A', liveModel);
        list = saveProfile(list, 'B', defaultModel());
        list = saveProfile(list, ' A ', buildPreset('small', 'mono'));
        expect(list.map(p => p.name)).toEqual(['A', 'B']);
        expect(findProfile(list, 'A').model).toEqual(normalize(buildPreset('small', 'mono')));
        expect(saveProfile(list, '  ', liveModel)).toBeNull();
    });

    it('does not alias the saved model', () => {
        const model = defaultModel();
        const list = saveProfile([], 'A', model);
        model.shape.bold = !model.shape.bold;
        expect(list[0].model.shape.bold).not.toBe(model.shape.bold);
    });

    it('deletes and renames, refusing collisions', () => {
        let list = saveProfile(saveProfile([], 'A', liveModel), 'B', liveModel);
        expect(renameProfile(list, 'A', 'B')).toBeNull();
        expect(renameProfile(list, 'A', ' ')).toBeNull();
        expect(renameProfile(list, 'zzz', 'C')).toBeNull();
        expect(renameProfile(list, 'A', 'C').map(p => p.name)).toEqual(['C', 'B']);
        expect(renameProfile(list, 'A', 'A').map(p => p.name)).toEqual(['A', 'B']);
        list = deleteProfile(list, 'A');
        expect(list.map(p => p.name)).toEqual(['B']);
    });

    it('treats malformed stored JSON as empty and skips bad entries', () => {
        expect(parseProfiles('')).toEqual([]);
        expect(parseProfiles('{nope')).toEqual([]);
        expect(parseProfiles('[1,2]')).toEqual([]);
        expect(parseProfiles('"x"')).toEqual([]);
        const good = normalize(liveModel);
        const json = JSON.stringify({good, bad: 5, noVersion: {shape: {}}, ' padded ': good});
        expect(parseProfiles(json).map(p => p.name)).toEqual(['good']);
    });

    it('handles a __proto__ name safely', () => {
        const list = saveProfile([], '__proto__', liveModel);
        expect(parseProfiles(serializeProfiles(list)).map(p => p.name)).toEqual(['__proto__']);
    });
});
