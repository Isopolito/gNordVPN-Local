import {createFakeProcCom} from '../../helpers/vpn.js';   // first: patches the gi stubs Vpn.js needs
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {FakeSettings} from '../../helpers/FakeSettings.js';
import {fakes, resetRegistry, findAll, createWindow, installedProviders} from '../../helpers/fakeGtk.js';
import GnordVpnPrefs from '../../../modules/prefs/GnordVpnPrefs.js';
import StylesManager, {TOKENS, SAMPLE_STATUS} from '../../../modules/prefs/StylesManager.js';
import {STATE_KEYS, parseStored, resolveState, serialize} from '../../../modules/style/AppearanceModel.js';
import {loadModel} from '../../../modules/style/ModelLoader.js';
import {render} from '../../../modules/PanelText.js';
import {compile, sameStyles} from '../../../modules/style/StyleCompiler.js';
import {parse} from '../../../modules/style/LegacyStyleParser.js';
import {SIZE_PRESETS, buildPreset} from '../../../modules/style/Presets.js';
import {legacyGenerate} from '../../helpers/legacyStyles.js';

const {RGBA} = fakes;

const colorOf = (css) => { const c = new RGBA(); c.parse(css); return c; };
const legacyArgs = (legacy) => ({
    'panel-styles': legacy.panelStyles,
    'common-panel-style': legacy.commonCss,
});

// Opens the real Styles page against FakeSettings.
function openPage(overrides = {}) {
    resetRegistry();
    const settings = new FakeSettings(overrides);
    const page = new Adw.PreferencesPage();
    const manager = new StylesManager(settings);
    manager.fillStylesPage(page);
    settings.writes.length = 0;
    const byTitle = (Class, title) => {
        const found = findAll(Class).find(w => w.title === title);
        if (!found) throw new Error(`no ${Class.name} '${title}'`);
        return found;
    };
    // The color button in the row of a given title, inside an expander of a given title.
    const colorButton = (expanderTitle, rowTitle) => {
        const expander = byTitle(Adw.ExpanderRow, expanderTitle);
        const row = expander.children.find(c => c.title === rowTitle);
        return row.children.find(c => c instanceof fakes.ColorDialogButton);
    };
    const stored = () => parseStored(settings.get_string('panel-appearance'));
    const compiled = () => ({
        panelStyles: settings.get_value('panel-styles').deep_unpack(),
        commonCss: settings.get_string('common-panel-style'),
    });
    return {settings, page, manager, byTitle, colorButton, stored, compiled};
}

void createFakeProcCom;
const rowOf = (expander, title) => expander.children.find(c => c.title === title);
const click = (button) => button.emit('clicked');
const applyButton = (combo) => combo.children.find(c => c instanceof Gtk.Button);

describe('StylesManager', () => {
    describe('opening the page', () => {
        it('adds the preview, presets, shape, state color and advanced groups', () => {
            const {page} = openPage();
            const titles = page.children.map(g => g.title);
            expect(titles).toEqual(['Preview', 'Presets', 'Shape', 'State colors', undefined]);
        });

        it('performs zero settings writes when panel-appearance is empty', () => {
            resetRegistry();
            const settings = new FakeSettings();
            new StylesManager(settings).fillStylesPage(new Adw.PreferencesPage());
            expect(settings.writes).toEqual([]);
            expect(settings.get_string('panel-appearance')).toBe('');
        });

        it('shows the parsed legacy colors without writing', () => {
            const legacy = legacyGenerate('large', 'trafficLight');
            const {colorButton, settings} = openPage(legacyArgs(legacy));
            expect(colorButton('Connected', 'Background color').rgba.to_string()).toBe('rgba(0,255,0,0.7)');
            expect(settings.writes).toEqual([]);
        });

        it('loads the re-parsed legacy model when panel-appearance no longer matches, with zero writes', () => {
            const stale = buildPreset('small', 'mono');
            const legacy = legacyGenerate('extraLarge', 'outline');
            resetRegistry();
            const settings = new FakeSettings({'panel-appearance': serialize(stale), ...legacyArgs(legacy)});
            const manager = new StylesManager(settings);
            manager.fillStylesPage(new Adw.PreferencesPage());
            expect(settings.writes).toEqual([]);
            expect(manager._model).toEqual(parse(legacy.panelStyles, legacy.commonCss));
            expect(resolveState(manager._model, 'CONNECTING').text).toBe('VPN CONNECTING');
        });

        it('keeps a matching panel-appearance, including advanced CSS', () => {
            const model = buildPreset('large', 'trafficLight');
            model.advanced.common = 'opacity: 0.9;';
            const compiled = compile(model);
            resetRegistry();
            const settings = new FakeSettings({
                'panel-appearance': serialize(model),
                'panel-styles': compiled.panelStyles,
                'common-panel-style': compiled.commonCss,
            });
            const manager = new StylesManager(settings);
            manager.fillStylesPage(new Adw.PreferencesPage());
            expect(manager._model).toEqual(model);
            expect(settings.writes).toEqual([]);
        });

        it('is built by GnordVpnPrefs.fillPreferencesWindow through fillStylesPage', async () => {
            const calls = [];
            const original = StylesManager.prototype.fillStylesPage;
            StylesManager.prototype.fillStylesPage = function (page) { calls.push(page); return original.call(this, page); };
            try {
                resetRegistry();
                const settings = new FakeSettings();
                const prefs = new GnordVpnPrefs(settings, {name: 'x', version: '1'});
                prefs._vpn.setSettingsFromNord = () => Promise.resolve();
                prefs.fillPreferencesWindow(createWindow());
                expect(calls).toHaveLength(1);
                expect(calls[0].calls).toContainEqual(['set_title', 'Styles']);
                expect(settings.writes.filter(([k]) => /panel-|common-panel/.test(k))).toEqual([]);
            } finally {
                StylesManager.prototype.fillStylesPage = original;
            }
        });
    });

    describe('edits', () => {
        it('a color change writes panel-appearance, panel-styles and common-panel-style consistently', () => {
            const {colorButton, settings, stored, compiled} = openPage();
            colorButton('Connected', 'Background color').rgba = colorOf('rgba(1,2,3,0.5)');

            expect(settings.writes.map(([k]) => k).sort()).toEqual(['common-panel-style', 'panel-appearance', 'panel-styles']);
            const model = stored();
            expect(model.groups.connected.bg).toBe('rgba(1,2,3,0.5)');
            expect(sameStyles(compiled(), compile(model))).toBe(true);
            expect(compiled().panelStyles.CONNECTED.css).toContain('background-color: rgba(1,2,3,0.5);');
        });

        it('a shape change updates the compiled common CSS', () => {
            const {byTitle, compiled} = openPage();
            byTitle(Adw.ComboRow, 'Corners').selected = 2;   // square
            expect(compiled().commonCss).toContain('border-radius: 0;');
            byTitle(Adw.SwitchRow, 'Border').active = true;
            expect(compiled().commonCss).toContain('border: 1px solid white;');
        });

        it('choosing Custom spacing reveals the spin rows and editing one writes px', () => {
            const {byTitle, compiled, stored} = openPage();
            const top = byTitle(Adw.SpinRow, 'Padding top (px)');
            expect(top.visible).toBe(false);
            byTitle(Adw.ComboRow, 'Spacing').selected = 3;
            expect(top.visible).toBe(true);
            top.value = 9;
            expect(stored().shape.padding.top).toBe('9px');
            expect(stored().shape.spacing).toBe('custom');
            expect(compiled().commonCss).toContain('padding: 9px');
        });

        it('a panel text edit and a per-state override edit write the compiled text', () => {
            const {byTitle, compiled} = openPage();
            const connected = byTitle(Adw.ExpanderRow, 'Connected').children[0];
            connected.set_text('hello');
            expect(compiled().panelStyles.CONNECTED.panelText).toBe('hello');

            const customize = byTitle(Adw.ExpanderRow, 'Customize individual states');
            const reconnecting = customize.children.find(c => c.title === 'Reconnecting');
            rowOf(reconnecting, 'Panel text').set_text('RE');
            expect(compiled().panelStyles.RECONNECTING.panelText).toBe('RE');
            expect(compiled().panelStyles.CONNECTING.panelText).toBe('CONNECTING');
        });

        it('the reset button clears a state override and is only on the Transitioning group', () => {
            const {byTitle, compiled, stored} = openPage();
            expect(findAll(Adw.ExpanderRow).filter(r => r.title === 'Customize individual states')).toHaveLength(1);

            const customize = byTitle(Adw.ExpanderRow, 'Customize individual states');
            const row = customize.children.find(c => c.title === 'Logging in');
            const reset = row.children.find(c => c instanceof Gtk.Button);
            expect(reset.sensitive).toBe(true);        // Large has a distinct LOGGING IN label
            click(reset);
            expect(stored().overrides.LOGGING_IN).toBeUndefined();
            expect(compiled().panelStyles.LOGGING_IN.panelText).toBe('CONNECTING');
            expect(reset.sensitive).toBe(false);
        });
    });

    describe('presets', () => {
        it.each(Object.keys(SIZE_PRESETS))('Apply size %s reproduces every preset text and leaves the rest alone', (size) => {
            const {byTitle, stored, compiled, manager} = openPage();
            // Set up something Apply size must not touch.
            byTitle(Adw.ComboRow, 'Corners').selected = 1;
            rowOf(byTitle(Adw.ExpanderRow, 'Disconnected'), 'Background color').children[0].rgba = colorOf('rgba(9,9,9,1)');
            const before = stored();

            byTitle(Adw.ComboRow, 'Size').selected = Object.keys(SIZE_PRESETS).indexOf(size);
            click(applyButton(byTitle(Adw.ComboRow, 'Size')));

            const model = stored();
            STATE_KEYS.forEach(key => {
                expect(resolveState(model, key).text).toBe(SIZE_PRESETS[size].panelTexts[key]);
                expect(compiled().panelStyles[key].panelText).toBe(SIZE_PRESETS[size].panelTexts[key]);
            });
            expect(model.shape).toEqual(before.shape);
            expect(model.advanced).toEqual(before.advanced);
            STATE_KEYS.forEach(key => {
                const a = resolveState(model, key);
                const b = resolveState(before, key);
                expect([a.bg, a.fg]).toEqual([b.bg, b.fg]);
            });
            expect(manager._model).toEqual(model);
        });

        it('Apply theme changes colors and shape and clears only color overrides', () => {
            const {byTitle, stored, manager} = openPage();
            // Advanced CSS has no UI yet, so seed it (and mixed overrides) through the model.
            const advanced = {common: 'opacity: 0.5;', states: {CONNECTED: 'x: y;'}};
            manager._model.advanced = advanced;
            manager._model.overrides = {RECONNECTING: {text: 'RE', bg: 'rgba(7,7,7,1)', fg: 'rgba(8,8,8,1)'}};
            const before = JSON.parse(JSON.stringify(manager._model));

            byTitle(Adw.ComboRow, 'Theme').selected = 1;   // outline
            click(applyButton(byTitle(Adw.ComboRow, 'Theme')));

            const model = stored();
            expect(model.shape.corner).toBe('rounded');
            expect(model.shape.border.enabled).toBe(true);
            expect(model.groups.connected.fg).toBe('rgba(0,255,0,0.7)');
            expect(model.overrides).toEqual({RECONNECTING: {text: 'RE'}});
            STATE_KEYS.forEach(key => expect(resolveState(model, key).text).toBe(resolveState(before, key).text));
            expect(model.advanced).toEqual(advanced);
        });

        it('syncs the controls to the applied preset without extra writes', () => {
            const {byTitle, settings} = openPage();
            byTitle(Adw.ComboRow, 'Theme').selected = 1;
            click(applyButton(byTitle(Adw.ComboRow, 'Theme')));
            expect(settings.writes.map(([k]) => k)).toEqual(['panel-appearance', 'panel-styles', 'common-panel-style']);
            expect(byTitle(Adw.ComboRow, 'Corners').selected).toBe(1);
            expect(byTitle(Adw.SwitchRow, 'Border').active).toBe(true);
        });
    });

    describe('tokens', () => {
        it('inserts a token at the cursor position', () => {
            const {byTitle, compiled} = openPage();
            const entry = byTitle(Adw.ExpanderRow, 'Connected').children[0];
            entry.set_text('ab');
            entry.set_position(1);
            const menu = entry.children.find(c => c instanceof Gtk.MenuButton);
            const items = menu.popover.child.child.children;
            expect(items.map(i => i.label)).toEqual(TOKENS.map(t => `{${t}}`));
            click(items[TOKENS.indexOf('city')]);

            expect(entry.get_text()).toBe('a{city}b');
            expect(entry.get_position()).toBe(7);
            expect(compiled().panelStyles.CONNECTED.panelText).toBe('a{city}b');
        });

        it('treats the cursor position as code points when an emoji precedes it', () => {
            const {byTitle} = openPage();
            const entry = byTitle(Adw.ExpanderRow, 'Connected').children[0];
            entry.set_text('😀ab');
            entry.set_position(2);   // after the emoji and 'a'
            const menu = entry.children.find(c => c instanceof Gtk.MenuButton);
            click(menu.popover.child.child.children[TOKENS.indexOf('city')]);

            expect(entry.get_text()).toBe('😀a{city}b');
            expect(entry.get_position()).toBe(8);
        });

        it('only the Connected group has a token menu', () => {
            openPage();
            expect(findAll(Gtk.MenuButton)).toHaveLength(1);
        });
    });

    describe('live preview', () => {
        const previewLabel = () => findAll(Gtk.Label).find(l => l.cssClasses?.includes('gnordvpn-preview'));
        const provider = () => findAll(Gtk.CssProvider)[0];
        const previewState = (byTitle, index) => { byTitle(Adw.ComboRow, 'State').selected = index; };
        const expected = (model, key) => {
            const {panelStyles, commonCss} = compile(model);
            const text = resolveState(model, key).text;
            return {
                text: key === 'CONNECTED' ? render(text, SAMPLE_STATUS) : text,
                css: `${commonCss} ${panelStyles[key].css}`.trim(),
                raw: panelStyles[key].panelText,
            };
        };

        it('is the first group and says it is approximate', () => {
            const {page} = openPage();
            expect(page.children[0].title).toBe('Preview');
            expect(page.children[0].description).toMatch(/approximate/i);
        });

        it.each(STATE_KEYS.map((key, i) => [key, i]))('%s preview text and CSS match StyleCompiler and PanelText', (key, index) => {
            const {byTitle, settings} = openPage();
            previewState(byTitle, index);
            const want = expected(loadModel({appearanceJson: settings.get_string('panel-appearance'), panelStyles: settings.get_value('panel-styles').deep_unpack(), commonCss: settings.get_string('common-panel-style')}).model, key);
            expect(previewLabel().text).toBe(want.text);
            expect(provider().css).toContain(`.gnordvpn-preview { ${want.css} }`);
        });

        it('renders tokens with the fixed sample status for the connected state', () => {
            const {byTitle} = openPage();
            byTitle(Adw.ExpanderRow, 'Connected').children[0].set_text('{country} {number} {tech} {uptime}');
            expect(previewLabel().text).toBe('United States 1234 NORDLYNX 1 hour 2 minutes 3 seconds');
        });

        it('re-renders on every model change and never writes a setting itself', () => {
            const {byTitle, colorButton, settings} = openPage();
            colorButton('Connected', 'Background color').rgba = colorOf('rgba(1,2,3,0.5)');
            expect(provider().css).toContain('background-color: rgba(1,2,3,0.5);');
            settings.writes.length = 0;
            byTitle(Adw.ComboRow, 'State').selected = 3;
            byTitle(Adw.ComboRow, 'State').selected = 0;
            expect(settings.writes).toEqual([]);
        });

        it('adds the page-scoped provider on realize and removes it on unrealize and destroy', () => {
            const {page} = openPage();
            expect(installedProviders()).toEqual([]);
            page.emit('realize');
            page.emit('realize');
            expect(installedProviders()).toEqual([provider()]);
            page.emit('unrealize');
            expect(installedProviders()).toEqual([]);
            page.emit('realize');
            page.emit('destroy');
            expect(installedProviders()).toEqual([]);
        });
    });

    describe('advanced CSS', () => {
        const commonView = () => findAll(Gtk.TextView)[0];

        it('is collapsed by default', () => {
            const {byTitle} = openPage();
            expect(byTitle(Adw.ExpanderRow, 'Custom CSS (advanced)').expanded).toBe(false);
        });

        it('shows stored advanced CSS without writing', () => {
            const model = buildPreset('large', 'trafficLight');
            model.advanced.common = 'opacity: 0.9;';
            const {settings} = openPage({'panel-appearance': serialize(model), ...legacyArgs(compile(model))});
            expect(commonView().get_buffer().text).toBe('opacity: 0.9;');
            expect(settings.writes).toEqual([]);
        });

        it('common CSS edits are appended last in the compiled common CSS', () => {
            const {compiled, stored} = openPage();
            commonView().get_buffer().set_text('opacity: 0.9', -1);
            expect(stored().advanced.common).toBe('opacity: 0.9');
            expect(compiled().commonCss.endsWith('opacity: 0.9;')).toBe(true);
            expect(compiled().commonCss.indexOf('border-radius')).toBeLessThan(compiled().commonCss.indexOf('opacity'));
        });

        it('per-state extra CSS is appended last in that state CSS only', () => {
            const {byTitle, compiled, stored} = openPage();
            rowOf(byTitle(Adw.ExpanderRow, 'Per-state extra CSS'), 'Connected extra CSS').set_text('letter-spacing: 1px');
            expect(stored().advanced.states.CONNECTED).toBe('letter-spacing: 1px');
            expect(compiled().panelStyles.CONNECTED.css.endsWith('letter-spacing: 1px;')).toBe(true);
            expect(compiled().panelStyles.ERROR.css).not.toContain('letter-spacing');
            rowOf(byTitle(Adw.ExpanderRow, 'Per-state extra CSS'), 'Connected extra CSS').set_text('');
            expect(stored().advanced.states.CONNECTED).toBeUndefined();
        });

        it('advanced edits show up in the preview', () => {
            const {byTitle} = openPage();
            commonView().get_buffer().set_text('opacity: 0.9', -1);
            expect(findAll(Gtk.CssProvider)[0].css).toContain('opacity: 0.9;');
        });
    });
});
