#!/bin/bash
# Stops the Iboro app (and stops it auto-starting on login).
# Run "Start Iboro (Linux).sh" any time to bring it back -
# nothing gets uninstalled or deleted.
cd "$(dirname "${BASH_SOURCE[0]}")"
bash deploy/linux/uninstall-services.sh
echo
echo "Stopped. Run 'Start Iboro (Linux).sh' any time to bring it back."
read -r -p "Press Enter to close this window..."
