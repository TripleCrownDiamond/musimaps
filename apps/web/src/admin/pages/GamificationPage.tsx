import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Compass,
  Download,
  Flame,
  Globe,
  Heart,
  Loader2,
  MapPin,
  Medal,
  Music,
  PersonStanding,
  Plane,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, hasSupabase } from '@/lib/supabase'
import { useCms } from '@/context/CmsContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** Catalogue de secours (si le CMS est vide ou non configuré). */
const FALLBACK_CATALOG: { id: string; label: string; icon: typeof MapPin; color: string }[] = [
  { id: 'first-city', label: 'Premier pas', icon: MapPin, color: '#0891B2' },
  { id: 'cities-3', label: 'Curieux', icon: Globe, color: '#0D9488' },
  { id: 'cities-8', label: 'Globe-trotter', icon: Compass, color: '#2563EB' },
  { id: 'cities-15', label: 'Explorateur', icon: Plane, color: '#7C3AED' },
  { id: 'first-save', label: 'Coup de cœur', icon: Heart, color: '#E11D48' },
  { id: 'saves-5', label: 'Mélomane', icon: Music, color: '#DB2777' },
  { id: 'saves-12', label: 'Collectionneur', icon: Sparkles, color: '#EA580C' },
  { id: 'profile', label: 'Ambassadeur', icon: PersonStanding, color: '#059669' },
]

/** Icône lucide par défaut pour un badge inconnu du catalogue. */
const DEFAULT_ICON = Medal

const LEVEL_TITLES: Record<number, string> = {
  1: 'Explorateur',
  2: 'Voyageur',
  3: 'Globe-trotter',
  4: 'Navigateur',
  5: 'Connaisseur',
  6: 'Légende',
}

interface BadgeEntry {
  id: string
  earnedAt: number
}

interface GamificationRow {
  user_key: string
  display_name: string | null
  points: number
  level: number
  level_title: string | null
  badges: BadgeEntry[] | null
  badge_count: number
  visited_cities: number
  favorites: number
  updated_at: string
}

export default function GamificationPage() {
  const { content } = useCms()
  const cmsBadges = content.badges ?? []
  const [rows, setRows] = useState<GamificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = async () => {
    setLoading(true)
    if (!hasSupabase()) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase!
      .from('gamification')
      .select(
        'user_key, display_name, points, level, level_title, badges, badge_count, visited_cities, favorites, updated_at',
      )
      .order('points', { ascending: false })
    if (error) {
      toast.error('Impossible de charger les stats de gamification', {
        description: error.message,
      })
    } else {
      setRows((data ?? []) as GamificationRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const ranked = useMemo(
    () =>
      rows
        .map((row, index) => ({ ...row, rank: index + 1 }))
        .filter((row) =>
          [row.display_name, row.user_key, String(row.points), String(row.level)]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(query.toLowerCase())),
        ),
    [rows, query],
  )

  const stats = useMemo(() => {
    const totalPlayers = rows.length
    const totalPoints = rows.reduce((sum, row) => sum + row.points, 0)
    const totalBadges = rows.reduce((sum, row) => sum + row.badge_count, 0)
    const avgLevel = totalPlayers
      ? Math.round((rows.reduce((sum, row) => sum + row.level, 0) / totalPlayers) * 10) / 10
      : 0
    return { totalPlayers, totalPoints, totalBadges, avgLevel }
  }, [rows])

  const badgeDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const entry of row.badges ?? []) {
        counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1)
      }
    }
    const cmsById = new Map(cmsBadges.map((b) => [b.id, b]))
    const fallbackById = new Map(FALLBACK_CATALOG.map((b) => [b.id, b]))
    const ids = new Set([...counts.keys(), ...cmsById.keys(), ...fallbackById.keys()])
    return [...ids]
      .map((id) => {
        const cms = cmsById.get(id)
        const fallback = fallbackById.get(id)
        return {
          id,
          label: cms?.label ?? fallback?.label ?? id,
          icon: fallback?.icon ?? DEFAULT_ICON,
          color: fallback?.color ?? '#0891B2',
          count: counts.get(id) ?? 0,
        }
      })
      .sort((a, b) => b.count - a.count)
  }, [rows, cmsBadges])

  const maxBadgeCount = Math.max(1, ...badgeDistribution.map((b) => b.count))

  const exportCsv = () => {
    const header = ['rang', 'joueur', 'points', 'niveau', 'badges', 'villes', 'favoris', 'dernière_sync']
    const lines = ranked.map((r) =>
      [
        r.rank,
        r.display_name ?? r.user_key,
        r.points,
        r.level,
        r.badge_count,
        r.visited_cities,
        r.favorites,
        r.updated_at,
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(';'),
    )
    const blob = new Blob([header.join(';') + '\n' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gamification-musimaps.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const statCards = [
    { label: 'Joueurs', value: stats.totalPlayers, icon: Users },
    { label: 'Points cumulés', value: stats.totalPoints, icon: Trophy },
    { label: 'Badges débloqués', value: stats.totalBadges, icon: Award },
    { label: 'Niveau moyen', value: stats.avgLevel, icon: Medal },
  ]

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Badges & trophées</h1>
          <p className="text-muted-foreground text-sm">
            {stats.totalPlayers} joueur{stats.totalPlayers > 1 ? 's' : ''} synchronisé
            {stats.totalPlayers > 1 ? 's' : ''} depuis l’app mobile — lecture réservée aux
            administrateurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-48"
          />
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Recharger">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={ranked.length === 0}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="text-muted-foreground size-4" /> Classement
            </CardTitle>
            <CardDescription>Joueurs triés par points de gamification.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground flex items-center gap-2 py-16 justify-center">
                <Loader2 className="animate-spin" /> Chargement…
              </div>
            ) : ranked.length === 0 ? (
              <p className="text-muted-foreground py-16 text-center">
                Aucune donnée{query ? ' ne correspond au filtre' : ''}. Les statistiques
                apparaissent dès que des utilisateurs jouent sur l’app mobile.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>Joueur</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Badges</TableHead>
                    <TableHead className="text-right">Dernière sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((row) => (
                    <TableRow key={row.user_key}>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {row.rank <= 3 ? (
                          <span className="flex items-center gap-1 font-sans text-sm font-bold">
                            {row.rank === 1 && <Trophy className="size-4 text-amber-500" />}
                            {row.rank === 2 && <Medal className="size-4 text-slate-400" />}
                            {row.rank === 3 && <Medal className="size-4 text-orange-400" />}
                            {row.rank}
                          </span>
                        ) : (
                          row.rank
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.display_name ?? <span className="text-muted-foreground">Anonyme</span>}
                        <span className="text-muted-foreground block font-mono text-[10px]">
                          {row.user_key}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {LEVEL_TITLES[row.level] ?? row.level_title ?? `Niveau ${row.level}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{row.points}</TableCell>
                      <TableCell className="text-right">{row.badge_count}</TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {new Date(row.updated_at).toLocaleString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="text-muted-foreground size-4" /> Répartition des badges
            </CardTitle>
            <CardDescription>Badges les plus débloqués chez les joueurs.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            {badgeDistribution.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Aucun badge débloqué pour l’instant.
              </p>
            ) : (
              badgeDistribution.map((badge) => {
                const Icon = badge.icon
                return (
                  <div key={badge.id} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0" style={{ color: badge.color }} />
                        <span className="truncate">{badge.label}</span>
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">{badge.count}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-accent h-full rounded-full transition-all"
                        style={{ width: `${(badge.count / maxBadgeCount) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
