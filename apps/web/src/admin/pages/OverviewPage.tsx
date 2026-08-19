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
  CalendarHeart,
  Globe2,
  ShieldCheck,
  Users,
  Mic2,
  Eye,
  Heart,
  Bell,
  Loader2,
  ChevronDown,
  ChevronRight,
  BarChart3,
  TrendingUp,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
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

/** Section pliable — un titre + contenu caché/affiché au clic. */
function CollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  icon: typeof Eye
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="text-muted-foreground size-4" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t px-6 pb-5 pt-4">{children}</div>}
    </Card>
  )
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

  const artistPage = usePagination(filteredArtists, 10)

  // ── Graphiques (gardés en dessous, pliables) ──
  const topArtistsByViews = useMemo(
    () =>
      [...(artistStats ?? [])]
        .map((a) => ({
          label: `${a.flag ?? '🌍'} ${a.name}`,
          value: a.views_profile + a.views_pin,
        }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 5),
    [artistStats],
  )

  const topArtistsByLikes = useMemo(
    () =>
      [...(artistStats ?? [])]
        .map((a) => ({ label: a.name, value: a.likes }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 5),
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
      .slice(0, 5)
      .map(([code, value]) => {
        const info = countryByCode(code)
        return {
          label: info ? `${flagFor(code)} ${info.en}` : code,
          value,
        }
      })
  }, [artistStats])

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
      ...(other > 0 ? [{ label: 'Autres', value: other, color: 'var(--color-muted-foreground)' }] : []),
    ]
  }, [stats])

  async function supabaseCount() {
    const { count, error } = await supabase!
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
    return error ? 0 : count ?? 0
  }

  // ── Navigation rapide ──
  const navCards = [
    { to: '/admin/sections', label: 'Landing', icon: FileText },
    { to: '/admin/sections?tab=faq', label: 'FAQ', icon: HelpCircle },
    { to: '/admin/badges', label: 'Badges', icon: Medal },
    { to: '/admin/brand', label: 'Brand', icon: Palette },
    { to: '/admin/seo', label: 'SEO', icon: Search },
    { to: '/admin/waitlist', label: `Waitlist`, icon: ListChecks },
    { to: '/admin/gamification', label: 'Gamification', icon: Trophy },
    { to: '/admin/bookings', label: 'Bookings', icon: CalendarHeart },
    { to: '/admin/discovered', label: 'Découverts', icon: Globe2 },
    { to: '/admin/claims', label: 'Claims', icon: ShieldCheck },
    { to: '/admin/settings', label: 'Réglages', icon: Settings },
  ]

  const isLoading = stats === null && waitlistCount === null

  return (
    <div className="space-y-8">
      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vue d'ensemble</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plateforme en un coup d'œil — tout le reste est dans le menu.
        </p>
      </div>

      {/* ── KPI principaux — 4 cartes compactses ── */}
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Mic2}
            label="Artistes"
            value={stats?.artists}
            sub={`${formatNumber(stats?.artists_verified)} vérifiés`}
            accent
          />
          <StatCard
            icon={Users}
            label="Utilisateurs"
            value={stats?.users_total}
            sub={`${formatNumber(stats?.users_artists)} artistes`}
          />
          <StatCard
            icon={Eye}
            label="Vues totales"
            value={(stats?.views_profile ?? 0) + (stats?.views_pin ?? 0)}
            sub={`${formatNumber(stats?.views_pin)} pins`}
          />
          <StatCard
            icon={Heart}
            label="Abonnements"
            value={stats?.follows_total}
            sub={`${formatNumber(stats?.favorites_total)} favoris`}
          />
        </div>
      )}

      {/* ── Seconde ligne — alerts + waitlist ── */}
      {!isLoading && stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={ListChecks}
            label="Waitlist"
            value={waitlistCount}
            sub="Inscrits en attente"
          />
          <StatCard
            icon={CalendarHeart}
            label="Réservations"
            value={stats.bookings_total}
            sub={`${formatNumber(stats.bookings_pending)} en attente`}
          />
          <StatCard
            icon={ShieldCheck}
            label="Claims"
            value={stats.claims_total}
            sub={`${formatNumber(stats.claims_pending)} à vérifier`}
          />
          <StatCard
            icon={Bell}
            label="Notifications"
            value={stats.notifications_total}
            sub="Envoyées"
          />
        </div>
      )}

      {/* ── Graphiques (pliables) ── */}
      {!isLoading && stats && (
        <CollapsibleSection
          title="Statistiques visuelles"
          subtitle="Répartitions, top artistes et pays"
          icon={BarChart3}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Top artistes" subtitle="Par vues profil + pin">
              {topArtistsByViews.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">Aucune donnée.</p>
              ) : (
                <HBarList data={topArtistsByViews} />
              )}
            </ChartCard>

            <ChartCard title="Artistes par pays">
              {topCountries.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">Aucune donnée.</p>
              ) : (
                <HBarList data={topCountries} />
              )}
            </ChartCard>

            <ChartCard title="Types de comptes">
              <Donut
                segments={accountsDonut}
                size={130}
                thickness={14}
                centerLabel="comptes"
                centerValue={compactNumber(stats.users_total)}
              />
            </ChartCard>

            <ChartCard title="Top likes" subtitle="Artistes les plus aimés">
              {topArtistsByLikes.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">Aucune donnée.</p>
              ) : (
                <BarChart data={topArtistsByLikes} height={140} />
              )}
            </ChartCard>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Table artistes (pliable) ── */}
      <CollapsibleSection
        title="Stats par artiste"
        subtitle={
          artistStats
            ? `${filteredArtists.length} artiste${filteredArtists.length > 1 ? 's' : ''}`
            : 'Chargement…'
        }
        icon={TrendingUp}
        defaultOpen={false}
      >
        <div className="mb-3">
          <Input
            placeholder="Filtrer…"
            value={artistQuery}
            onChange={(e) => {
              setArtistQuery(e.target.value)
              artistPage.setPage(1)
            }}
            className="h-9 w-full sm:w-52"
          />
        </div>
        {artistStats === null ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-6">
            <Loader2 className="size-4 animate-spin" /> Chargement…
          </div>
        ) : filteredArtists.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Aucun résultat.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artiste</TableHead>
                  <TableHead className="hidden md:table-cell">Statut</TableHead>
                  <TableHead className="text-right">Vues</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Uniques</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Abonnés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artistPage.pageItems.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="relative size-7 shrink-0">
                          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                            {a.flag ?? '🌍'}
                          </span>
                          {a.image && (
                            <img
                              src={a.image}
                              alt=""
                              className="absolute inset-0 size-7 rounded-full border object-cover"
                              onError={(e) => { e.currentTarget.remove() }}
                            />
                          )}
                        </span>
                        <span className="truncate">{a.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.claimed ? (
                        <Badge variant="default" className="bg-brand text-black hover:bg-brand">
                          <Users className="size-3" /> Compte
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Globe2 className="size-3" /> Carte
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(a.views_profile + a.views_pin)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                      {formatNumber(a.unique_viewers)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(a.likes)}</TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {formatNumber(a.followers)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={artistPage.page}
              pageCount={artistPage.pageCount}
              total={artistPage.total}
              pageSize={10}
              onPageChange={artistPage.setPage}
            />
          </div>
        )}
      </CollapsibleSection>

      {/* ── État du contenu ── */}
      {sections.length > 0 && (
        <CollapsibleSection
          title="État du contenu"
          subtitle={`${sections.filter((s) => s.dirty).length} brouillon${sections.filter((s) => s.dirty).length > 1 ? 's' : ''} non publié${sections.filter((s) => s.dirty).length > 1 ? 's' : ''}`}
          icon={FileText}
          defaultOpen={false}
        >
          <ul className="grid gap-2">
            {sections.map(({ key, dirty, publishedAt }) => (
              <li key={key} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {SECTION_LABELS[key] ?? key}
                  </Badge>
                  {dirty && <Badge className="text-[10px]">Brouillon</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {publishedAt
                    ? new Date(publishedAt).toLocaleDateString('fr-FR')
                    : 'Jamais publié'}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* ── Navigation rapide ── */}
      <div>
        <p className="mb-3 text-sm font-semibold">Accès rapides</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {navCards.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <div className="group flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all hover:border-brand-deep/40 hover:shadow-sm">
                <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-brand-deep" />
                <span className="text-xs font-medium leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Sous-composant KPI compact ── */
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Users
  label: string
  value: number | null | undefined
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
            accent ? 'bg-brand-deep text-white' : 'bg-brand-soft text-brand-deep'
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums leading-tight">
            {value === null || value === undefined ? '—' : formatNumber(value)}
          </p>
        </div>
      </div>
      {sub && (
        <p className="mt-1.5 truncate pl-12 text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  )
}
