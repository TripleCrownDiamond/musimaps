import { useCallback, useEffect, useState } from 'react'
import { Crown, Download, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, hasSupabase } from '@/lib/supabase'
import { useLanguage } from '@/i18n/LanguageContext'
import { notifyBookingStatus } from '@musimaps/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAdminT, type AdminKey } from '../i18n'
import { Pagination, usePagination } from '../components/Pagination'

interface BookingRow {
  id: string
  artist_id: string
  artist_name: string
  user_email: string
  event_type: string | null
  event_date: string | null
  flexible_date: boolean
  city: string | null
  country: string | null
  address: string | null
  budget_range: string | null
  budget_amount: string | null
  audience_size: string | null
  message: string | null
  contact_name: string | null
  company: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  linkedin: string | null
  contact_prefs: string[]
  status: 'pending' | 'confirmed' | 'rejected'
  created_at: string
}

export default function BookingsPage() {
  const { t } = useAdminT()
  const { lang } = useLanguage()
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const bookingPage = usePagination(bookings, 15)
  const [subscribers, setSubscribers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [toDelete, setToDelete] = useState<BookingRow | null>(null)

  const load = useCallback(async () => {
    if (!hasSupabase()) {
      setLoading(false)
      return
    }
    const [bookingRes, subscriberRes] = await Promise.all([
      supabase!
        .from('bookings')
        .select(
          'id, artist_id, artist_name, user_email, event_type, event_date, flexible_date, city, country, address, budget_range, budget_amount, audience_size, message, contact_name, company, phone, website, instagram, linkedin, contact_prefs, status, created_at',
        )
        .order('created_at', { ascending: false }),
      supabase!.from('subscribers').select('email').order('created_at', { ascending: true }),
    ])
    if (bookingRes.error) {
      toast.error(t('bk.loadFailed'), {
        description: bookingRes.error.message,
      })
    } else {
      setBookings((bookingRes.data ?? []) as BookingRow[])
    }
    if (!subscriberRes.error && subscriberRes.data) {
      setSubscribers(subscriberRes.data.map((row) => row.email))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = async (booking: BookingRow, status: BookingRow['status']) => {
    const { error } = await supabase!
      .from('bookings')
      .update({ status })
      .eq('id', booking.id)
    if (error) toast.error(t('bk.updateFailed'), { description: error.message })
    else {
      toast.success(t('bk.statusUpdated', { status: t(`bk.status.${status}` as AdminKey) }))
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status } : b)),
      )
      // Notifie le demandeur : sa réservation a changé de statut (web ⇄ mobile).
      const label =
        status === 'confirmed'
          ? lang === 'fr'
            ? 'confirmée'
            : 'confirmed'
          : status === 'rejected'
            ? lang === 'fr'
              ? 'refusée'
              : 'declined'
            : lang === 'fr'
              ? 'en attente'
              : 'pending'
      void notifyBookingStatus(
        booking.id,
        status,
        lang === 'fr'
          ? `Ta demande pour ${booking.artist_name} est ${label}.`
          : `Your request for ${booking.artist_name} is ${label}.`,
      )
    }
  }

  const remove = async () => {
    if (!toDelete) return
    const { error } = await supabase!.from('bookings').delete().eq('id', toDelete.id)
    if (error) toast.error(t('bk.deleteFailed'), { description: error.message })
    else {
      toast.success(t('bk.deleted'))
      setToDelete(null)
      setBookings((prev) => prev.filter((b) => b.id !== toDelete.id))
    }
  }

  const addSubscriber = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error(t('bk.invalidEmail'))
      return
    }
    const { error } = await supabase!.from('subscribers').insert({ email })
    if (error) {
      toast.error(t('bk.addFailed'), { description: error.message })
    } else {
      toast.success(t('bk.added', { email }))
      setNewEmail('')
      setSubscribers((prev) => [...prev, email])
    }
  }

  const removeSubscriber = async (email: string) => {
    const { error } = await supabase!.from('subscribers').delete().eq('email', email)
    if (error) toast.error(t('bk.deleteFailed'), { description: error.message })
    else {
      toast.success(t('bk.removed', { email }))
      setSubscribers((prev) => prev.filter((e) => e !== email))
    }
  }

  const exportCsv = () => {
    const header = [
      t('bk.col.artist'), t('bk.col.email'), t('bk.col.type'), t('bk.col.date'), 'flexible',
      t('bk.col.location'), t('bk.col.address'), 'budget', t('bk.col.audience'), t('bk.col.message'),
      t('bk.col.contact'), t('bk.col.company'), t('bk.col.phone'), t('bk.col.website'), 'instagram',
      'linkedin', t('bk.col.prefs'), t('bk.col.status'), t('bk.col.created'),
    ]
    const lines = bookings.map((b) =>
      [
        b.artist_name, b.user_email, b.event_type ?? '', b.event_date ?? '',
        b.flexible_date ? t('bk.col.yes') : '', b.city ?? '', b.country ?? '', b.address ?? '',
        b.budget_range ?? b.budget_amount ?? '', b.audience_size ?? '', b.message ?? '',
        b.contact_name ?? '', b.company ?? '', b.phone ?? '', b.website ?? '',
        b.instagram ?? '', b.linkedin ?? '', (b.contact_prefs ?? []).join(' / '),
        b.status, b.created_at,
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
    a.download = 'bookings-musimaps.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('bk.title')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('bk.summary', {
              bookings: bookings.length,
              s: bookings.length > 1 ? 's' : '',
              subscribers: subscribers.length,
              s2: subscribers.length > 1 ? 's' : '',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label={t('bk.reload')}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={bookings.length === 0}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="text-muted-foreground size-4" /> {t('bk.subTitle')}
          </CardTitle>
          <CardDescription>{t('bk.subDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap gap-2">
            {subscribers.length === 0 && (
              <span className="text-muted-foreground text-sm">{t('bk.noSubscribers')}</span>
            )}
            {subscribers.map((email) => (
              <span
                key={email}
                className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
              >
                {email}
                <button
                  type="button"
                  onClick={() => void removeSubscriber(email)}
                  aria-label={t('bk.removeAria', { email })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={t('bk.subPh')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" onClick={() => void addSubscriber()}>
              <Plus /> {t('bk.addSubscriber')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('bk.requestsTitle')}</CardTitle>
          <CardDescription>{t('bk.requestsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-16 justify-center">
              <Loader2 className="animate-spin" /> {t('bk.loading')}
            </div>          ) : bookings.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center">
              {t('bk.empty')}
            </p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bk.col.artist')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('bk.col.email')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('bk.col.type')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('bk.col.date')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('bk.col.location')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('bk.col.budget')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('bk.col.audience')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('bk.col.contact')}</TableHead>
                  <TableHead>{t('bk.col.status')}</TableHead>
                  <TableHead className="text-right">{t('bk.col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingPage.pageItems.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.artist_name}</TableCell>
                    <TableCell className="hidden lg:table-cell">{booking.user_email}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {booking.event_type ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      {booking.flexible_date ? t('bk.flexible') : booking.event_date ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {[booking.city, booking.country].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {booking.budget_range ?? (booking.budget_amount ? `~${booking.budget_amount} €` : '—')}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {booking.audience_size ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      <div className="max-w-[160px] truncate" title={booking.contact_name ?? ''}>
                        {booking.contact_name ?? '—'}
                        {booking.phone ? ` · ${booking.phone}` : ''}
                      </div>
                      {booking.message && (
                        <div className="max-w-[160px] truncate text-xs" title={booking.message}>
                          💬 {booking.message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={booking.status}
                        onValueChange={(status) =>
                          void changeStatus(booking, status as BookingRow['status'])
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <Badge variant="secondary">{t('bk.status.pending')}</Badge>
                          </SelectItem>
                          <SelectItem value="confirmed">
                            <Badge variant="default">{t('bk.status.confirmed')}</Badge>
                          </SelectItem>
                          <SelectItem value="rejected">
                            <Badge variant="destructive">{t('bk.status.rejected')}</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setToDelete(booking)}
                            aria-label={t('bk.deleteAria', { email: booking.user_email })}
                          >
                            <Trash2 />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('bk.deleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('bk.deleteDesc', { email: booking.user_email, artist: booking.artist_name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setToDelete(null)}>
                              {t('bk.cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove()}>
                              {t('bk.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={bookingPage.page}
              pageCount={bookingPage.pageCount}
              total={bookingPage.total}
              pageSize={15}
              onPageChange={bookingPage.setPage}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
