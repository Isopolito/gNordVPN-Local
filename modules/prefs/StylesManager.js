import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';

import {CORNERS, GROUPS, GROUP_OF, SPACING_PRESETS, STATE_KEYS, clone, serialize} from '../style/AppearanceModel.js';
import {compile} from '../style/StyleCompiler.js';
import {loadModel} from '../style/ModelLoader.js';
import {SIZE_PRESETS, THEME_PRESETS, applySize, applyTheme} from '../style/Presets.js';
import {render} from '../PanelText.js';

// Tokens that render in the CONNECTED panel text.
export const TOKENS = [
    'country', 'COUNTRY', 'ctry', 'city', 'CITY', 'number', 'server', 'ip', 'tech', 'protocol',
    'transfer', 'transferUp', 'transferDown', 'uptime', 'uptimeHr', 'uptimeMin', 'uptimeSec',
];

const GROUP_TITLES = {
    connected: 'Connected',
    transitioning: 'Transitioning',
    disconnected: 'Disconnected',
    error: 'Error',
    loggedOut: 'Logged out',
};

const CORNER_ITEMS = [['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']];
const SPACING_ITEMS = [['compact', 'Compact'], ['normal', 'Normal'], ['roomy', 'Roomy'], ['custom', 'Custom']];
const SIZE_KEYS = Object.keys(SIZE_PRESETS);
const THEME_KEYS = Object.keys(THEME_PRESETS);

// Fixed values the preview renders tokens with, shaped like the Vpn status the panel gets.
export const SAMPLE_STATUS = {
    currentServer: 'us1234.nordvpn.com',
    country: 'United States',
    city: 'New York',
    serverNumber: '1234',
    serverIp: '203.0.113.7',
    currentTech: 'NORDLYNX',
    currentProtocol: 'UDP',
    transfer: '1.25 GiB received; 340.00 MiB sent',
    uptime: '1 hour 2 minutes 3 seconds',
};

const PREVIEW_CLASS = 'gnordvpn-preview';
const PREVIEW_STRIP_CLASS = 'gnordvpn-preview-strip';
const PREVIEW_STRIP_CSS = `.${PREVIEW_STRIP_CLASS} { background-color: #241f31; padding: 12px; border-radius: 6px; }`;

const stateTitle = (key) => key.charAt(0) + key.slice(1).toLowerCase().replace(/_(.)/g, (_, ch) => ` ${ch}`);
const pxOf = (value) => parseFloat(value) || 0;

export default class StylesManager {
    constructor(settings) {
        this._settings = settings;
        this._model = null;
        this._syncing = 0;
        this._sync = [];
        this._previewState = 'CONNECTED';
        this._previewLabel = null;
        this._provider = null;
        this._providerDisplay = null;
    }

    // Adds the Styles groups to an Adw.PreferencesPage. Opening only reads settings; edits write.
    fillStylesPage(page) {
        this._model = loadModel({
            appearanceJson: this._settings.get_string('panel-appearance'),
            panelStyles: this._settings.get_value('panel-styles').deep_unpack(),
            commonCss: this._settings.get_string('common-panel-style'),
        }).model;

        page.add(this._createPreviewGroup(page));
        page.add(this._createPresetsGroup());
        page.add(this._createShapeGroup());
        page.add(this._createColorsGroup());
        page.add(this._createAdvancedGroup());
        this._syncUi();
    }

    // ---- model plumbing ---------------------------------------------------------------------

    // Runs a model edit, then writes the model and what it compiles to.
    _edit(change) {
        if (this._syncing) return;
        change(this._model);
        this._commit();
        this._syncUi();
    }

    _replaceModel(model) {
        this._model = model;
        this._commit();
        this._syncUi();
    }

    _commit() {
        const {panelStyles, commonCss} = compile(this._model);
        this._settings.set_string('panel-appearance', serialize(this._model));
        this._settings.set_value('panel-styles', new GLib.Variant('a{sa{ss}}', panelStyles));
        this._settings.set_string('common-panel-style', commonCss);
    }

    // Pushes the model into every widget without triggering writes.
    _syncUi() {
        this._syncing++;
        try {
            this._sync.forEach(fn => fn(this._model));
        } finally {
            this._syncing--;
        }
    }

    // ---- small widget builders --------------------------------------------------------------

    _createColorButton(read, write) {
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({with_alpha: true}),
            valign: Gtk.Align.CENTER,
        });
        button.connect('notify::rgba', () => {
            if (this._syncing) return;
            const color = button.rgba.to_string();
            this._edit(model => write(model, color));
        });
        this._sync.push(model => {
            const next = this._parseColor(read(model));
            if (button.rgba?.to_string() !== next.to_string()) button.rgba = next;
        });
        return button;
    }

    _parseColor(css) {
        const rgba = new Gdk.RGBA();
        if (!rgba.parse(css)) rgba.parse('rgba(0,0,0,0)');
        return rgba;
    }

    _createColorRow(title, read, write) {
        const row = new Adw.ActionRow({title});
        row.add_suffix(this._createColorButton(read, write));
        return row;
    }

    _createEntryRow(title, read, write) {
        const row = new Adw.EntryRow({title});
        row.connect('changed', () => {
            if (this._syncing) return;
            const text = row.get_text();
            this._edit(model => write(model, text));
        });
        this._sync.push(model => {
            const next = read(model);
            if (row.get_text() !== next) row.set_text(next);
        });
        return row;
    }

    _createComboRow(title, items, read, write) {
        const row = new Adw.ComboRow({
            title,
            model: new Gtk.StringList({strings: items.map(([, label]) => label)}),
        });
        row.connect('notify::selected', () => {
            if (this._syncing) return;
            const key = items[row.selected]?.[0];
            if (key !== undefined) this._edit(model => write(model, key));
        });
        this._sync.push(model => {
            const index = items.findIndex(([key]) => key === read(model));
            if (index >= 0 && row.selected !== index) row.selected = index;
        });
        return row;
    }

    _createSwitchRow(title, read, write) {
        const row = new Adw.SwitchRow({title});
        row.connect('notify::active', () => {
            if (this._syncing) return;
            const active = row.active;
            this._edit(model => write(model, active));
        });
        this._sync.push(model => {
            if (row.active !== read(model)) row.active = read(model);
        });
        return row;
    }

    _createSpinRow(title, read, write) {
        const row = new Adw.SpinRow({
            title,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 1, page_increment: 5, value: 0}),
        });
        row.connect('notify::value', () => {
            if (this._syncing) return;
            const value = Math.round(row.value);
            this._edit(model => write(model, `${value}px`));
        });
        this._sync.push(model => {
            const next = pxOf(read(model));
            if (row.value !== next) row.value = next;
        });
        return row;
    }

    // ---- preview ----------------------------------------------------------------------------

    // The text and CSS the panel would show for `key`, from the model alone. Never touches settings.
    _previewOf(key) {
        const {panelStyles, commonCss} = compile(this._model);
        const {panelText, css} = panelStyles[key];
        const text = GROUP_OF[key] === 'connected' ? render(panelText, SAMPLE_STATUS) : panelText;
        return {text, css: `${commonCss} ${css}`.trim()};
    }

    _createPreviewGroup(page) {
        const group = new Adw.PreferencesGroup({
            title: 'Preview',
            description: 'Approximate: GTK CSS and GNOME Shell CSS differ slightly.',
        });

        // Choosing the previewed state is not a model edit, so it never goes through _edit/_commit.
        const stateRow = new Adw.ComboRow({
            title: 'State',
            model: new Gtk.StringList({strings: STATE_KEYS.map(stateTitle)}),
        });
        stateRow.selected = STATE_KEYS.indexOf(this._previewState);
        stateRow.connect('notify::selected', () => {
            this._previewState = STATE_KEYS[stateRow.selected] ?? this._previewState;
            this._refreshPreview();
        });
        group.add(stateRow);

        const strip = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, halign: Gtk.Align.CENTER});
        strip.add_css_class(PREVIEW_STRIP_CLASS);
        this._previewLabel = new Gtk.Label({halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER});
        this._previewLabel.add_css_class(PREVIEW_CLASS);
        strip.append(this._previewLabel);
        const stripRow = new Adw.PreferencesRow({child: strip});
        group.add(stripRow);

        this._provider = new Gtk.CssProvider();
        // GTK rejects some St-only CSS; that must not spam the prefs log.
        this._provider.connect('parsing-error', () => {});
        page.connect('realize', () => this._installProvider());
        page.connect('unrealize', () => this._removeProvider());
        page.connect('destroy', () => this._removeProvider());

        this._sync.push(() => this._refreshPreview());
        return group;
    }

    _refreshPreview() {
        if (!this._previewLabel || !this._model) return;
        const {text, css} = this._previewOf(this._previewState);
        this._previewLabel.set_text(text);
        this._provider.load_from_string(`${PREVIEW_STRIP_CSS}\n.${PREVIEW_CLASS} { ${css} }`);
    }

    _installProvider() {
        if (this._providerDisplay) return;
        const display = Gdk.Display.get_default();
        if (!display) return;
        Gtk.StyleContext.add_provider_for_display(display, this._provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        this._providerDisplay = display;
    }

    // Takes the page-scoped provider off the display so nothing outlives the page.
    _removeProvider() {
        if (!this._providerDisplay) return;
        Gtk.StyleContext.remove_provider_for_display(this._providerDisplay, this._provider);
        this._providerDisplay = null;
    }

    // ---- advanced ---------------------------------------------------------------------------

    _createAdvancedGroup() {
        const group = new Adw.PreferencesGroup();
        const expander = new Adw.ExpanderRow({
            title: 'Custom CSS (advanced)',
            subtitle: 'Added after the generated CSS, so it wins.',
            expanded: false,
        });

        const view = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            monospace: true,
            top_margin: 8,
            bottom_margin: 8,
            left_margin: 8,
            right_margin: 8,
        });
        const buffer = view.get_buffer();
        buffer.connect('changed', () => {
            if (this._syncing) return;
            const text = buffer.text;
            this._edit(model => { model.advanced.common = text; });
        });
        this._sync.push(model => {
            if (buffer.text !== model.advanced.common) buffer.set_text(model.advanced.common, -1);
        });
        const scroller = new Gtk.ScrolledWindow({
            min_content_height: 96,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            child: view,
        });
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6, margin_top: 6, margin_bottom: 6, margin_start: 12, margin_end: 12});
        const caption = new Gtk.Label({label: 'Applies to every state', xalign: 0});
        caption.add_css_class('dim-label');
        box.append(caption);
        box.append(scroller);
        expander.add_row(new Adw.PreferencesRow({child: box}));

        const perState = new Adw.ExpanderRow({title: 'Per-state extra CSS', expanded: false});
        STATE_KEYS.forEach(key => {
            perState.add_row(this._createEntryRow(`${stateTitle(key)} extra CSS`,
                model => model.advanced.states[key] ?? '',
                (model, css) => {
                    if (css.trim() === '') delete model.advanced.states[key];
                    else model.advanced.states[key] = css;
                }));
        });
        expander.add_row(perState);

        group.add(expander);
        return group;
    }

    // ---- presets ----------------------------------------------------------------------------

    _createPresetsGroup() {
        const group = new Adw.PreferencesGroup({
            title: 'Presets',
            description: 'Size sets the panel text. Theme sets the colors and shape. Each only changes its own settings.',
        });

        const size = new Adw.ComboRow({
            title: 'Size',
            model: new Gtk.StringList({strings: SIZE_KEYS.map(key => SIZE_PRESETS[key].label)}),
        });
        size.selected = SIZE_KEYS.indexOf('large');
        const applySizeButton = new Gtk.Button({label: 'Apply size', valign: Gtk.Align.CENTER});
        applySizeButton.connect('clicked', () => this._replaceModel(applySize(this._model, SIZE_KEYS[size.selected])));
        size.add_suffix(applySizeButton);
        group.add(size);

        const theme = new Adw.ComboRow({
            title: 'Theme',
            model: new Gtk.StringList({strings: THEME_KEYS.map(key => THEME_PRESETS[key].label)}),
        });
        const applyThemeButton = new Gtk.Button({label: 'Apply theme', valign: Gtk.Align.CENTER});
        applyThemeButton.connect('clicked', () => this._replaceModel(applyTheme(this._model, THEME_KEYS[theme.selected])));
        theme.add_suffix(applyThemeButton);
        group.add(theme);

        return group;
    }

    // ---- shape ------------------------------------------------------------------------------

    _createShapeGroup() {
        const group = new Adw.PreferencesGroup({title: 'Shape'});

        group.add(this._createComboRow('Corners', CORNER_ITEMS,
            model => model.shape.corner,
            (model, key) => { model.shape.corner = Object.hasOwn(CORNERS, key) ? key : model.shape.corner; }));

        group.add(this._createSwitchRow('Bold text',
            model => model.shape.bold,
            (model, active) => { model.shape.bold = active; }));

        group.add(this._createSwitchRow('Border',
            model => model.shape.border.enabled,
            (model, active) => { model.shape.border.enabled = active; }));

        const borderColor = this._createColorRow('Border color',
            model => model.shape.border.color,
            (model, color) => { model.shape.border.color = color; });
        this._sync.push(model => { borderColor.visible = model.shape.border.enabled; });
        group.add(borderColor);

        group.add(this._createComboRow('Spacing', SPACING_ITEMS,
            model => model.shape.spacing,
            (model, key) => {
                model.shape.spacing = key;
                if (key !== 'custom') {
                    model.shape.padding = clone(SPACING_PRESETS[key].padding);
                    model.shape.margin = clone(SPACING_PRESETS[key].margin);
                }
            }));

        const sides = (field, title, sidesOf) => {
            const row = this._createSpinRow(title,
                model => model.shape[field][sidesOf[0]],
                (model, value) => {
                    sidesOf.forEach(side => { model.shape[field][side] = value; });
                    model.shape.spacing = 'custom';
                });
            this._sync.push(model => { row.visible = model.shape.spacing === 'custom'; });
            group.add(row);
        };
        sides('padding', 'Padding top (px)', ['top']);
        sides('padding', 'Padding bottom (px)', ['bottom']);
        sides('padding', 'Padding horizontal (px)', ['left', 'right']);
        sides('margin', 'Margin top (px)', ['top']);
        sides('margin', 'Margin bottom (px)', ['bottom']);
        sides('margin', 'Margin horizontal (px)', ['left', 'right']);

        return group;
    }

    // ---- state colors -----------------------------------------------------------------------

    _createColorsGroup() {
        const group = new Adw.PreferencesGroup({
            title: 'State colors',
            description: 'Colors and text for each connection state.',
        });
        GROUPS.forEach(name => group.add(this._createStateGroupRow(name)));
        return group;
    }

    _createStateGroupRow(name) {
        const members = STATE_KEYS.filter(key => GROUP_OF[key] === name);
        const row = new Adw.ExpanderRow({title: GROUP_TITLES[name], subtitle: members.map(stateTitle).join(', ')});

        const textRow = this._createEntryRow('Panel text',
            model => model.groups[name].text,
            (model, text) => { model.groups[name].text = text; });
        if (name === 'connected') textRow.add_suffix(this._createTokenButton(textRow));
        row.add_row(textRow);

        row.add_row(this._createColorRow('Background color',
            model => model.groups[name].bg,
            (model, color) => { model.groups[name].bg = color; }));
        row.add_row(this._createColorRow('Text color',
            model => model.groups[name].fg,
            (model, color) => { model.groups[name].fg = color; }));

        if (members.length > 1) row.add_row(this._createOverridesRow(members));
        return row;
    }

    _createOverridesRow(members) {
        const section = new Adw.ExpanderRow({title: 'Customize individual states'});
        members.forEach(key => section.add_row(this._createOverrideRow(key)));
        return section;
    }

    _createOverrideRow(key) {
        const row = new Adw.ExpanderRow({title: stateTitle(key)});
        const setOverride = (model, field, value) => {
            const entry = {...(model.overrides[key] ?? {})};
            if (value === '') delete entry[field];
            else entry[field] = value;
            if (Object.keys(entry).length) model.overrides[key] = entry;
            else delete model.overrides[key];
        };

        const reset = new Gtk.Button({icon_name: 'edit-clear-symbolic', tooltip_text: 'Use the group settings', valign: Gtk.Align.CENTER});
        reset.add_css_class('flat');
        reset.connect('clicked', () => this._edit(model => { delete model.overrides[key]; }));
        row.add_suffix(reset);
        this._sync.push(model => { reset.sensitive = key in model.overrides; });

        // Blank text means "inherit the group's text".
        row.add_row(this._createEntryRow('Panel text',
            model => model.overrides[key]?.text ?? '',
            (model, text) => setOverride(model, 'text', text)));
        row.add_row(this._createColorRow('Background color',
            model => model.overrides[key]?.bg ?? model.groups[GROUP_OF[key]].bg,
            (model, color) => setOverride(model, 'bg', color)));
        row.add_row(this._createColorRow('Text color',
            model => model.overrides[key]?.fg ?? model.groups[GROUP_OF[key]].fg,
            (model, color) => setOverride(model, 'fg', color)));
        return row;
    }

    // ---- tokens -----------------------------------------------------------------------------

    _createTokenButton(entry) {
        const list = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2});
        const scroller = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            min_content_height: 240,
            min_content_width: 160,
        });
        const popover = new Gtk.Popover();

        TOKENS.forEach(token => {
            const item = new Gtk.Button({label: `{${token}}`});
            item.add_css_class('flat');
            item.connect('clicked', () => {
                this.insertToken(entry, `{${token}}`);
                popover.popdown();
            });
            list.append(item);
        });
        scroller.set_child(list);
        popover.set_child(scroller);

        return new Gtk.MenuButton({
            icon_name: 'insert-text-symbolic',
            tooltip_text: 'Insert a token',
            valign: Gtk.Align.CENTER,
            popover,
        });
    }

    // Inserts `text` into an editable at the cursor and moves the cursor past it.
    insertToken(entry, text) {
        // GTK positions count characters (code points), not UTF-16 units.
        const chars = Array.from(entry.get_text());
        const position = Math.min(Math.max(entry.get_position(), 0), chars.length);
        entry.set_text(chars.slice(0, position).join('') + text + chars.slice(position).join(''));
        entry.set_position(position + Array.from(text).length);
    }
}
