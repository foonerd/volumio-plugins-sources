## Audiophonics On/Off Plugin Installation Script

echo "Installing Audiophonics On/Off plugin and its dependencies..."
INSTALLING="/home/volumio/audiophonicsonoff-plugin.installing"

if [ ! -f $INSTALLING ]; then
	touch $INSTALLING

	# Ensure required system dependencies are installed
	echo "Checking and installing required dependencies..."
	if ! dpkg -s libgpiod2 &> /dev/null; then
		echo "Installing libgpiod2..."
		apt-get update && apt-get install -y libgpiod2
	else
		echo "libgpiod2 is already installed."
	fi

	# Install Node.js dependencies
	echo "Installing Node.js dependencies..."
	npm install --prefix /data/plugins/miscellanea/audiophonicsonoff

	# Cleanup
	rm $INSTALLING

	# Required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
