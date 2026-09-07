import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, CheckCheck, Loader2, MapPinned, Music2 } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import {
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  notificationIcon,
  type AppNotification,
} from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

export default function Notifications() {
  const { user, loading: authLoading } = useAuth()
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const [items, setItems] = useState<AppNotification[] | null>(null)

  const load = useCallback(async () => {
    setItems(await fetchNotifications())
  }, [])

  useEffect(() => {
    if (!user) return
    void load()
  }, [load, user])

  const unread = useMemo(() => items?.filter((item) => !item.read).length ?? 0, [items])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <Loader2 className="h-7 w-7 animate-spin text-brand-deep" />
      </div>
    )
  }

  if (!user) return <Navigate to={localize('/login')} state={{ from: localize('/notifications') }} replace />

  const openTarget = (item: AppNotification) =>
    item.artist_id ? localize(`/artist/${item.artist_id}`) : localize('/globe')

  const markAll = async () => {
    if (unread === 0) return
    await markAllNotificationsRead()
    setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? null)
  }

  const openOne = async (item: AppNotification) => {
    if (!item.read) {
      await markNotificationRead(item.id)
      setItems((current) => current?.map((row) => (row.id === item.id ? { ...row, read: true } : row)) ?? null)
    }
  }

  return (
    <main className="min-h-screen bg-warm-white px-6 pb-24 pt-36 md:px-12">
      <div className="mx-auto max-w-4xl">
        <Link
          to={localize('/dashboard')}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-secondary-text transition-colors hover:text-brand-deep"
        >
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </Link>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">{t('notif.title')}</p>
            <h1 className="display-font text-4xl font-extrabold tracking-tight md:text-6xl">{t('notif.historyTitle')}</h1>
            <p className="mt-3 max-w-2xl text-secondary-text">{t('notif.historySubtitle')}</p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAll()}
              className="inline-flex items-center gap-2 rounded-full border border-hairline-strong px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary-bg"
            >
              <CheckCheck className="h-4 w-4" /> {t('notif.markAll')}
            </button>
          )}
        </header>

        {items === null ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-hairline bg-surface py-16 text-secondary-text">
            <Loader2 className="h-5 w-5 animate-spin" /> {t('common.loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-hairline bg-surface px-6 py-16 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
              <Bell className="h-7 w-7" />
            </span>
            <h2 className="display-font text-2xl font-bold">{t('notif.emptyTitle')}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-secondary-text">{t('notif.empty')}</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-hairline bg-surface">
            {items.map((item) => (
              <li key={item.id} className="border-b border-hairline last:border-b-0">
                <Link
                  to={openTarget(item)}
                  onClick={() => void openOne(item)}
                  className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-secondary-bg md:px-6 ${item.read ? '' : 'bg-brand-soft/40'}`}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary-bg text-lg" aria-hidden="true">
                    {notificationIcon(item.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">
                      {item.message ?? (item.artist_name ? `${item.artist_name}${item.city ? ` · ${item.city}` : ''}` : t('notif.title'))}
                    </span>
                    {item.artist_name ? (
                      <span className="mt-1 flex items-center gap-1 text-xs text-brand-deep">
                        <Music2 className="h-3 w-3" /> {item.artist_name}{item.city ? ` · ${item.city}` : ''}
                      </span>
                    ) : (
                      <span className="mt-1 flex items-center gap-1 text-xs text-secondary-text">
                        <MapPinned className="h-3 w-3" /> {t('notif.title')}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-secondary-text">{formatNotificationTime(item.created_at, lang)}</span>
                  </span>
                  {!item.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-deep" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
