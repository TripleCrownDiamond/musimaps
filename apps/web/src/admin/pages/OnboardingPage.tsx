import { useEffect, useState } from 'react'
import type { OnboardingContent } from '@/lib/cms'
import { useSection } from '../useSection'
import { LangSwitch } from '../components/LangSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Field,
  TextInput,
  TextAreaInput,
  ArrayEditor,
  IconSelect,
} from '../components/fields'
import { PublishBar } from '../components/PublishBar'

/**
 * Onboarding de l'application mobile : les slides (icône lucide + chip +
 * titre + description) sont éditables ici, en FR et en EN. Le mobile lit la
 * version publiée de la clé 'onboarding' via site_content_public.
 */
export default function OnboardingPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const section = useSection('onboarding', lang)
  const [draft, setDraft] = useState<OnboardingContent | null>(null)

  useEffect(() => {
    if (section.draft) setDraft(structuredClone(section.draft as OnboardingContent))
  }, [section.draft])

  const save = async () => {
    if (!draft) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return section.save(draft)
  }

  const setSlides = (slides: OnboardingContent['slides']) =>
    setDraft((d) => (d ? { ...d, slides } : d))

  if (!draft) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Onboarding de l’application</h1>
          <p className="text-muted-foreground text-sm">
            Slides affichées au premier lancement de l’app mobile (et de la preview web). Modifiez
            l’icône, l’étiquette, le titre et la description de chaque écran, puis publiez.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LangSwitch lang={lang} onChange={setLang} />
          <PublishBar
            dirty={section.dirty}
            loading={section.loading}
            publishedAt={section.publishedAt}
            onSave={save}
            onPublish={section.publish}
            onDiscard={section.discard}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Slides</CardTitle>
          <CardDescription>
            Les icônes utilisent la bibliothèque Lucide — les mêmes noms fonctionnent sur le web et
            sur mobile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArrayEditor
            label="Slide"
            items={draft.slides}
            onChange={setSlides}
            createItem={(): OnboardingContent['slides'][number] => ({
              icon: 'Sparkles',
              chip: '',
              title: '',
              text: '',
            })}
            renderItem={(item, update) => (
              <div className="grid grid-cols-1 gap-3">
                <Field label="Icône">
                  <IconSelect value={item.icon} onChange={(v) => update({ icon: v })} />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Étiquette (chip)">
                    <TextInput value={item.chip} onChange={(v) => update({ chip: v })} />
                  </Field>
                  <Field label="Titre">
                    <TextInput value={item.title} onChange={(v) => update({ title: v })} />
                  </Field>
                </div>
                <Field label="Description">
                  <TextAreaInput value={item.text} onChange={(v) => update({ text: v })} />
                </Field>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
