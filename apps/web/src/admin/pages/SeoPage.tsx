import { useEffect, useState } from 'react'
import type { SeoContent } from '@/lib/cms'
import { useSection } from '../useSection'
import { LangSwitch } from '../components/LangSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, TextInput, TextAreaInput, ImageField } from '../components/fields'
import { PublishBar } from '../components/PublishBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Globe2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Plateformes dont l'aperçu est géré ici (toutes lisent og:*, X a ses propres balises). */
const PLATFORMS = ['facebook', 'x', 'linkedin', 'whatsapp', 'discord', 'telegram'] as const
type Platform = (typeof PLATFORMS)[number]

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  x: 'X / Twitter',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  telegram: 'Telegram',
}

/** Aperçu façon réseau social (styles distincts par plateforme). */
function PlatformPreview({
  platform,
  title,
  description,
  image,
}: {
  platform: Platform
  title: string
  description: string
  image: string
}) {
  const styles: Record<Platform, { card: string; domain: string; accent: string }> = {
    facebook: { card: 'bg-white text-[#1c1e21]', domain: 'text-[#8a8d91]', accent: 'text-[#1877f2]' },
    x: { card: 'bg-white text-[#0f1419]', domain: 'text-[#536471]', accent: 'text-[#0f1419]' },
    linkedin: { card: 'bg-white text-[#111]', domain: 'text-[#6a737b]', accent: 'text-[#0a66c2]' },
    whatsapp: { card: 'bg-white text-[#111b21]', domain: 'text-[#667781]', accent: 'text-[#075e54]' },
    discord: { card: 'bg-[#313338] text-[#f2f3f5]', domain: 'text-[#949ba4]', accent: 'text-[#5865f2]' },
    telegram: { card: 'bg-white text-[#0f1419]', domain: 'text-[#707579]', accent: 'text-[#229ed9]' },
  }
  const s = styles[platform]

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', s.card)}>
      {image ? (
        <img src={image} alt="" className="aspect-[1200/630] w-full object-cover" />
      ) : (
        <div className="from-brand-deep flex aspect-[1200/630] w-full items-center justify-center bg-gradient-to-br to-black text-white">
          {platform === 'x' ? 'Image de carte manquante' : 'Ajoutez une image OG'}
        </div>
      )}
      <div className="grid gap-0.5 p-3">
        <p className={cn('text-xs uppercase tracking-wide', s.domain)}>musimaps.app</p>
        <p className="line-clamp-1 font-semibold leading-snug">{title || 'Titre à renseigner'}</p>
        <p className={cn('line-clamp-2 text-sm leading-snug', s.domain)}>
          {description || 'Description à renseigner'}
        </p>
      </div>
    </div>
  )
}

export default function SeoPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const section = useSection('seo', lang)
  const [draft, setDraft] = useState<SeoContent | null>(null)

  useEffect(() => {
    if (section.draft) setDraft(structuredClone(section.draft as SeoContent))
  }, [section.draft])

  const set = (patch: Partial<SeoContent>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d))

  const save = async () => {
    if (!draft) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return section.save(draft)
  }

  if (!draft) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
    )
  }

  // Chaque plateforme non-X lit og:* ; X a ses propres balises twitter:*.
  const preview = (platform: Platform) => ({
    title: platform === 'x' ? draft.twitterTitle || draft.ogTitle : draft.ogTitle,
    description:
      platform === 'x'
        ? draft.twitterDescription || draft.ogDescription
        : draft.ogDescription || draft.description,
    image:
      platform === 'x'
        ? draft.twitterImage || draft.ogImage
        : draft.ogImage,
  })

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">SEO</h1>
          <p className="text-muted-foreground text-sm">
            Titre, meta description et Open Graph — appliqués sur le site après publication.
            Chaque langue a son propre jeu de meta, plateforme par plateforme.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LangSwitch lang={lang} onChange={setLang} />
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Champs d'édition */}
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Meta principales</CardTitle>
              <CardDescription>Utilisées par les moteurs de recherche (aperçu Google).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre" hint={`${draft.title.length}/60 caractères conseillés`}>
                <TextInput value={draft.title} onChange={(v) => set({ title: v })} />
              </Field>
              <Field
                label="Meta description"
                hint={`${draft.description.length}/160 caractères conseillés`}
              >
                <TextAreaInput
                  value={draft.description}
                  onChange={(v) => set({ description: v })}
                  rows={3}
                />
              </Field>
              <Field label="Mots-clés (séparés par des virgules)">
                <TextInput value={draft.keywords} onChange={(v) => set({ keywords: v })} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open Graph — toutes les plateformes</CardTitle>
              <CardDescription>
                Cartes de partage lues par Facebook, LinkedIn, WhatsApp, Discord et Telegram.
                Une seule image 1200 × 630 suffit : toutes ces plateformes utilisent les balises og:*.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre OG">
                <TextInput value={draft.ogTitle} onChange={(v) => set({ ogTitle: v })} />
              </Field>
              <Field label="Description OG">
                <TextAreaInput
                  value={draft.ogDescription}
                  onChange={(v) => set({ ogDescription: v })}
                  rows={3}
                />
              </Field>
              <Field label="Image OG" hint="Recommandé : 1200 × 630 px. Affichée sur les partages et l'aperçu Google.">
                <ImageField value={draft.ogImage} onChange={(v) => set({ ogImage: v })} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>X / Twitter</CardTitle>
              <CardDescription>
                X (ex-Twitter) utilise ses propres balises twitter:*. Laisser vide pour reprendre
                automatiquement l'Open Graph générique.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Type de carte">
                <div className="flex flex-wrap gap-2">
                  {(['summary', 'summary_large_image'] as const).map((card) => (
                    <button
                      key={card}
                      type="button"
                      onClick={() => set({ twitterCard: card })}
                      aria-pressed={draft.twitterCard === card}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                        draft.twitterCard === card
                          ? 'border-brand bg-brand/15 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {card === 'summary_large_image' ? 'Grande image' : 'Petite image'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Titre de la carte">
                <TextInput
                  value={draft.twitterTitle}
                  onChange={(v) => set({ twitterTitle: v })}
                  placeholder={draft.ogTitle || 'Reprend le titre OG'}
                />
              </Field>
              <Field label="Description de la carte">
                <TextAreaInput
                  value={draft.twitterDescription}
                  onChange={(v) => set({ twitterDescription: v })}
                  rows={3}
                  placeholder={draft.ogDescription || 'Reprend la description OG'}
                />
              </Field>
              <Field label="Image de la carte" hint="1200 × 675 px idéalement. Vide = image OG.">
                <ImageField
                  value={draft.twitterImage}
                  onChange={(v) => set({ twitterImage: v })}
                  placeholder={draft.ogImage || 'Reprend l’image OG'}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Aperçus en direct */}
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="text-muted-foreground size-4" /> Aperçu Google
              </CardTitle>
              <CardDescription>
                Ce que les internautes voient dans les résultats de recherche ({lang === 'fr' ? 'français' : 'anglais'}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-secondary-text">
                https://musimaps.app{lang === 'en' ? '/en' : ''}
              </div>
              <p className="text-xl leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
                {draft.title || 'Titre à renseigner'}
              </p>
              <p className="text-sm leading-snug text-[#006621] dark:text-[#9aa0a6]">
                {draft.ogDescription || draft.description || 'Description à renseigner'}
              </p>
              <p className="text-sm leading-snug text-secondary-text">
                {draft.description || 'Meta description à renseigner'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="text-muted-foreground size-4" /> Aperçus par plateforme
              </CardTitle>
              <CardDescription>
                Ce que chaque réseau affiche lors d'un partage, dans la langue éditée.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="facebook">
                <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1">
                  {PLATFORMS.map((platform) => (
                    <TabsTrigger
                      key={platform}
                      value={platform}
                      className="flex-1 whitespace-nowrap px-2.5"
                    >
                      {PLATFORM_LABELS[platform]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PLATFORMS.map((platform) => (
                  <TabsContent key={platform} value={platform}>
                    <PlatformPreview
                      platform={platform}
                      title={preview(platform).title}
                      description={preview(platform).description}
                      image={preview(platform).image}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-muted-foreground px-1 text-xs">
            Le favicon et les logos sont gérés dans l'onglet « Logo & favicon ». Google peut
            mettre quelques jours à rafraîchir son aperçu après publication.
          </p>
        </div>
      </div>
    </div>
  )
}
