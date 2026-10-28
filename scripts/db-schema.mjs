/**
 * Exporte le SCHÉMA de production (sans aucune donnée) dans
 * supabase/schema/production.sql.
 *
 * Pourquoi : les migrations 00001 à 00014 ne sont pas dans le dépôt. Les
 * tables d'origine (profiles, map_artists, admins, waitlist…), is_admin()
 * et leurs politiques RLS n'existent donc qu'en production : impossible de
 * reconstruire la base depuis le code, ni d'auditer ces règles. Ce fichier
 * comble le trou et se relit dans les diffs.
 *
 * Schéma public uniquement, structure seule (--schema-only) : tables,
 * fonctions, triggers, politiques RLS, droits. Aucune ligne, aucune donnée
 * personnelle — versionnable dans le dépôt public.
 *
 * Lecture seule côté Supabase. pg_dump tourne dans Docker (même image que
 * db:backup). Usage : npm run db:schema
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

const password = process.env.DATABASE_PASSWORD ?? loadEnv(path.join(root, '.env')).DATABASE_PASSWORD
const url = process.env.SUPABASE_URL ?? loadEnv(path.join(root, 'apps', 'web', '.env.local')).VITE_SUPABASE_URL
if (!password || !url) {
  console.error('Manquant : DATABASE_PASSWORD (racine .env) ou VITE_SUPABASE_URL (apps/web/.env.local).')
  process.exit(1)
}
const ref = url.replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1')

// Docker Desktop (macOS) n'ajoute pas toujours sa CLI au PATH.
const DOCKER_DESKTOP_BIN = '/Applications/Docker.app/Contents/Resources/bin'
const PATH = existsSync(DOCKER_DESKTOP_BIN) ? `${process.env.PATH}:${DOCKER_DESKTOP_BIN}` : process.env.PATH

// Le mot de passe passe par l'environnement, jamais par la ligne de commande.
const conn = `host=aws-0-eu-west-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.${ref} sslmode=require`
console.log(`Schéma de la base « ${ref} » (structure seule)…`)
const sql = execFileSync(
  'docker',
  ['run', '--rm', '-e', 'PGPASSWORD', PG_IMAGE,
    'pg_dump', conn, '--schema-only', '--schema=public', '--no-owner', '--no-privileges'],
  { env: { ...process.env, PATH, PGPASSWORD: password }, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
)

const outDir = path.join(root, 'supabase', 'schema')
mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'production.sql')
writeFileSync(out, `-- Généré par npm run db:schema le ${new Date().toISOString().slice(0, 10)} — ne pas éditer.\n${sql}`)
console.log(`✅ ${path.relative(root, out)} (${sql.split('\n').length} lignes)`)
