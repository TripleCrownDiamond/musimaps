#!/usr/bin/env node
/**
 * inject-og — Grave le SEO publié du CMS dans le HTML livré.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * `apps/web/src/lib/seo.ts` applique le SEO du CMS via `document.head` : c'est
 * du JavaScript, exécuté après le rendu de React. Or **aucun robot de réseau
 * social n'exécute JavaScript** — Facebook, WhatsApp, LinkedIn, X, Slack,
 * iMessage et Discord téléchargent le HTML brut et lisent les balises qui s'y
 * trouvent déjà. L'image et les textes posés dans l'admin restaient donc
 * invisibles au partage : les robots ne voyaient que les balises figées dans
 * `apps/web/index.html`.
 *
 * Ce script s'exécute après `vite build` et réécrit les balises `og:*` et
 * `twitter:*` du HTML produit avec le contenu réellement publié dans le CMS.
 * `applySeo` reste utile côté navigateur (navigation SPA, titre d'onglet) ;
 * ici on couvre le premier chargement, le seul que voient les robots.
 *
 * Deux fichiers sont produits, le préfixe de langue vivant dans l'URL :
 *   dist/index.html      → français  (musimaps.com/)
 *   dist/en/index.html   → anglais   (musimaps.com/en)
 *
 * Sans identifiants Supabase, le script n'échoue pas : il laisse le HTML tel
 * quel et rend la main (`npm run check` doit rester vert sans secrets).
 *
 * Usage : node scripts/inject-og.mjs   (appelé par `npm run build:web`)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'apps', 'web', 'dist')
const SITE = 'https://musimaps.com'

/** Dimensions annoncées aux robots pour une grande carte de partage. */
const OG_IMAGE_WIDTH = '1200'
const OG_IMAGE_HEIGHT = '630'

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

/** Échappe une valeur destinée à un attribut HTML entre guillemets doubles. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Remplace la balise <meta> si elle existe, l'ajoute avant </head> sinon. */
function setMeta(html, attrName, key, value) {
  if (!value) return html
  const tag = `<meta ${attrName}="${key}" content="${attr(value)}" />`
  const existing = new RegExp(`<meta\\s+${attrName}="${key}"[^>]*>`, 'i')
  if (existing.test(html)) return html.replace(existing, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setTitle(html, value) {
  if (!value) return html
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${attr(value)}</title>`)
}

function setCanonical(html, value) {
  const tag = `<link rel="canonical" href="${attr(value)}" />`
  return /<link\s+rel="canonical"[^>]*>/i.test(html)
    ? html.replace(/<link\s+rel="canonical"[^>]*>/i, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`)
}

/** URL absolue : le CMS stocke tantôt un chemin relatif, tantôt une URL complète. */
function absolute(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : new URL(url, SITE).toString()
}

/**
 * Applique un bloc SEO à un document. `lang` détermine la locale, l'URL
 * canonique et l'image de repli quand le CMS n'en fournit pas.
 */
function applySeo(html, seo, lang) {
  const isEn = lang === 'en'
  const pageUrl = isEn ? `${SITE}/en` : `${SITE}/`
  const ogImage = absolute(seo.ogImage || (isEn ? '/og-en.jpg' : '/og-fr.jpg'))
  const twitterImage = absolute(seo.twitterImage || seo.ogImage) || ogImage
  const ogTitle = seo.ogTitle || seo.title
  const ogDescription = seo.ogDescription || seo.description

  let out = html
  // Le gabarit déclare `lang="fr"` : la page /en l'héritait, et les
  // navigateurs proposaient de « traduire du français » une page anglaise.
  out = out.replace(/<html\s+lang="[^"]*"/i, `<html lang="${isEn ? 'en' : 'fr'}"`)
  out = setTitle(out, seo.title)
  out = setMeta(out, 'name', 'description', seo.description)
  out = setMeta(out, 'name', 'keywords', seo.keywords)

  out = setMeta(out, 'property', 'og:type', 'website')
  out = setMeta(out, 'property', 'og:site_name', 'Musimaps')
  out = setMeta(out, 'property', 'og:locale', isEn ? 'en_US' : 'fr_FR')
  out = setMeta(out, 'property', 'og:locale:alternate', isEn ? 'fr_FR' : 'en_US')
  out = setMeta(out, 'property', 'og:url', pageUrl)
  out = setMeta(out, 'property', 'og:title', ogTitle)
  out = setMeta(out, 'property', 'og:description', ogDescription)
  out = setMeta(out, 'property', 'og:image', ogImage)
  out = setMeta(out, 'property', 'og:image:width', OG_IMAGE_WIDTH)
  out = setMeta(out, 'property', 'og:image:height', OG_IMAGE_HEIGHT)
  out = setMeta(
    out,
    'property',
    'og:image:alt',
    isEn ? 'Musimaps — The world’s map of music' : 'Musimaps — Explorez le monde en musique',
  )

  out = setMeta(out, 'name', 'twitter:card', seo.twitterCard || 'summary_large_image')
  out = setMeta(out, 'name', 'twitter:title', seo.twitterTitle || ogTitle)
  out = setMeta(out, 'name', 'twitter:description', seo.twitterDescription || ogDescription)
  out = setMeta(out, 'name', 'twitter:image', twitterImage)

  // Canonical : le FR vit sur `/`, l'EN sur `/en` — pas de doublon d'indexation.
  out = setCanonical(out, pageUrl)

  return out
}

/**
 * Grave une carte sociale spécifique à un artiste dans un document HTML.
 *
 * `identifier` est le segment d'URL du fichier servi (slug, sinon id) : il
 * pilote l'adresse du document. En revanche og:url et canonical annoncent
 * TOUJOURS la forme slugée — depuis 00069 chaque artiste possède un slug,
 * et l'id comme le slug renvoient la même page : donner aux robots les deux
 * adresses ferait doubler l'indexation d'un même contenu.
 */
function applyArtistSeo(html, artist, lang, identifier) {
  const isEn = lang === 'en'
  const prefix = isEn ? '/en' : ''
  const canonical = safeArtistIdentifier(artist.slug) || identifier
  const pageUrl = `${SITE}${prefix}/artist/${encodeURIComponent(canonical)}`
  const location = [artist.city, artist.country].filter(Boolean).join(', ')
  const genre = artist.genre || (isEn ? 'Artist' : 'Artiste')
  const rawDescription = artist.bio || (isEn
    ? `Discover ${artist.name}, ${genre}${location ? ` from ${location}` : ''}, on Musimaps.`
    : `Découvrez ${artist.name}, ${genre}${location ? ` à ${location}` : ''}, sur Musimaps.`)
  // Une bio peut être très longue et contenir des citations. Les aperçus
  // sociaux ont besoin d'un résumé compact ; les guillemets typographiques
  // évitent aussi toute ambiguïté dans l'attribut HTML brut.
  const compactDescription = rawDescription.replace(/\s+/g, ' ').trim().replace(/"/g, '”')
  const description = compactDescription.length > 220
    ? `${compactDescription.slice(0, 217).trimEnd()}…`
    : compactDescription
  const title = `${artist.name} — ${location || genre} | Musimaps`
  const image = absolute(artist.image || (isEn ? '/og-en.jpg' : '/og-fr.jpg'))

  // La page-id canonicalise vers le slug : un robot qui suit og:url depuis
  // l'une ou l'autre adresse atterrit sur la même URL canonique.
  let out = html.replace(/<html\s+lang="[^"]*"/i, `<html lang="${isEn ? 'en' : 'fr'}"`)
  out = setTitle(out, title)
  out = setMeta(out, 'name', 'description', description)
  out = setMeta(out, 'property', 'og:type', 'profile')
  out = setMeta(out, 'property', 'og:site_name', 'Musimaps')
  out = setMeta(out, 'property', 'og:locale', isEn ? 'en_US' : 'fr_FR')
  out = setMeta(out, 'property', 'og:url', pageUrl)
  out = setMeta(out, 'property', 'og:title', `${artist.name} | Musimaps`)
  out = setMeta(out, 'property', 'og:description', description)
  out = setMeta(out, 'property', 'og:image', image)
  out = setMeta(out, 'property', 'og:image:width', OG_IMAGE_WIDTH)
  out = setMeta(out, 'property', 'og:image:height', OG_IMAGE_HEIGHT)
  out = setMeta(out, 'property', 'og:image:alt', artist.name)
  out = setMeta(out, 'name', 'twitter:card', 'summary_large_image')
  out = setMeta(out, 'name', 'twitter:title', `${artist.name} | Musimaps`)
  out = setMeta(out, 'name', 'twitter:description', description)
  out = setMeta(out, 'name', 'twitter:image', image)
  return setCanonical(out, pageUrl)
}

function safeArtistIdentifier(value) {
  const text = String(value || '').trim()
  return /^[a-zA-Z0-9_-]{1,120}$/.test(text) ? text : ''
}

function writeArtistDocuments(source, artists) {
  let written = 0
  for (const artist of artists) {
    const identifiers = new Set([
      safeArtistIdentifier(artist.id),
      safeArtistIdentifier(artist.slug),
    ].filter(Boolean))
    for (const identifier of identifiers) {
      for (const lang of ['fr', 'en']) {
        const folder = lang === 'en'
          ? path.join(dist, 'en', 'artist')
          : path.join(dist, 'artist')
        mkdirSync(folder, { recursive: true })
        writeFileSync(
          path.join(folder, `${identifier}.html`),
          applyArtistSeo(source, artist, lang, identifier),
          'utf8',
        )
        written++
      }
    }
  }
  return written
}

async function main() {
  const indexPath = path.join(dist, 'index.html')
  if (!existsSync(indexPath)) {
    console.error('inject-og : apps/web/dist/index.html introuvable — lancez le build d’abord.')
    process.exit(1)
  }
  const source = readFileSync(indexPath, 'utf8')

  const env = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
  const url = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn(
      'inject-og : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absents — ' +
        'balises du HTML source conservées (le partage n’utilisera pas le CMS).',
    )
    writeFileSync(indexPath, applySeo(source, {}, 'fr'), 'utf8')
    mkdirSync(path.join(dist, 'en'), { recursive: true })
    writeFileSync(path.join(dist, 'en', 'index.html'), applySeo(source, {}, 'en'), 'utf8')
    return
  }

  let row
  let artistRows = []
  try {
    const [res, artistRes] = await Promise.all([
      fetch(
      // `site_content_public` est la vue lisible en anonyme (la table
      // `site_content` porte les brouillons et reste réservée à l'admin).
      `${url.replace(/\/$/, '')}/rest/v1/site_content_public?key=eq.seo&select=content,content_en`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      ),
      fetch(
        `${url.replace(/\/$/, '')}/rest/v1/map_artists?select=id,name,genre,city,country,bio,image,slug&limit=500`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      ),
    ])
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    row = (await res.json())[0]
    if (artistRes.ok) artistRows = await artistRes.json()
    else console.warn(`inject-og : profils artistes illisibles (HTTP ${artistRes.status}).`)
  } catch (err) {
    console.warn(`inject-og : CMS illisible (${err.message}) — balises source conservées.`)
    row = { content: {}, content_en: {} }
  }

  if (!row) {
    console.warn('inject-og : aucune ligne « seo » publiée dans le CMS — balises source conservées.')
    row = { content: {}, content_en: {} }
  }

  const fr = row.content && typeof row.content === 'object' ? row.content : {}
  writeFileSync(indexPath, applySeo(source, fr, 'fr'), 'utf8')

  const en = row.content_en && typeof row.content_en === 'object' ? row.content_en : fr
  mkdirSync(path.join(dist, 'en'), { recursive: true })
  writeFileSync(path.join(dist, 'en', 'index.html'), applySeo(source, en, 'en'), 'utf8')

  const artistDocuments = writeArtistDocuments(source, artistRows)

  const shown = (s) => s.ogImage || s.twitterImage || '(image de repli)'
  console.log(
    `inject-og : SEO du CMS grave — fr og:image=${shown(fr)} · en og:image=${shown(en)} · ${artistDocuments} pages artiste`,
  )
}

await main()
