/* Affiche un PNG en ASCII art (luminance). Usage : node scripts/png-ascii.mjs <fichier> [cols] */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const file = process.argv[2];
const cols = Number(process.argv[3] ?? 64);
const buf = readFileSync(file);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Pas un PNG');

let pos = 8, width = 0, height = 0, colorType = 0;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
  else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}
const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
const stride = width * bpp;
const raw = inflateSync(Buffer.concat(idat));
const out = Buffer.alloc(height * stride);
let prev = Buffer.alloc(stride);
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const cur = out.subarray(y * stride, (y + 1) * stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
    let v = line[x];
    if (filter === 1) v = (v + a) & 0xff;
    else if (filter === 2) v = (v + b) & 0xff;
    else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
    else if (filter === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
    }
    cur[x] = v;
  }
  prev = cur;
}
const rows = Math.round((cols * height) / width);
const ramp = ' .:-=+*#%@';
for (let r = 0; r < rows; r++) {
  let line = '';
  for (let c = 0; c < cols; c++) {
    const x = Math.min(width - 1, Math.floor(((c + 0.5) / cols) * width));
    const y = Math.min(height - 1, Math.floor(((r + 0.5) / rows) * height));
    const i = (y * width + x) * bpp;
    const lum = (0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2]) / 255;
    line += ramp[Math.min(ramp.length - 1, Math.floor(lum * (ramp.length - 1)))];
  }
  console.log(line);
}
