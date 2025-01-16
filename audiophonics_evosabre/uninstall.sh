#!/bin/bash
## Audiophonics EVO Sabre Plugin Uninstallation Script

echo "Uninstalling Audiophonics EVO Sabre plugin and cleaning up dependencies..."
UNINSTALLING="/home/volumio/audiophonics_evo_sabre-plugin.uninstalling"

if [ ! -f $UNINSTALLING ]; then
    touch $UNINSTALLING

    # Remove Node.js dependencies
    echo "Removing Node.js dependencies..."
    rm -rf /data/plugins/miscellanea/audiophonics_evo_sabre/node_modules

    # Disable and remove systemd services
    echo "Disabling and removing systemd services..."
    systemctl stop evo_oled2.service
    systemctl disable evo_oled2.service
    rm -f /etc/systemd/system/evo_oled2.service

    systemctl stop evo_remote.service
    systemctl disable evo_remote.service
    rm -f /etc/systemd/system/evo_remote.service

    systemctl stop evo_irexec.service
    systemctl disable evo_irexec.service
    rm -f /etc/systemd/system/evo_irexec.service

    systemctl daemon-reload

    # Remove GPIO permissions (if safe)
    echo "Checking and removing GPIO permissions..."
    groupdel gpio &> /dev/null
    echo "GPIO permissions cleaned up."

    # Clean up system dependencies
    echo "Checking if libgpiod2 can be safely removed..."
    if dpkg -s libgpiod2 &> /dev/null; then
        echo "libgpiod2 is installed. Leaving it untouched as it may be used by other plugins."
    else
        echo "libgpiod2 is not installed. No cleanup needed."
    fi

    # Remove temporary uninstallation flag
    rm $UNINSTALLING

    # Required to end the plugin uninstall
    echo "pluginuninstallend"
else
    echo "Plugin is already uninstalling! Not continuing..."
fi
