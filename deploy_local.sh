#!/bin/bash

# This script deploys the extension locally for testing.
# It removes the old version, copies the new version,
# removes development-only files, and compiles the GSettings schema.

set -e # Exit immediately if a command exits with a non-zero status.

EXTENSION_ID="gnordvpn-local@isopolito"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_ID"
SOURCE_DIR=$(pwd)

echo "Deploying gNordVpn locally for testing..."

# 1. Remove existing installation
if [ -d "$DEST_DIR" ]; then
    echo "--> Removing old version from: $DEST_DIR"
    rm -rf "$DEST_DIR"
fi

# 2. Copy new version from the current directory
echo "--> Copying new version from: $SOURCE_DIR"
mkdir -p "$DEST_DIR"
cp -r ./* "$DEST_DIR/"

# 3. Remove development-only files and directories from the destination
echo "--> Removing development files (.git, .idea, etc.)..."
rm -rf "$DEST_DIR/.git"
rm -rf "$DEST_DIR/.idea"
rm -f "$DEST_DIR/deploy_local.sh"
rm -f "$DEST_DIR/makegnordext"
rm -f "$DEST_DIR/debug-logs.sh"
rm -f "$DEST_DIR/gsettings_fix_worklog.md"

# 4. Compile GSettings schema
SCHEMA_DIR="$DEST_DIR/schemas"
if [ -d "$SCHEMA_DIR" ]; then
    echo "--> Compiling GSettings schema in: $SCHEMA_DIR"
    glib-compile-schemas "$SCHEMA_DIR"
else
    echo "--> WARNING: Schema directory not found. Skipping compilation."
fi

echo
echo "-----------------------------------------------------------"
echo "✅ Local deployment complete."
echo "Restart GNOME Shell (Alt+F2, type 'r', press Enter) to apply."
echo "-----------------------------------------------------------"
