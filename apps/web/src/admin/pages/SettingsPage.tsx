import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldPlus, Trash2 } from 'lucide-react'
import type { SettingsContent } from '@/lib/cms'
import { useSection } from '../useSection'
import { supabase, hasSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, TextAreaInput, TextInput } from '../components/fields'
import { LangSwitch } from '../components/LangSwitch'
import { PublishBar } from '../components/PublishBar'

export default function SettingsPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const section = useSection('settings', lang)
  const [draft, setDraft] = useState<SettingsContent | null>(null)
  const [admins, setAdmins] = useState<string[]>([])
  const [newAdmin, setNewAdmin] = useState('')

  useEffect(() => {
    if (section.draft) setDraft(structuredClone(section.draft as SettingsContent))
  }, [section.draft])

  useEffect(() => {
    void loadAdmins()
  }, [])

  async function loadAdmins() {
    if (!hasSupabase()) return
    const { data, error } = await supabase!.from('admins').select('email')
    if (!error && data) setAdmins(data.map((row) => row.email))
  }

  const set = (patch: Partial<SettingsContent>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d))

  const save = async () => {
    if (!draft) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return section.save(draft)
  }

  const addAdmin = async () => {
    const email = newAdmin.trim().toLowerCase()
    if (!email || !hasSupabase()) return
    const { error } = await supabase!.from('admins').insert({ email })
    if (error) {
      toast.error('Ajout impossible', { description: error.message })
    } else {
      toast.success(`${email} est désormais administrateur`)
      setNewAdmin('')
      void loadAdmins()
    }
  }

  const removeAdmin = async (email: string) => {
    if (!hasSupabase()) return
    const { error } = await supabase!.from('admins').delete().eq('email', email)
    if (error) {
      toast.error('Suppression impossible', { description: error.message })
    } else {
      toast.success(`Administrateur retiré : ${email}`)
      void loadAdmins()
    }
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
          <h1 className="text-2xl font-bold">Réglages</h1>
          <p className="text-muted-foreground text-sm">
            Date de lancement, libellés du compteur et administrateurs.
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

      <Card>
        <CardHeader>
          <CardTitle>Lancement</CardTitle>
          <CardDescription>Pilotent le compteur de la section liste d’attente.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <Field label="Date de lancement (ISO)" hint="Ex : 2026-08-19T12:00:00Z">
            <TextInput value={draft.launchDate} onChange={(v) => set({ launchDate: v })} placeholder="2026-08-19T12:00:00Z" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Libellé avant lancement">
              <TextInput value={draft.launchLabel} onChange={(v) => set({ launchLabel: v })} />
            </Field>
            <Field label="Libellé après lancement">
              <TextInput value={draft.onlineLabel} onChange={(v) => set({ onlineLabel: v })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inscription des comptes</CardTitle>
          <CardDescription>
            Fermez la création de compte avant le lancement : la page d’inscription affiche
            «&nbsp;Disponible après le lancement&nbsp;». Les liens d’invitation de la liste
            d’attente continuent de fonctionner.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <span>
              <span className="block text-sm font-medium">Inscription ouverte</span>
              <span className="block text-xs text-muted-foreground">
                Désactivé = message «&nbsp;disponible après le lancement&nbsp;» sur /signup.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.openSignup}
              onClick={() => set({ openSignup: !draft.openSignup })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                draft.openSignup ? 'bg-lime-400' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  draft.openSignup ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
          <Field
            label="Message « disponible après le lancement »"
            hint="Affiché sur /signup quand l’inscription est fermée (par langue)."
          >
            <TextAreaInput
              value={draft.closedSignupMessage}
              onChange={(v) => set({ closedSignupMessage: v })}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrateurs</CardTitle>
          <CardDescription>
            Les comptes autorisés à modifier le contenu via ce dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <ul className="grid grid-cols-1 gap-2">
            {admins.map((email) => (
              <li key={email} className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive size-7"
                  onClick={() => void removeAdmin(email)}
                  aria-label={`Retirer ${email}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="nouvel.admin@exemple.com"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
            />
            <Button variant="outline" onClick={() => void addAdmin()}>
              <ShieldPlus /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
