/**
 * Sauvegarde complète du projet Supabase, hors du dépôt.
 *
 * - base.dump : toute la base (public, auth, storage…), format pg_dump custom,
 *   restaurable sur n'importe quel Postgres avec `pg_restore --no-owner`.
 * - base.sql : la même chose en SQL lisible.
 * - fichiers/ : tous les fichiers du stockage, rangés par bucket.
 *
 * Lecture seule : rien n'est modifié côté Supabase. pg_dump tourne dans Docker
 * (image postgres officielle), aucune installation locale requise.
 * Mêmes identifiants que `db:migrate` : DATABASE_PASSWORD (racine .env) et
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local). En
 * sauvegarde automatique (GitHub Actions, voir docs/SAUVEGARDES.md), les
 * mêmes valeurs arrivent par l'environnement : DATABASE_PASSWORD,
 * SUPABASE_URL, SUPABASE_ANON_KEY, et BACKUP_DIR pour le dossier de sortie.
 *
 * Sortie : ../musimaps-play/sauvegardes/supabase-AAAA-MM-JJ/ (ou BACKUP_DIR)
 * Contient des données personnelles (e-mails, mots de passe chiffrés) :
 * ne jamais la versionner ni la partager.
 *
 * Usage : npm run db:backup
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PG_IMAGE = 'postgres:17-alpine'

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

const password = process.env.DATABASE_PASSWORD ?? rootEnv.DATABASE_PASSWORD
const url = process.env.SUPABASE_URL ?? webEnv.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY ?? webEnv.VITE_SUPABASE_ANON_KEY
if (!password || !url) {
  console.error('Manquant : DATABASE_PASSWORD (racine .env) ou VITE_SUPABASE_URL (apps/web/.env.local).')
  process.exit(1)
}
const ref = url.replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1')

const day = new Date().toISOString().slice(0, 10)
const outDir = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(root, '..', 'musimaps-play', 'sauvegardes', `supabase-${day}`)
mkdirSync(outDir, { recursive: true })

// Le mot de passe passe par l'environnement, jamais par la ligne de commande.
const conn = `host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.${ref} sslmode=require`
const docker = (args, opts = {}) =>
  execFileSync(
    'docker',
    ['run', '--rm', '-e', 'PGPASSWORD', '-v', `${outDir}:/out`, PG_IMAGE, ...args],
    { env: { ...process.env, PGPASSWORD: password }, maxBuffer: 256 * 1024 * 1024, ...opts },
  )

console.log(`Sauvegarde de la base « ${ref} » → ${outDir}`)
docker(['pg_dump', conn, '-Fc', '-f', '/out/base.dump'], { stdio: 'inherit' })
docker(['pg_dump', conn, '--no-owner', '--no-privileges', '-f', '/out/base.sql'], { stdio: 'inherit' })
console.log('✅ Base sauvegardée (base.dump, base.sql).')

// Fichiers du stockage : la liste vient de la base, le contenu de l'API Storage.
const list = docker([
  'psql', conn, '-At', '-F', '\t', '-c',
  'select o.bucket_id, o.name, b.public from storage.objects o join storage.buckets b on b.id = o.bucket_id order by 1, 2',
]).toString().trim()
const objects = list ? list.split('\n').map((row) => row.split('\t')) : []
writeFileSync(path.join(outDir, 'fichiers.tsv'), 'bucket\tnom\tpublic\n' + list + '\n')

const failed = []
let saved = 0
for (const [bucket, name, isPublic] of objects) {
  const encoded = name.split('/').map(encodeURIComponent).join('/')
  const access = isPublic === 't' ? 'public' : 'authenticated'
  try {
    const res = await fetch(`${url}/storage/v1/object/${access}/${bucket}/${encoded}`, {
      headers: anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {},
    })
    if (!res.ok) throw new Error(String(res.status))
    const file = path.join(outDir, 'fichiers', bucket, name)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    saved++
  } catch (error) {
    failed.push(`${bucket}/${name}\t${error.message}`)
  }
}
if (failed.length) writeFileSync(path.join(outDir, 'fichiers-echecs.txt'), failed.join('\n') + '\n')
console.log(`✅ Fichiers : ${saved}/${objects.length} téléchargés${failed.length ? ` (${failed.length} échecs, voir fichiers-echecs.txt)` : ''}.`)
