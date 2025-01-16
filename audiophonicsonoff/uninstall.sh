## Audiophonics On/Off Plugin Uninstallation Script

echo "Uninstalling Audiophonics On/Off plugin and cleaning up dependencies..."
UNINSTALLING="/home/volumio/audiophonicsonoff-plugin.uninstalling"

if [ ! -f $UNINSTALLING ]; then
	touch $UNINSTALLING

	# Remove Node.js dependencies
	echo "Removing Node.js dependencies..."
	rm -rf /data/plugins/miscellanea/audiophonicsonoff/node_modules

	# Clean up system dependencies if necessary
	echo "Checking if libgpiod2 can be safely removed..."
	if dpkg -s libgpiod2 &> /dev/null; then
		echo "libgpiod2 is installed. Leaving it untouched as it may be used by other plugins."
	else
		echo "libgpiod2 is not installed. No cleanup needed."
	fi

	# Cleanup
	rm $UNINSTALLING

	# Required to end the plugin uninstall
	echo "pluginuninstallend"
else
	echo "Plugin is already uninstalling! Not continuing..."
fi
