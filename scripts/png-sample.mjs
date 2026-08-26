/* Décode un PNG (sans dépendance) et affiche une grille de couleurs échantillonnée.
 * Usage : node scripts/png-sample.mjs <fichier.png> [cols] [rows]
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const file = process.argv[2];
const cols = Number(process.argv[3] ?? 24);
const rows = Number(process.argv[4] ?? 16);
const buf = readFileSync(file);

if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Pas un PNG');

let pos = 8;
let width = 0, height = 0, bitDepth = 0, colorType = 0;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === 'IDAT') {
    idat.push(data);
  } else if (type === 'IEND') {
    break;
  }
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
    const a = x >= bpp ? cur[x - bpp] : 0;
    const b = prev[x];
    const c = x >= bpp ? prev[x - bpp] : 0;
    let v = line[x];
    if (filter === 1) v = (v + a) & 0xff;
    else if (filter === 2) v = (v + b) & 0xff;
    else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      v = (v + pr) & 0xff;
    }
    cur[x] = v;
  }
  prev = cur;
}

const px = (x, y) => {
  const i = (y * width + x) * bpp;
  return [out[i], out[i + 1], out[i + 2]];
};
const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

console.log(`PNG ${width}x${height} (${colorType === 6 ? 'RGBA' : 'RGB'})`);
for (let r = 0; r < rows; r++) {
  const cells = [];
  for (let c = 0; c < cols; c++) {
    const x = Math.min(width - 1, Math.floor(((c + 0.5) / cols) * width));
    const y = Math.min(height - 1, Math.floor(((r + 0.5) / rows) * height));
    cells.push(hex(px(x, y)));
  }
  console.log(cells.join(' '));
}

// Colonnes échantillonnées verticales (x fixe) pour voir les bandes.
console.log('\nProfils verticaux (x = 10%, 50%, 90%) :');
for (let r = 0; r < 20; r++) {
  const y = Math.min(height - 1, Math.floor(((r + 0.5) / 20) * height));
  const row = [0.1, 0.5, 0.9].map((fx) => hex(px(Math.min(width - 1, Math.floor(fx * width)), y)));
  console.log(`${((y / height) * 100).toFixed(0)}%\t${row.join('  ')}`);
}
