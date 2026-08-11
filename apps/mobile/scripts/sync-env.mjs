import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, '..');
const webEnvPath = resolve(mobileRoot, '..', 'web', '.env.local');
const mobileEnvPath = resolve(mobileRoot, '.env.local');

const source = await readFile(webEnvPath, 'utf8');
const values = Object.fromEntries(
  source
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

if (!values.VITE_SUPABASE_URL || !values.VITE_SUPABASE_ANON_KEY || !values.VITE_MAPBOX_TOKEN) {
  throw new Error(
    'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ou VITE_MAPBOX_TOKEN est absent de l’app web.',
  );
}

await writeFile(
  mobileEnvPath,
  [
    `EXPO_PUBLIC_SUPABASE_URL=${values.VITE_SUPABASE_URL}`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${values.VITE_SUPABASE_ANON_KEY}`,
    `EXPO_PUBLIC_MAPBOX_TOKEN=${values.VITE_MAPBOX_TOKEN}`,
    '',
  ].join('\n'),
  'utf8',
);

console.log('Configuration Supabase et Mapbox mobile synchronisée depuis l’app web.');
