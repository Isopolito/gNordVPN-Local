// Minimal stub for gi://GObject. registerClass returns the class it receives, as VpnIndicator needs.
export default {
    registerClass: (...args) => args[args.length - 1],
};
