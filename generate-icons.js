// Generate simple placeholder icons for the extension
// Run with: node generate-icons.js

const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color icons with "A" letter
function createSimplePNG(size) {
  // PNG file structure
  const png = [];

  // PNG Signature
  png.push(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);

  // IHDR chunk
  const ihdr = createIHDRChunk(size, size);
  png.push(...ihdr);

  // IDAT chunk (image data)
  const idat = createIDATChunk(size);
  png.push(...idat);

  // IEND chunk
  const iend = createIENDChunk();
  png.push(...iend);

  return Buffer.from(png);
}

function createIHDRChunk(width, height) {
  const data = [];

  // Width (4 bytes, big-endian)
  data.push((width >> 24) & 0xFF, (width >> 16) & 0xFF, (width >> 8) & 0xFF, width & 0xFF);
  // Height (4 bytes, big-endian)
  data.push((height >> 24) & 0xFF, (height >> 16) & 0xFF, (height >> 8) & 0xFF, height & 0xFF);
  // Bit depth: 8
  data.push(8);
  // Color type: 2 (RGB)
  data.push(2);
  // Compression: 0
  data.push(0);
  // Filter: 0
  data.push(0);
  // Interlace: 0
  data.push(0);

  return createChunk('IHDR', data);
}

function createIDATChunk(size) {
  // Create raw image data (RGB)
  const rawData = [];

  // Amazon orange: #FF9900
  const bgR = 0xFF, bgG = 0x99, bgB = 0x00;
  // White for letter
  const fgR = 0xFF, fgG = 0xFF, fgB = 0xFF;

  // Simple "A" pattern - scale based on size
  const letterA = createLetterA(size);

  for (let y = 0; y < size; y++) {
    rawData.push(0); // Filter type: None
    for (let x = 0; x < size; x++) {
      if (letterA[y * size + x]) {
        rawData.push(fgR, fgG, fgB);
      } else {
        rawData.push(bgR, bgG, bgB);
      }
    }
  }

  // Compress with zlib (deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  return createChunk('IDAT', [...compressed]);
}

function createLetterA(size) {
  const pixels = new Array(size * size).fill(false);

  // Draw a simple "A" shape
  const margin = Math.floor(size * 0.15);
  const thickness = Math.max(2, Math.floor(size * 0.15));

  // Left diagonal
  for (let y = margin; y < size - margin; y++) {
    const progress = (y - margin) / (size - 2 * margin);
    const x = Math.floor(margin + progress * (size / 2 - margin - thickness / 2));
    for (let t = 0; t < thickness; t++) {
      if (x + t < size) pixels[y * size + x + t] = true;
    }
  }

  // Right diagonal
  for (let y = margin; y < size - margin; y++) {
    const progress = (y - margin) / (size - 2 * margin);
    const x = Math.floor(size - margin - thickness - progress * (size / 2 - margin - thickness / 2));
    for (let t = 0; t < thickness; t++) {
      if (x + t < size) pixels[y * size + x + t] = true;
    }
  }

  // Horizontal bar
  const barY = Math.floor(size * 0.6);
  for (let y = barY; y < barY + thickness; y++) {
    for (let x = margin + thickness; x < size - margin - thickness; x++) {
      pixels[y * size + x] = true;
    }
  }

  return pixels;
}

function createIENDChunk() {
  return createChunk('IEND', []);
}

function createChunk(type, data) {
  const chunk = [];

  // Length (4 bytes, big-endian)
  const length = data.length;
  chunk.push((length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF);

  // Type (4 bytes)
  for (const char of type) {
    chunk.push(char.charCodeAt(0));
  }

  // Data
  chunk.push(...data);

  // CRC32
  const crcData = [...type.split('').map(c => c.charCodeAt(0)), ...data];
  const crc = crc32(crcData);
  chunk.push((crc >> 24) & 0xFF, (crc >> 16) & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF);

  return chunk;
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c >>> 0;
  }
  return table;
}

// Generate icons
const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

sizes.forEach(size => {
  const png = createSimplePNG(size);
  const filepath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filepath, png);
  console.log(`Created: icon${size}.png`);
});

console.log('Icons generated successfully!');
