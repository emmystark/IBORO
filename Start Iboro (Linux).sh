#!/bin/bash
# Run this to install (first run) or start (every run after) the Knowledge
# Base app. Safe to run any time - on a machine that's already set up,
# this just makes sure everything is running and opens the app.
#
# Most file managers run a double-clicked .sh through a text editor by
# default, not as a program - if double-clicking just opens this in an
# editor, right-click it, choose "Run" or "Run in terminal" (exact wording
# depends on your desktop environment), or run it from a terminal instead:
#   bash "Start Iboro (Linux).sh"
cd "$(dirname "${BASH_SOURCE[0]}")"
bash deploy/linux/setup.sh
echo
read -r -p "Press Enter to close this window..."
