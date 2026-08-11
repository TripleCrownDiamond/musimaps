#!/usr/bin/env node
/**
 * Purge le cache Hostinger (serveur + hCDN) pour musimaps.app.
 *
 * Le cache CDN de Hostinger (hCDN) garde les anciens logos/visuels jusqu'à un
 * an à cause de l'en-tête `immutable` : après un redéploiement, l'ancien logo
 * peut rester affiché. Ce script force la purge via l'API Hostinger.
 *
 * Prérequis (une seule fois) :
 *   1. hPanel → en bas à gauche → « API » → « Créer un nouveau jeton »
 *   2. Ajouter dans le fichier .env racine :
 *        HOSTINGER_API_TOKEN=xxxxxxxx
 *      (le compte utilisateur hPanel est lu depuis HOSTINGER_FTP_USERNAME,
 *      ex. u123456789 — sinon précisez HOSTINGER_ACCOUNT_USERNAME)
 *
 * Usage : npm run purge
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Charge .env sans surcharger les variables déjà présentes dans l'environnement. */
function loadEnv(file) {
  const vars = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined && vars[m[1]] === undefined) vars[m[1]] = m[2]
  }
  return vars
}

async function main() {
  const env = loadEnv(join(ROOT, '.env'))
  const token = env.HOSTINGER_API_TOKEN
  // Le nom de compte hPanel ressemble au login FTP (u123456789) ; on en déduit
  // le compte si HOSTINGER_ACCOUNT_USERNAME n'est pas défini.
  const username = env.HOSTINGER_ACCOUNT_USERNAME || env.HOSTINGER_FTP_USERNAME
  const domain = env.HOSTINGER_DOMAIN || 'musimaps.app'

  if (!token) {
    console.error(
      'HOSTINGER_API_TOKEN manquant. Créez un jeton API dans hPanel (en bas à gauche → API) ' +
        'puis ajoutez HOSTINGER_API_TOKEN=… dans le fichier .env racine.',
    )
    process.exit(1)
  }
  if (!username) {
    console.error('Impossible de déterminer le compte hPanel (HOSTINGER_FTP_USERNAME ou HOSTINGER_ACCOUNT_USERNAME requis).')
    process.exit(1)
  }

  const url =
    `https://api.hostinger.com/api/hosting/v1/accounts/${encodeURIComponent(username)}` +
    `/websites/${encodeURIComponent(domain)}/cache/clear`

  console.log(`Purge du cache (serveur + hCDN) pour ${domain} …`)
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await res.text().catch(() => '')
  if (!res.ok) {
    console.error(`Échec (HTTP ${res.status}) : ${body.slice(0, 300)}`)
    console.error('Vérifiez le jeton API et que musimaps.app est bien rattaché à ce compte.')
    process.exit(1)
  }
  console.log('Cache purgé ✓', body ? body.slice(0, 200) : '')
}

main().catch((err) => {
  console.error(`Échec : ${err.message}`)
  process.exit(1)
})
