import { useEffect, useState } from 'react'
import type { ArtistSignupContent } from '@/lib/cms'
import { useSection } from '../useSection'
import { LangSwitch } from '../components/LangSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, TextInput, TextAreaInput, ArrayEditor } from '../components/fields'
import { RichEditor } from '../components/RichEditor'
import { PublishBar } from '../components/PublishBar'

export default function ArtistSignupPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const section = useSection('artistSignup', lang)
  const [draft, setDraft] = useState<ArtistSignupContent | null>(null)

  useEffect(() => {
    if (section.draft) setDraft(structuredClone(section.draft as ArtistSignupContent))
  }, [section.draft])

  const set = (patch: Partial<ArtistSignupContent>) =>
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

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Page artistes</h1>
          <p className="text-muted-foreground text-sm">
            Textes de la page « Espace artistes » (/artistes).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LangSwitch lang={lang} onChange={setLang} />
          <PublishBar
            dirty={section.dirty}
            loading={section.loading}
            publishedAt={section.publishedAt}
            previewUrl="/preview/artistes"
            onSave={save}
            onPublish={section.publish}
            onDiscard={section.discard}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Textes</CardTitle>
          <CardDescription>Le formulaire d’inscription des artistes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Badge">
              <TextInput value={draft.badge} onChange={(v) => set({ badge: v })} />
            </Field>
            <Field label="Bouton du formulaire">
              <TextInput value={draft.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
            </Field>
          </div>
          <Field label="Titre">
            <TextAreaInput value={draft.title} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Sous-titre" hint="Markdown et HTML supportés.">
            <RichEditor value={draft.subtitle} onChange={(v) => set({ subtitle: v })} height={140} />
          </Field>
          <Field label="Note de confidentialité" hint="Markdown et HTML supportés.">
            <RichEditor value={draft.privacyNote} onChange={(v) => set({ privacyNote: v })} height={100} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avantages</CardTitle>
          <CardDescription>Les trois cartes de la section « perks ».</CardDescription>
        </CardHeader>
        <CardContent>
          <ArrayEditor
            label="Avantage"
            items={draft.perks}
            onChange={(perks) => set({ perks })}
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
    </div>
  )
}
