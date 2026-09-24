#!/usr/bin/env node
/**
 * check-og — Vérifie que le HTML livré porte des balises de partage utilisables.
 *
 * C'est la garantie qui compte : les robots sociaux n'exécutent pas de
 * JavaScript, ils ne voient que ce fichier. Un test navigateur ne peut pas
 * l'attester — il observe le DOM après exécution de `applySeo`, et court
 * contre elle.
 *
 * Contrôles, sur `dist/index.html` et `dist/en/index.html` :
 *   - og:title, og:description, og:image, og:url renseignées ;
 *   - og:image en URL absolue (un chemin relatif casse tous les robots) ;
 *   - og:url cohérente avec la langue du fichier ;
 *   - les deux langues ne servent pas la même URL canonique.
 *
 * Sur les pages artiste produites par inject-og, en plus :
 *   - og:url = canonical (les deux balises doivent annoncer la même adresse) ;
 *   - og:url porte le SLUG (00069 attribue un slug à chaque artiste) — une
 *     og:url en identifiant brut (UUID) signifie que le backfill a sauté ;
 *   - la page-id et la page-slug d'un même artiste annoncent la même og:url
 *     (c'est voulu : une seule adresse canonique) — seule une collision
 *     ENTRE LANGUES, ou entre DEUX ARTISTES, est fautive.
 *
 * Usage : node scripts/check-og.mjs   (`npm run test:og`)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'apps', 'web', 'dist')

const REQUIRED = ['og:title', 'og:description', 'og:image', 'og:url']

function metaContent(html, property) {
  const m = html.match(new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`, 'i'))
  return m ? m[1] : null
}

const failures = []
const targets = [
  { file: path.join(dist, 'index.html'), lang: 'fr', expectUrl: 'https://musimaps.com/' },
  { file: path.join(dist, 'en', 'index.html'), lang: 'en', expectUrl: 'https://musimaps.com/en' },
]

// Quand le build a accès à Supabase, inject-og produit aussi un document brut
// par profil artiste. Ils sont vérifiés ici parce que ce sont précisément ces
// fichiers (et non le DOM React) que lisent les robots sociaux. Pas d'URL
// attendue ici : elle est déduite des balises elles-mêmes (voir plus bas).
for (const lang of ['fr', 'en']) {
  const folder = lang === 'en' ? path.join(dist, 'en', 'artist') : path.join(dist, 'artist')
  if (!existsSync(folder)) continue
  for (const name of readdirSync(folder).filter((entry) => entry.endsWith('.html'))) {
    targets.push({ file: path.join(folder, name), lang, expectUrl: null })
  }
}

if (!existsSync(targets[0].file)) {
  console.error('check-og : dist/index.html introuvable — lancez `npm run build:web` d’abord.')
  process.exit(1)
}

// og:url → titre : la page-id et la page-slug d'un MÊME artiste partagent
// normalement la même adresse canonique ; la retrouver sur un autre titre
// (autre artiste) révèle en revanche une collision.
const seenUrls = new Map()

for (const { file, lang, expectUrl } of targets) {
  const label = path.relative(root, file)
  if (!existsSync(file)) {
    failures.push(`${label} : absent (inject-og n’a pas produit la version ${lang})`)
    continue
  }
  const html = readFileSync(file, 'utf8')

  for (const prop of REQUIRED) {
    if (!metaContent(html, prop)) failures.push(`${label} : ${prop} manquante ou vide`)
  }

  const image = metaContent(html, 'og:image')
  if (image && !/^https?:\/\//i.test(image)) {
    failures.push(`${label} : og:image doit être absolue, reçu « ${image} »`)
  }

  const url = metaContent(html, 'og:url')
  if (url) {
    if (expectUrl) {
      if (url.replace(/\/$/, '') !== expectUrl.replace(/\/$/, '')) {
        failures.push(`${label} : og:url attendue ${expectUrl}, reçue « ${url} »`)
      }
    } else {
      // Page artiste : og:url annonce la forme canonique slugée (00069
      // attribue un slug à chaque artiste), jamais l'identifiant interne.
      const m = url.match(/^https:\/\/musimaps\.com(\/en)?\/artist\/([a-zA-Z0-9_-]+)$/)
      if (!m) {
        failures.push(`${label} : og:url « ${url} » n’est pas une page artiste`)
      } else if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m[2])
      ) {
        failures.push(`${label} : og:url sur l’identifiant brut ${m[2]} — le slug est attendu`)
      }
      // og:url et canonical doivent désigner la même adresse.
      const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1]
      if (canonical && canonical !== url) {
        failures.push(`${label} : canonical « ${canonical} » ≠ og:url « ${url} »`)
      }
    }

    const seen = seenUrls.get(url)
    if (seen && seen.title !== metaContent(html, 'og:title')) {
      failures.push(`${label} : og:url « ${url} » partagée par deux artistes`)
    } else if (!seen) {
      seenUrls.set(url, { title: metaContent(html, 'og:title') })
    }
  }
}

if (failures.length > 0) {
  console.error('check-og : le partage social est cassé.\n')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(`check-og : OK — ${targets.length} documents portent des balises de partage valides.`)
