#!/usr/bin/env bash

set -euo pipefail

EXTENSION_ID="gnordvpn-local@isopolito"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAIL_LOGS=false

usage() {
    cat <<'EOF'
Usage: ./reload_local.sh [--logs]

Deploy the current worktree into the local GNOME Shell extensions directory,
disable and re-enable the extension, and optionally tail filtered logs.

Options:
  --logs    Tail extension logs after reload
  -h        Show this help text
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --logs)
            TAIL_LOGS=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

cd "$SCRIPT_DIR"

"$SCRIPT_DIR/deploy_local.sh"

echo "--> Reloading extension: $EXTENSION_ID"
gnome-extensions disable "$EXTENSION_ID" || true
gnome-extensions enable "$EXTENSION_ID"
gnome-extensions info "$EXTENSION_ID"

if [[ "$TAIL_LOGS" == true ]]; then
    echo
    echo "--> Tailing extension logs"
    exec "$SCRIPT_DIR/debug-logs.sh"
fi
