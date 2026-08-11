import { useEffect, useState } from 'react'
import { Download, Loader2, MapPin, RefreshCw, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, hasSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Pagination, usePagination } from '../components/Pagination'
import {
  convertWaitlistToMap,
  inviteLink,
  type WaitlistRow,
} from '@/lib/waitlist'

const isArtist = (row: WaitlistRow) =>
  row.profile === 'artiste' || row.profile === 'artist'

export default function WaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<WaitlistRow | null>(null)
  const [convertingId, setConvertingId] = useState<string | number | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    if (!hasSupabase()) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase!
      .from('waitlist')
      .select(
        'id, email, profile, artist_name, city, district, genre, link, bio, photo, spotify, youtube, instagram, user_id, converted_at, map_artist_id, created_at',
      )
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Impossible de charger la liste', { description: error.message })
    } else {
      setRows((data ?? []) as WaitlistRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = rows.filter((row) =>
    [row.email, row.artist_name, row.city, row.genre]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(query.toLowerCase())),
  )

  const waitlistPage = usePagination(filtered, 15)

  const unconverted = rows.filter((r) => !r.converted_at)
  const unconvertedArtists = unconverted.filter(isArtist)

  const remove = async () => {
    if (!toDelete || !hasSupabase()) return
    const { error } = await supabase!.from('waitlist').delete().eq('id', toDelete.id)
    if (error) {
      toast.error('Suppression impossible', { description: error.message })
    } else {
      toast.success('Inscription supprimée')
      setToDelete(null)
      setRows((prev) => prev.filter((r) => r.id !== toDelete.id))
    }
  }

  // Conversion d'une entrée artiste → pin sur la carte.
  const convertOne = async (row: WaitlistRow) => {
    setConvertingId(row.id)
    const result = await convertWaitlistToMap(row)
    setConvertingId(null)
    if (!result.ok) {
      toast.error('Conversion impossible', { description: result.error })
      return
    }
    toast.success(`${row.artist_name ?? row.email} ajouté à la carte`)
    await load()
  }

  // Conversion batch de tous les artistes non convertis.
  const convertAll = async () => {
    if (unconvertedArtists.length === 0) return
    setBulkBusy(true)
    let ok = 0
    let failed = 0
    for (const row of unconvertedArtists) {
      const result = await convertWaitlistToMap(row)
      if (result.ok) ok += 1
      else failed += 1
    }
    setBulkBusy(false)
    toast.success(`${ok} artiste(s) ajouté(s) à la carte${failed ? `, ${failed} en échec` : ''}`)
    await load()
  }

  // Invitation amateur : copie le lien de création de compte. On ne marque
  // l'entrée comme convertie que si la copie a réussi (le lien copié EST le
  // mécanisme de livraison de l'invitation).
  const invite = async (row: WaitlistRow) => {
    const link = inviteLink(row.email, 'melomane')
    let copied = false
    try {
      await navigator.clipboard.writeText(link)
      copied = true
    } catch {
      /* presse-papiers indisponible : le lien reste affiché dans le toast */
    }
    toast.success(
      copied ? 'Lien d’invitation copié' : 'Copiez le lien d’invitation ci-dessous',
      { description: link, duration: copied ? 4000 : 12000 },
    )
    if (copied && hasSupabase() && !row.converted_at) {
      const { error } = await supabase!
        .from('waitlist')
        .update({ converted_at: new Date().toISOString() })
        .eq('id', row.id)
      if (!error) await load()
    }
  }

  const exportCsv = () => {
    const header = ['email', 'profil', 'artiste', 'ville', 'genre', 'lien', 'converti', 'date']
    const lines = filtered.map((r) =>
      [
        r.email,
        r.profile,
        r.artist_name ?? '',
        r.city ?? '',
        r.genre ?? '',
        r.link ?? '',
        r.converted_at ? 'oui' : '',
        r.created_at,
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
    a.download = 'waitlist-musimaps.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Liste d’attente</h1>
          <p className="text-muted-foreground text-sm">
            {rows.length} inscription{rows.length > 1 ? 's' : ''} — lecture réservée aux
            administrateurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrer…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              waitlistPage.setPage(1)
            }}
            className="w-48"
          />
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Recharger">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      {/* Flux après lancement */}
      <div className="rounded-2xl border border-lime-400/40 bg-lime-400/10 p-4 text-sm leading-relaxed">
        <p className="font-semibold">Après le lancement</p>
        <p className="mt-1 text-muted-foreground">
          Les artistes de la liste d’attente sont ajoutés à la carte (via «&nbsp;→ Carte&nbsp;»
          ou le bouton de conversion en masse), les autres reçoivent leur lien de compte
          (via «&nbsp;Inviter&nbsp;»). Chaque conversion est tracée ici. Tant que l’accès
          n’est pas ouvert, la création de compte affiche «&nbsp;Disponible après le
          lancement&nbsp;».
        </p>
        {unconvertedArtists.length > 0 && (
          <Button
            size="sm"
            className="mt-3"
            onClick={() => void convertAll()}
            disabled={bulkBusy}
          >
            {bulkBusy ? <Loader2 className="animate-spin" /> : <MapPin />}
            Convertir {unconvertedArtists.length} artiste
            {unconvertedArtists.length > 1 ? 's' : ''} → carte
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 justify-center">
          <Loader2 className="animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center">
          Aucune inscription{query ? ' ne correspond au filtre' : ''}.
        </p>
      ) : (
        <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Profil</TableHead>
              <TableHead className="hidden md:table-cell">Artiste</TableHead>
              <TableHead className="hidden md:table-cell">Ville</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden md:table-cell">Inscrit le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {waitlistPage.pageItems.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell>
                  <Badge variant={isArtist(row) ? 'default' : 'secondary'}>
                    {isArtist(row) ? 'artiste' : 'amateur'}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{row.artist_name ?? '—'}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {row.city ?? '—'}
                  {row.district ? <span className="block text-xs opacity-70">{row.district}</span> : null}
                </TableCell>
                <TableCell>
                  {row.converted_at ? (
                    <Badge variant="outline" className="border-lime-400/50 text-lime-600">
                      Converti
                    </Badge>
                  ) : (
                    <Badge variant="secondary">En attente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {new Date(row.created_at).toLocaleString('fr-FR')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isArtist(row) && !row.converted_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void convertOne(row)}
                        disabled={convertingId === row.id}
                        title="Ajouter cet artiste à la carte"
                      >
                        {convertingId === row.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MapPin />
                        )}
                        <span className="hidden sm:inline">Carte</span>
                      </Button>
                    )}
                    {!isArtist(row) && !row.converted_at && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void invite(row)}
                        title="Copier le lien de création de compte"
                      >
                        <Send />
                        <span className="hidden sm:inline">Inviter</span>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(row)}
                          aria-label={`Supprimer ${row.email}`}
                        >
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer l’inscription ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            L’inscription de {row.email} sera définitivement supprimée.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setToDelete(null)}>
                            Annuler
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={() => void remove()}>
                            Supprimer
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
          page={waitlistPage.page}
          pageCount={waitlistPage.pageCount}
          total={waitlistPage.total}
          pageSize={15}
          onPageChange={waitlistPage.setPage}
        />
        </>
      )}
    </div>
  )
}
