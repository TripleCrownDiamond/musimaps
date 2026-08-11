import { useEffect, useState } from 'react'
import type { BadgeDefinition } from '@/lib/cms'
import {
  BADGE_ICON_KEYS,
  BADGE_METRICS,
  type BadgeMetric,
  type BadgeRole,
} from '@musimaps/shared'
import { useSection } from '../useSection'
import { LangSwitch } from '../components/LangSwitch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, TextInput, TextAreaInput, ArrayEditor } from '../components/fields'
import { Input } from '@/components/ui/input'
import { PublishBar } from '../components/PublishBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ICON_HINT = BADGE_ICON_KEYS.join(', ')

/**
 * Toutes les métriques du catalogue partagé. Les trois premières venaient du
 * mobile, les suivantes du web : le badge est désormais éditable sur les dix.
 */
const METRIC_LABELS: Record<BadgeMetric, string> = {
  cities: 'Villes visitées',
  favorites: 'Artistes sauvegardés',
  profile: 'Profil créé',
  following: 'Artistes suivis',
  streak: 'Jours d’affilée (streak)',
  bookingsSent: 'Demandes de réservation envoyées',
  claimed: 'Profil carte revendiqué',
  profileViews: 'Vues du profil',
  bookingsReceived: 'Demandes de réservation reçues',
  events: 'Dates de concert annoncées',
}

/** À qui s'applique le badge. */
const ROLE_LABELS: Record<BadgeRole, string> = {
  all: 'Tout le monde',
  audience: 'Mélomane',
  artist: 'Artiste',
}

/** Catalogue des badges : éditable, ajoutable, réordonnable, brouillon → publié. */
export default function BadgesPage() {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const section = useSection('badges', lang)
  const [badges, setBadges] = useState<BadgeDefinition[] | null>(null)

  useEffect(() => {
    if (section.draft && Array.isArray(section.draft)) {
      setBadges(structuredClone(section.draft as BadgeDefinition[]))
    }
  }, [section.draft])

  const save = async () => {
    if (!badges) return { ok: false, error: 'Aucun contenu à enregistrer' }
    const ids = badges.map((b) => b.id)
    const duplicate = ids.find((id, i) => id && ids.indexOf(id) !== i)
    if (duplicate) return { ok: false, error: `Identifiant en double : « ${duplicate} »` }
    if (badges.some((b) => !b.id || !b.label)) {
      return { ok: false, error: 'Chaque badge doit avoir un identifiant et un libellé.' }
    }
    return section.save(badges)
  }

  if (!badges) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Catalogue des badges</h1>
          <p className="text-muted-foreground text-sm">
            Définissez les badges de gamification : libellés, points, icône et condition de
            déblocage. Ajoutez, supprimez ou réordonnez librement, puis publiez — l’application
            mobile applique le catalogue publié automatiquement.
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
          <CardTitle>Badges</CardTitle>
          <CardDescription>
            Les points s’accumulent dès qu’une condition est atteinte (rétroactif sur l’app).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArrayEditor
            label="Badge"
            items={badges}
            onChange={setBadges}
            createItem={(): BadgeDefinition => ({
              id: `badge-${Date.now()}`,
              icon: 'star',
              label: '',
              description: '',
              points: 10,
              role: 'all',
              condition: { metric: 'cities', min: 1 },
            })}
            renderItem={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Identifiant (unique)">
                  <TextInput value={item.id} onChange={(v) => update({ id: v })} />
                </Field>
                <Field label="Libellé">
                  <TextInput value={item.label} onChange={(v) => update({ label: v })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description">
                    <TextAreaInput value={item.description} onChange={(v) => update({ description: v })} />
                  </Field>
                </div>
                <Field label="Points">
                  <Input
                    type="number"
                    min={0}
                    value={item.points}
                    onChange={(e) => update({ points: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Icône" hint={ICON_HINT}>
                  <TextInput value={item.icon} onChange={(v) => update({ icon: v as never })} />
                </Field>
                <Field label="S’applique à" hint="Un badge « artiste » n’apparaît que pour les comptes artistes.">
                  <Select
                    value={item.role ?? 'all'}
                    onValueChange={(role) => update({ role: role as BadgeRole })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as BadgeRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Condition — métrique">
                  <Select
                    value={item.condition.metric}
                    onValueChange={(metric) =>
                      update({
                        condition: {
                          metric: metric as BadgeMetric,
                          min: item.condition.min,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Métrique" />
                    </SelectTrigger>
                    <SelectContent>
                      {BADGE_METRICS.map(
                        (metric) => (
                          <SelectItem key={metric} value={metric}>
                            {METRIC_LABELS[metric]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Condition — minimum">
                  <Input
                    type="number"
                    min={0}
                    value={item.condition.min}
                    onChange={(e) =>
                      update({
                        condition: {
                          metric: item.condition.metric,
                          min: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </Field>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
