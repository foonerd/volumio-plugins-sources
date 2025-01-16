# Audiophonics On/Off Plugin for Volumio

## Overview
The Audiophonics On/Off plugin provides seamless integration of hardware power management with Volumio. This plugin enables button management using the modern `libgpiod` library, ensuring compatibility across all Raspberry Pi models, including the latest Raspberry Pi 5 and CM5.

## Features
- Soft shutdown using a GPIO pin.
- Hardware button monitoring for shutdown requests.
- Boot OK signaling through a GPIO pin.
- Fully compatible with Raspberry Pi models 1 through 5.
- Updated to utilize `libgpiod` for GPIO management.

## Requirements
- Volumio 3 or later.
- Raspberry Pi running Debian Buster or compatible OS.
- `libgpiod` library installed (`libgpiod2`).
- A configured GPIO pin setup for power management.

## Installation
1. **Install Required Dependencies**
   ```bash
   sudo apt update
   sudo apt install -y libgpiod2
   ```

2. **Install the Plugin**
   ```bash
   volumio plugin install
   ```

3. **Activate the Plugin**
   - Go to the Volumio web interface.
   - Navigate to `Plugins` -> `Installed Plugins`.
   - Enable the Audiophonics On/Off plugin.

## Configuration
1. Open the plugin settings in the Volumio web interface.
2. Configure the GPIO pins for:
   - Soft Shutdown.
   - Shutdown Button.
   - Boot OK Signal.
3. Save the settings to apply the changes.

## Troubleshooting
- Ensure `libgpiod2` is installed by running:
  ```bash
  dpkg -s libgpiod2
  ```
- Check Volumio logs for plugin-specific errors:
  ```bash
  journalctl -f | grep volumio
  ```

## Development
### Repository
- Source: [GitHub - Audiophonics On/Off Plugin](https://github.com/volumio/volumio-plugins-sources/audiophonicsonoff)

### Building and Testing
1. Clone the repository:
   ```bash
   git clone https://github.com/volumio/volumio-plugins-sources/audiophonicsonoff
   ```
2. Navigate to the plugin directory and install dependencies:
   ```bash
   cd audiophonicsonoff
   npm install
   ```
3. Deploy the plugin for local testing:
   ```bash
   volumio plugin install
   ```

## Changelog
### Version 1.1.0
- Migrated GPIO handling to `libgpiod`.
- Added compatibility for Raspberry Pi 5 and newer.
- Improved shutdown and button monitoring logic.

## License
This project is licensed under the GPL-3.0 License.

## Support
For issues and feature requests, please visit the [GitHub Issues](https://github.com/volumio/volumio-plugins-sources/audiophonicsonoff/issues) page.

