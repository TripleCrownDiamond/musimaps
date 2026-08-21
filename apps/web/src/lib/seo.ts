import type { BrandContent, SeoContent } from './cms'
import { isLegacyBrandUrl } from '@musimaps/shared'
import { localizePath, type Lang } from '@/i18n/translations'

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Supprime tous les liens de favicon (pour restaurer le défaut quand le CMS est vide). */
function removeFaviconLinks() {
  document.head
    .querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    )
    .forEach((el) => el.remove())
}

/** Meta par langue pour les moteurs de recherche (hreflang) et les réseaux. */
const LOCALES: Record<Lang, string> = { fr: 'fr_FR', en: 'en_US' }

/** Ajoute ?v=N (ou &v=N) à une URL pour casser le cache CDN. */
function withCacheQuery(url: string, cacheVersion: number): string {
  if (cacheVersion <= 0) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${cacheVersion}`
}

/**
 * Applique le SEO fourni par le CMS au document courant, dans la langue
 * active (contenu publié par langue). Met aussi à jour canonical, og:locale
 * et og:url pour que Google comprenne le bilinguisme du site : le français
 * vit sur `/`, l'anglais sur `/en`.
 * `cacheVersion` ajoute ?v=N aux images stables (og:image, twitter:image)
 * pour casser le cache CDN lors d'une invalidation depuis l'admin.
 */
export function applySeo(seo: SeoContent, lang: Lang = 'fr', cacheVersion = 1) {
  if (seo.title) document.title = seo.title
  if (seo.description) setMeta('name', 'description', seo.description)
  if (seo.keywords) setMeta('name', 'keywords', seo.keywords)
  if (seo.ogTitle) setMeta('property', 'og:title', seo.ogTitle)
  if (seo.ogDescription) setMeta('property', 'og:description', seo.ogDescription)

  // Image OG par langue : si le CMS fournit une image on l'utilise,
  // sinon on utilise les images dédiées FR/EN dans /public.
  const ogImage = seo.ogImage || (lang === 'en' ? '/og-en.jpg' : '/og-fr.jpg')
  setMeta(
    'property',
    'og:image',
    new URL(withCacheQuery(ogImage, cacheVersion), 'https://musimaps.app').toString(),
  )
  setMeta('property', 'og:image:width', '1200')
  setMeta('property', 'og:image:height', '630')
  setMeta('property', 'og:image:alt', lang === 'en' ? 'Musimaps — The world\'s map of music' : 'Musimaps — Explorez le monde en musique')

  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:site_name', 'Musimaps')
  setMeta('property', 'og:locale', LOCALES[lang] ?? 'fr_FR')
  setMeta('property', 'og:locale:alternate', lang === 'fr' ? 'en_US' : 'fr_FR')
  setMeta('property', 'og:url', currentUrl(lang))

  // Carte X / Twitter (balises dédiées, en plus des og:* génériques).
  setMeta('name', 'twitter:card', seo.twitterCard || 'summary_large_image')
  if (seo.twitterTitle || seo.ogTitle) {
    setMeta('name', 'twitter:title', seo.twitterTitle || seo.ogTitle)
  }
  if (seo.twitterDescription || seo.ogDescription) {
    setMeta('name', 'twitter:description', seo.twitterDescription || seo.ogDescription)
  }
  const twitterImage = seo.twitterImage || ogImage
  setMeta(
    'name',
    'twitter:image',
    new URL(withCacheQuery(twitterImage, cacheVersion), 'https://musimaps.app').toString(),
  )

  // Canonical : URL de la page courante dans la locale active (le préfixe
  // `/en` distingue les deux versions — pas de doublons d'indexation).
  setLink('canonical', currentUrl(lang))
}

/** URL canonique absolue de la page courante, préfixée par la locale. */
function currentUrl(lang: Lang): string {
  const path = localizePath(window.location.pathname, lang)
  return path === '/' ? 'https://musimaps.app/' : `https://musimaps.app${path}`
}

/**
 * Applique la favicon du CMS au document courant.
 * L'ancienne favicon cyan du CMS est ignorée (on retombe sur l'officielle
 * embarquée). `cacheVersion` ajoute ?v=N aux noms stables pour casser le
 * cache CDN lors d'une invalidation depuis l'admin.
 */
export function applyBrand(brand: BrandContent, cacheVersion = 1) {
  const cacheQuery = cacheVersion > 0 ? `?v=${cacheVersion}` : ''
  const favicon = brand.favicon && !isLegacyBrandUrl(brand.favicon) ? brand.favicon : ''
  const faviconCached = favicon ? withCacheQuery(favicon, cacheVersion) : ''
  if (faviconCached) {
    setLink('icon', faviconCached)
    setLink('shortcut icon', faviconCached)
    setLink('apple-touch-icon', faviconCached)
  } else {
    removeFaviconLinks()
    // Noms -v2 : l'ancienne favicon était figée dans le cache CDN (immutable
    // 1 an) ; un nom frais force tous les navigateurs/Google à la re-télécharger.
    setLink('icon', `/favicon-32-v2.png${cacheQuery}`)
    setLink('icon', `/favicon-v2.png${cacheQuery}`)
    setLink('apple-touch-icon', `/apple-touch-icon-v2.png${cacheQuery}`)
  }
}


