import { supabase, hasSupabase } from './supabase'
import { DEFAULT_CONTENT_EN } from './cms-en'
import type { Lang } from '../i18n/translations'

/* ------------------------------------------------------------------ */
/* Types du contenu piloté par le dashboard                           */
/* ------------------------------------------------------------------ */

export interface FeatureItem {
  title: string
  text: string
  image: string
  alt: string
}

export interface JourneyItem {
  title: string
  text: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface WaitlistProfile {
  id: 'artiste' | 'amateur'
  label: string
  description: string
}

/** Condition d'un badge, exprimée en données (évaluée côté mobile). */
export interface BadgeCondition {
  metric: 'cities' | 'favorites' | 'profile'
  min: number
}

/** Définition éditable d'un badge (miroir sérialisable de la gamification mobile). */
export interface BadgeDefinition {
  id: string
  icon: string
  label: string
  description: string
  points: number
  condition: BadgeCondition
}

/** Lien de réseau social du footer (rendu en icône). */
export interface SocialLinkItem {
  label: string
  to: string
  /** Identifiant d'icône : x, instagram, facebook, youtube, spotify, tiktok, discord, linkedin, twitch, threads… */
  icon: string
}

/**
 * Identité visuelle pilotable : logos (clair/sombre), favicon et image d'app.
 *
 * Section GLOBALE : contrairement aux textes, la marque est partagée entre
 * les deux langues (FR et EN) — un seul jeu de logos sert tout le site et
 * l'application. Ne pas la dupliquer dans un contenu par langue.
 */
export interface BrandContent {
  navbarLogoLight: string
  navbarLogoDark: string
  footerLogoLight: string
  footerLogoDark: string
  favicon: string
  appImage: string
  /** Hauteur du logo navbar en px (contrôlable depuis l'admin). */
  navbarLogoHeight: number
  /** Hauteur du logo footer en px (contrôlable depuis l'admin). */
  footerLogoHeight: number
}

export interface LandingContent {
  hero: {
    title: string
    subtitle: string
    ctaPrimary: string
    ctaPrimaryTo: string
    ctaSecondary: string
    ctaSecondaryTo: string
  }
  features: {
    title: string
    subtitle: string
    items: FeatureItem[]
  }
  journey: {
    items: JourneyItem[]
  }
  globePreview: {
    title: string
    subtitle: string
    cta: string
    ctaTo: string
  }
  philosophy: {
    title: string
  }
  faq: {
    title: string
    subtitle: string
    items: FaqItem[]
  }
  waitlist: {
    title: string
    subtitle: string
    legend: string
    emailPlaceholder: string
    ctaLabel: string
    successTitle: string
    successSubtitle: string
    profiles: WaitlistProfile[]
  }
  stores: {
    badge: string
    title: string
    subtitle: string
    appStoreUrl: string
    playStoreUrl: string
    /** Labels des badges de téléchargement (éditables). */
    appStoreLabel: string
    playStoreLabel: string
    /** Libellé « bientôt disponible » affiché au-dessus du badge. */
    soonLabel: string
  }
}

export interface SeoContent {
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  keywords: string
  /** Carte X / Twitter : 'summary' (petite) ou 'summary_large_image' (grande). */
  twitterCard: 'summary' | 'summary_large_image'
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
}

export interface NavLinkItem {
  label: string
  to: string
}

export interface NavContent {
  links: NavLinkItem[]
  ctaLabel: string
}

export interface FooterLinkItem {
  label: string
  to: string
  external?: boolean
}

export interface FooterContent {
  tagline: string
  copyright: string
  links: FooterLinkItem[]
  /** Réseaux sociaux rendus en icônes à droite du footer. */
  socials: SocialLinkItem[]
}

export interface PerkItem {
  title: string
  text: string
}

export interface ArtistSignupContent {
  badge: string
  title: string
  subtitle: string
  ctaLabel: string
  privacyNote: string
  perks: PerkItem[]
}

export interface SettingsContent {
  launchDate: string
  launchLabel: string
  onlineLabel: string
  /** true = inscription ouverte ; false = « disponible après le lancement ». */
  openSignup: boolean
  /** Message affiché sur l'inscription quand elle est fermée. */
  closedSignupMessage: string
}

/** Une slide de l'onboarding mobile (icône lucide + textes, par langue). */
export interface OnboardingSlide {
  /** Nom de l'icône lucide (ex : 'Globe', 'Search', 'Heart', 'Trophy'). */
  icon: string
  chip: string
  title: string
  text: string
}

export interface OnboardingContent {
  slides: OnboardingSlide[]
}

export interface CmsContent {
  landing: LandingContent
  seo: SeoContent
  nav: NavContent
  footer: FooterContent
  badges: BadgeDefinition[]
  brand: BrandContent
  artistSignup: ArtistSignupContent
  settings: SettingsContent
  onboarding: OnboardingContent
}

export type ContentKey = keyof CmsContent

/* ------------------------------------------------------------------ */
/* Contenus par défaut (les textes actuels du site)                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_CONTENT: CmsContent = {
  landing: {
    hero: {
      title: 'Découvrez les artistes autour de vous.',
      subtitle: "Une nouvelle façon d'explorer la musique grâce à la géolocalisation.",
      ctaPrimary: 'Explorer la carte',
      ctaPrimaryTo: '/globe',
      ctaSecondary: "Rejoindre la liste d'attente",
      ctaSecondaryTo: '#waitlist',
    },
    features: {
      title: 'Une nouvelle manière de découvrir.',
      subtitle: 'Oubliez les algorithmes, explorez les territoires.',
      items: [
        {
          title: 'Autour de vous',
          text: 'Découvrez les talents qui créent à deux pas de chez vous.',
          image: 'import:autour-de-vous',
          alt: 'Concert acoustique de quartier entoure de spectateurs',
        },
        {
          title: 'Explorer',
          text: 'Naviguez de ville en ville, de continent en continent.',
          image:
            'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
          alt: 'Exploration map',
        },
        {
          title: 'Voyager',
          text: "Imprégnez-vous de la culture musicale d'un territoire.",
          image: 'import:voyager',
          alt: "Voyageur consultant Musimaps face a un village au bord d'un lac",
        },
      ],
    },
    journey: {
      items: [
        { title: '1. Autoriser', text: 'Activez votre position pour révéler les artistes locaux.' },
        { title: '2. Révéler', text: "La carte s'anime et dévoile des milliers de points." },
        { title: '3. Découvrir', text: "Plongez dans l'univers d'un artiste inconnu." },
        { title: '4. Écouter', text: 'Vivez sa musique là où elle est née.' },
      ],
    },
    globePreview: {
      title: 'Le monde entier, artiste par artiste.',
      subtitle:
        "Faites tourner la carte, cherchez une ville, zoomez jusqu'à la rue. Chaque point est un créateur.",
      cta: 'Explorer la carte',
      ctaTo: '/globe',
    },
    philosophy: {
      title: "Musimaps construit la première carte mondiale de découverte d'artistes.",
    },
    faq: {
      title: 'Questions fréquentes',
      subtitle: 'Tout ce que vous devez savoir avant l’expédition.',
      items: [
        {
          question: 'Comment fonctionne Musimaps ?',
          answer:
            'Musimaps transforme la géolocalisation en terrain de découverte musicale : les artistes apparaissent comme des points sur une carte du monde, et chaque point ouvre un univers (bio, titres, dates).',
        },
        {
          question: 'Est-ce gratuit ?',
          answer:
            "Oui. L'exploration de la carte, la recherche de villes et la découverte des artistes sont entièrement gratuites, pour toujours.",
        },
        {
          question: 'Je suis artiste, comment apparaître sur la carte ?',
          answer:
            "Remplissez le formulaire de la page artistes : votre profil sera référencé à sa place sur la carte dès le lancement.",
        },
        {
          question: 'Sur quels appareils Musimaps est-il disponible ?',
          answer:
            "Musimaps est accessible depuis le navigateur (web) et via l'application mobile iOS et Android.",
        },
      ],
    },
    waitlist: {
      title: 'Soyez parmi les premiers.',
      subtitle:
        "Rejoignez l'expédition et redéfinissez votre façon de consommer la musique.",
      legend: 'Je rejoins en tant que',
      emailPlaceholder: 'votre@email.com',
      ctaLabel: "Rejoindre l'attente",
      successTitle: 'Merci, vous êtes inscrit·e !',
      successSubtitle: 'Redirection vers votre confirmation…',
      profiles: [
        { id: 'artiste', label: 'Artiste', description: 'Je crée de la musique et veux être sur la carte.' },
        { id: 'amateur', label: 'Amateur de musique', description: 'Je veux découvrir les artistes.' },
      ],
    },
    stores: {
      badge: 'Applications mobiles',
      title: 'Bientôt disponible.',
      subtitle:
        "Musimaps arrive bientôt sur iOS et Android. Rejoignez la liste d'attente pour être prévenu·e du lancement.",
      appStoreUrl: 'https://apps.apple.com/app/musimaps',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.musimaps.app',
      appStoreLabel: 'App Store',
      playStoreLabel: 'Google Play',
      soonLabel: 'Bientôt disponible',
    },
  },
  seo: {
    title: 'Découvrez des artistes, des villes et des scènes musicales | Musimaps',
    description:
      'Découvrez des villes, des artistes et des scènes musicales partout dans le monde. Explorez chaque lieu à travers sa musique, retrouvez vos artistes favoris et repérez les talents près de vous.',
    ogTitle: 'Découvrez le monde en musique | Musimaps',
    ogDescription:
      'Découvrez des artistes par ville et explorez les scènes musicales locales du monde entier.',
    ogImage: '/og-image.jpg',
    keywords: 'Musimaps, découverte musicale, carte musicale, carte des artistes, scènes musicales',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Découvrez le monde en musique | Musimaps',
    twitterDescription:
      'Découvrez des artistes par ville et explorez les scènes musicales locales du monde entier.',
    twitterImage: '/og-image.jpg',
  },
  nav: {
    links: [
      { label: 'La carte', to: '/globe' },
      { label: 'Artistes', to: '/artistes' },
    ],
    ctaLabel: 'Rejoindre la liste',
  },
  footer: {
    tagline: 'La carte vivante de la musique.',
    copyright: '© Musimaps. La carte vivante de la musique.',
    links: [
      { label: 'La carte', to: '/globe' },
      { label: 'Espace artistes', to: '/artistes' },
      { label: "Liste d'attente", to: '/#waitlist' },
    ],
    socials: [
      {
        label: 'X',
        to: 'https://x.com/intent/post?text=D%C3%A9couvrez%20Musimaps%20%E2%80%94%20la%20carte%20vivante%20de%20la%20musique',
        icon: 'x',
      },
    ],
  },
  brand: {
    navbarLogoLight: '',
    navbarLogoDark: '',
    footerLogoLight: '',
    footerLogoDark: '',
    favicon: '',
    appImage: '',
    navbarLogoHeight: 40,
    footerLogoHeight: 32,
  },
  badges: [
    {
      id: 'first-city',
      icon: 'navigate',
      label: 'Premier pas',
      description: 'Visiter sa première ville',
      points: 10,
      condition: { metric: 'cities', min: 1 },
    },
    {
      id: 'cities-3',
      icon: 'compass',
      label: 'Curieux',
      description: 'Visiter 3 villes',
      points: 25,
      condition: { metric: 'cities', min: 3 },
    },
    {
      id: 'cities-8',
      icon: 'earth',
      label: 'Globe-trotter',
      description: 'Visiter 8 villes',
      points: 60,
      condition: { metric: 'cities', min: 8 },
    },
    {
      id: 'cities-15',
      icon: 'planet',
      label: 'Explorateur',
      description: 'Visiter 15 villes',
      points: 120,
      condition: { metric: 'cities', min: 15 },
    },
    {
      id: 'first-save',
      icon: 'heart',
      label: 'Coup de cœur',
      description: 'Sauvegarder un artiste',
      points: 10,
      condition: { metric: 'favorites', min: 1 },
    },
    {
      id: 'saves-5',
      icon: 'musical-notes',
      label: 'Mélomane',
      description: 'Sauvegarder 5 artistes',
      points: 30,
      condition: { metric: 'favorites', min: 5 },
    },
    {
      id: 'saves-12',
      icon: 'sparkles',
      label: 'Collectionneur',
      description: 'Sauvegarder 12 artistes',
      points: 80,
      condition: { metric: 'favorites', min: 12 },
    },
    {
      id: 'profile',
      icon: 'person',
      label: 'Ambassadeur',
      description: 'Créer son profil',
      points: 20,
      condition: { metric: 'profile', min: 1 },
    },
  ],
  artistSignup: {
    badge: 'Appel aux artistes',
    title: 'Soyez sur la carte au lancement.',
    subtitle:
      "Musimaps référence les créateurs territoire par territoire. Demandez votre place avant l'ouverture — les premiers profils seront les premiers visibles.",
    ctaLabel: 'Demander mon référencement',
    privacyNote:
      "Aucune donnée n'est partagée. Nous vous écrivons uniquement pour le lancement.",
    perks: [
      {
        title: 'Épinglé sur la carte',
        text: 'Votre ville, votre scène, votre son — visibles dès le premier jour.',
      },
      {
        title: 'Un public de proximité',
        text: 'Les auditeurs vous trouvent parce que vous créez près de chez eux.',
      },
      {
        title: 'Portée mondiale',
        text: 'Un voyageur qui atterrit dans votre ville tombe sur votre profil.',
      },
    ],
  },
  settings: {
    launchDate: '2026-08-19T12:00:00Z',
    launchLabel: 'Lancement dans',
    onlineLabel: 'Musimaps est en ligne.',
    openSignup: true,
    closedSignupMessage:
      'La création de compte ouvrira après le lancement. Votre place sur la carte est réservée si vous êtes sur la liste d’attente.',
  },
  onboarding: {
    slides: [
      {
        icon: 'Globe',
        chip: 'Globe interactif',
        title: 'La carte vivante de la musique',
        text: 'Explore le globe et découvre les artistes du monde entier, comme sur la landing page web.',
      },
      {
        icon: 'Search',
        chip: 'Recherche globale',
        title: 'Trouve ta prochaine découverte',
        text: 'Recherche une ville ou un artiste. Chaque coin du monde a sa scène musicale.',
      },
      {
        icon: 'Heart',
        chip: 'Artistes sauvegardés',
        title: 'Sauvegarde tes coups de cœur',
        text: 'Garde tes artistes préférés à portée de main et construis ta collection.',
      },
      {
        icon: 'Trophy',
        chip: 'Gamification & partage',
        title: 'Explore, gagne, partage',
        text: 'Visite des villes et sauvegarde des artistes pour gagner des points, monter de niveau et débloquer des badges.',
      },
    ],
  },
}

/* ------------------------------------------------------------------ */
/* Lecture / écriture                                                 */
/* ------------------------------------------------------------------ */

/**
 * Charge le contenu PUBLIÉ depuis la vue site_content_public et le fusionne
 * avec les défauts de la langue active. Chaque section du CMS stocke une
 * version FR (content) et une version EN (content_en) : on lit celle de la
 * langue demandée, en retombant sur les défauts de cette langue.
 */
export async function fetchContent(lang: Lang = 'fr'): Promise<CmsContent> {
  const defaults: CmsContent = structuredClone(lang === 'en' ? DEFAULT_CONTENT_EN : DEFAULT_CONTENT)
  const merged: CmsContent = defaults
  if (!hasSupabase()) return merged

  const { data, error } = await supabase!
    .from('site_content_public')
    .select('key, content, content_en')

  if (error || !data) return merged

  // launchDate n'est pas un texte traduisible : la date publiée côté FR fait
  // foi pour toutes les langues (sinon le compte à rebours différerait).
  let frLaunchDate: string | undefined

  const base = merged as unknown as Record<string, unknown>
  for (const row of data) {
    const key = row.key as ContentKey
    if (!(key in base)) continue
    if (key === 'settings' && lang === 'en') {
      const frSettings = row.content as { launchDate?: string } | null
      frLaunchDate = frSettings?.launchDate
    }
    const published = lang === 'en' ? row.content_en : row.content
    if (published && typeof published === 'object') {
      const current = base[key] as Record<string, unknown>
      base[key] = deepMerge(current, published as Record<string, unknown>)
    }
  }
  if (lang === 'en' && frLaunchDate) merged.settings.launchDate = frLaunchDate
  return merged
}

/** Charge le contenu BROUILLON (draft ?? publié) depuis la table de base. */
export async function fetchDraftContent(lang: Lang = 'fr'): Promise<CmsContent> {
  const defaults: CmsContent = structuredClone(lang === 'en' ? DEFAULT_CONTENT_EN : DEFAULT_CONTENT)
  const merged: CmsContent = defaults
  if (!hasSupabase()) return merged

  const { data, error } = await supabase!
    .from('site_content')
    .select('key, content, draft, content_en, draft_en')

  if (error || !data) return merged

  let frLaunchDate: string | undefined

  const base = merged as unknown as Record<string, unknown>
  for (const row of data) {
    const key = row.key as ContentKey
    if (!(key in base)) continue
    const isEn = lang === 'en'
    if (key === 'settings' && isEn) {
      const frSettings = row.content as { launchDate?: string } | null
      frLaunchDate = frSettings?.launchDate
    }
    const published = isEn ? row.content_en : row.content
    const draftField = isEn ? row.draft_en : row.draft
    const chosen =
      draftField && typeof draftField === 'object' && Object.keys(draftField).length > 0
        ? draftField
        : published
    if (chosen && typeof chosen === 'object') {
      const current = base[key] as Record<string, unknown>
      base[key] = deepMerge(current, chosen as Record<string, unknown>)
    }
  }
  if (lang === 'en' && frLaunchDate) merged.settings.launchDate = frLaunchDate
  return merged
}

/** Fusion profonde : les tableaux et scalaires de `override` remplacent. */
function deepMerge<T>(base: T, override: unknown): T {
  if (Array.isArray(override)) return override as T
  if (override === null || typeof override !== 'object') {
    return (override as T) ?? base
  }
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return override as T
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    out[key] = deepMerge((base as Record<string, unknown>)[key], value)
  }
  return out as T
}

/** Fusionne une section partielle sur les défauts. */
function mergeSection(key: ContentKey, value: unknown): Record<string, unknown> {
  const base = structuredClone(DEFAULT_CONTENT[key]) as unknown as Record<string, unknown>
  if (value && typeof value === 'object') return deepMerge(base, value)
  return base
}

/**
 * Sauvegarde un BROUILLON (ne touche pas au contenu publié). Le brouillon est
 * écrit dans `draft` (FR) ou `draft_en` (EN) selon la langue éditée.
 */
export async function saveDraft(
  key: ContentKey,
  content: unknown,
  lang: Lang = 'fr',
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }

  const field = lang === 'en' ? { draft_en: content } : { draft: content }
  const { error } = await supabase!
    .from('site_content')
    .upsert({ key, ...field, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * État d'une section pour la langue active : brouillon, version publiée, date
 * de publication. La langue détermine les colonnes lues (content/draft en FR,
 * content_en/draft_en en EN).
 */
export async function fetchSectionState(
  key: ContentKey,
  lang: Lang = 'fr',
): Promise<{ draft: unknown; published: unknown; publishedAt: string | null }> {
  if (!hasSupabase()) {
    const fallback = structuredClone(
      lang === 'en' ? DEFAULT_CONTENT_EN[key] : DEFAULT_CONTENT[key],
    )
    return { draft: fallback, published: fallback, publishedAt: null }
  }

  const { data, error } = await supabase!
    .from('site_content')
    .select('key, content, draft, content_en, draft_en, published_at')
    .eq('key', key)
    .maybeSingle()

  if (error || !data) {
    const fallback = structuredClone(
      lang === 'en' ? DEFAULT_CONTENT_EN[key] : DEFAULT_CONTENT[key],
    )
    return { draft: fallback, published: fallback, publishedAt: null }
  }

  const isEn = lang === 'en'
  const published = mergeSection(key, isEn ? data.content_en : data.content)
  const draftField = isEn ? data.draft_en : data.draft
  const draft =
    draftField && typeof draftField === 'object' && Object.keys(draftField).length > 0
      ? mergeSection(key, draftField)
      : published
  return { draft, published, publishedAt: data.published_at ?? null }
}

/**
 * Publie le brouillon (content = draft, published_at = maintenant) et archive
 * la version dans content_history. Délégué à la fonction SQL publish_section
 * pour garantir l'atomicité (archive + publication dans une transaction).
 */
export async function publishContent(
  key: ContentKey,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }

  const { data, error } = await supabase!.rpc('publish_section', { p_key: key })
  if (error) return { ok: false, error: error.message }

  const result = data as { ok?: boolean; error?: string } | null
  if (!result?.ok) return { ok: false, error: result?.error ?? 'Publication impossible' }
  return { ok: true }
}

/** Annule le brouillon de la langue active : on revient à la version publiée. */
export async function discardDraft(
  key: ContentKey,
  lang: Lang = 'fr',
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const field = lang === 'en' ? { draft_en: null } : { draft: null }
  const { error } = await supabase!
    .from('site_content')
    .update(field)
    .eq('key', key)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/* ------------------------------------------------------------------ */
/* Cache (version d'invalidation + politiques .htaccess)              */
/* ------------------------------------------------------------------ */

/** Bloc de cache .htaccess par défaut (règles mod_headers + mod_expires). */
export const DEFAULT_HTACCESS_CACHE = `# ---------------------------------------------------------------
# Cache headers
# ---------------------------------------------------------------
<IfModule mod_headers.c>
  <FilesMatch "\.(html|htm)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
  <FilesMatch "\.(js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "^favicon\.png$">
    Header set Cache-Control "public, max-age=3600"
  </FilesMatch>
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/avif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/x-icon "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
  ExpiresByType font/ttf "access plus 1 year"
</IfModule>`

/** Version de cache courante (cache-busting ?v=N). */
export async function fetchCacheVersion(): Promise<number> {
  if (!hasSupabase()) return 1
  const { data, error } = await supabase!
    .from('cache_config')
    .select('value')
    .eq('key', 'cache_version')
    .maybeSingle()
  if (error || !data) return 1
  const n = Number.parseInt(String(data.value), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Passe la version de cache à N+1 : tous les visiteurs rechargent les visuels stables. */
export async function bumpCacheVersion(): Promise<number> {
  const next = (await fetchCacheVersion()) + 1
  if (hasSupabase()) {
    await supabase!
      .from('cache_config')
      .upsert(
        { key: 'cache_version', value: String(next), updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      )
  }
  return next
}

/** Politique de cache .htaccess stockée (vide = défaut). */
export async function fetchCachePolicy(): Promise<string> {
  if (!hasSupabase()) return DEFAULT_HTACCESS_CACHE
  const { data, error } = await supabase!
    .from('cache_config')
    .select('value')
    .eq('key', 'htaccess_cache')
    .maybeSingle()
  if (error || !data) return DEFAULT_HTACCESS_CACHE
  return String(data.value)
}

/** Sauvegarde la politique de cache (appliquée au prochain déploiement). */
export async function saveCachePolicy(
  policy: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { error } = await supabase!
    .from('cache_config')
    .upsert(
      { key: 'htaccess_cache', value: policy, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  return error ? { ok: false, error: error.message } : { ok: true }
}

/* ------------------------------------------------------------------ */
/* Historique des versions publiées                                   */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  id: string
  key: ContentKey
  content: unknown
  /** Version anglaise archivée (vide si la version est antérieure au bilingue). */
  contentEn?: unknown
  publishedAt: string
  createdBy: string | null
}

/** Liste les versions publiées, la plus récente en premier. */
export async function fetchContentHistory(
  key?: ContentKey,
): Promise<HistoryEntry[]> {
  if (!hasSupabase()) return []

  // La migration 00017 ajoute content_en — repli si absente.
  const RICH_SELECT = 'id, key, content, content_en, published_at, created_by'
  const BASE_SELECT = 'id, key, content, published_at, created_by'

  const run = async (select: string) => {
    let q = supabase!.from('content_history').select(select)
    if (key) q = q.eq('key', key)
    return q.order('published_at', { ascending: false }).limit(200)
  }

  const first = await run(RICH_SELECT)
  let rows: Array<Record<string, unknown>> | null = (first.data ??
    null) as unknown as Array<Record<string, unknown>> | null
  if (!rows || first.error) {
    const fallback = await run(BASE_SELECT)
    rows = (fallback.data ?? null) as unknown as Array<Record<string, unknown>> | null
  }
  if (!rows) return []

  return rows.map((row) => ({
    id: row.id as string,
    key: row.key as ContentKey,
    content: row.content,
    contentEn: (row as { content_en?: unknown }).content_en ?? undefined,
    publishedAt: row.published_at as string,
    createdBy: (row.created_by as string | null) ?? null,
  }))
}

/**
 * Restaure une version archivée : elle redevient la version publiée (et le
 * brouillon de travail), et la restauration est elle-même archivée.
 * Délégué à la fonction SQL restore_version (transaction + is_admin).
 */
export async function restoreVersion(
  key: ContentKey,
  versionId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }

  const { data, error } = await supabase!.rpc('restore_version', {
    p_key: key,
    p_version_id: versionId,
  })
  if (error) return { ok: false, error: error.message }

  const result = data as { ok?: boolean; error?: string } | null
  if (!result?.ok) return { ok: false, error: result?.error ?? 'Restauration impossible' }
  return { ok: true }
}

/** État de toutes les sections : brouillon en attente ? date de publication ? */
export async function fetchContentStates(): Promise<
  { key: ContentKey; dirty: boolean; publishedAt: string | null }[]
> {
  const keys = Object.keys(DEFAULT_CONTENT) as ContentKey[]
  if (!hasSupabase()) return keys.map((key) => ({ key, dirty: false, publishedAt: null }))

  // Dirty si un brouillon FR OU EN diffère de la version publiée.
  const { data, error } = await supabase!
    .from('site_content')
    .select('key, content, content_en, draft, draft_en, published_at')
  if (error || !data) return keys.map((key) => ({ key, dirty: false, publishedAt: null }))

  const rows = new Map(data.map((r) => [r.key as string, r]))
  return keys.map((key) => {
    const row = rows.get(key)
    if (!row) return { key, dirty: false, publishedAt: null }

    const draftField =
      row.draft && typeof row.draft === 'object' && Object.keys(row.draft).length > 0
        ? row.draft
        : row.content
    const draftEn =
      row.draft_en && typeof row.draft_en === 'object' && Object.keys(row.draft_en).length > 0
        ? row.draft_en
        : row.content_en
    const published = row.content ?? {}
    const publishedEn = row.content_en ?? {}

    const dirty =
      JSON.stringify(mergeSection(key, draftField)) !== JSON.stringify(mergeSection(key, published)) ||
      JSON.stringify(mergeSection(key, draftEn)) !== JSON.stringify(mergeSection(key, publishedEn))
    return { key, dirty, publishedAt: row.published_at ?? null }
  })
}
