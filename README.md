# NordVPN-Local
A Gnome extension that shows your NordVPN status in the top bar, features a menu showing the current status and a button to Connect / Disconnect.

Source: https://github.com/ThatRobVK/NordVPN-Local

## What it does
When disconnected, the top bar will show a red button reading `UNPROTECTED`, to remind you that you are not connected to the VPN. When connecting or disconnecting the button turns amber, and once connected it will turn green showing you the country and server number you are connected to, e.g. `UNITED KINGDOM #813`. When you click the button it will show the full command-line output of the command `nordvpn status` in the menu. Undearneath the status is a button that allows you to connect / disconnect.

### How it's different 
This is loosely based on Quadipedia's NordVPN Status extension (found on the Gnome extensions site), kudos to them for creating the original. Their version works by reading the server list from NordVPN's API and comparing the computer's public IP against this list. I found it often didn't pick up my active connection, which I suspect is due to incorrect API data.

This version uses the NordVPN command-line tools to determine the status. It updates as soon as you use the menu to connect or disconnect, and it refreshes every 30 seconds in case you change your connection external to the plugin.

Note that due to using the local command-line tools, this only works if you use NordVPN locally (hence the title). If your VPN connection is established outside of your computer, e.g. on your router, then this plugin __will not__ detect your VPN connection. Use Quasipedia's version instead, which will detect that, if it finds your public IP in the NordVPN server list.

## How to Install
This extension uses the NordVPN command line client, which can be set up as follows.
The actual extension isn't on the Gnome extensions site yet, so below are instructions for setting it up manually.

### Install NordVPN
1. Install NordVPN with `sudo apt install nordvpn`.
2. Configure your credentials with `nordvpn login`, following the prompts.
3. Check NordVPN is set up with `nordvpn c`, if it connects successfully then you're good to go.

### Install the extension
1. Create a folder for the extension with `mkdir ~/.local/share/gnome-shell/extensions/nordvpn-local@robvk.uk`
2. Copy the files from this repo into that folder
3. Enable the extension using `Tweaks` (if you don't have it, install via `sudo apt install gnome-tweaks`)

## Development

### Contribute
Please do contribute if you like the extension. Pull requests are more than welcome.

### Bugs
None known

### Future Plans
1. I often move between Wifi's from hotels and train companies, which have captive portals to log on to the wifi. I have noticed that whilst NordVPN is connected, the laptop can't load those captive portals and the NordVPN command-line tools get a bit mixed up when you switch connections. To work around this, I want the plugin to listen for Wifi changes and automatically disconnect NordVPN when it detects either you have disconnected or the Wifi connection has changed. This allows the laptop to connect and authenticate to the new network, after which the user can connect the VPN again.
2. The current panel button is purely based on Quasipedia's extension. I'd like to add the option to just show an icon, perhaps one that changes colour depending on status. This allows you to still see the status at a glance, get the details by opening the menu, but doesn't take up so much panel space.
3. Add the ability to configure which country / city to connect to.
4. Add a configuration menu to configure all of the above.
