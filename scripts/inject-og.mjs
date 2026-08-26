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
  const canonical = `<link rel="canonical" href="${pageUrl}" />`
  out = /<link\s+rel="canonical"[^>]*>/i.test(out)
    ? out.replace(/<link\s+rel="canonical"[^>]*>/i, canonical)
    : out.replace('</head>', `    ${canonical}\n  </head>`)

  return out
}

async function main() {
  const indexPath = path.join(dist, 'index.html')
  if (!existsSync(indexPath)) {
    console.error('inject-og : apps/web/dist/index.html introuvable — lancez le build d’abord.')
    process.exit(1)
  }

  const env = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
  const url = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn(
      'inject-og : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absents — ' +
        'balises du HTML source conservées (le partage n’utilisera pas le CMS).',
    )
    return
  }

  let row
  try {
    const res = await fetch(
      // `site_content_public` est la vue lisible en anonyme (la table
      // `site_content` porte les brouillons et reste réservée à l'admin).
      `${url.replace(/\/$/, '')}/rest/v1/site_content_public?key=eq.seo&select=content,content_en`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    row = (await res.json())[0]
  } catch (err) {
    console.warn(`inject-og : CMS illisible (${err.message}) — balises source conservées.`)
    return
  }

  if (!row) {
    console.warn('inject-og : aucune ligne « seo » publiée dans le CMS — balises source conservées.')
    return
  }

  const source = readFileSync(indexPath, 'utf8')

  const fr = row.content && typeof row.content === 'object' ? row.content : {}
  writeFileSync(indexPath, applySeo(source, fr, 'fr'), 'utf8')

  const en = row.content_en && typeof row.content_en === 'object' ? row.content_en : fr
  mkdirSync(path.join(dist, 'en'), { recursive: true })
  writeFileSync(path.join(dist, 'en', 'index.html'), applySeo(source, en, 'en'), 'utf8')

  const shown = (s) => s.ogImage || s.twitterImage || '(image de repli)'
  console.log(
    `inject-og : SEO du CMS grave — fr og:image=${shown(fr)} · en og:image=${shown(en)}`,
  )
}

await main()
