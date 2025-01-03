## Evo Sabre as a Volumio 3 Plugin

This plugin has two main purposes:
* Installing and configuring the EVO-Sabre secondary OLED display (rightmost display) to work with Volumio playback system.
* Configuring the remote control receiver to work alongside Volumio playback control.

---

### Installation
A step-by-step installation guide [is available here](https://www.audiophonics.fr/en/blog-diy-audio/40-new-installation-system-for-evo-sabre-under-volumio-plugin.html).

### Compatibility
The plugin is now compatible with:
- **Volumio 3** and upcoming **Bookworm** platforms.
- **Kernel-agnostic GPIO numbering** for modern systems.
- Expanded architecture support for **armhf**, **arm64**, and **x86**.

---

### Display Layer

The OLED#2 layer is a separate Node.js application launched when the plugin starts. The run command is exposed as a service (`evo_oled2.service`) and can be triggered using `systemctl`.

- It uses WebSocket to address the [Volumio WebSocket API](https://volumio.github.io/docs/API/WebSocket_APIs.html) and fetch the streamer state.
- A micro HTTP server listens to many events, primarily to detect activity (e.g., automatically exiting sleep mode when the remote is used).
- The SPI driver is handled by the [RPIO](https://www.npmjs.com/package/rpio) package, which is provided as precompiled binaries. This ensures users do not need to install `build-essential` or `node-gyp`.

---

### Remote Layer

The remote layer leverages LIRC and IREXEC to translate IR inputs into system calls. Both processes run as separate services (`evo_remote.service` and `evo_irexec.service`) to prevent conflicts with other plugins using remotes.

During installation, the plugin writes to `/boot/userconfig.txt` to expose the `gpio-ir` device tree with the correct pin-out. Because of this, **a reboot is required after the first installation** to ensure the remote works properly.

---

### GPIO Configuration

- The plugin now supports **kernel-agnostic GPIO handling**. Users can configure GPIO pins directly through the settings page, specifying:
  - **Pin Name** (e.g., `oledReset`)
  - **Pin Number** (kernel-agnostic numbering)
  - **Direction** (`in` or `out`)

This provides more flexibility and compatibility across various hardware platforms.

---

### Translations and Documentation

The plugin settings page includes documentation and tips to assist users in configuring their Evo Sabre (e.g., selecting the correct audio output). Translations are available in:
- **English**
- **French**
- **German**
- **Spanish**
- **Dutch**
- **Polish**

Anyone willing to contribute additional translations is warmly welcomed.

---

### Credits

Many thanks to:
- **Gé** & **Balbuze** for guidance, documentation, and valuable advice during development.
- **Jens Neugebauer** for thorough testing and invaluable feedback, which boosted confidence in releasing this plugin.
- The Evo Sabre community for providing patient and constructive feedback during the beta phase.

Special thanks to all contributors who helped refine this plugin to its current state.

