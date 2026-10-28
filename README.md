# gNordVPN: GNOME Interface for NordVPN

<img align="right" src="img/screenshot1.png">


## Overview

**gNordVPN** puts NordVPN controls directly in the GNOME top bar. It uses the NordVPN CLI under the hood to show live connection state, surface quick actions, and expose the most useful NordVPN settings without leaving the desktop shell.

## Prerequisites

- A NordVPN account
- The NordVPN Linux CLI installed and working
- GNOME Shell 42 or newer

## Features

- 🖥️ **Top-bar control**: Connect, disconnect, and inspect NordVPN status from the GNOME panel.
- 📡 **Live status display**: See connection state, country, and server details at a glance.
- 🌍 **Fast server selection**: Browse and connect by country, city, or server.
- ⭐ **Favorites**: Pin commonly used countries, cities, and servers for quicker access.
- ⚙️ **Connection preferences**: Configure options such as auto-connect, protocol, and technology from the extension settings.
- 🧭 **Panel customization**: Move the indicator to the left, center, or right side of the top bar.
- 🎨 **Style overrides**: A Styles page with a live preview, Size and Theme presets, Shape controls (corners, bold, border, spacing), and per-state colors and panel text. An Advanced CSS section is the fallback for anything the controls don't cover.

## Installation
This extension uses the NordVPN command line client, which can be set up as follows.

### Install NordVPN
1. Install NordVPN with `sudo apt install nordvpn`.
2. Configure your credentials with `nordvpn login`, following the prompts.
3. Check NordVPN is set up with `nordvpn c`, if it connects successfully then you're good to go.

### Install the extension
#### Easiest way: 
Enable on gnome-extensions at [gNordVPN Local on gnome extensions](https://extensions.gnome.org/extension/2569/gnordvpn-local/)

#### Manual install:
1. Create a folder for the extension with `mkdir ~/.local/share/gnome-shell/extensions/gnordvpn-local@isopolito`
2. Copy the files from this repo into that folder
3. Enable the extension using `Tweaks` (if you don't have it, install via `sudo apt install gnome-tweaks`)

## Troubleshooting

If the extension shows an error state, make sure NordVPN CLI is functioning (`nordvpn status`). The extension relies on NordVPN CLI being operational. If any behavior suddenly changes, check `nordvpn` CLI to see if anything has changed there, sometimes they make breaking changes that need to be handled by the extension. Other times they have transient errors on their end that eventually clear up.

## Known Issues

When this extension is used with **Dash to Panel**, the gNordVpn panel icon can look unusually large. Fix it on the **Styles** page of the extension settings:

1. Under **Shape**, set **Spacing** to **Compact**.
2. If that isn't right, set **Spacing** to **Custom** and adjust the padding and margin values (px) until it fits.
3. Only if the controls can't do what you need, open **Custom CSS (advanced)** and add CSS there. It applies to every state and is added after the generated CSS, so it wins. Per-state extra CSS is available there too.

## Bug Reports

Please raise an issue with the following data points:
  1. Version of gnome: `gnome-shell --version`
  2. Version of nordvpn: `nordvpn --version`
  3. Version the gNordVpn extension
  4. Screenshots of the problem if applicable
  5. Steps to reproduce the issue

## Development

Contributions welcome! If you find any issues or think of any cool features, check to see if it's already documented under Issues, if not--raise it.

### Running tests

Run `npm ci && npm test`. Tests use Jest; `gi://...` and `resource:///...` imports are mapped by `moduleNameMapper` in `package.json` to stubs under `__mocks__/gi` and `__mocks__/resource`, so add a stub there when a module imports a new GNOME library. `deploy_local.sh` installs into your live GNOME session, so run it yourself; it is not part of the tests.

## Thanks

Thanks [TheRobVK](https://github.com/ThatRobVK) for creating the original version of this extension. Also thanks to all who have contributed, it's much appreciated!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
