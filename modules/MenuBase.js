const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

var MenuBase = class MenuBase {
    buildFavIcon(isFavorite) {
        const icon_name = isFavorite ? `starred-symbolic` : `non-starred-symbolic`;
        const iconfav = new St.Icon({
            icon_name: icon_name,
            style_class: `system-status-icon`
        });

        return new St.Button({
                style_class: `ci-action-btn`,
                can_focus: true,
                child: iconfav,
                x_align: Clutter.ActorAlign.END,
                x_expand: true,
                y_expand: true
        });
    }
}