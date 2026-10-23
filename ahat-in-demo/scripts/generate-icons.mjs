// Generates the PWA PNG icons from simple vector shapes, using only Node's built-in zlib.
// Run with: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [11, 31, 58];
const GOLD = [201, 162, 39];
const GOLD_DARK = [168, 133, 28];

// Shapes in 0..1 coordinates, drawn in order.
const shapes = [
  // Cap base
  { color: GOLD_DARK, points: [[0.32, 0.5], [0.5, 0.58], [0.68, 0.5], [0.68, 0.66], [0.5, 0.73], [0.32, 0.66]] },
  // Mortarboard top
  { color: GOLD, points: [[0.5, 0.29], [0.82, 0.44], [0.5, 0.59], [0.18, 0.44]] },
  // Tassel cord and end
  { color: GOLD, points: [[0.795, 0.44], [0.815, 0.44], [0.815, 0.63], [0.795, 0.63]] },
  { color: GOLD, points: [[0.78, 0.62], [0.83, 0.62], [0.84, 0.69], [0.77, 0.69]] },
];

function inside(x, y, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function render(size) {
  const ss = 4; // 4x4 supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // PNG filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size;
          const y = (py + (sy + 0.5) / ss) / size;
          let c = NAVY;
          for (const s of shapes) if (inside(x, y, s.points)) c = s.color;
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = ss * ss;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
      raw[o + 3] = 255;
    }
  }
  return png(size, size, raw);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
for (const [name, size] of [['pwa-192x192.png', 192], ['pwa-512x512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/${name}`, render(size));
  console.log(`public/${name}`);
}
