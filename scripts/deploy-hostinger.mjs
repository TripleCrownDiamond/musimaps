#!/usr/bin/env node
/**
 * Deploie le build web (apps/web/dist) vers Hostinger via FTPS.
 *
 * Configuration : variables HOSTINGER_FTP_* du fichier .env (racine du repo) :
 *   HOSTINGER_FTP_PROTOCOL  ftp | ftps (explicite, port 21) — pas de SFTP ici
 *   HOSTINGER_FTP_HOST
 *   HOSTINGER_FTP_PORT      defaut 21
 *   HOSTINGER_FTP_USERNAME
 *   HOSTINGER_FTP_PASSWORD
 *   HOSTINGER_FTP_REMOTE_DIR defaut /domains/musimaps.app/public_html
 *
 * Stratégie :
 *   1. Upload recursif de tout apps/web/dist (les fichiers emis par Vite sont
 *      haches ; les noms ne collident jamais).
 *   2. Nettoyage des fichiers distants obsolètes dans assets/ et brand/
 *      (dossiers geres par Vite) pour ne pas accumuler d'anciens bundles.
 *      Le reste du dossier distant (ex. .well-known) n'est jamais touche.
 *
 * Usage : npm run deploy
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'basic-ftp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = join(ROOT, '.env')
const WEB_ENV_FILE = join(ROOT, 'apps', 'web', '.env.local')
const LOCAL_DIR = join(ROOT, 'apps', 'web', 'dist')
const HTACCESS = join(LOCAL_DIR, '.htaccess')

/**
 * Récupère la politique de cache (.htaccess) enregistrée dans l'admin
 * (table cache_config, clé htaccess_cache) et l'injecte dans dist/.htaccess.
 * Les règles de réécriture SPA sont conservées ; seul le bloc « Cache headers »
 * (mod_headers + mod_expires) est remplacé.
 */
async function applyCachePolicyFromDb() {
  try {
    const webEnv = loadEnv(WEB_ENV_FILE)
    const url = webEnv.VITE_SUPABASE_URL
    const anon = webEnv.VITE_SUPABASE_ANON_KEY
    if (!url || !anon) {
      console.log('Supabase non configuré : .htaccess local conservé.')
      return
    }
    const res = await fetch(
      `${url}/rest/v1/cache_config?key=eq.htaccess_cache&select=value`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
    )
    if (!res.ok) {
      console.log(`Impossible de lire la politique de cache (HTTP ${res.status}) : .htaccess local conservé.`)
      return
    }
    const rows = await res.json()
    const policy = rows?.[0]?.value
    if (typeof policy !== 'string' || !policy.trim() || !existsSync(HTACCESS)) return
    const current = readFileSync(HTACCESS, 'utf8')
    const marker = '\n# Cache headers'
    const head = current.includes(marker)
      ? current.slice(0, current.indexOf(marker))
      : current
    writeFileSync(HTACCESS, `${head}\n${policy.trim()}\n`, 'utf8')
    console.log('Politique de cache de l\'admin appliquée au .htaccess ✓')
  } catch (err) {
    console.warn(`Politique de cache ignorée (${err.message})`)
  }
}

/** Charge .env sans surcharger les variables deja presentes dans l'environnement. */
function loadEnv(file) {
  const vars = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined && vars[m[1]] === undefined) vars[m[1]] = m[2]
  }
  return vars
}

/** Liste recursive des fichiers/dossiers locaux (chemins relatifs, separateur '/'). */
function walkLocal(dir, base, files, dirs) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    const rel = relative(base, abs).split(sep).join('/')
    if (entry.isDirectory()) {
      dirs.add(rel)
      walkLocal(abs, base, files, dirs)
    } else if (entry.isFile()) {
      files.add(rel)
    }
  }
  return { files, dirs }
}

/** Liste recursive d'un dossier distant (chemins absolus). */
async function listRemoteTree(client, dir) {
  const files = new Set()
  const dirs = new Set()
  async function walk(d) {
    let entries
    try {
      entries = await client.list(d)
    } catch {
      return // dossier inexistant : rien a lister
    }
    for (const info of entries) {
      const p = `${d}/${info.name}`
      if (info.isDirectory) {
        dirs.add(p)
        await walk(p)
      } else if (info.isFile) {
        files.add(p)
      }
    }
  }
  await walk(dir)
  return { files, dirs }
}

/** Supprime les fichiers distants absents du build local, puis les dossiers vides. */
async function cleanup(client, remoteDir, localFiles) {
  let removed = 0
  for (const sub of ['assets', 'brand']) {
    const remoteSub = `${remoteDir}/${sub}`
    const { files, dirs } = await listRemoteTree(client, remoteSub)
    for (const file of files) {
      const rel = file.slice(remoteDir.length + 1) // ex. assets/foo-abc123.js
      if (!localFiles.has(rel)) {
        try {
          await client.remove(file)
          removed++
          console.log(`  - ${rel}`)
        } catch (err) {
          console.warn(`  ! suppression impossible : ${rel} (${err.message})`)
        }
      }
    }
    for (const d of [...dirs].sort((a, b) => b.length - a.length)) {
      const entries = await client.list(d)
      if (entries.length === 0) {
        try {
          await client.removeDir(d)
          console.log(`  - ${d.slice(remoteDir.length + 1)}/`)
        } catch {
          /* dossier protege ou verrouille : on ignore */
        }
      }
    }
  }
  return removed
}

async function main() {
  const env = loadEnv(ENV_FILE)
  const host = env.HOSTINGER_FTP_HOST
  const user = env.HOSTINGER_FTP_USERNAME
  const password = env.HOSTINGER_FTP_PASSWORD
  const port = Number(env.HOSTINGER_FTP_PORT || 21)
  const protocol = (env.HOSTINGER_FTP_PROTOCOL || 'ftps').toLowerCase()
  const remoteDir = (env.HOSTINGER_FTP_REMOTE_DIR || '/domains/musimaps.app/public_html').replace(/\/+$/, '')

  if (!host || !user || !password || !remoteDir) {
    console.error('Configuration Hostinger incomplète. Vérifiez les variables HOSTINGER_FTP_* dans .env')
    process.exit(1)
  }
  if (protocol === 'sftp') {
    console.error("basic-ftp ne gère pas le SFTP. Utilisez 'ftps' (recommandé) ou 'ftp' dans HOSTINGER_FTP_PROTOCOL.")
    process.exit(1)
  }

  const { files: localFiles, dirs: localDirs } = walkLocal(LOCAL_DIR, LOCAL_DIR, new Set(), new Set())
  if (localFiles.size === 0) {
    console.error(`Aucun fichier à déployer dans ${LOCAL_DIR}. Lancez d'abord 'npm run build:web'.`)
    process.exit(1)
  }

  // Politique de cache gérée depuis l'admin : injectée dans le .htaccess à uploader.
  await applyCachePolicyFromDb()

  const client = new Client()
  try {
    console.log(`Connexion ${protocol === 'ftps' ? 'FTPS (explicite)' : 'FTP'} -> ${host}:${port} ...`)
    await client.access({
      host,
      port,
      user,
      password,
      secure: protocol === 'ftps' ? 'explicit' : false,
      secureOptions: { rejectUnauthorized: false },
    })
    console.log(`Connecté. Déploiement vers ${remoteDir} ...`)

    // 1. Upload
    let uploaded = 0
    for (const rel of [...localFiles].sort()) {
      const dest = `${remoteDir}/${rel}`
      await client.ensureDir(dirname(dest))
      await client.uploadFrom(join(LOCAL_DIR, ...rel.split('/')), dest)
      uploaded++
      console.log(`  + ${rel}`)
    }
    console.log(`Upload terminé : ${uploaded} fichier(s).`)

    // 2. Nettoyage des anciens fichiers
    const removed = await cleanup(client, remoteDir, localFiles)
    console.log(`Nettoyage terminé : ${removed} fichier(s) obsolète(s) supprimé(s).`)
    console.log(`Déploiement terminé ✓ (${localFiles.size} fichiers, ${localDirs.size} dossiers)`)
  } finally {
    client.close()
  }
}

main().catch((err) => {
  console.error(`Échec du déploiement : ${err.message}`)
  process.exit(1)
})
