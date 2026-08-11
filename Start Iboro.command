#!/bin/bash
# Double-click this file in Finder to install (first run) or start
# (every run after) the Iboro app. Safe to double-click any time -
# on a machine that's already set up, this just makes sure everything is
# running and opens the app in your browser.
cd "$(dirname "${BASH_SOURCE[0]}")"
bash deploy/setup.sh
echo
read -r -p "Press Enter to close this window..."
