#!/bin/sh
set -eu

PORT="${EXPO_PORT:-8081}"
HOST="${EXPO_HOST:-lan}"

start_expo() {
  pnpm exec expo start --host "$1" --port "$PORT"
}

if [ "$HOST" = "tunnel" ]; then
  start_expo tunnel || {
    echo "[Risk Radar] Expo tunnel failed; falling back to LAN mode."
    echo "[Risk Radar] For phone testing in LAN mode, set REACT_NATIVE_PACKAGER_HOSTNAME to this computer's LAN IP."
    start_expo lan
  }
else
  start_expo "$HOST"
fi
