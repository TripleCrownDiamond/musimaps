/**
 * Tests SQL contre un Postgres JETABLE (Docker) — jamais contre la production.
 *
 * Démarre `postgres:15-alpine` sur 127.0.0.1:54329, lance les tests de
 * scripts/db-test/, puis supprime le conteneur quoi qu'il arrive.
 *
 * Usage : npm run test:db              (Docker doit tourner)
 *         npm run test:db -- account   (seuls les fichiers dont le nom contient « account »)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const CONTAINER = 'musimaps-db-test'
const PORT = 54329
const IMAGE = 'postgres:15-alpine'

// Docker Desktop (macOS) n'ajoute pas toujours sa CLI au PATH.
const DOCKER_DESKTOP_BIN = '/Applications/Docker.app/Contents/Resources/bin'
const env = existsSync(DOCKER_DESKTOP_BIN)
  ? { ...process.env, PATH: `${process.env.PATH}:${DOCKER_DESKTOP_BIN}` }
  : process.env

const docker = (...args) => spawnSync('docker', args, { env, encoding: 'utf8' })
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

if (docker('info').status !== 0) {
  console.error('Docker ne répond pas : démarrer Docker Desktop puis relancer npm run test:db.')
  process.exit(1)
}

docker('rm', '-f', CONTAINER)
const started = docker(
  'run', '-d', '--rm', '--name', CONTAINER,
  '-e', 'POSTGRES_PASSWORD=test',
  '-p', `127.0.0.1:${PORT}:5432`,
  IMAGE,
)
if (started.status !== 0) {
  console.error(started.stderr)
  process.exit(1)
}

let status = 1
try {
  // -h 127.0.0.1 : le serveur temporaire de l'initialisation n'écoute que sur
  // la socket Unix ; seul le serveur définitif répond en TCP.
  let ready = false
  for (let i = 0; i < 120 && !ready; i += 1) {
    ready = docker('exec', CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres').status === 0
    if (!ready) pause(500)
  }
  if (!ready) throw new Error('Postgres ne démarre pas')

  // Une base par fichier, fichiers l'un après l'autre : chacun rejoue
  // schema.sql (CREATE TABLE auth.users…) et les rôles sont communs au
  // cluster. Lancés ensemble sur la même base, ils se marchaient dessus.
  const only = process.argv.slice(2)
  const tests = readdirSync(here)
    .filter((file) => file.endsWith('.test.mjs'))
    .filter((file) => only.length === 0 || only.some((part) => file.includes(part)))
    .sort()
  if (tests.length === 0) throw new Error(`Aucun test ne correspond à : ${only.join(' ')}`)
  let failed = false
  for (const file of tests) {
    const db = `test_${path.basename(file, '.test.mjs').replace(/\W/g, '_')}`
    const created = docker('exec', CONTAINER, 'createdb', '-U', 'postgres', db)
    if (created.status !== 0) throw new Error(created.stderr)
    const run = spawnSync(process.execPath, ['--test', path.join(here, file)], {
      stdio: 'inherit',
      env: { ...process.env, DB_URL: `postgres://postgres:test@127.0.0.1:${PORT}/${db}` },
    })
    if (run.status !== 0) failed = true
  }
  status = failed ? 1 : 0
} catch (error) {
  console.error(error.message)
} finally {
  docker('rm', '-f', CONTAINER)
}
process.exit(status)
