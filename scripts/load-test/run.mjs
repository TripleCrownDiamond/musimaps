/**
 * Lance le test de charge k6 (scripts/load-test/app-open.js) dans Docker,
 * sans rien installer : image officielle grafana/k6.
 *
 * Usage :
 *   npm run load:test                          # MODE=avant, 100 utilisateurs
 *   npm run load:test -- apres 300             # avec le cache, 300 au pic
 *
 * Lit l'URL et la clé publique (anon) dans apps/web/.env.local, comme
 * l'app web. Lecture seule : voir l'en-tête de app-open.js.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const K6_IMAGE = 'grafana/k6:0.54.0'

const env = {}
const envFile = path.join(root, 'apps', 'web', '.env.local')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const url = process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local).')
  process.exit(1)
}

const [mode = 'avant', peak = '100'] = process.argv.slice(2)
if (!['avant', 'apres'].includes(mode) || !/^\d+$/.test(peak)) {
  console.error('Usage : npm run load:test -- [avant|apres] [utilisateurs au pic]')
  process.exit(1)
}

// Docker Desktop (macOS) n'ajoute pas toujours sa CLI au PATH.
const DOCKER_DESKTOP_BIN = '/Applications/Docker.app/Contents/Resources/bin'
const dockerEnv = existsSync(DOCKER_DESKTOP_BIN)
  ? { ...process.env, PATH: `${process.env.PATH}:${DOCKER_DESKTOP_BIN}` }
  : process.env

console.log(`Test de charge : mode « ${mode} », ${peak} utilisateurs simultanés au pic (≈ 3 min).`)
// La clé passe par l'environnement du conteneur, jamais par la ligne de commande.
const result = spawnSync(
  'docker',
  [
    'run', '--rm', '-i',
    '-e', 'SUPABASE_URL', '-e', 'SUPABASE_ANON_KEY', '-e', 'MODE', '-e', 'PEAK',
    '-v', `${here}:/scripts:ro`,
    K6_IMAGE, 'run', '--quiet', '/scripts/app-open.js',
  ],
  {
    stdio: 'inherit',
    env: { ...dockerEnv, SUPABASE_URL: url, SUPABASE_ANON_KEY: key, MODE: mode, PEAK: peak },
  },
)
process.exit(result.status ?? 1)
