import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const S = 1024;
const pixels = Buffer.alloc(S * S * 4, 0);

function blend(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return;
  const i = (y * S + x) * 4;
  const srcA = a / 255;
  const dstA = pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  pixels[i] = Math.round((r * srcA + pixels[i] * dstA * (1 - srcA)) / outA);
  pixels[i + 1] = Math.round((g * srcA + pixels[i + 1] * dstA * (1 - srcA)) / outA);
  pixels[i + 2] = Math.round((b * srcA + pixels[i + 2] * dstA * (1 - srcA)) / outA);
  pixels[i + 3] = Math.round(outA * 255);
}

function fill(r, g, b) {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
}

function ellipse(cx, cy, rx, ry, r, g, b) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(S - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(S - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) blend(x, y, r, g, b, 255);
    }
  }
}

fill(0x1b, 0x12, 0x0c);
ellipse(512, 540, 340, 390, 0xc4, 0x7a, 0x32);
ellipse(512, 530, 300, 348, 0xf3, 0xcc, 0x8a);
ellipse(512, 430, 150, 70, 0xff, 0xe2, 0x8a);
ellipse(400, 560, 28, 36, 0x3a, 0x20, 0x12);
ellipse(624, 560, 28, 36, 0x3a, 0x20, 0x12);
ellipse(400, 548, 10, 12, 0xff, 0xf4, 0xe0);
ellipse(624, 548, 10, 12, 0xff, 0xf4, 0xe0);

for (let y = 680; y <= 760; y++) {
  const t = (y - 680) / 80;
  const half = 90 + Math.sin(t * Math.PI) * 70;
  for (let x = Math.round(512 - half); x <= 512 + half; x++) {
    const edge = y < 688 || y > 752 || x < 512 - half + 8 || x > 512 + half - 8;
    blend(x, y, edge ? 0x3a : 0x6b, edge ? 0x20 : 0x38, edge ? 0x12 : 0x22, 255);
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  pixels.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../build/icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(out);
