import { useEffect, useState } from 'react'
import type { NavContent, FooterContent, SocialLinkItem } from '@/lib/cms'
import { useSection } from '../useSection'
import { LangSwitch } from '../components/LangSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, TextInput, ArrayEditor } from '../components/fields'
import { PublishBar } from '../components/PublishBar'

const SOCIAL_ICON_HINT =
  'x, instagram, facebook, youtube, spotify, tiktok, discord, linkedin, twitch, threads, github'

export default function NavFooterPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const navSection = useSection('nav', lang)
  const footerSection = useSection('footer', lang)
  const [nav, setNav] = useState<NavContent | null>(null)
  const [footer, setFooter] = useState<FooterContent | null>(null)

  useEffect(() => {
    if (navSection.draft) setNav(structuredClone(navSection.draft as NavContent))
  }, [navSection.draft])
  useEffect(() => {
    if (footerSection.draft) setFooter(structuredClone(footerSection.draft as FooterContent))
  }, [footerSection.draft])

  const saveNav = async () => {
    if (!nav) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return navSection.save(nav)
  }
  const saveFooter = async () => {
    if (!footer) return { ok: false, error: 'Aucun contenu à enregistrer' }
    return footerSection.save(footer)
  }

  if (!nav || !footer) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Navigation & footer</h1>
          <p className="text-muted-foreground text-sm">
            Les liens de la barre de navigation et du pied de page. Chaque partie se publie
            séparément.
          </p>
        </div>
        <LangSwitch lang={lang} onChange={setLang} />
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1.5">
            <CardTitle>Barre de navigation</CardTitle>
            <CardDescription>Liens affichés dans la navbar fixe.</CardDescription>
          </div>
          <PublishBar
            dirty={navSection.dirty}
            loading={navSection.loading}
            publishedAt={navSection.publishedAt}
            previewUrl="/preview"
            onSave={saveNav}
            onPublish={navSection.publish}
            onDiscard={navSection.discard}
            className="justify-end"
          />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <ArrayEditor
            label="Lien"
            items={nav.links}
            onChange={(links) => setNav((n) => (n ? { ...n, links } : n))}
            createItem={() => ({ label: '', to: '' })}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Libellé">
                  <TextInput value={item.label} onChange={(v) => update({ label: v })} />
                </Field>
                <Field label="Chemin (ex : /globe)">
                  <TextInput value={item.to} onChange={(v) => update({ to: v })} />
                </Field>
              </div>
            )}
          />
          <Field label="Libellé du bouton CTA">
            <TextInput value={nav.ctaLabel} onChange={(v) => setNav((n) => (n ? { ...n, ctaLabel: v } : n))} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1.5">
            <CardTitle>Footer</CardTitle>
            <CardDescription>Le pied de page du site.</CardDescription>
          </div>
          <PublishBar
            dirty={footerSection.dirty}
            loading={footerSection.loading}
            publishedAt={footerSection.publishedAt}
            previewUrl="/preview"
            onSave={saveFooter}
            onPublish={footerSection.publish}
            onDiscard={footerSection.discard}
            className="justify-end"
          />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Slogan">
              <TextInput value={footer.tagline} onChange={(v) => setFooter((f) => (f ? { ...f, tagline: v } : f))} />
            </Field>
            <Field label="Copyright">
              <TextInput value={footer.copyright} onChange={(v) => setFooter((f) => (f ? { ...f, copyright: v } : f))} />
            </Field>
          </div>
          <ArrayEditor
            label="Lien"
            items={footer.links}
            onChange={(links) => setFooter((f) => (f ? { ...f, links } : f))}
            createItem={(): FooterContent['links'][number] => ({ label: '', to: '', external: false })}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Libellé">
                  <TextInput value={item.label} onChange={(v) => update({ label: v })} />
                </Field>
                <Field label="Destination">
                  <TextInput value={item.to} onChange={(v) => update({ to: v })} />
                </Field>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réseaux sociaux</CardTitle>
          <CardDescription>
            Affichés en icônes à droite du footer. Ouvrez chaque réseau dans un nouvel onglet, et
            choisissez l’icône correspondante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArrayEditor
            label="Réseau"
            items={footer.socials}
            onChange={(socials) => setFooter((f) => (f ? { ...f, socials } : f))}
            createItem={(): SocialLinkItem => ({ label: '', to: '', icon: 'x' })}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom affiché">
                  <TextInput value={item.label} onChange={(v) => update({ label: v })} />
                </Field>
                <Field label="URL">
                  <TextInput value={item.to} onChange={(v) => update({ to: v })} />
                </Field>
                <Field label="Icône" hint={SOCIAL_ICON_HINT}>
                  <TextInput value={item.icon} onChange={(v) => update({ icon: v })} />
                </Field>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
