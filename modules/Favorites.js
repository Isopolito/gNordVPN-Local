var Favorites = class Favorites {
    constructor(getData, setData) {
        this._getData = getData;
        this._setData = setData;
    }

    get(favoriteType, items) {
        const favorites = this._getData(favoriteType)
            ?.split(`,`)
            ?.map(i => i.trim())
            ?.filter(i => i && i.length > 0);

        return {
            favorites: favorites?.sort() ?? [],
            itemsMinusFavorites: items.filter(i => !favorites?.includes(i)),
        }
    }
    
    remove(favoriteType, item) {
        const favorites = this._getData(favoriteType)
            ?.split(`,`)
            ?.map(i => i.trim());
        if (!favorites) return;
        
        this._setData(favoriteType, favorites.filter(favorite => favorite !== item).join(`,`));
    }

    add(favoriteType, item) {
        if (!item) return;

        const favorites = this._getData(favoriteType);
        if (favorites && !favorites.includes(item)) {
            this._setData(favoriteType, `${favorites},${item}`);
        } else {
            this._setData(favoriteType, item);
        }
    }
}
