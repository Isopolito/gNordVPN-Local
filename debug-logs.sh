#!/usr/bin/env bash
# debug-logs.sh — gNordVpn extension log viewer
# Filters GNOME Shell journal to only show gNordVpn lines.
#
# Usage:
#   ./debug-logs.sh                        # live tail (default)
#   ./debug-logs.sh -f / --follow          # live tail (explicit)
#   ./debug-logs.sh --dump                 # all lines since last boot
#   ./debug-logs.sh --since "10 min ago"   # time-windowed dump
#   ./debug-logs.sh --errors               # WRN/ERR only
#   ./debug-logs.sh --slow [N]             # CALL/SPAN lines with durationMs > N (default 100)
#   ./debug-logs.sh --capture [FILE]       # tee to file
#   ./debug-logs.sh --summary FILE         # analyze a captured log file

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
ORANGE=$'\033[0;33m\033[1m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

# ── Defaults ──────────────────────────────────────────────────────────────────
MODE="follow"
SINCE=""
ERRORS_ONLY=false
SLOW_THRESHOLD=100
SLOW_FILTER=false
CAPTURE=false
CAPTURE_FILE=""
SUMMARY_FILE=""
JOURNAL_OUTPUT_MODE="short-iso-precise"
EXTENSION_PATTERN='gNordVpn|gnordvpn-local@isopolito|/gnome-shell/extensions/gnordvpn-local@isopolito/|gNordVPN-Local'

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--follow)   MODE="follow"; shift ;;
        --dump)        MODE="dump"; shift ;;
        --since)       MODE="dump"; SINCE="$2"; shift 2 ;;
        --errors)      ERRORS_ONLY=true; shift ;;
        --slow)
            SLOW_FILTER=true
            if [[ $# -gt 1 && "$2" =~ ^[0-9]+$ ]]; then
                SLOW_THRESHOLD="$2"; shift
            fi
            shift ;;
        --capture)
            CAPTURE=true
            if [[ $# -gt 1 && "$2" != --* ]]; then
                CAPTURE_FILE="$2"; shift
            fi
            shift ;;
        --summary)
            MODE="summary"; SUMMARY_FILE="${2:-}"; shift; [[ $# -gt 0 ]] && shift || true ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Usage: $0 [--follow|--dump|--since TIME|--errors|--slow [N]|--capture [FILE]|--summary FILE]" >&2
            exit 1 ;;
    esac
done

# ── Summary mode ──────────────────────────────────────────────────────────────
if [[ "$MODE" == "summary" ]]; then
    if [[ -z "$SUMMARY_FILE" || ! -f "$SUMMARY_FILE" ]]; then
        echo "Error: --summary requires an existing log file" >&2
        exit 1
    fi

    echo ""
    echo "${BOLD}=== gNordVpn Debug Summary: $SUMMARY_FILE ===${RESET}"
    echo ""

    # CALL events
    echo "${CYAN}── CALL events (low-level subprocess + HTTP) ──${RESET}"
    call_lines=$(grep -i '\[CALL\]' "$SUMMARY_FILE" || true)

    if [[ -n "$call_lines" ]]; then
        echo ""
        echo "  ${BOLD}Slowest 10 by durationMs:${RESET}"
        echo "$call_lines" \
            | grep -oP '"durationMs":\K[0-9]+' \
            | sort -rn | head -10 \
            | while read -r ms; do
                line=$(echo "$call_lines" | grep -m1 "\"durationMs\":$ms" || true)
                cmd=$(echo "$line" | grep -oP '"cmd":"\K[^"]+' || echo "?")
                blocking=$(echo "$line" | grep -oP '"blocking":\K\w+' || echo "?")
                printf "    %6dms  %-30s  blocking=%s\n" "$ms" "$cmd" "$blocking"
              done

        echo ""
        blocking_count=$(echo "$call_lines" | grep -c '"blocking":true' || true)
        async_count=$(echo "$call_lines"    | grep -c '"blocking":false' || true)
        echo "  Blocking calls : ${RED}${blocking_count}${RESET}"
        echo "  Async calls    : ${async_count}"
    else
        echo "  (no CALL events found)"
    fi

    echo ""

    # SPAN events
    echo "${CYAN}── SPAN events (high-level operations) ──${RESET}"
    span_lines=$(grep -i '\[SPAN\]' "$SUMMARY_FILE" || true)

    if [[ -n "$span_lines" ]]; then
        echo ""
        echo "  ${BOLD}Slowest 10 by durationMs:${RESET}"
        echo "$span_lines" \
            | grep -oP '"durationMs":\K[0-9]+' \
            | sort -rn | head -10 \
            | while read -r ms; do
                line=$(echo "$span_lines" | grep -m1 "\"durationMs\":$ms" || true)
                op=$(echo "$line" | grep -oP '"operation":"\K[^"]+' || echo "?")
                printf "    %6dms  %s\n" "$ms" "$op"
              done
    else
        echo "  (no SPAN events found)"
    fi

    echo ""

    # Error/warn counts
    echo "${CYAN}── Error / Warning counts ──${RESET}"
    err_count=$(grep -c '\[ERR\]' "$SUMMARY_FILE" || true)
    wrn_count=$(grep -c '\[WRN\]' "$SUMMARY_FILE" || true)
    echo "  ERR : ${RED}${err_count}${RESET}"
    echo "  WRN : ${YELLOW}${wrn_count}${RESET}"

    echo ""

    # enable() timestamps
    echo "${CYAN}── enable() lifecycle events (login correlation) ──${RESET}"
    grep -i 'enable.*called\|_buildIndicatorMenu\|read-only path\|applySettingsToNord' "$SUMMARY_FILE" \
        | sed 's/^/  /' || echo "  (none found)"

    echo ""
    exit 0
fi

# ── Colorizer ─────────────────────────────────────────────────────────────────
colorize() {
    while IFS= read -r line; do
        if $SLOW_FILTER; then
            dur=$(echo "$line" | grep -oP '"durationMs":\K[0-9]+' || true)
            if [[ -n "$dur" && "$dur" -le "$SLOW_THRESHOLD" ]]; then
                continue
            fi
        fi

        if $ERRORS_ONLY; then
            if ! echo "$line" | grep -qiE '\[(WRN|ERR)\]'; then
                continue
            fi
        fi

        if echo "$line" | grep -q '\[ERR\]'; then
            echo "${RED}${line}${RESET}"
        elif echo "$line" | grep -q '"blocking":true'; then
            echo "${RED}${line}${RESET}"
        elif echo "$line" | grep -q '\[WRN\]'; then
            echo "${YELLOW}${line}${RESET}"
        elif echo "$line" | grep -q '\[SPAN\]'; then
            dur=$(echo "$line" | grep -oP '"durationMs":\K[0-9]+' || true)
            if [[ -n "$dur" && "$dur" -gt "$SLOW_THRESHOLD" ]]; then
                echo "${ORANGE}${line}${RESET}"
            else
                echo "${CYAN}${line}${RESET}"
            fi
        elif echo "$line" | grep -q '\[CALL\]'; then
            dur=$(echo "$line" | grep -oP '"durationMs":\K[0-9]+' || true)
            if [[ -n "$dur" && "$dur" -gt "$SLOW_THRESHOLD" ]]; then
                echo "${ORANGE}${line}${RESET}"
            else
                echo "$line"
            fi
        else
            echo "$line"
        fi
    done
}

SPINNER_PID=""

start_spinner() {
    if [[ "$MODE" != "dump" || ! -t 2 ]]; then
        return
    fi

    (
        local frames='|/-\'
        local i=0
        while true; do
            local frame="${frames:i%4:1}"
            printf '\r[gNordVpn debug-logs] scanning journal %s' "$frame" >&2
            i=$((i + 1))
            sleep 0.1
        done
    ) &
    SPINNER_PID=$!
}

stop_spinner() {
    if [[ -n "$SPINNER_PID" ]]; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
        SPINNER_PID=""
        if [[ -t 2 ]]; then
            printf '\r%*s\r' 60 '' >&2
        fi
    fi
}

filter_extension_logs() {
    awk -v pattern="$EXTENSION_PATTERN" '
        BEGIN {
            in_block = 0;
        }
        {
            line = $0;
            ts = "";
            if (match($0, /^[0-9T:+.-]+ /))
                ts = substr($0, RSTART, RLENGTH - 1);
            sub(/^[0-9T:+.-]+ [^:]+: /, "", line);

            if (in_block) {
                # Blank line ends the error block
                if (line == "") {
                    print $0; fflush();
                    in_block = 0;
                    next;
                }

                # Continuation lines belonging to a JS stack trace or error block
                if (line ~ /^[[:space:]]/ ||
                    line ~ /^@/ ||
                    line ~ /^[[:alnum:]_.:$-]+@/ ||
                    line ~ /^file:\/\// ||
                    line ~ /^Stack trace:/ ||
                    line ~ /^Caused by:/ ||
                    line ~ /^(TypeError|Error|ReferenceError|SyntaxError):/ ||
                    line ~ /^\.\.\//) {
                    print $0; fflush();
                    next;
                }

                # Non-continuation line from a different source ends the block
                in_block = 0;
            }

            if (line ~ pattern) {
                if (ts != "")
                    print ts " " line;
                else
                    print $0;
                fflush();
                in_block = 1;
                next;
            }
        }
    '
}

# ── Capture setup ─────────────────────────────────────────────────────────────
if $CAPTURE; then
    if [[ -z "$CAPTURE_FILE" ]]; then
        mkdir -p "$HOME/tmp"
        CAPTURE_FILE="$HOME/tmp/gNordVpn-debug-$(date +%Y-%m-%d_%H-%M).log"
    fi
    echo "Capturing to: ${BOLD}${CAPTURE_FILE}${RESET}" >&2
fi

# ── Build journalctl args ─────────────────────────────────────────────────────
jctl_args=("-o" "$JOURNAL_OUTPUT_MODE" "--no-hostname" "--no-pager" "_COMM=gnome-shell")

if [[ "$MODE" == "follow" ]]; then
    jctl_args+=("-f")
elif [[ "$MODE" == "dump" ]]; then
    if [[ -n "$SINCE" ]]; then
        jctl_args+=("--since" "$SINCE")
    else
        jctl_args+=("-b")
    fi
fi

echo "${BOLD}[gNordVpn debug-logs]${RESET} mode=${MODE} errors_only=${ERRORS_ONLY} slow_threshold=${SLOW_THRESHOLD}ms" >&2
if [[ "$MODE" == "dump" ]]; then
    echo "Scanning journal entries for gNordVpn logs. Large --since windows can take a while." >&2
fi
echo "" >&2

# ── Run ───────────────────────────────────────────────────────────────────────
trap stop_spinner EXIT
start_spinner
if $CAPTURE; then
    journalctl "${jctl_args[@]}" \
        | filter_extension_logs \
        | tee "$CAPTURE_FILE" \
        | colorize
else
    journalctl "${jctl_args[@]}" \
        | filter_extension_logs \
        | colorize
fi
stop_spinner
