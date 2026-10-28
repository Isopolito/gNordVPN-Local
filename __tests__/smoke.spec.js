import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listJs(dir) {
    return fs.readdirSync(path.join(root, dir), {withFileTypes: true})
        .flatMap(entry => {
            const rel = path.join(dir, entry.name);
            if (entry.isDirectory()) return listJs(rel);
            return entry.name.endsWith('.js') ? [rel] : [];
        });
}

const files = [...listJs('modules'), 'extension.js', 'prefs.js'].sort();

describe('module load smoke test', () => {
    it('finds the modules, including VpnIndicator and prefs/*', () => {
        expect(files).toEqual(expect.arrayContaining([
            path.join('modules', 'VpnIndicator.js'),
            path.join('modules', 'prefs', 'GnordVpnPrefs.js'),
            path.join('modules', 'prefs', 'StylesManager.js'),
            path.join('modules', 'prefs', 'ResetManager.js'),
        ]));
    });

    it.each(files)('imports %s without throwing', async (file) => {
        const mod = await import(path.join(root, file));
        expect(mod).toBeDefined();
    });
});
