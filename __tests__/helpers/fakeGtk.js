import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {installGLibVariant, installGioBindFlags} from './FakeSettings.js';

// Not a spec: recording stand-ins for the Gtk/Adw widgets the prefs UI builds. Importing this
// module installs them onto the jest gi:// stubs (see __mocks__/gi), so the real
// modules/prefs/*.js can run unmodified.
//
// Widgets are Proxies: assigning any property emits `notify::<prop>` (as GObject does), which is
// what FakeSettings.bind listens to. Unknown snake_case setters/getters (set_hexpand, ...) are
// recorded no-ops, so UI code that only styles widgets doesn't need a stub per method.

export const registry = [];
export const resetRegistry = () => { registry.length = 0; };
export const findAll = (Class) => registry.filter(w => w instanceof Class);

const NOOP_METHOD = /^(set_|get_|add_|remove_|pack_|insert_|attach|append|prepend|show|hide|present)/;
let nextHandlerId = 1;

class Widget {
    constructor(props = {}) {
        Object.assign(this, props);
        Object.defineProperty(this, '_handlers', {value: [], enumerable: false});
        Object.defineProperty(this, 'calls', {value: [], enumerable: false});
        Object.defineProperty(this, 'children', {value: [], enumerable: false});
        if (this.sensitive === undefined) this.sensitive = true;
        const proxy = new Proxy(this, {
            set(target, prop, value, receiver) {
                const old = target[prop];
                Reflect.set(target, prop, value, receiver);
                if (typeof prop === 'string' && !prop.startsWith('_') && old !== value) {
                    proxy.emit(`notify::${prop}`);
                }
                return true;
            },
            get(target, prop, receiver) {
                if (prop in target || typeof prop !== 'string' || !NOOP_METHOD.test(prop)) {
                    return Reflect.get(target, prop, receiver);
                }
                return (...args) => { target.calls.push([prop, ...args]); };
            },
        });
        registry.push(proxy);
        return proxy;
    }

    connect(signal, cb) {
        const id = nextHandlerId++;
        this._handlers.push({id, signal, cb});
        return id;
    }
    disconnect(id) {
        const i = this._handlers.findIndex(h => h.id === id);
        if (i >= 0) this._handlers.splice(i, 1);
    }
    emit(signal, ...args) {
        let result;
        for (const h of [...this._handlers]) if (h.signal === signal) result = h.cb(this, ...args);
        return result;
    }
    set_sensitive(v) { this.sensitive = v; }
    get_sensitive() { return this.sensitive; }
    show() { this.visible = true; }
    get_style_context() { return {add_class: () => {}}; }
    set_child(c) { this.child = c; }
    append(c) { this.children.push(c); }
    add(c) { this.children.push(c); }
}

class Label extends Widget {
    set_text(t) { this.label = t; this.text = t; }
}

class Grid extends Widget {
    attach(child, col, row, w = 1, h = 1) {
        if (!this._cells) Object.defineProperty(this, '_cells', {value: [], enumerable: false});
        this._cells.push({child, col, row, w, h});
    }
    cellAt(col, row) { return this._cells?.find(c => c.col === col && c.row === row)?.child; }
    // The widget in the column right of the Label whose text is `labelText`.
    controlFor(labelText) {
        const cell = this._cells?.find(c => c.child instanceof Label && c.child.label === labelText);
        if (!cell) throw new Error(`No label '${labelText}' in grid`);
        return this.cellAt(cell.col + 1, cell.row);
    }
    hasLabel(labelText) { return !!this._cells?.some(c => c.child instanceof Label && c.child.label === labelText); }
}

class Button extends Widget {
    // Like GTK, a click on an insensitive button does nothing.
    click() { if (this.sensitive) this.emit('clicked'); }
}

class Switch extends Widget {
    // A user toggle: property change (notify::active) plus the state-set signal.
    userSet(v) { this.active = v; this.emit('state-set', v); }
    get_active() { return !!this.active; }
}

class Adjustment extends Widget {}

class SpinButton extends Widget {
    constructor(props) {
        super(props);
        // `this` is the proxy; Widget's constructor returned it
        if (!this.adjustment) this.adjustment = new Adjustment({value: 0});
        if (this.value === undefined) this.value = 0;
    }
    get_adjustment() { return this.adjustment; }
    set_value(v) { this.value = v; }
    get_value() { return this.value; }
}

class ComboBoxText extends Widget {
    append(id, text) {
        if (!this.items) Object.defineProperty(this, 'items', {value: [], enumerable: false});
        this.items.push({id, text});
    }
    set_active_id(id) {
        if (this.activeId === id) return true;
        this.activeId = id;
        this.emit('changed');
        return true;
    }
    get_active_id() { return this.activeId ?? null; }
}

class ListStore extends Widget {
    set_column_types() {}
    append() {
        if (!this.rows) Object.defineProperty(this, 'rows', {value: [], enumerable: false});
        this.rows.push([]);
        return {row: this.rows.length - 1};
    }
    set(iter, cols, vals) { cols.forEach((c, i) => { this.rows[iter.row][c] = vals[i]; }); }
    get_value(iter, col) { return this.rows[iter.row][col]; }
    get_iter(path) { return [path >= 0 && path < (this.rows?.length ?? 0), {row: path}]; }
    clear() { if (this.rows) this.rows.length = 0; }
}
class TreeStore extends ListStore {
    append(_parent) { return super.append(); }
}

class ComboBox extends Widget {
    // Like GTK, 'changed' only fires when the active row actually changes.
    set_active(i) {
        if (this.active === i) return;
        this.active = i;
        this.emit('changed');
    }
    get_active_iter() {
        const ok = this.active !== undefined && this.active >= 0 && this.active < (this.model.rows?.length ?? 0);
        return [ok, ok ? {row: this.active} : null];
    }
}

class TreeSelection extends Widget {
    constructor(model) {
        super();
        Object.defineProperty(this, '_model', {value: model, enumerable: false});
        Object.defineProperty(this, '_rows', {value: new Set(), enumerable: false});
    }
    set_mode() {}
    select_iter(iter) { if (!this._rows.has(iter.row)) { this._rows.add(iter.row); this.emit('changed'); } }
    unselect_all() { if (this._rows.size) { this._rows.clear(); this.emit('changed'); } }
    get_selected_rows() { return [[...this._rows].sort((a, b) => a - b), this._model]; }
    selectedRows() { return [...this._rows].sort((a, b) => a - b); }
}

class TreeView extends Widget {
    get_model() { return this.model; }
    get_selection() {
        if (!this._selection) Object.defineProperty(this, '_selection', {value: new TreeSelection(this.model), enumerable: false});
        return this._selection;
    }
    insert_column() {}
}

class Entry extends Widget {
    get_buffer() {
        if (!this._buffer) {
            Object.defineProperty(this, '_buffer', {
                enumerable: false,
                value: {text: '', set_text(t) { this.text = t; }, get_text() { return this.text; }},
            });
        }
        return this._buffer;
    }
}

class Window extends Widget {
    set_default_size() {}
}

const simple = (name) => ({[name]: class extends Widget {}})[name];

export const fakes = {Label, Grid, Button, Switch, Adjustment, SpinButton, ComboBoxText, ComboBox, ListStore, TreeStore, TreeSelection, TreeView, Entry, Window};

Object.assign(Gtk, {
    Frame: simple('Frame'), Box: simple('Box'), ScrolledWindow: simple('ScrolledWindow'),
    CellRendererText: simple('CellRendererText'), TreeViewColumn: simple('TreeViewColumn'),
    Label, Grid, Button, Switch, Adjustment, SpinButton, ComboBoxText, ComboBox, ListStore, TreeStore,
    TreeView, Entry,
    Orientation: {VERTICAL: 1, HORIZONTAL: 0},
    Align: {START: 1, END: 2, CENTER: 3},
    SelectionMode: {MULTIPLE: 3},
    PolicyType: {NEVER: 2, AUTOMATIC: 1},
});
Object.assign(Adw, {PreferencesPage: simple('PreferencesPage'), PreferencesGroup: simple('PreferencesGroup')});
Gdk.Display = {get_default: () => ({get_monitors: () => ({get_item: () => null})})};
GObject.TYPE_STRING = 'gchararray';
GLib.markup_escape_text = (s) => s;
installGLibVariant(GLib);
installGioBindFlags(Gio);

export const createWindow = () => new Window();
