import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { History, RotateCcw } from 'lucide-react'
import type { ContentKey } from '@/lib/cms'
import { fetchContentHistory, restoreVersion, type HistoryEntry } from '@/lib/cms'
import { useCms } from '@/context/CmsContext'
import { SECTION_LABELS } from '../sections'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ALL_KEYS = Object.keys(SECTION_LABELS) as ContentKey[]

export default function HistoryPage() {
  const { reload: reloadPublic } = useCms()
  const [filter, setFilter] = useState<'all' | ContentKey>('all')
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [restoring, setRestoring] = useState<HistoryEntry | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const list = await fetchContentHistory(filter === 'all' ? undefined : filter)
    setEntries(list)
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const handleRestore = async () => {
    if (!restoring) return
    setBusy(restoring.id)
    const result = await restoreVersion(restoring.key, restoring.id)
    setBusy(null)
    if (result.ok) {
      toast.success(
        `Version restaurée et publiée (${SECTION_LABELS[restoring.key] ?? restoring.key})`,
      )
      setRestoring(null)
      await Promise.all([load(), reloadPublic()])
    } else {
      toast.error('Restauration impossible', { description: result.error })
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <History className="text-muted-foreground size-6" />
            Historique des publications
          </h1>
          <p className="text-muted-foreground text-sm">
            Chaque publication archive une version. Restaurez une version antérieure pour la
            remettre en ligne.
          </p>
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as 'all' | ContentKey)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Toutes les sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sections</SelectItem>
            {ALL_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {SECTION_LABELS[key] ?? key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions publiées</CardTitle>
          <CardDescription>
            Les plus récentes en premier. Chaque version archive le contenu FR et EN.
            La restauration republie immédiatement les deux langues de la version choisie
            (elles deviennent aussi les brouillons de travail).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries === null ? (
            <div className="grid grid-cols-1 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <>
              <p className="text-muted-foreground py-8 text-center text-sm">
                Aucune version publiée pour l’instant. Publiez du contenu depuis une section pour
                la retrouver ici.
              </p>
              <p className="text-muted-foreground -mt-6 pb-2 text-center text-xs">
                Les versions antérieures au CMS bilingue n’archivent que le FR — l’EN publié à ce
                moment est conservé tel quel.
              </p>
            </>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="grid gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {SECTION_LABELS[entry.key] ?? entry.key}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Badge variant="outline" className="px-1.5 text-[10px]">FR</Badge>
                        {entry.contentEn ? (
                          <Badge variant="outline" className="px-1.5 text-[10px]">EN</Badge>
                        ) : null}
                      </span>
                      <span className="text-sm font-medium">{formatDate(entry.publishedAt)}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {entry.createdBy
                        ? `Publiée par ${entry.createdBy}`
                        : 'Version initiale (backfill)'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestoring(entry)}
                    disabled={busy !== null}
                  >
                    <RotateCcw /> Restaurer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={restoring !== null}
        onOpenChange={(open) => {
          if (!open) setRestoring(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoring
                ? `La version du ${formatDate(restoring.publishedAt)} (${SECTION_LABELS[restoring.key] ?? restoring.key}) remplacera le contenu publié actuel et sera immédiatement visible par les visiteurs. Elle deviendra aussi votre brouillon de travail.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              onSelect={(e) => {
                // Empêche la fermeture automatique : le dialog ne se referme
                // que si la restauration réussit (setRestoring(null) ci-dessus).
                e.preventDefault()
                void handleRestore()
              }}
            >
              {busy !== null ? 'Restauration…' : 'Restaurer et publier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
