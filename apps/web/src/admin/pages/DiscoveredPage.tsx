import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Download, Globe2, Loader2, MapPin, Pencil, RefreshCw, Sparkles, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, hasSupabase } from '@/lib/supabase'
import { aiReviewArtists, geocodeArtistLocation, removeMapArtist, updateMapArtist, type ArtistPlatforms, type ArtistSocials } from '@/lib/discovery'
import { LocationSelect, type LocationValue } from '@/components/LocationSelect'
import { useAdminT } from '../i18n'
import { ImageField } from '../components/fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination, usePagination } from '../components/Pagination'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface MapArtistRow {
  id: string
  name: string
  genre: string | null
  city: string | null
  district: string | null
  country: string | null
  flag: string | null
  lat: number
  lng: number
  bio: string | null
  image: string | null
  cover: string | null
  source: string | null
  platforms: ArtistPlatforms | null
  socials: ArtistSocials | null
  verified: boolean
  claimed_by: string | null
  bookable: boolean
  created_at: string
}

interface BookingPlanInput {
  name: string
  price: string
  currency: string
  duration: string
  description: string
  active: boolean
}

/** Proposition de correction renvoyée par l'assistant IA (genre + bio). */
interface AiSuggestion {
  row: MapArtistRow
  verdict: string
  reason: string
  genre: string
  bio: string
  apply: boolean
}

const PLATFORM_FIELDS: Array<keyof ArtistPlatforms> = [
  'youtube',
  'spotify',
  'apple_music',
  'bandcamp',
  'soundcloud',
  'deezer',
  'website',
]

const SOCIAL_FIELDS: Array<keyof ArtistSocials> = [
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'wikipedia',
]

export default function DiscoveredPage() {
  const { t } = useAdminT()
  const [rows, setRows] = useState<MapArtistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<MapArtistRow | null>(null)
  const [toEdit, setToEdit] = useState<MapArtistRow | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    genre: string
    city: string
    district: string
    country: string
    lat: number
    lng: number
    continent: string
    bio: string
    image: string
    cover: string
    verified: boolean
    bookable: boolean
    platforms: ArtistPlatforms
    socials: ArtistSocials
    plans: BookingPlanInput[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  // Filtre de statut : 'all' | 'claimed' (compte + carte) | 'map' (carte seule)
  const [statusFilter, setStatusFilter] = useState<'all' | 'claimed' | 'map'>('all')
  // Assistant IA : revue des genres/bios mal écrits via l'edge function ai_verify.
  const [aiBusy, setAiBusy] = useState(false)
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 })
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(null)
  const [aiApplied, setAiApplied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    if (!hasSupabase()) {
      setLoading(false)
      return
    }
    // La migration 00016 ajoute plateformes/sociaux/vérification — repli si absents.
    const RICH_SELECT =
      'id, name, genre, city, district, country, flag, lat, lng, bio, image, cover, source, platforms, socials, verified, claimed_by, bookable, created_at'
    const BASE_SELECT =
      'id, name, genre, city, country, flag, lat, lng, bio, image, source, created_at'
    let { data, error } = await supabase!
      .from('map_artists')
      .select(RICH_SELECT)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      const fallback = await supabase!
        .from('map_artists')
        .select(BASE_SELECT)
        .order('created_at', { ascending: false })
        .limit(500)
      if (!fallback.error) {
        data = (fallback.data ?? null) as unknown as typeof data
        error = null
      } else {
        toast.error(t('d.loadFailed'), {
          description: fallback.error.message,
        })
      }
    }
    if (!error) setRows((data ?? []) as MapArtistRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = rows.filter((row) => {
    const matchesQuery = [row.name, row.genre, row.city, row.country]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(query.toLowerCase()))
    if (!matchesQuery) return false
    if (statusFilter === 'claimed') return Boolean(row.claimed_by)
    if (statusFilter === 'map') return !row.claimed_by
    return true
  })

  const counts = {
    all: rows.length,
    claimed: rows.filter((r) => r.claimed_by).length,
    map: rows.filter((r) => !r.claimed_by).length,
  }

  const artistPage = usePagination(filtered, 15)

  const openEdit = async (row: MapArtistRow) => {
    setToEdit(row)
    setEditForm({
      name: row.name,
      genre: row.genre ?? '',
      city: row.city ?? '',
      district: row.district ?? '',
      country: row.country ?? '',
      lat: row.lat,
      lng: row.lng,
      continent: '',
      bio: row.bio ?? '',
      image: row.image ?? '',
      cover: row.cover ?? '',
      verified: row.verified,
      bookable: row.bookable,
      platforms: row.platforms ?? {},
      socials: row.socials ?? {},
      plans: [],
    })
    // Charge les forfaits existants (migration 00048) — silencieux si absents.
    try {
      const { data } = await supabase!.rpc('get_artist_booking', { p_artist_id: row.id })
      const booking = data as
        | { bookable?: boolean; plans?: Array<{ name: string; price: number | string; currency: string; duration: string | null; description: string | null; active: boolean }> }
        | null
      if (!booking) return
      setEditForm((current) => {
        if (!current || current.name !== row.name) return current
        return {
          ...current,
          bookable: Boolean(booking.bookable),
          plans: (booking.plans ?? []).map((plan) => ({
            name: plan.name,
            price: String(plan.price ?? ''),
            currency: plan.currency || 'EUR',
            duration: plan.duration ?? '',
            description: plan.description ?? '',
            active: plan.active !== false,
          })),
        }
      })
    } catch {
      /* RPC absent (migration pas appliquée) : on garde le formulaire de base */
    }
  }

  const save = async () => {
    if (!toEdit || !editForm) return
    setSaving(true)
    // Réservable + forfaits (migration 00048) — l'artiste réservable accepte
    // les demandes de booking et ses forfaits s'affichent sur sa fiche.
    const booking = await supabase!.rpc('update_artist_booking', {
      p_artist_id: toEdit.id,
      p_bookable: editForm.bookable,
      p_plans: editForm.plans
        .filter((plan) => plan.name.trim())
        .map((plan) => ({
          name: plan.name.trim(),
          description: plan.description.trim() || null,
          price: Number.isNaN(Number(plan.price)) ? 0 : Number(plan.price),
          currency: plan.currency.trim() || 'EUR',
          duration: plan.duration.trim() || null,
          active: plan.active,
        })),
    })
    const bookingResult = booking.data as { ok?: boolean; error?: string } | null
    if (booking.error || !bookingResult?.ok) {
      toast.error(t('d.saveFailed'), {
        description: booking.error?.message ?? bookingResult?.error ?? 'Erreur inconnue',
      })
      setSaving(false)
      return
    }
    // Quartier saisi/corrigé : on re-géocode « quartier, ville, pays » pour
    // déplacer le pin dans le vrai quartier (best-effort — on garde les
    // coordonnées existantes si le géocodage échoue).
    let lat = Number.isFinite(editForm.lat) ? editForm.lat : toEdit.lat
    let lng = Number.isFinite(editForm.lng) ? editForm.lng : toEdit.lng
    if (editForm.district.trim()) {
      const located = await geocodeArtistLocation(
        editForm.city.trim(),
        editForm.country.trim(),
        editForm.district.trim(),
      )
      if (located) {
        lat = located.lat
        lng = located.lng
      }
    }
    const result = await updateMapArtist(toEdit.id, {
      name: editForm.name.trim() || toEdit.name,
      genre: editForm.genre.trim(),
      city: editForm.city.trim(),
      district: editForm.district.trim(),
      country: editForm.country.trim(),
      // Coordonnées : garde les existantes tant que la ville n'est pas
      // résolue (le géocodage arrive via le sélecteur de ville).
      lat,
      lng,
      bio: editForm.bio.trim(),
      image: editForm.image.trim() || undefined,
      cover: editForm.cover.trim() || undefined,
      verified: editForm.verified,
      platforms: editForm.platforms,
      socials: editForm.socials,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(t('d.saveFailed'), { description: result.error })
      return
    }
    toast.success(t('d.saved', { name: toEdit.name }))
    setToEdit(null)
    setEditForm(null)
    await load()
  }

  const remove = async () => {
    if (!toDelete) return
    const result = await removeMapArtist(toDelete.id)
    if (!result.ok) {
      toast.error(t('d.removeFailed'), { description: result.error })
      return
    }
    toast.success(t('d.removed', { name: toDelete.name }))
    setToDelete(null)
    setRows((prev) => prev.filter((r) => r.id !== toDelete.id))
  }

  /**
   * Assistant IA : envoie les artistes (filtrés, ou une seule ligne) à
   * l'edge function ai_verify (Mistral) qui corrige genre + bio. On ne
   * modifie RIEN automatiquement : l'admin valide chaque proposition.
   */
  const runAiReview = async (targets?: MapArtistRow[]) => {
    const list = (targets ?? filtered).slice(0, 200)
    if (list.length === 0) return
    setAiBusy(true)
    setAiProgress({ done: 0, total: list.length })
    const suggestions: AiSuggestion[] = []
    const BATCH = 15
    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH)
      const result = await aiReviewArtists(
        batch.map((r) => ({
          id: r.id,
          name: r.name,
          genre: r.genre ?? '',
          city: r.city ?? '',
          country: r.country ?? '',
          bio: r.bio ?? '',
        })),
      )
      if (!result.ok) {
        toast.error(t('d.ai.failed'), {
          description: result.error,
        })
        setAiBusy(false)
        return
      }
      const byId = new Map(result.results.map((r) => [r.id, r]))
      for (const row of batch) {
        const verdict = byId.get(row.id)
        if (!verdict) continue
        const genre = (verdict.genre ?? '').trim()
        const bio = (verdict.bio ?? '').trim()
        // Ne propose que les vraies corrections (genre différent, bio réelle
        // d'au moins 40 caractères). Un « reject » = non-musicien probable →
        // signalé à l'admin sans l'appliquer par défaut.
        const genreChanged = genre && genre !== (row.genre ?? '')
        const bioChanged = bio.length >= 40 && bio !== (row.bio ?? '')
        if (!genreChanged && !bioChanged && verdict.verdict !== 'reject') continue
        suggestions.push({
          row,
          verdict: verdict.verdict ?? 'keep',
          reason: verdict.reason ?? '',
          genre,
          bio,
          apply: verdict.verdict !== 'reject' && (genreChanged || bioChanged),
        })
      }
      setAiProgress({ done: Math.min(i + BATCH, list.length), total: list.length })
    }
    setAiBusy(false)
    setAiSuggestions(suggestions)
    setAiApplied(false)
  }

  /** Applique les propositions cochées (genre + bio) via updateMapArtist. */
  const applyAiSuggestions = async () => {
    if (!aiSuggestions) return
    const selected = aiSuggestions.filter((s) => s.apply)
    if (selected.length === 0) return
    setAiBusy(true)
    let done = 0
    for (const s of selected) {
      const patch: { genre?: string; bio?: string } = {}
      if (s.genre) patch.genre = s.genre
      if (s.bio) patch.bio = s.bio
      // skipGenreClean : le genre vient de Mistral (déjà normalisé), on ne
      // doit pas le re-passer dans cleanGenre (« Afrobeat » → « Afrobeats »).
      const result = await updateMapArtist(s.row.id, patch, { skipGenreClean: true })
      if (result.ok) done += 1
    }
    setAiBusy(false)
    setAiApplied(true)
    toast.success(t('d.ai.applied', { n: done, s: done > 1 ? 's' : '' }))
    await load()
  }

  const exportCsv = () => {
    const header = [t('d.col.name'), t('d.col.genre'), t('d.col.city'), t('d.col.country'), t('d.col.lat'), t('d.col.lng'), t('d.col.source'), t('d.col.date')]
    const lines = filtered.map((r) =>
      [r.name, r.genre ?? '', r.city ?? '', r.country ?? '', r.lat, r.lng, r.source ?? '', r.created_at]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(';'),
    )
    const blob = new Blob([header.join(';') + '\n' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'artistes-decouverts-musimaps.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Globe2 className="text-muted-foreground size-6" /> {t('d.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('d.summary', {
              count: rows.length,
              s: rows.length > 1 ? 's' : '',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/docs"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <BookOpen className="size-4" /> {t('d.guide')}
          </Link>
          <Input
            placeholder={t('d.filter')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              artistPage.setPage(1)
            }}
            className="w-40"
          />
          {/* Filtre : tous / compte + carte / carte seule */}
          <div className="flex rounded-md border">
            {(['all', 'claimed', 'map'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key)
                  artistPage.setPage(1)
                }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                } ${key === 'all' ? 'rounded-l-md' : key === 'map' ? 'rounded-r-md' : ''}`}
              >
                {key === 'all' ? t('d.filterAll') : key === 'claimed' ? t('d.filterClaimed') : t('d.filterMap')}
                <span className="ml-1 text-xs opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label={t('d.reload')}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download /> CSV
          </Button>
          <Button
            variant="default"
            disabled={aiBusy || filtered.length === 0}
            onClick={() => void runAiReview()}
            title={t('d.ai.reviewAll')}
          >
            {aiBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {aiBusy
              ? t('d.ai.progress', {
                  done: aiProgress.done,
                  total: aiProgress.total,
                })
              : t('d.ai.reviewAll')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('d.cardTitle')}</CardTitle>
          <CardDescription>{t('d.cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-16 justify-center">
              <Loader2 className="animate-spin" /> {t('d.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center">
              {t('d.empty', { query: query ? t('d.emptyFilterSuffix') : '' })}
            </p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('d.col.artist')}</TableHead>
                  <TableHead>{t('d.col.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('d.col.genre')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('d.col.city')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('d.col.country')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('d.col.coords')}</TableHead>
                  <TableHead className="text-right">{t('d.col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artistPage.pageItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="relative size-9 shrink-0">
                          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            {row.flag ?? '🌍'}
                          </span>
                          {row.image && (
                            <img
                              src={row.image}
                              alt=""
                              className="absolute inset-0 size-9 rounded-full border object-cover"
                              onError={(e) => {
                                e.currentTarget.remove()
                              }}
                            />
                          )}
                        </span>
                        <span>{row.name}</span>
                        {row.verified && (
                          <Badge className="ml-1" variant="default">
                            {t('d.verifiedBadge')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.claimed_by ? (
                        <Badge variant="default" className="bg-brand text-black hover:bg-brand">
                          <UserRound className="size-3" /> {t('d.statusClaimed')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <MapPin className="size-3" /> {t('d.statusMap')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">{row.genre ?? '—'}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{row.city ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{row.country ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell font-mono text-xs">
                      {row.lat.toFixed(2)}, {row.lng.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void runAiReview([row])}
                        disabled={aiBusy}
                        aria-label={t('d.ai.row')}
                        title={t('d.ai.row')}
                      >
                        {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(row)}
                        aria-label={t('d.edit')}
                      >
                        <Pencil />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setToDelete(row)}
                            aria-label={t('d.deleteAria', { name: row.name })}
                          >
                            <Trash2 />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('d.deleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('d.deleteDesc', { name: row.name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setToDelete(null)}>
                              {t('d.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove()}>
                              {t('d.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </TableCell>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal d'édition / correction des informations */}
      {toEdit && editForm && (
        <Dialog open onOpenChange={(open) => !open && setToEdit(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('d.editTitle')}</DialogTitle>
              <DialogDescription>{t('d.editDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t('d.field.name')}</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('d.field.genre')}</Label>
                  <Input
                    value={editForm.genre}
                    onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t('d.field.location')}</Label>
                  <LocationSelect
                    value={{
                      city: editForm.city,
                      country: editForm.country,
                      flag: toEdit.flag ?? '🌍',
                      lat: editForm.lat,
                      lng: editForm.lng,
                      continent: editForm.continent,
                    }}
                    onChange={(loc: LocationValue) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              city: loc.city,
                              country: loc.country,
                              lat: loc.lat,
                              lng: loc.lng,
                              continent: loc.continent,
                            }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t('d.field.district')}</Label>
                  <Input
                    value={editForm.district}
                    placeholder="Ex. Yopougon, Bastille, Almadies…"
                    onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>{t('d.field.bio')}</Label>
                <Textarea
                  rows={4}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t('d.field.image')}</Label>
                  <ImageField
                    value={editForm.image}
                    onChange={(value) => setEditForm({ ...editForm, image: value })}
                    objectFit="cover"
                  />
                </div>
                <div>
                  <Label>{t('d.field.cover')}</Label>
                  <ImageField
                    value={editForm.cover}
                    onChange={(value) => setEditForm({ ...editForm, cover: value })}
                    objectFit="cover"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{t('d.field.verify')}</p>
                </div>
                <Switch
                  checked={editForm.verified}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, verified: checked })}
                />
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('d.bookingTitle')}</p>
                    <p className="text-muted-foreground text-xs">{t('d.bookingDesc')}</p>
                  </div>
                  <Switch
                    checked={editForm.bookable}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, bookable: checked })}
                  />
                </div>

                {editForm.bookable && (
                  <div className="mt-4 grid gap-3">
                    {editForm.plans.map((plan, index) => (
                      <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                        <div>
                          <Label>{t('d.plan.name')}</Label>
                          <Input
                            value={plan.name}
                            placeholder="Concert privé"
                            onChange={(e) => {
                              const plans = [...editForm.plans]
                              plans[index] = { ...plan, name: e.target.value }
                              setEditForm({ ...editForm, plans })
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <Label>{t('d.plan.price')}</Label>
                            <Input
                              value={plan.price}
                              inputMode="decimal"
                              placeholder="1500"
                              onChange={(e) => {
                                const plans = [...editForm.plans]
                                plans[index] = { ...plan, price: e.target.value }
                                setEditForm({ ...editForm, plans })
                              }}
                            />
                          </div>
                          <div>
                            <Label>{t('d.plan.currency')}</Label>
                            <Input
                              value={plan.currency}
                              placeholder="EUR"
                              onChange={(e) => {
                                const plans = [...editForm.plans]
                                plans[index] = { ...plan, currency: e.target.value }
                                setEditForm({ ...editForm, plans })
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t('d.plan.duration')}</Label>
                          <Input
                            value={plan.duration}
                            placeholder="2h"
                            onChange={(e) => {
                              const plans = [...editForm.plans]
                              plans[index] = { ...plan, duration: e.target.value }
                              setEditForm({ ...editForm, plans })
                            }}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Label className="mb-2 flex items-center gap-2">
                            <Switch
                              checked={plan.active}
                              onCheckedChange={(checked) => {
                                const plans = [...editForm.plans]
                                plans[index] = { ...plan, active: checked }
                                setEditForm({ ...editForm, plans })
                              }}
                            />
                            {t('d.plan.active')}
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-destructive hover:text-destructive"
                            onClick={() =>
                              setEditForm({
                                ...editForm,
                                plans: editForm.plans.filter((_, i) => i !== index),
                              })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="sm:col-span-2">
                          <Label>{t('d.plan.desc')}</Label>
                          <Input
                            value={plan.description}
                            placeholder="Set complet, sonorisation incluse…"
                            onChange={(e) => {
                              const plans = [...editForm.plans]
                              plans[index] = { ...plan, description: e.target.value }
                              setEditForm({ ...editForm, plans })
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditForm({
                          ...editForm,
                          plans: [
                            ...editForm.plans,
                            { name: '', price: '', currency: 'EUR', duration: '', description: '', active: true },
                          ],
                        })
                      }
                    >
                      + {t('d.plan.add')}
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">{t('d.platformsTitle')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PLATFORM_FIELDS.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-xs font-medium capitalize text-muted-foreground">
                        {key.replace('_', ' ')}
                      </span>
                      <Input
                        value={editForm.platforms[key] ?? ''}
                        placeholder="https://…"
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            platforms: { ...editForm.platforms, [key]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">{t('d.socialsTitle')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOCIAL_FIELDS.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-xs font-medium capitalize text-muted-foreground">
                        {key}
                      </span>
                      <Input
                        value={editForm.socials[key] ?? ''}
                        placeholder="https://…"
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            socials: { ...editForm.socials, [key]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setToEdit(null)}>
                {t('d.cancel')}
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('d.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Assistant IA : propositions de correction (genre + bio) */}
      {aiSuggestions && (
        <Dialog open onOpenChange={(open) => !open && setAiSuggestions(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                <span className="flex items-center gap-2">
                  <Sparkles className="size-5 text-brand" /> {t('d.ai.results')}
                </span>
              </DialogTitle>
              <DialogDescription>
                {t('d.ai.resultsDesc', {
                  n: aiSuggestions.length,
                  s: aiSuggestions.length > 1 ? 's' : '',
                })}
              </DialogDescription>
            </DialogHeader>

            {aiSuggestions.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">{t('d.ai.noCorrections')}</p>
            ) : (
              <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1">
                {aiSuggestions.map((s) => (
                  <div key={s.row.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{s.row.name}</p>
                        <p className="text-muted-foreground text-xs">{s.reason}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {s.verdict === 'reject' && (
                          <Badge variant="destructive">{t('d.ai.rejected')}</Badge>
                        )}
                        <Switch
                          checked={s.apply}
                          onCheckedChange={(checked) =>
                            setAiSuggestions((cur) =>
                              cur?.map((x) => (x.row.id === s.row.id ? { ...x, apply: checked } : x)) ?? null,
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">{t('d.ai.genreBefore')}</p>
                        <Badge variant="secondary">{s.row.genre || '—'}</Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">{t('d.ai.genreAfter')}</p>
                        <Badge className="bg-brand text-black hover:bg-brand">{s.genre || '—'}</Badge>
                      </div>
                      {s.bio && (
                        <div className="sm:col-span-2">
                          <p className="text-muted-foreground mb-1 text-xs">{t('d.ai.bioAfter')}</p>
                          <p className="text-sm">{s.bio}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setAiSuggestions(null)}>
                {t('d.cancel')}
              </Button>
              <Button
                onClick={() => void applyAiSuggestions()}
                disabled={aiBusy || aiSuggestions.length === 0 || aiApplied}
              >
                {aiBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                {aiApplied
                  ? t('d.ai.appliedDone')
                  : t('d.ai.apply', {
                      n: aiSuggestions.filter((s) => s.apply).length,
                      s: aiSuggestions.filter((s) => s.apply).length > 1 ? 's' : '',
                    })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
