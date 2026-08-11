import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  HelpCircle,
  ListChecks,
  Medal,
  Palette,
  Search,
  Settings,
  Trophy,
  ArrowRight,
  CalendarHeart,
  Globe2,
  ShieldCheck,
  Users,
  Mic2,
  Eye,
  Heart,
  Bell,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase, hasSupabase } from '@/lib/supabase'
import { fetchContentStates, type ContentKey } from '@/lib/cms'
import { SECTION_LABELS } from '../sections'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination, usePagination } from '../components/Pagination'
import { BarChart, ChartCard, Donut, HBarList } from '@/components/charts'
import { compactNumber } from '@/lib/utils'
import { countryByCode, flagFor } from '@musimaps/shared'

/** Palette minimale de la marque pour les graphiques (cohérente light/dark). */
const DEEP = 'var(--color-brand-deep)'
const LIME = 'var(--color-brand)'
const SOFT = 'var(--color-brand-soft)'
const NEUTRAL = 'var(--color-muted-foreground)'

interface ArtistStatRow {
  id: string
  name: string
  city: string | null
  country: string | null
  flag: string | null
  image: string | null
  genre: string | null
  verified: boolean
  claimed: boolean
  created_at: string
  views_profile: number
  views_pin: number
  unique_viewers: number
  likes: number
  followers: number
  bookings: number
}

interface AdminStats {
  artists: number
  artists_verified: number
  artists_claimed: number
  claims_pending: number
  claims_total: number
  bookings_total: number
  bookings_pending: number
  waitlist_total: number
  users_total: number
  users_business: number
  users_premium: number
  users_artists: number
  follows_total: number
  notifications_total: number
  views_profile: number
  views_pin: number
  favorites_total: number
}

function formatNumber(value: number | undefined | null): string {
  const n = value ?? 0
  return new Intl.NumberFormat('fr-FR').format(n)
}

/** Le RPC admin_stats refuse les non-admin ; en cas d'erreur on retombe sur 0. */
async function fetchAdminStats(): Promise<AdminStats | null> {
  if (!hasSupabase()) return null
  const { data, error } = await supabase!.rpc('admin_stats')
  if (error || !data) return null
  return data as unknown as AdminStats
}

async function fetchArtistStats(): Promise<ArtistStatRow[] | null> {
  if (!hasSupabase()) return null
  const { data, error } = await supabase!.rpc('admin_artist_stats')
  if (error || !data) return null
  const rows = (data as { artists?: ArtistStatRow[] }).artists
  return rows ?? null
}

export default function OverviewPage() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [sections, setSections] = useState<
    { key: ContentKey; dirty: boolean; publishedAt: string | null }[]
  >([])
  const [artistStats, setArtistStats] = useState<ArtistStatRow[] | null>(null)
  const [artistQuery, setArtistQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!hasSupabase()) return
      const [waitlist, content, adminStats, artists] = await Promise.all([
        supabaseCount(),
        fetchContentStates(),
        fetchAdminStats(),
        fetchArtistStats(),
      ])
      if (cancelled) return
      setWaitlistCount(waitlist)
      setSections(content)
      setStats(adminStats)
      setArtistStats(artists)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredArtists = (artistStats ?? []).filter((a) =>
    [a.name, a.city, a.country, a.genre]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(artistQuery.toLowerCase())),
  )

  const artistPage = usePagination(filteredArtists, 15)

  const artistTotal = {
    views: (artistStats ?? []).reduce((sum, a) => sum + a.views_profile + a.views_pin, 0),
    unique: (artistStats ?? []).reduce((sum, a) => sum + a.unique_viewers, 0),
    likes: (artistStats ?? []).reduce((sum, a) => sum + a.likes, 0),
    followers: (artistStats ?? []).reduce((sum, a) => sum + a.followers, 0),
    bookings: (artistStats ?? []).reduce((sum, a) => sum + a.bookings, 0),
  }

  // --- Données des graphiques (top artistes, top pays, répartitions) ---
  const topArtistsByViews = useMemo(
    () =>
      [...(artistStats ?? [])]
        .map((a) => ({
          label: `${a.flag ?? '🌍'} ${a.name}`,
          value: a.views_profile + a.views_pin,
        }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 6),
    [artistStats],
  )

  const topArtistsByLikes = useMemo(
    () =>
      [...(artistStats ?? [])]
        .map((a) => ({ label: a.name, value: a.likes }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 7),
    [artistStats],
  )

  const topCountries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of artistStats ?? []) {
      const key = a.country || 'Autre'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([code, value]) => {
        const info = countryByCode(code)
        return {
          label: info ? `${flagFor(code)} ${info.en}` : code,
          value,
        }
      })
  }, [artistStats])

  const viewsDonut = useMemo(() => {
    if (!stats) return []
    return [
      { label: 'Profil', value: stats.views_profile, color: DEEP },
      { label: 'Pins', value: stats.views_pin, color: LIME },
    ]
  }, [stats])

  const accountsDonut = useMemo(() => {
    if (!stats) return []
    const other = Math.max(
      stats.users_total -
        (stats.users_artists ?? 0) -
        (stats.users_business ?? 0) -
        (stats.users_premium ?? 0),
      0,
    )
    return [
      { label: 'Artistes', value: stats.users_artists ?? 0, color: DEEP },
      { label: 'Business', value: stats.users_business ?? 0, color: LIME },
      { label: 'Premium', value: stats.users_premium ?? 0, color: SOFT },
      ...(other > 0 ? [{ label: 'Autres', value: other, color: NEUTRAL }] : []),
    ]
  }, [stats])

  const engagementDonut = useMemo(() => {
    if (!stats) return []
    return [
      { label: 'Abonnés', value: stats.follows_total ?? 0, color: DEEP },
      { label: 'Favoris', value: stats.favorites_total ?? 0, color: LIME },
      { label: 'Réservations', value: stats.bookings_total ?? 0, color: SOFT },
    ]
  }, [stats])

  async function supabaseCount() {
    const { count, error } = await supabase!
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
    return error ? 0 : count ?? 0
  }

  // --- Cartes de statistiques (KPIs) — palette minimale de la marque ---
  const kpis: Array<{
    label: string
    value: number | null
    hint: string
    icon: typeof Users
    emphasis?: boolean
  }> = [
    {
      label: 'Artistes sur la carte',
      value: stats?.artists ?? null,
      hint: `${formatNumber(stats?.artists_verified)} vérifiés · ${formatNumber(stats?.artists_claimed)} revendiqués`,
      icon: Mic2,
      emphasis: true,
    },
    {
      label: 'Vues des profils',
      value: stats?.views_profile ?? null,
      hint: `${formatNumber(stats?.views_pin)} vues de pins sur le globe`,
      icon: Eye,
    },
    {
      label: 'Comptes utilisateurs',
      value: stats?.users_total ?? null,
      hint: `${formatNumber(stats?.users_artists)} artistes · ${formatNumber(stats?.users_business)} business · ${formatNumber(stats?.users_premium)} premium`,
      icon: Users,
    },
    {
      label: 'Abonnements (follows)',
      value: stats?.follows_total ?? null,
      hint: `${formatNumber(stats?.favorites_total)} favoris sauvegardés`,
      icon: Heart,
    },
    {
      label: 'Liste d’attente',
      value: waitlistCount,
      hint: 'Inscrits en attente d’ouverture',
      icon: ListChecks,
    },
    {
      label: 'Réservations',
      value: stats?.bookings_total ?? null,
      hint: `${formatNumber(stats?.bookings_pending)} en attente de réponse`,
      icon: CalendarHeart,
    },
    {
      label: 'Revendications de profil',
      value: stats?.claims_total ?? null,
      hint: `${formatNumber(stats?.claims_pending)} à examiner`,
      icon: ShieldCheck,
    },
    {
      label: 'Notifications envoyées',
      value: stats?.notifications_total ?? null,
      hint: 'Découvertes & alertes',
      icon: Bell,
    },
  ]

  const cards = [
    {
      to: '/admin/sections',
      title: 'Sections de la landing',
      description: 'Hero, fonctionnalités, parcours, globe, philosophie, waitlist.',
      icon: FileText,
    },
    {
      to: '/admin/sections?tab=faq',
      title: 'FAQ',
      description: 'Questions & réponses de la page d’accueil.',
      icon: HelpCircle,
    },
    {
      to: '/admin/badges',
      title: 'Catalogue badges',
      description: 'Libellés, points, icônes et conditions de déblocage.',
      icon: Medal,
    },
    {
      to: '/admin/brand',
      title: 'Logo & favicon',
      description: 'Logos navbar/footer (clair & sombre), favicon, image de l’app.',
      icon: Palette,
    },
    {
      to: '/admin/seo',
      title: 'SEO',
      description: 'Titre, meta description, Open Graph.',
      icon: Search,
    },
    {
      to: '/admin/waitlist',
      title: `Liste d’attente (${waitlistCount ?? '…'})`,
      description: 'Emails et profils des inscrits.',
      icon: ListChecks,
    },
    {
      to: '/admin/gamification',
      title: 'Badges & trophées',
      description: 'Points, niveaux et badges des joueurs mobile.',
      icon: Trophy,
    },
    {
      to: '/admin/bookings',
      title: 'Réservations & abonnés',
      description: 'Demandes des organisateurs, comptes business, abonnés autorisés.',
      icon: CalendarHeart,
    },
    {
      to: '/admin/discovered',
      title: 'Artistes découverts',
      description: 'Artistes ajoutés depuis la recherche web : vérifiez et corrigez les infos.',
      icon: Globe2,
    },
    {
      to: '/admin/claims',
      title: 'Revendications de profil',
      description: 'Artistes qui réclament leur profil : approuvez après vérification.',
      icon: ShieldCheck,
    },
    {
      to: '/admin/settings',
      title: 'Réglages',
      description: 'Date de lancement, compteur, administrateurs.',
      icon: Settings,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-bold">Vue d’ensemble</h1>
        <p className="text-muted-foreground text-sm">
          Statistiques en temps réel de la plateforme, puis accès à tout le contenu éditable.
        </p>
      </div>

      {/* Statistiques */}
      {stats === null && waitlistCount === null ? (
        <div className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement des statistiques…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, hint, icon: Icon, emphasis }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums">
                      {value === null ? '—' : formatNumber(value)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${emphasis
                      ? 'bg-brand-deep text-white'
                      : 'bg-brand-soft text-brand-deep'}`}
                  >
                    <Icon className="size-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Graphiques — top artistes, top pays, répartitions */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Top artistes par vues"
            subtitle={`${formatNumber(artistTotal.views)} vues au total (profil + pins)`}
          >
            {topArtistsByViews.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Aucune donnée.</p>
            ) : (
              <HBarList data={topArtistsByViews} />
            )}
          </ChartCard>

          <ChartCard
            title="Artistes par pays"
            subtitle={`${artistStats?.length ?? 0} artistes sur la carte`}
          >
            {topCountries.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Aucune donnée.</p>
            ) : (
              <HBarList data={topCountries} />
            )}
          </ChartCard>

          <ChartCard title="Répartition des vues" subtitle="Profils visités vs pins vus sur le globe">
            <Donut
              segments={viewsDonut}
              centerLabel="vues"
              centerValue={compactNumber(artistTotal.views)}
            />
          </ChartCard>

          <ChartCard title="Types de comptes" subtitle="Répartition des utilisateurs inscrits">
            <Donut
              segments={accountsDonut}
              centerLabel="comptes"
              centerValue={compactNumber(stats.users_total)}
            />
          </ChartCard>

          <ChartCard
            title="Engagement"
            subtitle="Abonnements, favoris et réservations"
            right={
              <span className="rounded-full bg-secondary-bg px-3 py-1 text-xs font-bold">
                {formatNumber(
                  (stats.follows_total ?? 0) +
                    (stats.favorites_total ?? 0) +
                    (stats.bookings_total ?? 0),
                )}
              </span>
            }
          >
            <Donut segments={engagementDonut} centerLabel="actions" />
          </ChartCard>

          <ChartCard title="Top artistes par likes" subtitle="Artistes les plus aimés sur la carte">
            {topArtistsByLikes.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Aucune donnée.</p>
            ) : (
              <BarChart data={topArtistsByLikes} height={170} />
            )}
          </ChartCard>
        </div>
      )}

      {/* Stats par artiste — vue détaillée de la performance de chaque pin */}
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic2 className="text-muted-foreground size-4" /> Stats par artiste
            </CardTitle>
            <CardDescription>
              Vues profil / pin, visiteurs uniques, likes, abonnés et réservations de chaque artiste.
              {' '}{artistStats === null
                ? 'Chargement…'
                : `${filteredArtists.length} artiste${filteredArtists.length > 1 ? 's' : ''} · ` +
                  `${artistTotal.views} vues · ${artistTotal.likes} likes · ` +
                  `${artistTotal.followers} abonnés · ${artistTotal.bookings} réservations`}
            </CardDescription>
          </div>
          <Input
            placeholder="Filtrer les artistes…"
            value={artistQuery}
            onChange={(e) => {
              setArtistQuery(e.target.value)
              artistPage.setPage(1)
            }}
            className="w-full sm:w-56"
          />
        </CardHeader>
        <CardContent>
          {artistStats === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 justify-center">
              <Loader2 className="size-4 animate-spin" /> Chargement…
            </div>
          ) : filteredArtists.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Aucun artiste ne correspond à la recherche.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artiste</TableHead>
                    <TableHead className="hidden md:table-cell">Statut</TableHead>
                    <TableHead className="text-right">Vues profil</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Vues pin</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Visiteurs uniques</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Abonnés</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Réservations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artistPage.pageItems.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="relative size-8 shrink-0">
                            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              {a.flag ?? '🌍'}
                            </span>
                            {a.image && (
                              <img
                                src={a.image}
                                alt=""
                                className="absolute inset-0 size-8 rounded-full border object-cover"
                                onError={(e) => {
                                  e.currentTarget.remove()
                                }}
                              />
                            )}
                          </span>
                          <span>{a.name}</span>
                          {a.verified && (
                            <Badge className="ml-1" variant="default">
                              Vérifié
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {a.claimed ? (
                          <Badge variant="default" className="bg-brand text-black hover:bg-brand">
                            <Users className="size-3" /> Compte + carte
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Globe2 className="size-3" /> Carte seule
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.views_profile)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">{formatNumber(a.views_pin)}</TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">{formatNumber(a.unique_viewers)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.likes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.followers)}</TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">{formatNumber(a.bookings)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={artistPage.page}
                pageCount={artistPage.pageCount}
                total={artistPage.total}
                pageSize={15}
                onPageChange={artistPage.setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="text-muted-foreground size-4" />
                  {title}
                  <ArrowRight className="text-muted-foreground ml-auto size-4" />
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">État du contenu</CardTitle>
          <CardDescription>
            Chaque section a une version publiée (visible du public) et un éventuel brouillon en
            attente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune section enregistrée pour l’instant.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {sections.map(({ key, dirty, publishedAt }) => (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{SECTION_LABELS[key] ?? key}</Badge>
                    {dirty && <Badge>Brouillon non publié</Badge>}
                  </div>
                  <span className="text-muted-foreground">
                    {publishedAt
                      ? `Publié le ${new Date(publishedAt).toLocaleDateString('fr-FR')}`
                      : 'Jamais publié'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
