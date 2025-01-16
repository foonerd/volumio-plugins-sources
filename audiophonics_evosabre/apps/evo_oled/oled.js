cconst fs = require("fs");
const spi = require("spi-device");
const gpiod = require("gpiod");

// Command Constants
const CMD_COL = 0x15;
const CMD_ROW = 0x75;
const CMD_WRITE = 0x5C;
const CMD_READ = 0x5D;
const CMD_DISPON = 0xAF;
const CMD_DISPOFF = 0xAE;
const CMD_ENGREYSCALE = 0x00;
const CMD_MODE = 0xA0;
const CMD_SETSTART = 0xA1;
const CMD_DISPOFFSET = 0xA2;
const CMD_DISPNORM = 0xA6;
const CMD_DISPINVERT = 0xA7;
const CMD_DISPALLON = 0xA5;
const CMD_DISPALLOFF = 0xA4;
const CMD_VDDSEL = 0xAB;
const CMD_PHASELEN = 0xB1;
const CMD_SETCLKFREQ = 0xB3;
const CMD_DISPENHA = 0xB4;
const CMD_SETGPIO = 0xB5;
const CMD_SECPRECHRG = 0xB6;
const CMD_SETGRYTABLE = 0xB8;
const CMD_DEFGRYTABLE = 0xB9;
const CMD_PRECHRGVOL = 0xBB;
const CMD_SETVCOMH = 0xBE;
const CMD_CONTRSTCUR = 0xC1;
const CMD_MSTCONTRST = 0xC7;
const CMD_MUXRATIO = 0xCA;
const CMD_DISPENHB = 0xD1;
const CMD_COMLOCK = 0xFD;

function chunkString(str, length) {
  return str.match(new RegExp(".{1," + length + "}", "g"));
}
var Oled = function (opts) {
  this.HEIGHT = opts.height || 64;
  this.WIDTH = opts.width || 256;
  this.horizontal_chunks = this.WIDTH >> 2; // Divide width by 4 for horizontal chunks
  this._rXs = 28; // Start column register
  this._rXe = this._rXs + this.horizontal_chunks - 1; // End column register
  this._rYs = 0; // Start row register
  this._rYe = this._rYs + this.HEIGHT - 1; // End row register

  this.DCPIN = opts.dcPin || 27; // Data/Command GPIO pin
  this.RSPIN = opts.rstPin || 24; // Reset GPIO pin
  this.divisor = opts.divisor || 0xF1; // Clock divisor for display frequency

  this.cursor_x = 0; // Initial cursor position X
  this.cursor_y = 0; // Initial cursor position Y

  // Allocate buffer for OLED display memory
  this.buffer = Buffer.alloc(2 * this.horizontal_chunks * this.HEIGHT);
  this.bufferlength = this.buffer.length;

  // Initialize GPIO and SPI resources
  this.chip = gpiod.openChip(0); // Open GPIO chip (e.g., gpiochip0)
  this.dcLine = this.chip.getLine(this.DCPIN); // Request Data/Command line
  this.rsLine = this.chip.getLine(this.RSPIN); // Request Reset line

  this.dcLine.request({ consumer: "oled", type: gpiod.LINE_REQUEST_DIRECTION_OUTPUT });
  this.rsLine.request({ consumer: "oled", type: gpiod.LINE_REQUEST_DIRECTION_OUTPUT });

  // Open SPI device for communication
  this.spiDevice = spi.openSync(0, 0); // SPI Bus 0, Device 0
};

Oled.prototype.begin = function () {
  // Ensure display reset
  this.reset();

  // Send initialization commands to the OLED
  this._initialise();

  // Clear the display buffer and update the OLED
  this.clear();

  // Ensure cleanup on process exit
  process.on('exit', () => {
    this.clear(); // Clear display
    this.cleanup(); // Release GPIO and SPI resources
  });
};

Oled.prototype._initialise = function () {
  // Set OLED to Command Mode
  this.setCommandMode();

  // Define the initialization sequence
  const initSequence = [
    { val: CMD_COMLOCK },                  // Unlock commands
    { val: 0x12, dc: true },               // Command lock setting
    { val: CMD_DISPOFF },                  // Display OFF
    { val: CMD_COL, dc: true },            // Set column start and end
    { val: this._rXs },                    // Start column
    { val: this._rXe },                    // End column
    { val: CMD_ROW, dc: true },            // Set row start and end
    { val: this._rYs },                    // Start row
    { val: this._rYe },                    // End row
    { val: CMD_SETCLKFREQ, dc: true },     // Set display clock frequency
    { val: this.divisor },                 // Frequency divisor
    { val: CMD_MUXRATIO, dc: true },       // Multiplex ratio
    { val: this._rYe },                    // Height of the display
    { val: CMD_DISPOFFSET, dc: true },     // Display offset
    { val: 0x00 },                         // No offset
    { val: CMD_SETSTART, dc: true },       // Set start line
    { val: 0x00 },                         // Start line at 0
    { val: CMD_MODE, dc: true },           // Remap format
    { val: 0x14 },                         // Horizontal addressing
    { val: 0x11 },                         // Sequential COM
    { val: CMD_SETGPIO, dc: true },        // GPIO settings
    { val: 0x00 },                         // Disable GPIO
    { val: CMD_VDDSEL, dc: true },         // Enable external VDD
    { val: 0x01 },                         // Function selection
    { val: CMD_DISPENHA, dc: true },       // Display enhancement
    { val: 0x00 },                         // Enable external VSL
    { val: 0xB0 },                         // VSL selection
    { val: CMD_CONTRSTCUR, dc: true },     // Contrast current
    { val: 0xFF },                         // Max contrast
    { val: CMD_MSTCONTRST, dc: true },     // Master contrast
    { val: 0b11001111 },                   // High contrast
    { val: CMD_DEFGRYTABLE },              // Default grayscale table
    { val: CMD_ENGREYSCALE },              // Enable grayscale
    { val: CMD_PHASELEN, dc: true },       // Phase length
    { val: 0x05 },                         // Phase 1
    { val: 0x03 },                         // Phase 2
    { val: CMD_DISPENHB, dc: true },       // Display enhancement B
    { val: 0x82 },                         // Precharge and discharge
    { val: 0x20 },                         // Enhanced driving scheme
    { val: CMD_PRECHRGVOL, dc: true },     // Precharge voltage
    { val: 0x1F },                         // Level
    { val: CMD_SECPRECHRG, dc: true },     // Second precharge period
    { val: 0x08 },                         // Period
    { val: CMD_SETVCOMH, dc: true },       // Set VCOMH
    { val: 0x07 },                         // VCOMH level
    { val: CMD_DISPNORM },                 // Set display to normal mode
    { val: CMD_DISPON },                   // Display ON
  ];

  // Send the initialization sequence
  this.send_instruction_seq(initSequence);
};

Oled.prototype.send_instruction_seq = function (sequence, callback, index = 0) {
  // Base case: end of the sequence
  if (index >= sequence.length) {
    if (typeof callback === "function") callback();
    return;
  }

  const current = sequence[index];

  // Handle Data/Command mode toggling
  if (current.dc) {
    this.setDataMode(); // Set to Data mode
    this.send_instruction_seq(sequence, callback, index + 1);
  } else if (current.cd) {
    this.setCommandMode(); // Set to Command mode
    this.send_instruction_seq(sequence, callback, index + 1);
  } else {
    // Send the value
    let value = current.val;
    if (typeof value !== "object") value = Buffer.from([value]);

    this.spiWrite(value); // Send via SPI
    this.send_instruction_seq(sequence, callback, index + 1);
  }
};

Oled.prototype.update = function (callback) {
  // Prevent multiple updates running simultaneously
  if (this.updateInProgress) {
    if (typeof callback === "function") callback();
    return;
  }

  this.updateInProgress = true;

  // Create a copy of the buffer for static frame updates
  const staticFrame = Buffer.alloc(this.buffer.length);
  this.buffer.copy(staticFrame);

  // Define the update sequence
  const sequence = [
    { val: CMD_COL, dc: true },            // Set column range
    { val: 28 },                          // Start column
    { val: 28 + this.horizontal_chunks - 1 }, // End column
    { val: CMD_ROW, dc: true },           // Set row range
    { val: 0x00 },                        // Start row
    { val: this.HEIGHT - 1 },             // End row
    { val: CMD_WRITE },                   // Write data
    { val: staticFrame, dc: true },       // Send frame buffer data
  ];

  // Send the update sequence
  this.send_instruction_seq(sequence, () => {
    this.updateInProgress = false; // Mark update as completed
    if (typeof callback === "function") callback(); // Execute the callback if provided
  });
};

Oled.prototype.clear = function (callback) {
  // Fill the display buffer with zeros
  this.buffer.fill(0x00);

  // Push the cleared buffer to the OLED display
  this.update(() => {
    if (typeof callback === "function") callback();
  });
};

Oled.prototype.reset = function () {
  // Set the reset pin to LOW to reset the display
  this.rsLine.setValue(0);

  // Hold the reset pin LOW for 10 milliseconds
  setTimeout(() => {
    // Set the reset pin back to HIGH to complete the reset
    this.rsLine.setValue(1);
  }, 10);
};


// set starting position of a text string on the oled
Oled.prototype.setCursor = function(x, y) {
  this.cursor_x = x;
  this.cursor_y = y;
}

// write text to the oled
Oled.prototype.writeString = function (font, size, string, color) {
  let offset = this.cursor_x;

  for (let char of string) {
    // Get the character buffer from the font
    const charBuf = this._findCharBuf(font, char);
    if (!charBuf) {
      console.warn(`Character "${char}" not found in font.`);
      continue;
    }

    // Convert character buffer into binary for rendering
    const charBytes = this._readCharBytes(charBuf);

    // Draw the character at the current cursor position
    this._drawChar(charBytes, size, color);

    // Update the cursor offset for the next character
    offset += font.width * size + size; // Add spacing between characters
    this.setCursor(offset, this.cursor_y);
  }
};

// draw an individual character to the screen
Oled.prototype._drawChar = function (byteArray, size, col) {
  const x = this.cursor_x;
  const y = this.cursor_y;

  // Iterate through each byte in the character array
  for (let i = 0; i < byteArray.length; i++) {
    for (let j = 0; j < 8; j++) {
      // Determine the pixel's color (on or off)
      const pixel = (byteArray[i] >> j) & 1 ? col : 0;

      if (pixel) {
        // Scale pixel size and draw at the correct position
        if (size === 1) {
          this.drawPixel(x + i, y + j, pixel);
        } else {
          this.fillRect(x + i * size, y + j * size, size, size, pixel);
        }
      }
    }
  }
};

// BASIC UNICODE SUPPORT
Oled.prototype.load_hex_font = function (fontpath, callback) {
  this.hex_font = {}; // Initialize an empty object to store the font data

  fs.readFile(fontpath, (err, data) => {
    if (err) {
      console.log("Error loading font:", err);
      if (typeof callback === "function") callback(err);
      return;
    }

    const unichars = data.toString().split("\n"); // Split file content into lines
    for (let unichar of unichars) {
      const code = parseInt(unichar.substring(0, 4), 16); // Parse Unicode value
      const value = unichar.substring(5); // Get hex pixel data
      if (code) {
        let splitval;
        let columns = 0;
        let row_length = 0;

        // Determine the dimensions of the character (4x16 or 2x8)
        if (value.length === 64) {
          columns = 4;
          row_length = 16;
        } else {
          columns = 2;
          row_length = 8;
        }

        // Split hex data into rows
        splitval = chunkString(value, columns).map(hex => parseInt(hex, 16));
        this.hex_font[code] = {
          data: splitval, // Store binary row data
          length: row_length, // Number of rows (height)
        };
      }
    }

    // Call the callback if provided
    if (typeof callback === "function") {
      callback(null);
    }
  });
};

Oled.prototype.CacheGlyphsData = function (string) {
  this.cached_glyph = {}; // Initialize or reset the glyph cache

  if (!this.hex_font) {
    console.log("Font not loaded. Call load_hex_font() first.");
    return;
  }

  // Identify all unique characters in the string
  const used_chars = new Set(string);
  
  // Cache glyph data for each unique character
  for (let char of used_chars) {
    const charCode = char.charCodeAt(); // Get the Unicode code point of the character
    const glyph_raw_data = this.hex_font[charCode]; // Lookup the character in the loaded font

    if (glyph_raw_data) {
      const binary_glyph = [];
      
      // Convert each row of the glyph's hex data into binary strings
      for (let row of glyph_raw_data.data) {
        const binary_row_string = row.toString(2).padStart(glyph_raw_data.length, "0");
        binary_glyph.push(binary_row_string);
      }

      // Store the processed glyph data in the cache
      this.cached_glyph[char] = {
        data: binary_glyph, // Binary representation of each row
        width: binary_glyph[0]?.length || 0, // Width of the character
        height: binary_glyph.length, // Height of the character
      };
    } else {
      console.warn(`Character "${char}" not found in font.`);
    }
  }
};

Oled.prototype.writeStringUnifont = function (string, color) {
  if (!this.hex_font) {
    console.log("Font not loaded. Call load_hex_font() first.");
    return;
  }

  if (!this.cached_glyph) {
    console.log("Glyphs not cached. Call CacheGlyphsData() first.");
    return;
  }

  for (let char of string) {
    // Skip rendering if the character is not cached
    const charBuf = this.cached_glyph[char];
    if (!charBuf) {
      console.warn(`Character "${char}" not found in cached glyphs.`);
      continue;
    }

    // Skip rendering if the cursor is out of bounds
    if (this.cursor_x >= this.WIDTH) return;

    // Render the character using _drawCharUnifont
    this._drawCharUnifont(charBuf, color);

    // Move the cursor to the right for the next character
    this.setCursor(this.cursor_x + charBuf.width, this.cursor_y);
  }
};

Oled.prototype.getStringWidthUnifont = function (string) {
  if (!this.hex_font) {
    console.log("Font not loaded. Call load_hex_font() first.");
    return 0;
  }

  if (!this.cached_glyph) {
    console.log("Glyphs not cached. Call CacheGlyphsData() first.");
    return 0;
  }

  let totalWidth = 0;

  for (let char of string) {
    // Retrieve the cached glyph for the character
    const charBuf = this.cached_glyph[char];
    if (!charBuf) {
      console.warn(`Character "${char}" not found in cached glyphs.`);
      continue;
    }

    // Add the width of the character to the total width
    totalWidth += charBuf.width;
  }

  return totalWidth;
};

// draw an individual character to the screen
Oled.prototype._drawCharUnifont = function (glyph, color) {
  const startX = this.cursor_x; // Starting X position
  const startY = this.cursor_y; // Starting Y position

  // Iterate through the rows of the glyph
  for (let row = 0; row < glyph.height; row++) {
    // Iterate through each column in the row
    for (let col = 0; col < glyph.width; col++) {
      // Determine the pixel value (1 for on, 0 for off)
      const pixel = glyph.data[row][col] === "1" ? color : 0;

      // Render the pixel on the display
      this.drawPixel(startX + col, startY + row, pixel);
    }
  }
};

Oled.prototype._readCharBytes = function (byteArray) {
  const bitCharArr = []; // Array to hold binary rows

  for (let byte of byteArray) {
    const bitRow = byte
      .toString(2) // Convert the byte to a binary string
      .padStart(8, "0") // Ensure the binary string is 8 bits long
      .split("") // Split the binary string into individual bits
      .map(bit => parseInt(bit, 10)); // Convert bits back to integers
    bitCharArr.push(bitRow); // Add the binary row to the result array
  }

  return bitCharArr;
};

// find where the character exists within the font object
Oled.prototype._findCharBuf = function (font, c) {
  // Find the position of the character in the font's lookup table
  const charPos = font.lookup.indexOf(c);

  // If the character is not found, return null
  if (charPos === -1) {
    console.warn(`Character "${c}" not found in font.`);
    return null;
  }

  // Calculate the starting position of the character's bitmap data
  const startPos = charPos * font.width;

  // Extract and return the character's bitmap data
  return font.fontData.slice(startPos, startPos + font.width);
};

Oled.prototype.setContrast = function (contrast, callback) {
  // Ensure the contrast value is within valid bounds
  if (contrast < 0 || contrast > 255) {
    console.warn("Contrast value must be between 0 and 255.");
    return;
  }

  // Define the sequence to set the contrast
  const sequence = [
    { val: CMD_CONTRSTCUR },  // Command to set contrast
    { val: contrast, dc: true }, // Contrast value
  ];

  // Send the sequence and execute the callback if provided
  this.send_instruction_seq(sequence, callback);
};


Oled.prototype.drawPixel = function (x, y, color, bypass_buffer = false) {
  // Ensure the pixel coordinates are within the display's bounds
  if (x < 0 || x >= this.WIDTH || y < 0 || y >= this.HEIGHT) return;

  // Calculate the index in the buffer for the pixel
  const byteIndex = Math.floor(x / 2) + y * this.horizontal_chunks;

  // Determine which nibble (4 bits) to modify (left or right pixel)
  const nibble = x % 2 === 0 ? (color << 4) : color;

  if (!bypass_buffer) {
    // Update the buffer, preserving the other nibble's state
    this.buffer[byteIndex] =
      (this.buffer[byteIndex] & (x % 2 === 0 ? 0x0F : 0xF0)) | nibble;
  } else {
    // Directly update the OLED without modifying the buffer
    this.setCommandMode();
    this.spiWrite([
      CMD_COL,
      28 + Math.floor(x / 2), // Map to OLED's column address
      28 + Math.floor(x / 2),
    ]);
    this.spiWrite([CMD_ROW, y, y]);
    this.setDataMode();
    this.spiWrite([color]);
  }
};

//  Bresenham's algorithm
Oled.prototype.drawLine = function (x0, y0, x1, y1, color) {
  // Calculate the differences and steps for Bresenham's line algorithm
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1; // Step direction for x
  let sy = y0 < y1 ? 1 : -1; // Step direction for y
  let err = (dx > dy ? dx : -dy) / 2;

  while (true) {
    // Draw the current pixel
    this.drawPixel(x0, y0, color);

    // Break if we've reached the endpoint
    if (x0 === x1 && y0 === y1) break;

    let e2 = err;

    // Adjust error and step for x
    if (e2 > -dx) {
      err -= dy;
      x0 += sx;
    }

    // Adjust error and step for y
    if (e2 < dy) {
      err += dx;
      y0 += sy;
    }
  }
};

Oled.prototype.fillRect = function (x, y, w, h, color) {
  // Iterate over the width and height to draw vertical lines for the rectangle
  for (let i = x; i < x + w; i++) {
    this.drawLine(i, y, i, y + h - 1, color); // Draw a vertical line for each column
  }
};

Oled.prototype.load_and_display_logo = function (callback) {
  callback = callback || function () {}; // Ensure callback is always callable

  // Read the logo file
  fs.readFile("logo.logo", (err, data) => {
    if (err) {
      console.error("Error reading logo file:", err);
      callback(false);
      return;
    }

    try {
      const lines = data.toString().split("\n"); // Split the file into lines
      let flip = true; // Alternates pixel intensity
      let pixelIndex = 0;

      for (let line of lines) {
        while (line--) {
          // Calculate the position and set pixel intensity
          this.drawPixel(pixelIndex % this.WIDTH, Math.floor(pixelIndex / this.WIDTH), flip ? 7 : 0);
          pixelIndex++;
        }
        flip = !flip; // Toggle intensity for alternating pixels
      }

      // Update the OLED display with the buffered data
      this.update();
      callback(true);
    } catch (e) {
      console.error("Error processing logo data:", e);
      callback(false);
    }
  });
};

// Turn oled off
Oled.prototype.turnOffDisplay = function () {
  // Clear the display buffer
  this.buffer.fill(0x00);

  // Update the OLED display with the cleared buffer
  this.update(() => {
    // Send the command to turn off the display
    const sequence = [{ val: CMD_DISPOFF }];
    this.send_instruction_seq(sequence);
  });
};

// Turn oled on
Oled.prototype.turnOnDisplay = function () {
  // Send the command to turn on the display
  const sequence = [{ val: CMD_DISPON }];
  this.send_instruction_seq(sequence, () => {
    console.log("Display turned on.");
  });
};

module.exports = Oled;