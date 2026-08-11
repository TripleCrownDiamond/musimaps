import { useEffect, useState } from 'react'
import { Info, Languages, Moon, Sun } from 'lucide-react'
import type { BrandContent } from '@/lib/cms'
import { isLegacyBrandUrl, resolveBrandLogo } from '@musimaps/shared'
import logoBlack from '@/assets/brand/logo-black.png'
import logoWhite from '@/assets/brand/logo-white.png'
import { useSection } from '../useSection'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, ImageField } from '../components/fields'
import { PublishBar } from '../components/PublishBar'
import { cn } from '@/lib/utils'

/** Bornes des tailles de logos (px) proposées dans l'admin. */
const LOGO_SIZE_MIN = 20
const LOGO_SIZE_MAX = 140

/** Palette officielle Musimaps — appliquée sur le site et l'application. */
const BRAND_COLORS = [
  { hex: '#A8FF35', name: 'Vert lime', role: 'Actions, accents et a-plats' },
  { hex: '#2F52E0', name: 'Bleu profond', role: 'Texte et icônes sur fond clair' },
]

type PreviewTheme = 'light' | 'dark'

/** Couleurs réelles du site pour chaque thème (same source que index.css). */
const PREVIEW_PALETTE: Record<PreviewTheme, {
  page: string
  surface: string
  border: string
  text: string
  muted: string
  ink: string
  inkForeground: string
}> = {
  light: {
    page: '#FAF7F5',
    surface: '#FFFFFF',
    border: 'rgba(0, 0, 0, 0.1)',
    text: '#111111',
    muted: '#6B7280',
    ink: '#111111',
    inkForeground: '#FFFFFF',
  },
  dark: {
    page: '#0D0F13',
    surface: '#14181F',
    border: 'rgba(255, 255, 255, 0.16)',
    text: '#F3F4F6',
    muted: '#9AA4AF',
    ink: '#F3F4F6',
    inkForeground: '#0D0F13',
  },
}

/** Logo officiel embarqué, repli quand aucun logo CMS exploitable. */
const PACKAGED_LOGO: Record<PreviewTheme, string> = {
  light: logoBlack,
  dark: logoWhite,
}

/**
 * Même logique que Navbar/Footer : un seul logo rempli sert les deux thèmes,
 * et les anciens logos cyan du CMS sont ignorés (logo officiel embarqué).
 */
function resolveLogo(light: string, dark: string, theme: PreviewTheme): string {
  return (
    resolveBrandLogo(light, dark, theme) ?? PACKAGED_LOGO[theme]
  )
}

const FIELD_GROUPS: {
  title: string
  description: string
  fields: {
    key: keyof BrandContent
    label: string
    hint?: string
    /** Fond sur lequel la vignette d'aperçu monte le logo. */
    preview?: 'auto' | 'light' | 'dark'
    /** contain pour les logos (PNG transparent), cover pour les visuels. */
    fit?: 'cover' | 'contain'
  }[]
  /** Taille (hauteur en px) contrôlable pour ce groupe. */
  size?: {
    key: 'navbarLogoHeight' | 'footerLogoHeight'
    label: string
    hint: string
  }
}[] = [
  {
    title: 'Logo de la barre de navigation',
    description: 'Affiché en haut du site. Chaque version est rendue sur son fond réel : le logo du mode clair doit être visible sur fond clair, celui du mode sombre sur fond sombre.',
    fields: [
      {
        key: 'navbarLogoLight',
        label: 'Logo — mode clair',
        hint: 'Rendu sur fond clair : privilégiez des couleurs sombres (ou un logo à fond).',
        preview: 'light',
        fit: 'contain',
      },
      {
        key: 'navbarLogoDark',
        label: 'Logo — mode sombre',
        hint: 'Rendu sur fond sombre : privilégiez un logo blanc ou très clair.',
        preview: 'dark',
        fit: 'contain',
      },
    ],
    size: {
      key: 'navbarLogoHeight',
      label: 'Hauteur du logo navbar',
      hint: `Taille d’affichage en pixels (${LOGO_SIZE_MIN}–${LOGO_SIZE_MAX} px). Appliquée au site et visible dans l’aperçu ci-dessus.`,
    },
  },
  {
    title: 'Logo du footer',
    description: 'Affiché en bas de page (repli sur le logo packagé si vide).',
    fields: [
      { key: 'footerLogoLight', label: 'Logo — mode clair', preview: 'light', fit: 'contain' },
      { key: 'footerLogoDark', label: 'Logo — mode sombre', preview: 'dark', fit: 'contain' },
    ],
    size: {
      key: 'footerLogoHeight',
      label: 'Hauteur du logo footer',
      hint: `Taille d’affichage en pixels (${LOGO_SIZE_MIN}–${LOGO_SIZE_MAX} px). Appliquée au site et visible dans l’aperçu ci-dessus.`,
    },
  },
  {
    title: 'Favicon & image de l’app',
    description: 'Icône de l’onglet du navigateur et visuel de l’application.',
    fields: [
      { key: 'favicon', label: 'Favicon', hint: 'Format carré (PNG/SVG). Appliqué automatiquement au site — sa taille d’affichage est gérée par le navigateur.', fit: 'contain' },
      { key: 'appImage', label: 'Image de l’app', hint: 'Visuel utilisé pour l’application / réseaux.' },
    ],
  },
]

/** Clamp une taille en px dans les bornes autorisées. */
function clampSize(value: number): number {
  return Math.min(LOGO_SIZE_MAX, Math.max(LOGO_SIZE_MIN, Math.round(value)))
}

/** Curseur + champ numérique pour une taille de logo. */
function SizeField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={LOGO_SIZE_MIN}
          max={LOGO_SIZE_MAX}
          value={value}
          onChange={(e) => onChange(clampSize(Number(e.target.value)))}
          aria-label={`${label} (curseur)`}
          className="bg-secondary-bg h-2 flex-1 cursor-pointer appearance-none rounded-full accent-brand-deep"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Input
            type="number"
            min={LOGO_SIZE_MIN}
            max={LOGO_SIZE_MAX}
            value={value}
            onChange={(e) =>
              // Champ vidé → on garde la dernière valeur valide (évite de sauter à 20).
              onChange(e.target.value === '' ? value : clampSize(Number(e.target.value)))
            }
            className="w-20 text-center"
          />
          <span className="text-muted-foreground text-sm">px</span>
        </div>
      </div>
    </Field>
  )
}

/** Bascule clair/sombre de l'aperçu (indépendante du thème de l'admin). */
function PreviewSwitch({
  value,
  onChange,
}: {
  value: PreviewTheme
  onChange: (value: PreviewTheme) => void
}) {
  return (
    <div
      role="group"
      aria-label="Thème de l’aperçu"
      className="flex items-center gap-1 rounded-full border border-hairline-strong p-1"
    >
      {(['light', 'dark'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors',
            value === mode
              ? 'bg-brand text-black'
              : 'text-secondary-text hover:text-primary-text',
          )}
        >
          {mode === 'light' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {mode === 'light' ? 'Clair' : 'Sombre'}
        </button>
      ))}
    </div>
  )
}

export default function BrandPage() {
  const section = useSection('brand')
  const [draft, setDraft] = useState<BrandContent | null>(null)
  const [preview, setPreview] = useState<PreviewTheme>('light')

  useEffect(() => {
    if (section.draft) setDraft(structuredClone(section.draft as BrandContent))
  }, [section.draft])

  const save = async () => {
    if (!draft) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return section.save(draft)
  }

  if (!draft) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
  }

  const set = (key: keyof BrandContent) => (value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const setSize = (key: 'navbarLogoHeight' | 'footerLogoHeight') => (value: number) =>
    setDraft((d) => (d ? { ...d, [key]: clampSize(value) } : d))

  const palette = PREVIEW_PALETTE[preview]
  const navLogo = resolveLogo(draft.navbarLogoLight, draft.navbarLogoDark, preview)
  const footerLogo = resolveLogo(draft.footerLogoLight, draft.footerLogoDark, preview)
  const navLegacy =
    isLegacyBrandUrl(draft.navbarLogoLight) || isLegacyBrandUrl(draft.navbarLogoDark)
  const footerLegacy =
    isLegacyBrandUrl(draft.footerLogoLight) || isLegacyBrandUrl(draft.footerLogoDark)
  const navIsFallback = navLogo === PACKAGED_LOGO[preview]
  const footerIsFallback = footerLogo === PACKAGED_LOGO[preview]
  const themeLabel = preview === 'light' ? 'mode clair' : 'mode sombre'

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Logo & favicon</h1>
          <p className="text-muted-foreground text-sm">
            Uploadez les logos (clair et sombre), la favicon et l’image de l’app. Tout est relié
            au site : navbar, footer, onglet du navigateur.
          </p>
        </div>
        <PublishBar
          dirty={section.dirty}
          loading={section.loading}
          publishedAt={section.publishedAt}
          previewUrl="/preview"
          onSave={save}
          onPublish={section.publish}
          onDiscard={section.discard}
        />
      </div>

      {/* Anciens logos encore publiés dans le CMS : ignorés par le site. */}
      {(navLegacy || footerLegacy) && (
        <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-amber-50 p-4 dark:bg-amber-950/30">
          <Info className="text-amber-600 mt-0.5 size-5 shrink-0 dark:text-amber-400" />
          <div className="grid gap-0.5">
            <p className="text-sm font-medium">Anciens logos encore publiés</p>
            <p className="text-muted-foreground text-sm">
              Les anciens logos cyan déjà publiés sont ignorés par le site, qui affiche le
              wordmark officiel embarqué. Téléversez de nouveaux logos (mode clair et sombre)
              pour les remplacer, puis publiez.
            </p>
          </div>
        </div>
      )}

      {/* La marque est globale : partagée entre les versions FR et EN. */}
      <div className="bg-brand-soft flex items-start gap-3 rounded-2xl border border-hairline p-4">
        <Languages className="text-brand-deep mt-0.5 size-5 shrink-0" />
        <div className="grid gap-0.5">
          <p className="text-sm font-medium">Une seule marque pour les deux langues</p>
          <p className="text-muted-foreground text-sm">
            Logos, favicon et image d’app sont partagés entre les versions FR et EN du site :
            modifiez-les une seule fois, ils s’appliquent partout (web et application).
          </p>
        </div>
      </div>

      {/* Aperçu en conditions réelles, clair ET sombre. */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <CardTitle>Aperçu en conditions réelles</CardTitle>
            <CardDescription>
              Basculez clair / sombre pour vérifier la visibilité des logos dans chaque thème du
              site, avant de publier.
            </CardDescription>
          </div>
          <PreviewSwitch value={preview} onChange={setPreview} />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          {/* Navbar */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: palette.page }}>
            <div
              className="flex items-center justify-between rounded-[2rem] border px-6 py-3 backdrop-blur-xl"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <img
                src={navLogo}
                alt="Aperçu du logo navbar"
                className="w-auto"
                style={{ height: draft.navbarLogoHeight, maxHeight: LOGO_SIZE_MAX }}
              />
              <div className="hidden items-center gap-6 md:flex" style={{ color: palette.muted }}>
                <span style={{ color: palette.text }}>La carte</span>
                <span>Artistes</span>
                <span
                  className="rounded-full px-5 py-2 text-sm font-medium"
                  style={{ backgroundColor: palette.ink, color: palette.inkForeground }}
                >
                  Rejoindre la liste
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: palette.muted }}>
              Barre de navigation — {themeLabel}
              {navIsFallback &&
                (navLegacy
                  ? ' · anciens logos ignorés — wordmark officiel affiché'
                  : ' · wordmark officiel (aucun logo renseigné)')}
            </p>
          </div>

          {/* Footer */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: palette.page }}>
            <div className="border-t pt-5" style={{ borderColor: palette.border }}>
              <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                <img
                  src={footerLogo}
                  alt="Aperçu du logo footer"
                  className="w-auto"
                  style={{ height: draft.footerLogoHeight, maxHeight: LOGO_SIZE_MAX }}
                />
                <div className="flex flex-wrap justify-center gap-6 text-sm" style={{ color: palette.muted }}>
                  <span style={{ color: palette.text }}>La carte</span>
                  <span>Espace artistes</span>
                  <span>Liste d’attente</span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs" style={{ color: palette.muted }}>
                Pied de page — {themeLabel}
                {footerIsFallback &&
                  (footerLegacy
                    ? ' · anciens logos ignorés — wordmark officiel affiché'
                    : ' · wordmark officiel (aucun logo renseigné)')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Palette officielle. */}
      <Card>
        <CardHeader>
          <CardTitle>Couleurs de la marque</CardTitle>
          <CardDescription>
            La palette officielle (#A8FF35 et #2F52E0) est appliquée sur tout le site et
            l’application — elle n’est pas modifiable ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          {BRAND_COLORS.map((color) => (
            <div key={color.hex} className="flex items-center gap-3">
              <div
                className="size-12 shrink-0 rounded-xl border border-hairline"
                style={{ backgroundColor: color.hex }}
                aria-hidden="true"
              />
              <div className="grid gap-0.5">
                <p className="font-mono text-sm font-bold">{color.hex}</p>
                <p className="text-muted-foreground text-xs">
                  {color.name} — {color.role}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {FIELD_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            {group.fields.map(({ key, label, hint, preview, fit }) => (
              <Field key={key} label={label} hint={hint}>
                <ImageField
                  value={draft[key] as string}
                  onChange={set(key)}
                  previewBg={preview ?? 'auto'}
                  objectFit={fit ?? 'cover'}
                />
              </Field>
            ))}
            {group.size && (
              <div className="border-t border-hairline pt-4">
                <SizeField
                  label={group.size.label}
                  hint={group.size.hint}
                  value={draft[group.size.key]}
                  onChange={setSize(group.size.key)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
