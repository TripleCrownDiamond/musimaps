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
 *   HOSTINGER_REMOTE_DIR    OBLIGATOIRE — ex. /domains/musimaps.com/public_html
 *                           (HOSTINGER_FTP_REMOTE_DIR accepte aussi)
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
  /*
   * Le dossier distant a DEUX noms de clé possibles. Le script ne lisait que
   * `HOSTINGER_FTP_REMOTE_DIR`, absente du .env, qui déclare
   * `HOSTINGER_REMOTE_DIR` : il retombait donc toujours sur son défaut codé en
   * dur. Corriger le .env n'avait aucun effet — le déploiement repartait sur
   * le domaine du défaut. Constaté en livrant 94 fichiers dans le mauvais
   * domaine du compte.
   *
   * Plus de défaut codé en dur : une cible de déploiement se déclare, elle ne
   * se devine pas.
   */
  const remoteDir = (env.HOSTINGER_FTP_REMOTE_DIR || env.HOSTINGER_REMOTE_DIR || '').replace(/\/+$/, '')

  if (!host || !user || !password) {
    console.error('Configuration Hostinger incomplète. Vérifiez les variables HOSTINGER_FTP_* dans .env')
    process.exit(1)
  }
  if (!remoteDir) {
    console.error(
      'Dossier distant non défini. Ajoutez dans .env :\n' +
        '  HOSTINGER_REMOTE_DIR=/domains/<votre-domaine>/public_html',
    )
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
  const access = {
    host,
    port,
    user,
    password,
    secure: protocol === 'ftps' ? 'explicit' : false,
    secureOptions: { rejectUnauthorized: false },
  }

  /**
   * Rejoue une opération FTP qui a échoué, en se reconnectant d'abord.
   *
   * Hostinger refuse par moments d'ouvrir une connexion de données quand
   * elles s'enchaînent vite : « Can't open data connection in passive mode:
   * connect ETIMEDOUT ». Constaté en plein déploiement, APRÈS une trentaine
   * de fichiers déjà passés — ce n'est donc pas une mauvaise configuration du
   * mode passif, c'est un refus ponctuel.
   *
   * Sans reprise, le script s'arrête au milieu de l'upload. Les noms émis par
   * Vite étant hachés, le site reste servi par son ancien `index.html` et ne
   * casse pas — mais le déploiement est à refaire en entier, et il peut
   * échouer au même endroit.
   *
   * La reconnexion est nécessaire : après un refus, la connexion de contrôle
   * n'est plus exploitable pour un transfert.
   */
  async function withRetry(label, run, attempts = 5) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await run()
      } catch (err) {
        if (attempt >= attempts) throw err
        const wait = 1000 * attempt
        console.log(`  ! ${label} — essai ${attempt}/${attempts} échoué (${err.message}). Reprise dans ${wait} ms.`)
        await new Promise((resolve) => setTimeout(resolve, wait))
        try {
          client.close()
        } catch {
          // La connexion était déjà morte : c'est le cas normal ici.
        }
        await client.access(access)
      }
    }
  }

  try {
    console.log(`Connexion ${protocol === 'ftps' ? 'FTPS (explicite)' : 'FTP'} -> ${host}:${port} ...`)
    await client.access(access)
    console.log(`Connecté. Déploiement vers ${remoteDir} ...`)

    // 1. Upload
    let uploaded = 0
    for (const rel of [...localFiles].sort()) {
      const dest = `${remoteDir}/${rel}`
      await withRetry(rel, async () => {
        await client.ensureDir(dirname(dest))
        await client.uploadFrom(join(LOCAL_DIR, ...rel.split('/')), dest)
      })
      uploaded++
      console.log(`  + ${rel}`)
    }
    console.log(`Upload terminé : ${uploaded} fichier(s).`)

    // 2. Nettoyage des anciens fichiers
    // `cleanup` relit le distant avant d'agir : le rejouer est sans risque.
    const removed = await withRetry('nettoyage', () => cleanup(client, remoteDir, localFiles))
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
