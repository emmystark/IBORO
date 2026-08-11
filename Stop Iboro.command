#!/bin/bash
# Double-click to stop the Iboro app (and stop it auto-starting
# on login). Run "Start Iboro.command" again any time to bring it
# back - nothing gets uninstalled or deleted.
cd "$(dirname "${BASH_SOURCE[0]}")"
bash deploy/launchd/uninstall.sh
echo
echo "Stopped. Double-click 'Start Iboro.command' any time to bring it back."
read -r -p "Press Enter to close this window..."
