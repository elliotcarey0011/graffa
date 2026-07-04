#!/usr/bin/env bash
# Redeploy Graffa on the VPS: pulls the latest code and rebuilds the app
# container. Usage: ./deploy.sh user@your-vps-ip
set -euo pipefail

HOST="${1:?usage: ./deploy.sh user@host}"
REMOTE_DIR="${2:-/opt/graffa}"

ssh "$HOST" "cd $REMOTE_DIR && git pull && docker compose up -d --build"
