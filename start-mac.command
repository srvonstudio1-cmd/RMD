#!/bin/sh
# Double-click in Finder to start the studio server on a Mac.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org and run this file again."
  read -r _
  exit 1
fi
node server/server.js
