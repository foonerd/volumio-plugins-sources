const fs = require("fs");
const { Gpio } = require("onoff");

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
  // Display dimensions and chunk calculations
  this.HEIGHT = opts.height || 64;
  this.WIDTH = opts.width || 256;
  this.horizontal_chunks = this.WIDTH >> 2;

  // Display registers
  this._rXs = 28;
  this._rXe = this._rXs + this.horizontal_chunks - 1;
  this._rYs = 0;
  this._rYe = this._rYs + this.HEIGHT - 1;

  // GPIO pins for SPI-like communication
  this.DCPIN = opts.dcPin || 27; // Data/Command pin
  this.RSPIN = opts.rstPin || 24; // Reset pin
  this.CLKPIN = opts.clkPin || 11; // Clock pin
  this.DATAPIN = opts.dataPin || 10; // MOSI/Data pin

  // Cursor position
  this.cursor_x = 0;
  this.cursor_y = 0;

  // Initialize display buffer
  this.buffer = Buffer.alloc(2 * this.horizontal_chunks * this.HEIGHT);
  this.bufferlength = this.buffer.length;

  // GPIO pin handling using onoff
  const { Gpio } = require("onoff");
  this.dcPin = new Gpio(this.DCPIN, "out");
  this.rsPin = new Gpio(this.RSPIN, "out");
  this.clkPin = new Gpio(this.CLKPIN, "out");
  this.dataPin = new Gpio(this.DATAPIN, "out");

  // Additional properties
  this.last_change = null;
  this.change_log = {};
  this.updateInProgress = false;
  this.hex_font = null;
  this.contrast = opts.contrast || 0x00;

  // Debug information
  console.log(
    "Buffer length:",
    this.bufferlength,
    "Horizontal chunks:",
    this.horizontal_chunks
  );
}

Oled.prototype.begin = function () {
  // Ensure the display reset pin is properly initialized
  this.reset();

  // Initialize the OLED display with commands
  this._initialise();

  // Clear the display buffer and update the OLED
  this.clear();

  // Set up a process exit handler to ensure cleanup
  process.on("exit", () => {
    this.clear(); // Clear the display
    this.cleanup(); // Release GPIO resources
  });

  console.log("OLED initialization complete.");
}

Oled.prototype._initialise = function () {
  // Initialization sequence for the OLED display
  const seq = [
    { val: CMD_COMLOCK },         // Unlock command lock
    { val: 0x12, dc: true },      // Command lock setting
    { val: CMD_DISPOFF },         // Display OFF
    { val: CMD_COL, dc: true },   // Set column start and end
    { val: this._rXs },           // Start column
    { val: this._rXe },           // End column
    { val: CMD_ROW, dc: true },   // Set row start and end
    { val: this._rYs },           // Start row
    { val: this._rYe },           // End row
    { val: CMD_SETCLKFREQ, dc: true }, // Set display clock frequency
    { val: this.divisor },             // Frequency divisor
    { val: CMD_MUXRATIO, dc: true },   // Multiplex ratio
    { val: this._rYe },                // Height of the display
    { val: CMD_DISPOFFSET, dc: true }, // Display offset
    { val: 0x00 },                     // No offset
    { val: CMD_SETSTART, dc: true },   // Set start line
    { val: 0x00 },                     // Start line at 0
    { val: CMD_MODE, dc: true },       // Remap format
    { val: 0x14 },                     // Horizontal addressing
    { val: 0x11 },                     // Sequential COM
    { val: CMD_SETGPIO, dc: true },    // GPIO settings
    { val: 0x00 },                     // Disable GPIO
    { val: CMD_VDDSEL, dc: true },     // Enable external VDD
    { val: 0x01 },                     // Function selection
    { val: CMD_DISPENHA, dc: true },   // Display enhancement
    { val: 0x00 },                     // Enable external VSL
    { val: 0xB0 },                     // VSL selection
    { val: CMD_CONTRSTCUR, dc: true }, // Contrast current
    { val: this.contrast },            // Set contrast
    { val: CMD_MSTCONTRST, dc: true }, // Master contrast
    { val: 0b11001111 },               // High contrast
    { val: CMD_DEFGRYTABLE },          // Default grayscale table
    { val: CMD_ENGREYSCALE },          // Enable grayscale
    { val: CMD_PHASELEN, dc: true },   // Phase length
    { val: 0x05 },                     // Phase 1
    { val: 0x03 },                     // Phase 2
    { val: CMD_DISPENHB, dc: true },   // Display enhancement B
    { val: 0x82 },                     // Precharge and discharge
    { val: 0x20 },                     // Enhanced driving scheme
    { val: CMD_PRECHRGVOL, dc: true }, // Precharge voltage
    { val: 0x1F },                     // Level
    { val: CMD_SECPRECHRG, dc: true }, // Second precharge period
    { val: 0x08 },                     // Period
    { val: CMD_SETVCOMH, dc: true },   // Set VCOMH
    { val: 0x07 },                     // VCOMH level
    { val: CMD_DISPNORM },             // Set display to normal mode
    { val: CMD_DISPON }                // Display ON
  ];

  // Send the initialization sequence using the helper method
  this.send_instruction_seq(seq);
}

Oled.prototype.send_instruction_seq = function (sequence, callback, index = 0) {
  // Base case: if the sequence is complete
  if (index >= sequence.length) {
    if (typeof callback === "function") callback();
    return;
  }

  const current = sequence[index];

  // Handle Data/Command mode toggling
  if (current.dc) {
    this.dcPin.writeSync(1); // Set DC pin HIGH for Data mode
    this.send_instruction_seq(sequence, callback, index + 1);
  } else if (current.cd) {
    this.dcPin.writeSync(0); // Set DC pin LOW for Command mode
    this.send_instruction_seq(sequence, callback, index + 1);
  } else {
    // Send the value
    let value = current.val;
    if (typeof value !== "object") value = Buffer.from([value]);

    // Simulate SPI write using bit-banging
    this.spiWrite(value);

    // Move to the next instruction
    this.send_instruction_seq(sequence, callback, index + 1);
  }
}

Oled.prototype.update = function (callback) {
  // Prevent multiple updates from running simultaneously
  if (this.updateInProgress) {
    if (typeof callback === "function") callback();
    return;
  }

  this.updateInProgress = true;

  // Create a static copy of the buffer to avoid overwriting during update
  const static_frame = Buffer.alloc(this.buffer.length);
  this.buffer.copy(static_frame);

  // Define the sequence for updating the display
  const sequence = [
    { val: CMD_COL }, // Set column address
    { dc: true, val: 28 },
    { dc: true, val: 28 + this.horizontal_chunks - 1 },
    { cd: true },
    { val: CMD_ROW }, // Set row address
    { dc: true, val: 0x00 },
    { dc: true, val: this.HEIGHT - 1 },
    { cd: true },
    { val: CMD_WRITE }, // Write mode
    { dc: true, val: static_frame }, // Display buffer content
    { cd: true }
  ];

  // Send the sequence
  this.send_instruction_seq(sequence, () => {
    this.updateInProgress = false;

    // Execute callback if provided
    if (typeof callback === "function") callback();
  });
}

Oled.prototype.clear = function (callback) {
  this.buffer.fill(0x00); // Fill the display buffer with zeros
  this.update(() => {
    if (typeof callback === "function") callback();
  });
}

Oled.prototype.reset = function () {
  // Pull the reset pin LOW to reset the display
  this.rsPin.writeSync(0);

  // Hold the reset pin LOW for 10 milliseconds
  setTimeout(() => {
    // Pull the reset pin HIGH to complete the reset
    this.rsPin.writeSync(1);
  }, 10);
}

// Set the starting position of a text string on the OLED
Oled.prototype.setCursor = function (x, y) {
  this.cursor_x = x;
  this.cursor_y = y;
}

// Write text to the OLED display
Oled.prototype.writeString = function (font, size, string, color) {
  var wordArr = string.split(' '); // Split the string into words
  var len = wordArr.length;
  var offset = this.cursor_x; // Start at the current cursor position
  var padding = 0, letspace = 0, leading = 2; // Spacing variables

  for (var w = 0; w < len; w++) {
    wordArr[w] += ' '; // Add a space after each word
    var stringArr = wordArr[w].split(''); // Split the word into characters
    var slen = stringArr.length;

    for (var i = 0; i < slen; i++) {
      var charBuf = this._findCharBuf(font, stringArr[i]); // Find character buffer in the font
      if (!charBuf) {
        console.warn(`Character "${stringArr[i]}" not found in font.`);
        continue; // Skip characters not in the font
      }
      var charBytes = this._readCharBytes(charBuf); // Read the character's binary data
      this._drawChar(charBytes, size, color); // Draw the character on the screen

      padding = size + letspace; // Calculate padding for character spacing
      offset += (font.width * size) + padding; // Update the cursor offset
      this.setCursor(offset, this.cursor_y); // Move the cursor to the next position
    }
  }
}

// Draw an individual character to the screen
Oled.prototype._drawChar = function (byteArray, size, col) {
  var x = this.cursor_x; // Starting X position
  var y = this.cursor_y; // Starting Y position

  for (var i = 0; i < byteArray.length; i++) {
    for (var j = 0; j < 8; j++) {
      var color = ((byteArray[i] >> j) & 1) * col; // Determine pixel color (on or off)

      if (size === 1) {
        // Draw a single pixel for standard size
        this.drawPixel(x + i, y + j, color);
      } else {
        // Scale the character size and draw a filled rectangle
        var xpos = x + (i * size);
        var ypos = y + (j * size);
        this.fillRect(xpos, ypos, size, size, color);
      }
    }
  }
}

// Load a hex font for BASIC UNICODE SUPPORT
Oled.prototype.load_hex_font = function (fontpath, callback) {
  this.hex_font = {}; // Initialize the hex font storage

  fs.readFile(fontpath, (err, data) => {
    if (err) {
      console.error("Error reading font file:", err);
      if (typeof callback === "function") {
        callback(err);
      }
      return;
    }

    // Split the font file into individual character entries
    const unichars = data.toString().split("\n");

    for (let unichar of unichars) {
      const code = parseInt(unichar.substring(0, 4), 16); // Unicode code point
      const value = unichar.substring(5); // Hex pixel data

      if (code && value) {
        let columns, row_length;

        // Determine the dimensions of the character
        if (value.length === 64) {
          columns = 4;
          row_length = 16;
        } else {
          columns = 2;
          row_length = 8;
        }

        // Split the hex data into rows and parse into integers
        const splitval = chunkString(value, columns).map(hex => parseInt(hex, 16));

        // Store the character data in the hex font object
        this.hex_font[code] = {
          data: splitval, // Binary data of the character
          length: row_length // Number of rows (height)
        };
      }
    }

    // Invoke the callback if provided
    if (typeof callback === "function") {
      callback(null);
    }
  });
}

Oled.prototype.CacheGlyphsData = function (string) {
  // Initialize the glyph cache
  this.cached_glyph = {};
  if (!this.hex_font) {
    console.log("Font not loaded. Please call load_hex_font() first.");
    return;
  }

  // Extract unique characters from the string
  const used_chars = new Set(string);

  for (let char of used_chars) {
    const charCode = char.charCodeAt(); // Get Unicode code point
    const glyph_raw_data = this.hex_font[charCode]; // Lookup glyph data in the font

    if (glyph_raw_data) {
      const binary_glyph = [];

      // Process each row of the glyph's hex data
      for (let row of glyph_raw_data.data) {
        const binary_row_string = row.toString(2).padStart(glyph_raw_data.length, "0");
        binary_glyph.push(binary_row_string); // Add binary row to the glyph
      }

      // Cache the glyph data
      this.cached_glyph[char] = {
        data: binary_glyph, // Binary representation of the character
        width: binary_glyph[0]?.length || 0, // Width of the glyph
        height: binary_glyph.length, // Height of the glyph
      };
    } else {
      console.warn(`Character "${char}" not found in the font.`);
    }
  }
}

Oled.prototype.writeStringUnifont = function (string, color) {
  if (!this.hex_font) {
    console.log("Font not loaded. Please call load_hex_font() first.");
    return;
  }

  if (!this.cached_glyph) {
    console.log("Glyphs not cached. Please call CacheGlyphsData() first.");
    return;
  }

  // Loop through each character in the string
  for (let char of string) {
    if (this.cursor_x >= this.WIDTH) return; // Stop rendering if out of bounds

    const charBuf = this.cached_glyph[char]; // Retrieve glyph from cache
    if (!charBuf) {
      console.warn(`Character "${char}" not found in cached glyphs.`);
      continue; // Skip if glyph is missing
    }

    // Render the character
    this._drawCharUnifont(charBuf, color);

    // Move the cursor for the next character
    this.setCursor(this.cursor_x + charBuf.width, this.cursor_y);
  }
}

Oled.prototype.getStringWidthUnifont = function (string) {
  if (!this.hex_font) {
    console.log("Font not loaded. Please call load_hex_font() first.");
    return 0;
  }

  if (!string || string.length === 0) return 0;

  let totalWidth = 0;

  // Loop through each character in the string
  for (let char of string) {
    const charBuf = this.hex_font[char.charCodeAt(0)]; // Retrieve the character's font buffer
    if (charBuf) {
      totalWidth += charBuf.length; // Add the character's width to the total
    } else {
      console.warn(`Character "${char}" not found in font.`);
    }
  }

  return totalWidth;
};

// Draw an individual character to the screen using Unifont glyph data
Oled.prototype._drawCharUnifont = function (buf, color) {
  const startX = this.cursor_x; // Starting X position
  const startY = this.cursor_y; // Starting Y position
  const data = buf.data; // Glyph binary data

  // Iterate over each row of the glyph
  for (let row = 0; row < buf.height; row++) {
    // Iterate over each column in the current row
    for (let col = 0; col < buf.width; col++) {
      // Determine the pixel's state (on/off) from glyph data
      const pixel = data[row][col] === "1" ? color : 0

      // Render the pixel on the OLED screen
      this.drawPixel(startX + col, startY + row, pixel)
    }
  }
}

// Converts an array of bytes into an array of binary rows for character rendering
Oled.prototype._readCharBytes = function (byteArray) {
  var bitArr = []; // Temporary array to store bits for each byte
  var bitCharArr = []; // Final array to store binary rows for all bytes

  // Loop through each byte in the byte array
  for (var i = 0; i < byteArray.length; i += 1) {
    var byte = byteArray[i];
    
    // Extract each bit from the byte
    for (var j = 0; j < 8; j += 1) {
      var bit = (byte >> j) & 1; // Isolate the bit at position j
      bitArr.push(bit);
    }
    
    // Add the row of bits to the result and reset for the next byte
    bitCharArr.push(bitArr);
    bitArr = [];
  }

  return bitCharArr;
}

// Locate the character's bitmap data within the font object
Oled.prototype._findCharBuf = function(font, c) {
  // Check if the font lookup table and font data are available
  if (!font || !font.lookup || !font.fontData) {
    console.warn("Font data or lookup table is missing. Cannot find character buffer.");
    return null;
  }

  // Find the position of the character in the font's lookup table
  const cBufPos = font.lookup.indexOf(c) * font.width;

  // If the character is not found, return null
  if (cBufPos < 0) {
    console.warn(`Character "${c}" not found in font.`);
    return null;
  }

  // Extract and return the character's bitmap data
  const cBuf = font.fontData.slice(cBufPos, cBufPos + font.width);
  return cBuf;
}

// Turn off the OLED display
Oled.prototype.turnOffDisplay = function() {
  // Clear the display buffer
  this.buffer.fill(0x00);

  // Update the display to clear it
  this.update(() => {
    // Send the command to turn off the display
    this.send_instruction_seq([{ val: CMD_DISPOFF }]);
  });
}

// Turn on the OLED display
Oled.prototype.turnOnDisplay = function() {
  this.send_instruction_seq([{val: CMD_DISPON}]);
}

Oled.prototype.setContrast = function(contrast, callback) {
  // Ensure contrast is within valid range
  if (contrast < 0 || contrast > 255) {
    console.warn("Contrast value must be between 0 and 255.");
    return;
  }

  // Define the sequence to set the contrast
  const seq = [
    { val: CMD_CONTRSTCUR },
    { val: contrast, dc: true }
  ];

  // Send the instruction sequence with the callback
  this.send_instruction_seq(seq, callback);
}

Oled.prototype.drawPixel = function(x, y, color, bypass_buffer) {
  // Ensure the pixel coordinates are within the display bounds
  if (
    x >= this.WIDTH || 
    y >= this.HEIGHT || 
    x < 0 || 
    y < 0
  ) { 
    return;
  }

  // Calculate the horizontal index and buffer index for the pixel
  const horizontal_index = x >> 1; // Each buffer entry represents two horizontal pixels
  const buffer_index = horizontal_index + ((this.horizontal_chunks << 1) * y);

  // Get the current state of the buffer for the given index
  const oled_subcolumn_state = this.buffer[buffer_index];
  
  // Determine whether the pixel is in the right or left column
  const right_col = x & 0x1; // True if x is odd, indicating the right column
  const sub_col_left = oled_subcolumn_state >> 4; // Extract left nibble (4 bits)
  const sub_col_right = oled_subcolumn_state & 0x0f; // Extract right nibble (4 bits)

  if (right_col) {
    // Update the right column pixel
    this.buffer[buffer_index] = (sub_col_left << 4) | color; // Preserve left, update right
  } else {
    // Update the left column pixel
    this.buffer[buffer_index] = (color << 4) | sub_col_right; // Preserve right, update left
  }

  // Optionally bypass the buffer and update the OLED directly
  if (bypass_buffer) {
    this.setCommandMode();
    this.spiWrite([
      CMD_COL,
      28 + horizontal_index,
      28 + horizontal_index,
    ]);
    this.spiWrite([CMD_ROW, y, y]);
    this.setDataMode();
    this.spiWrite([color]);
  }
}

// Bresenham's algorithm
Oled.prototype.drawLine = function(x0, y0, x1, y1, color) {
  // Calculate differences and steps
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;

  // Initialize error term
  let err = (dx > dy ? dx : -dy) / 2;

  while (true) {
    // Draw the current pixel
    this.drawPixel(x0, y0, color);

    // Check if the line drawing is complete
    if (x0 === x1 && y0 === y1) break;

    // Store the error term for comparison
    let e2 = err;

    // Adjust error term and move the x-coordinate
    if (e2 > -dx) {
      err -= dy;
      x0 += sx;
    }

    // Adjust error term and move the y-coordinate
    if (e2 < dy) {
      err += dx;
      y0 += sy;
    }
  }
}

Oled.prototype.fillRect = function(x, y, w, h, color) {
  // Loop through each column within the rectangle's width
  for (let i = x; i < x + w; i++) {
    // Draw a vertical line from the top to the bottom of the rectangle
    this.drawLine(i, y, i, y + h - 1, color);
  }
}

Oled.prototype.load_and_display_logo = function(callback) {
  callback = callback || function() {}; // Default callback to an empty function if none is provided.

  fs.readFile("logo.logo", (err, data) => {
    if (err) {
      console.log("Error loading logo file:", err);
      callback(false);
      return;
    }

    try {
      data = data.toString().split("\n");
      let flip = true; // Alternate pixel colors for a simple effect.
      let p = 0; // Pixel index.

      // Iterate through each line of the logo data.
      for (let d of data) {
        let pixelCount = parseInt(d, 10); // Parse the number of pixels to process.
        if (isNaN(pixelCount)) continue; // Skip invalid lines.

        while (pixelCount--) {
          const x = p % this.WIDTH; // Calculate x-coordinate.
          const y = Math.floor(p / this.WIDTH); // Calculate y-coordinate.
          const color = flip ? 7 : 0; // Alternate between colors.

          this.drawPixel(x, y, color); // Draw the pixel.
          p++;
        }

        flip = !flip; // Toggle the color.
      }

      this.update(); // Push the updated buffer to the display.
      callback(true);
    } catch (e) {
      console.log("Error while displaying logo:", e);
      callback(false);
    }
  });
};

module.exports = Oled;
