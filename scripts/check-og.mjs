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
 * Usage : node scripts/check-og.mjs   (`npm run test:og`)
 */
import { existsSync, readFileSync } from 'node:fs'
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
  { file: path.join(dist, 'index.html'), lang: 'fr', expectUrl: 'https://musimaps.app/' },
  { file: path.join(dist, 'en', 'index.html'), lang: 'en', expectUrl: 'https://musimaps.app/en' },
]

if (!existsSync(targets[0].file)) {
  console.error('check-og : dist/index.html introuvable — lancez `npm run build:web` d’abord.')
  process.exit(1)
}

const seenUrls = new Set()

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
  if (url && url.replace(/\/$/, '') !== expectUrl.replace(/\/$/, '')) {
    failures.push(`${label} : og:url attendue ${expectUrl}, reçue « ${url} »`)
  }
  if (url) {
    if (seenUrls.has(url)) failures.push(`${label} : og:url dupliquée entre les langues (${url})`)
    seenUrls.add(url)
  }
}

if (failures.length > 0) {
  console.error('check-og : le partage social est cassé.\n')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(`check-og : OK — ${targets.length} documents portent des balises de partage valides.`)
