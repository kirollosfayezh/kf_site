#!/usr/bin/env bash
# Renders build/og-default.html to public/og-default.png (1200×630) with the
# locally installed Chrome. Run it after editing the HTML and commit the PNG;
# it is deliberately not part of `npm run build` — Vercel has no Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --screenshot="$PWD/public/og-default.png" \
  "file://$PWD/build/og-default.html" 2>/dev/null
sips -g pixelWidth -g pixelHeight public/og-default.png
