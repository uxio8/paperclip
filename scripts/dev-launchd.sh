#!/bin/zsh
set -euo pipefail

export PATH="/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/uxioadrianmarcosnores/Documents/Desarrollos/paperclip-master-codex

exec /opt/homebrew/bin/pnpm dev
