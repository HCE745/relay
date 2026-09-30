#!/usr/bin/env bash
# Run this once from the apps/relay directory to produce the KEYSTORE_BASE64 secret value.
# Copy the printed output and paste it as the secret in GitHub Settings → Secrets.
set -euo pipefail

KEYSTORE="android/relay-release.keystore"

if [ ! -f "$KEYSTORE" ]; then
  echo "Error: $KEYSTORE not found. Run this script from apps/relay/." >&2
  exit 1
fi

echo "Paste this value as the KEYSTORE_BASE64 GitHub secret:"
echo ""
base64 -w 0 "$KEYSTORE"
echo ""
