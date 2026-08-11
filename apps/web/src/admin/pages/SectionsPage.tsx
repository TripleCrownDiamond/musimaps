import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LandingContent, WaitlistProfile } from '@/lib/cms'
import { useSection } from '../useSection'
import { LangSwitch } from '../components/LangSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field, TextInput, TextAreaInput, ArrayEditor, ImageField } from '../components/fields'
import { RichEditor } from '../components/RichEditor'
import { PublishBar } from '../components/PublishBar'

const LANDING_TABS = ['hero', 'features', 'journey', 'globe', 'stores', 'philosophy', 'faq', 'waitlist']

export default function SectionsPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const section = useSection('landing', lang)
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = requestedTab && LANDING_TABS.includes(requestedTab) ? requestedTab : 'hero'
  const [draft, setDraft] = useState<LandingContent | null>(null)

  useEffect(() => {
    if (section.draft) setDraft(structuredClone(section.draft as LandingContent))
  }, [section.draft])

  const save = async () => {
    if (!draft) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return section.save(draft)
  }

  // Le garde « if (!draft) » plus bas garantit que ces setters ne s'exécutent
  // qu'une fois le contenu chargé ; le garde d dans le updater satisfait TS.
  const setHero = (patch: Partial<LandingContent['hero']>) =>
    setDraft((d) => (d ? { ...d, hero: { ...d.hero, ...patch } } : d))
  const setFeatures = (patch: Partial<LandingContent['features']>) =>
    setDraft((d) => (d ? { ...d, features: { ...d.features, ...patch } } : d))
  const setJourney = (patch: Partial<LandingContent['journey']>) =>
    setDraft((d) => (d ? { ...d, journey: { ...d.journey, ...patch } } : d))
  const setGlobePreview = (patch: Partial<LandingContent['globePreview']>) =>
    setDraft((d) => (d ? { ...d, globePreview: { ...d.globePreview, ...patch } } : d))
  const setPhilosophy = (patch: Partial<LandingContent['philosophy']>) =>
    setDraft((d) => (d ? { ...d, philosophy: { ...d.philosophy, ...patch } } : d))
  const setStores = (patch: Partial<LandingContent['stores']>) =>
    setDraft((d) => (d ? { ...d, stores: { ...d.stores, ...patch } } : d))
  const setFaq = (patch: Partial<LandingContent['faq']>) =>
    setDraft((d) => (d ? { ...d, faq: { ...d.faq, ...patch } } : d))
  const setWaitlist = (patch: Partial<LandingContent['waitlist']>) =>
    setDraft((d) => (d ? { ...d, waitlist: { ...d.waitlist, ...patch } } : d))

  if (!draft) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Sections de la landing</h1>
          <p className="text-muted-foreground text-sm">
            Modifiez les textes affichés sur la page d’accueil, prévisualisez le brouillon puis
            publiez-le.
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

      {/* key={activeTab} force le remontage quand on arrive via la sidebar (ex : FAQ) */}
      <Tabs key={activeTab} defaultValue={activeTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="features">Fonctionnalités</TabsTrigger>
          <TabsTrigger value="journey">Parcours</TabsTrigger>
          <TabsTrigger value="globe">Globe</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="philosophy">Philosophie</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="hero">
          <Card>
            <CardHeader>
              <CardTitle>Section Hero</CardTitle>
              <CardDescription>Le bloc d’introduction au-dessus de la carte.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre">
                <TextAreaInput value={draft.hero.title} onChange={(v) => setHero({ title: v })} />
              </Field>
              <Field label="Sous-titre" hint="Markdown et HTML supportés.">
                <RichEditor value={draft.hero.subtitle} onChange={(v) => setHero({ subtitle: v })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Bouton principal">
                  <TextInput value={draft.hero.ctaPrimary} onChange={(v) => setHero({ ctaPrimary: v })} />
                </Field>
                <Field label="Lien du bouton principal">
                  <TextInput value={draft.hero.ctaPrimaryTo} onChange={(v) => setHero({ ctaPrimaryTo: v })} />
                </Field>
                <Field label="Bouton secondaire">
                  <TextInput value={draft.hero.ctaSecondary} onChange={(v) => setHero({ ctaSecondary: v })} />
                </Field>
                <Field label="Lien du bouton secondaire">
                  <TextInput value={draft.hero.ctaSecondaryTo} onChange={(v) => setHero({ ctaSecondaryTo: v })} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Fonctionnalités</CardTitle>
              <CardDescription>Le bloc des trois cartes (Autour de vous, Explorer, Voyager).</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre du bloc">
                <TextAreaInput value={draft.features.title} onChange={(v) => setFeatures({ title: v })} />
              </Field>
              <Field label="Sous-titre du bloc" hint="Markdown et HTML supportés.">
                <RichEditor value={draft.features.subtitle} onChange={(v) => setFeatures({ subtitle: v })} />
              </Field>
              <ArrayEditor
                label="Carte"
                items={draft.features.items}
                onChange={(items) => setFeatures({ items })}
                createItem={() => ({ title: '', text: '', image: '', alt: '' })}
                renderItem={(item, update) => (
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Titre">
                      <TextInput value={item.title} onChange={(v) => update({ title: v })} />
                    </Field>
                    <Field label="Texte" hint="Markdown et HTML supportés.">
                      <RichEditor value={item.text} onChange={(v) => update({ text: v })} height={140} />
                    </Field>
                    <Field label="Image">
                      <ImageField value={item.image} onChange={(v) => update({ image: v })} />
                    </Field>
                    <Field label="Texte alternatif">
                      <TextInput value={item.alt} onChange={(v) => update({ alt: v })} />
                    </Field>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journey">
          <Card>
            <CardHeader>
              <CardTitle>Parcours</CardTitle>
              <CardDescription>La frise en 4 étapes (Autoriser, Révéler, Découvrir, Écouter).</CardDescription>
            </CardHeader>
            <CardContent>
              <ArrayEditor
                label="Étape"
                items={draft.journey.items}
                onChange={(items) => setJourney({ items })}
                createItem={() => ({ title: '', text: '' })}
                renderItem={(item, update) => (
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Titre">
                      <TextInput value={item.title} onChange={(v) => update({ title: v })} />
                    </Field>
                    <Field label="Texte" hint="Markdown et HTML supportés.">
                      <RichEditor value={item.text} onChange={(v) => update({ text: v })} height={140} />
                    </Field>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="globe">
          <Card>
            <CardHeader>
              <CardTitle>Prévisualisation du globe</CardTitle>
              <CardDescription>Le bloc noir avec la carte en rotation.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre">
                <TextAreaInput value={draft.globePreview.title} onChange={(v) => setGlobePreview({ title: v })} />
              </Field>
              <Field label="Sous-titre" hint="Markdown et HTML supportés.">
                <RichEditor value={draft.globePreview.subtitle} onChange={(v) => setGlobePreview({ subtitle: v })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Bouton">
                  <TextInput value={draft.globePreview.cta} onChange={(v) => setGlobePreview({ cta: v })} />
                </Field>
                <Field label="Lien du bouton">
                  <TextInput value={draft.globePreview.ctaTo} onChange={(v) => setGlobePreview({ ctaTo: v })} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores">
          <Card>
            <CardHeader>
              <CardTitle>Applications mobiles</CardTitle>
              <CardDescription>
                Section « Bientôt disponible » : badges App Store / Google Play, libellés et liens.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Badge (petite étiquette)">
                <TextInput value={draft.stores.badge} onChange={(v) => setStores({ badge: v })} />
              </Field>
              <Field label="Titre">
                <TextAreaInput value={draft.stores.title} onChange={(v) => setStores({ title: v })} />
              </Field>
              <Field label="Sous-titre">
                <TextAreaInput value={draft.stores.subtitle} onChange={(v) => setStores({ subtitle: v })} />
              </Field>
              <Field label="Libellé « bientôt disponible » (au-dessus des badges)">
                <TextInput value={draft.stores.soonLabel} onChange={(v) => setStores({ soonLabel: v })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Label badge App Store">
                  <TextInput value={draft.stores.appStoreLabel} onChange={(v) => setStores({ appStoreLabel: v })} />
                </Field>
                <Field label="Label badge Google Play">
                  <TextInput value={draft.stores.playStoreLabel} onChange={(v) => setStores({ playStoreLabel: v })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="URL App Store">
                  <TextInput value={draft.stores.appStoreUrl} onChange={(v) => setStores({ appStoreUrl: v })} />
                </Field>
                <Field label="URL Google Play">
                  <TextInput value={draft.stores.playStoreUrl} onChange={(v) => setStores({ playStoreUrl: v })} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="philosophy">
          <Card>
            <CardHeader>
              <CardTitle>Philosophie</CardTitle>
              <CardDescription>La grande citation pleine page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field label="Citation" hint="Markdown et HTML supportés.">
                <RichEditor value={draft.philosophy.title} onChange={(v) => setPhilosophy({ title: v })} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
              <CardDescription>
                Questions fréquentes affichées sur la landing. Ajoutez, supprimez ou réordonnez les
                entrées librement.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre du bloc">
                <TextAreaInput value={draft.faq.title} onChange={(v) => setFaq({ title: v })} />
              </Field>
              <Field label="Sous-titre du bloc">
                <TextAreaInput value={draft.faq.subtitle} onChange={(v) => setFaq({ subtitle: v })} />
              </Field>
              <ArrayEditor
                label="Question"
                items={draft.faq.items}
                onChange={(items) => setFaq({ items })}
                createItem={(): LandingContent['faq']['items'][number] => ({ question: '', answer: '' })}
                renderItem={(item, update) => (
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Question">
                      <TextAreaInput value={item.question} onChange={(v) => update({ question: v })} />
                    </Field>
                    <Field label="Réponse" hint="Markdown et HTML supportés.">
                      <RichEditor value={item.answer} onChange={(v) => update({ answer: v })} />
                    </Field>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist">
          <Card>
            <CardHeader>
              <CardTitle>Section liste d’attente</CardTitle>
              <CardDescription>Le formulaire d’inscription et ses textes.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Titre">
                <TextAreaInput value={draft.waitlist.title} onChange={(v) => setWaitlist({ title: v })} />
              </Field>
              <Field label="Sous-titre" hint="Markdown et HTML supportés.">
                <RichEditor value={draft.waitlist.subtitle} onChange={(v) => setWaitlist({ subtitle: v })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Légende (profil)">
                  <TextInput value={draft.waitlist.legend} onChange={(v) => setWaitlist({ legend: v })} />
                </Field>
                <Field label="Placeholder email">
                  <TextInput value={draft.waitlist.emailPlaceholder} onChange={(v) => setWaitlist({ emailPlaceholder: v })} />
                </Field>
                <Field label="Bouton">
                  <TextInput value={draft.waitlist.ctaLabel} onChange={(v) => setWaitlist({ ctaLabel: v })} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Message de succès">
                  <TextInput value={draft.waitlist.successTitle} onChange={(v) => setWaitlist({ successTitle: v })} />
                </Field>
                <Field label="Sous-message de succès" hint="Markdown et HTML supportés.">
                  <RichEditor value={draft.waitlist.successSubtitle} onChange={(v) => setWaitlist({ successSubtitle: v })} height={120} />
                </Field>
              </div>
              <ArrayEditor
                label="Profil"
                items={draft.waitlist.profiles}
                onChange={(profiles) => setWaitlist({ profiles })}
                createItem={(): WaitlistProfile => ({ id: 'amateur', label: '', description: '' })}
                renderItem={(item, update) => (
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Identifiant (artiste | amateur)">
                      <TextInput value={item.id} onChange={(v) => update({ id: v as WaitlistProfile['id'] })} />
                    </Field>
                    <Field label="Libellé">
                      <TextInput value={item.label} onChange={(v) => update({ label: v })} />
                    </Field>
                    <Field label="Description">
                      <TextAreaInput value={item.description} onChange={(v) => update({ description: v })} />
                    </Field>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
