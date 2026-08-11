/**
 * Applique les migrations Supabase sur la base distante.
 *
 * Lit le mot de passe de la base depuis `.env` (DATABASE_PASSWORD) et le
 * project ref depuis `apps/web/.env.local` (VITE_SUPABASE_URL), puis lance
 * `supabase db push` via le pooler (aucune clé d'accès requise).
 *
 * Usage : npm run db:migrate
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const rootEnv = loadEnv(path.join(root, '.env'))
const webEnv = loadEnv(path.join(root, 'apps', 'web', '.env.local'))

const password = rootEnv.DATABASE_PASSWORD
const url = webEnv.VITE_SUPABASE_URL
if (!password || !url) {
  console.error('Manquant : DATABASE_PASSWORD (racine .env) ou VITE_SUPABASE_URL (apps/web/.env.local).')
  process.exit(1)
}
const ref = url.replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1')

const dbUrl = `postgresql://postgres.${ref}:${password}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`

console.log(`Migration de la base « ${ref} »…`)
try {
  execSync(`npx supabase db push --db-url "${dbUrl}" --include-all`, {
    cwd: root,
    stdio: 'inherit',
  })
  console.log('✅ Migrations appliquées.')
} catch {
  console.error('Échec de la migration. Vérifiez le mot de passe et le project ref.')
  process.exit(1)
}
