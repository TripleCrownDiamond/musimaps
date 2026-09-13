/**
 * Tests SQL contre un Postgres JETABLE (Docker) — jamais contre la production.
 *
 * Démarre `postgres:15-alpine` sur 127.0.0.1:54329, lance les tests de
 * scripts/db-test/, puis supprime le conteneur quoi qu'il arrive.
 *
 * Usage : npm run test:db   (Docker doit tourner)
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

  const tests = readdirSync(here)
    .filter((file) => file.endsWith('.test.mjs'))
    .map((file) => path.join(here, file))
  status = spawnSync(process.execPath, ['--test', ...tests], {
    stdio: 'inherit',
    env: { ...process.env, DB_URL: `postgres://postgres:test@127.0.0.1:${PORT}/postgres` },
  }).status ?? 1
} catch (error) {
  console.error(error.message)
} finally {
  docker('rm', '-f', CONTAINER)
}
process.exit(status)
