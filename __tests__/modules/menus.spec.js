import {jest} from '@jest/globals';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {createFakeSettings} from '../helpers/vpn.js';

// --- fakes for the GNOME Shell UI the menus build on -------------------------------------------

let nextSignalId = 1;

class FakeWidget {
    constructor(props = {}) {
        Object.assign(this, props);
        this.handlers = {};
        this.children = [];
        this.visible = true;
        this.destroyed = false;
    }
    connect(signal, cb) { this.handlers[signal] = cb; return nextSignalId++; }
    disconnect() {}
    add_child(c) { this.children.push(c); }
    destroy() { this.destroyed = true; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    emit(signal, ...args) { return this.handlers[signal]?.(...args); }
}

class FakeMenuItem extends FakeWidget {
    constructor(label) {
        super();
        this.label = label;
        this.actor = new FakeWidget();
    }
}

class FakeSubMenu extends FakeMenuItem {
    constructor(label) {
        super(label);
        const items = [];
        this.menu = {
            items,
            addMenuItem: (item, idx) => { if (idx === undefined) items.push(item); else items.splice(idx, 0, item); },
            removeAll: () => { items.length = 0; },
            get numMenuItems() { return items.length; },
            connect: () => nextSignalId++,
        };
    }
    destroy() { super.destroy(); this.menu.items.length = 0; }
}

class FakeSeparator extends FakeMenuItem {
    constructor() { super(null); }
}

jest.unstable_mockModule('resource:///org/gnome/shell/ui/popupMenu.js', () => ({
    PopupBaseMenuItem: FakeMenuItem,
    PopupMenuItem: FakeMenuItem,
    PopupSubMenuMenuItem: FakeSubMenu,
    PopupSeparatorMenuItem: FakeSeparator,
}));

St.Icon = FakeWidget;
St.Button = FakeWidget;
Clutter.ActorAlign = {END: 'END'};

// Controllable idle queue so favorite toggles (deferred to idle) can be run on demand.
const idle = {queue: [], nextId: 1};
GLib.PRIORITY_DEFAULT = 0;
GLib.PRIORITY_DEFAULT_IDLE = 200;
GLib.SOURCE_REMOVE = false;
GLib.get_monotonic_time = () => 0;
GLib.idle_add = (priority, cb) => { const id = idle.nextId++; idle.queue.push({id, cb}); return id; };
GLib.Source = {remove: (id) => { idle.queue = idle.queue.filter(e => e.id !== id); }};
const runIdle = () => { const q = idle.queue; idle.queue = []; q.forEach(e => e.cb()); };

globalThis.log = () => {};
globalThis.logError = () => {};

const {default: ConnectionMenu} = await import('../../modules/ConnectionMenu.js');
const {default: CommonFavorite} = await import('../../modules/CommonFavorite.js');
const {default: Favorites} = await import('../../modules/Favorites.js');
const Constants = await import('../../modules/constants.js');

beforeEach(() => {
    idle.queue = [];
});

const labels = (menu) => menu.menu.items.map(i => i.label);
const press = (item) => item.icofavBtn.emit('button-press-event');

function fakeVpn(list) {
    return {
        getConnectionList: jest.fn(async () => (list ? {...list} : list)), // copy: Favorites.get() deletes from the object it is given
        connectVpn: jest.fn(async () => 'ok'),
        isConnectThrottled: jest.fn(() => false),
    };
}

// --- Favorites ---------------------------------------------------------------------------------

describe('Favorites', () => {
    const KEY = Constants.favorites.favoriteCountries;

    it('returns an empty favorites object when nothing is stored', () => {
        const fav = new Favorites(createFakeSettings({[KEY]: ''}));
        expect(fav.get(KEY).favorites).toEqual({});
    });

    it('returns an empty favorites object for invalid JSON', () => {
        const fav = new Favorites(createFakeSettings({[KEY]: 'not json'}));
        expect(fav.get(KEY).favorites).toEqual({});
    });

    it('removes favorites from the item list it is given', () => {
        const fav = new Favorites(createFakeSettings({[KEY]: JSON.stringify({Albania: 'Albania'})}));
        const result = fav.get(KEY, {Albania: 'Albania', Austria: 'Austria'});
        expect(result.favorites).toEqual({Albania: 'Albania'});
        expect(result.itemsMinusFavorites).toEqual({Austria: 'Austria'});
    });

    it('adds a favorite and persists it as JSON', () => {
        const settings = createFakeSettings({[KEY]: ''});
        const fav = new Favorites(settings);
        fav.add(KEY, 'New York', 'New_York');
        fav.add(KEY, 'Albania', 'Albania');
        expect(JSON.parse(settings.values[KEY])).toEqual({'New York': 'New_York', Albania: 'Albania'});
    });

    it('ignores add() without both a name and a value', () => {
        const settings = createFakeSettings({[KEY]: ''});
        const fav = new Favorites(settings);
        fav.add(KEY, 'X');
        fav.add(KEY, '', 'X');
        expect(settings.values[KEY]).toBe('');
    });

    it('removes a favorite and persists the rest', () => {
        const settings = createFakeSettings({[KEY]: JSON.stringify({A: 'a', B: 'b'})});
        new Favorites(settings).remove(KEY, 'A');
        expect(JSON.parse(settings.values[KEY])).toEqual({B: 'b'});
    });

    it('ignores remove() without an item', () => {
        const before = JSON.stringify({A: 'a'});
        const settings = createFakeSettings({[KEY]: before});
        new Favorites(settings).remove(KEY, undefined);
        expect(settings.values[KEY]).toBe(before);
    });
});

// --- ConnectionMenu ----------------------------------------------------------------------------

describe('ConnectionMenu', () => {
    const KEY = Constants.favorites.favoriteCountries;
    const LIST = {Albania: 'Albania', Austria: 'Austria', 'New Zealand': 'New_Zealand'};

    function createMenu({favorites = {}, list = LIST} = {}) {
        const settings = createFakeSettings({[KEY]: JSON.stringify(favorites)});
        const callback = jest.fn();
        const menu = new ConnectionMenu('Countries', 'countries', KEY, callback, settings);
        menu._vpn = fakeVpn(list);
        return {menu, settings, callback};
    }

    describe('building from a connection list', () => {
        it('lists favorites first, then a separator, then the rest sorted', async () => {
            const {menu} = createMenu({favorites: {'New Zealand': 'New_Zealand'}});
            await menu.tryBuild(true);
            expect(labels(menu.menu)).toEqual(['New Zealand', null, 'Albania', 'Austria']);
            expect(menu.isBuilt).toBe(true);
            expect(menu._vpn.getConnectionList).toHaveBeenCalledWith('countries', true);
        });

        it('shows the submenu when there are connections', async () => {
            const {menu} = createMenu();
            await menu.tryBuild(true);
            expect(menu.menu.visible).toBe(true);
        });

        it('passes running=false through to the connection list fetch', async () => {
            const {menu} = createMenu();
            await menu.tryBuild(false);
            expect(menu._vpn.getConnectionList).toHaveBeenCalledWith('countries', false);
        });

        it('shows a placeholder and stays unbuilt when no data comes back', async () => {
            const {menu} = createMenu({list: null});
            await menu.tryBuild(true);
            expect(labels(menu.menu)).toEqual(['Loading...']);
            expect(menu.isBuilt).toBe(false);
        });

        it('does not fetch again once built', async () => {
            const {menu} = createMenu();
            await menu.tryBuild(true);
            await menu.tryBuild(true);
            expect(menu._vpn.getConnectionList).toHaveBeenCalledTimes(1);
        });

        it('does not fetch again while a fetch is in flight', async () => {
            const {menu} = createMenu();
            await Promise.all([menu.tryBuild(true), menu.tryBuild(true)]);
            expect(menu._vpn.getConnectionList).toHaveBeenCalledTimes(1);
        });

        it('does not build once disposed', async () => {
            const {menu} = createMenu();
            await menu.tryBuild(true); // creates the submenu
            menu.disable();
            await menu.tryBuild(true);
            expect(menu.isBuilt).toBe(false);
        });
    });

    describe('activating an item', () => {
        it('connects to the target and calls overrideRefresh with the overrideKeys', async () => {
            const {menu, callback} = createMenu();
            await menu.tryBuild(true);
            const nz = menu.menu.menu.items.find(i => i.label === 'New Zealand');
            nz.emit('activate');
            expect(menu._vpn.connectVpn).toHaveBeenCalledWith('New_Zealand');
            expect(callback).toHaveBeenCalledWith(Constants.status.reconnecting, ['countries', 'New_Zealand']);
        });

        it('does nothing while connects are throttled', async () => {
            const {menu, callback} = createMenu();
            await menu.tryBuild(true);
            menu._vpn.isConnectThrottled.mockReturnValue(true);
            menu.menu.menu.items.find(i => i.label === 'Albania').emit('activate');
            expect(menu._vpn.connectVpn).not.toHaveBeenCalled();
            expect(callback).not.toHaveBeenCalled();
        });

        it('uses the connection type as the overrideKey for cities and servers', async () => {
            const settings = createFakeSettings({'favorite-cities': '{}'});
            const callback = jest.fn();
            const menu = new ConnectionMenu('Cities', 'cities', 'favorite-cities', callback, settings);
            menu._vpn = fakeVpn({'Germany, Berlin': 'Berlin'});
            await menu.tryBuild(true);
            menu.menu.menu.items.find(i => i.label === 'Germany, Berlin').emit('activate');
            expect(callback).toHaveBeenCalledWith(Constants.status.reconnecting, ['cities', 'Berlin']);
        });
    });

    describe('toggling a favorite', () => {
        it('adds a non-favorite to the favorite-* key on idle', async () => {
            const {menu, settings} = createMenu();
            await menu.tryBuild(true);
            press(menu.menu.menu.items.find(i => i.label === 'New Zealand'));
            // Deferred: nothing is written until the idle callback runs.
            expect(JSON.parse(settings.values[KEY])).toEqual({});
            runIdle();
            expect(JSON.parse(settings.values[KEY])).toEqual({'New Zealand': 'New_Zealand'});
        });

        it('removes a favorite from the favorite-* key on idle', async () => {
            const {menu, settings} = createMenu({favorites: {Albania: 'Albania'}});
            await menu.tryBuild(true);
            press(menu.menu.menu.items.find(i => i.label === 'Albania'));
            runIdle();
            expect(JSON.parse(settings.values[KEY])).toEqual({});
        });

        it('each click gets its own idle so rapid clicks all land', async () => {
            const {menu, settings} = createMenu();
            await menu.tryBuild(true);
            press(menu.menu.menu.items.find(i => i.label === 'Albania'));
            press(menu.menu.menu.items.find(i => i.label === 'Austria'));
            runIdle();
            expect(Object.keys(JSON.parse(settings.values[KEY])).sort()).toEqual(['Albania', 'Austria']);
        });
    });

    describe('updateFavorite', () => {
        it('moves a newly favorited item into the favorites group', async () => {
            const {menu, settings} = createMenu();
            await menu.tryBuild(true);
            settings.values[KEY] = JSON.stringify({Austria: 'Austria'});
            menu.updateFavorite();
            expect(menu._favConnectionItems).toEqual(['Austria']);
            expect(menu.menu.menu.items.some(i => i.label === 'Austria' && !i.destroyed)).toBe(true);
            // The old row for the item was destroyed and replaced.
            expect(menu._destroyMap.Austria.menuItem.destroyed).toBe(false);
        });

        it('moves an un-favorited item back out of the favorites group', async () => {
            const {menu, settings} = createMenu({favorites: {Austria: 'Austria'}});
            await menu.tryBuild(true);
            settings.values[KEY] = JSON.stringify({});
            menu.updateFavorite();
            expect(menu._favConnectionItems).toEqual([]);
            expect(menu._connectionMenuItems).toContain('Austria');
        });

        it('is a no-op when favorites have not changed', async () => {
            const {menu} = createMenu({favorites: {Austria: 'Austria'}});
            await menu.tryBuild(true);
            const before = [...menu.menu.menu.items];
            menu.updateFavorite();
            expect(menu.menu.menu.items).toEqual(before);
        });
    });

    describe('showHide', () => {
        it('hides when show is false and shows when there are connections', async () => {
            const {menu} = createMenu();
            await menu.tryBuild(true);
            menu.showHide(false);
            expect(menu.menu.visible).toBe(false);
            menu.showHide(true);
            expect(menu.menu.visible).toBe(true);
        });

        it('hides when there are no connections', async () => {
            const {menu} = createMenu({list: {}});
            await menu.tryBuild(true);
            menu.showHide(true);
            expect(menu.menu.visible).toBe(false);
        });
    });

    describe('rebuild', () => {
        it('resets to a placeholder and refetches on idle', async () => {
            const {menu} = createMenu();
            await menu.tryBuild(true);
            menu.rebuild(true);
            expect(menu.isBuilt).toBe(false);
            expect(labels(menu.menu)).toEqual(['Loading...']);
            runIdle();
            await Promise.resolve();
            await Promise.resolve();
            expect(menu._vpn.getConnectionList).toHaveBeenCalledTimes(2);
        });
    });
});

// --- CommonFavorite ----------------------------------------------------------------------------

describe('CommonFavorite', () => {
    function createCommon(stored = {}) {
        const settings = createFakeSettings({
            [Constants.favorites.favoriteCountries]: '{}',
            [Constants.favorites.favoriteCities]: '{}',
            [Constants.favorites.favoriteServers]: '{}',
        });
        Object.entries(stored).forEach(([k, v]) => { settings.values[k] = JSON.stringify(v); });
        const callback = jest.fn();
        const common = new CommonFavorite(callback, settings);
        common._vpn = fakeVpn({});
        return {common, settings, callback};
    }

    it('builds from all three favorite lists, grouped countries, cities, servers', () => {
        const {common} = createCommon({
            'favorite-servers': {'Germany #1': 'de1'},
            'favorite-countries': {Zambia: 'Zambia', Albania: 'Albania'},
            'favorite-cities': {'US, Miami': 'Miami'},
        });
        common.build();
        expect(labels(common.menu)).toEqual(['Albania', 'Zambia', 'US, Miami', 'Germany #1']);
        expect(common.favList.Albania).toEqual({item: 'Albania', type: 'favorite-countries'});
        expect(common.isBuilt).toBe(true);
    });

    it('hides itself when there are no favorites and shows when there are', () => {
        const empty = createCommon().common;
        empty.build();
        expect(empty.menu.visible).toBe(false);

        const full = createCommon({'favorite-countries': {Albania: 'Albania'}}).common;
        full.build();
        expect(full.menu.visible).toBe(true);
    });

    it('does not rebuild when already built', () => {
        const {common} = createCommon({'favorite-countries': {Albania: 'Albania'}});
        common.build();
        const first = common.menu.menu.items.length;
        common.build();
        expect(common.menu.menu.items.length).toBe(first);
    });

    it('activating an item connects and passes the type derived from the key as overrideKeys', () => {
        const {common, callback} = createCommon({'favorite-cities': {'US, Miami': 'Miami'}});
        common.build();
        common.menu.menu.items[0].emit('activate');
        expect(common._vpn.connectVpn).toHaveBeenCalledWith('Miami');
        expect(callback).toHaveBeenCalledWith(Constants.status.reconnecting, ['cities', 'Miami']);
    });

    it('does nothing on activate while connects are throttled', () => {
        const {common, callback} = createCommon({'favorite-countries': {Albania: 'Albania'}});
        common.build();
        common._vpn.isConnectThrottled.mockReturnValue(true);
        common.menu.menu.items[0].emit('activate');
        expect(common._vpn.connectVpn).not.toHaveBeenCalled();
        expect(callback).not.toHaveBeenCalled();
    });

    it('un-favoriting removes the entry from the right favorite-* key on idle', () => {
        const {common, settings} = createCommon({
            'favorite-countries': {Albania: 'Albania'},
            'favorite-cities': {'US, Miami': 'Miami'},
        });
        common.build();
        press(common.menu.menu.items.find(i => i.label === 'US, Miami'));
        expect(JSON.parse(settings.values['favorite-cities'])).toEqual({'US, Miami': 'Miami'}); // deferred
        runIdle();
        expect(JSON.parse(settings.values['favorite-cities'])).toEqual({});
        expect(JSON.parse(settings.values['favorite-countries'])).toEqual({Albania: 'Albania'});
    });

    describe('updateFavorite', () => {
        it('adds menu items for new favorites in type order', () => {
            const {common, settings} = createCommon({'favorite-servers': {'Germany #1': 'de1'}});
            common.build();
            settings.values['favorite-countries'] = JSON.stringify({Albania: 'Albania'});
            common.updateFavorite();
            expect(common.favList.Albania).toEqual({item: 'Albania', type: 'favorite-countries'});
            expect(labels(common.menu)).toEqual(['Albania', 'Germany #1']);
        });

        it('removes items that are no longer favorites', () => {
            const {common, settings} = createCommon({'favorite-countries': {Albania: 'Albania'}});
            common.build();
            const item = common.menu.menu.items[0];
            settings.values['favorite-countries'] = '{}';
            common.updateFavorite();
            expect(common.favList.Albania).toBeUndefined();
            expect(item.destroyed).toBe(true);
        });
    });

    describe('showHide', () => {
        it('shows only when asked to and when there are favorites, and remembers the last request', () => {
            const {common} = createCommon({'favorite-countries': {Albania: 'Albania'}});
            common.build();
            common.showHide(false);
            expect(common.menu.visible).toBe(false);
            expect(common.prevShowHide).toBe(false);
            common.showHide(true);
            expect(common.menu.visible).toBe(true);
        });
    });
});
