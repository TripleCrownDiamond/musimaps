import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Check, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, hasSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdminT } from '../i18n'
import { Pagination, usePagination } from '../components/Pagination'

interface ClaimRow {
  id: string
  map_artist_id: string
  user_email: string
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
  reviewed_at: string | null
  artist_name?: string
  artist_verified?: boolean
}

export default function ClaimsPage() {
  const { t } = useAdminT()
  const [rows, setRows] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const claimPage = usePagination(rows, 15)

  const load = useCallback(async () => {
    setLoading(true)
    if (!hasSupabase()) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase!
      .from('artist_claims')
      .select('id, map_artist_id, user_id, user_email, status, note, created_at, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      toast.error(t('c.loadFailed'), { description: error.message })
      setRows([])
    } else {
      const base = (data ?? []) as ClaimRow[]
      // Enrichit avec le nom de l'artiste + sa vérification.
      const ids = [...new Set(base.map((r) => r.map_artist_id))]
      const { data: artists } = ids.length
        ? await supabase!
            .from('map_artists')
            .select('id, name, verified')
            .in('id', ids)
        : { data: [] }
      const byId = new Map((artists ?? []).map((a) => [a.id, a]))
      setRows(base.map((r) => ({ ...r, ...byId.get(r.map_artist_id) })))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const review = async (claim: ClaimRow, approve: boolean) => {
    setBusyId(claim.id)
    const { data, error } = await supabase!.rpc('review_claim', {
      p_claim_id: claim.id,
      p_approve: approve,
    })
    setBusyId(null)
    if (error) {
      toast.error(t('c.updateFailed'), { description: error.message })
      return
    }
    const result = data as { ok?: boolean; error?: string } | null
    if (!result?.ok) {
      toast.error(t('c.updateFailed'), { description: result?.error })
      return
    }
    toast.success(
      approve
        ? t('c.approved', { artist: claim.artist_name ?? claim.map_artist_id })
        : t('c.rejected', { artist: claim.artist_name ?? claim.map_artist_id }),
    )
    await load()
  }

  const pending = rows.filter((r) => r.status === 'pending')

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="text-muted-foreground size-6" /> {t('c.title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('c.summary', {
              count: pending.length,
              s: pending.length > 1 ? 's' : '',
            })}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} aria-label={t('c.reload')}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('c.cardTitle')}</CardTitle>
          <CardDescription>{t('c.cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-16 justify-center">
              <Loader2 className="animate-spin" /> {t('c.loading')}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center">{t('c.empty')}</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('c.col.artist')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('c.col.email')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('c.col.note')}</TableHead>
                  <TableHead>{t('c.col.status')}</TableHead>
                  <TableHead className="text-right">{t('c.col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimPage.pageItems.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">
                      {claim.artist_name ?? claim.map_artist_id}
                      {claim.artist_verified && (
                        <BadgeCheck className="text-brand ml-1 inline h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{claim.user_email}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell max-w-[220px] truncate">
                      {claim.note || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          claim.status === 'approved'
                            ? 'default'
                            : claim.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {t(`c.status.${claim.status}` as 'c.status.pending')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {claim.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === claim.id}
                            onClick={() => void review(claim, false)}
                          >
                            {busyId === claim.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <X />
                            )}
                            <span className="hidden sm:inline">{t('c.reject')}</span>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={busyId === claim.id}
                            onClick={() => void review(claim, true)}
                          >
                            {busyId === claim.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check />
                            )}
                            <span className="hidden sm:inline">{t('c.approve')}</span>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {claim.reviewed_at
                            ? new Date(claim.reviewed_at).toLocaleDateString('fr-FR')
                            : '—'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={claimPage.page}
              pageCount={claimPage.pageCount}
              total={claimPage.total}
              pageSize={15}
              onPageChange={claimPage.setPage}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
