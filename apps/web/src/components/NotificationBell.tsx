import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Loader2, Music2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationIcon,
  type AppNotification,
} from '@musimaps/shared'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'

export default function NotificationBell({ showWhenLoggedOut = false, unreadCount }: { showWhenLoggedOut?: boolean; unreadCount?: number } = {}) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const displayedUnread = unreadCount ?? unread
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  // Recharge quand le panneau s'ouvre (fraîcheur) ou quand l'utilisateur change.
  useEffect(() => {
    if (!user) {
      setItems([])
      setUnread(0)
      loadedRef.current = false
      return
    }
    setLoading(true)
    void Promise.all([fetchNotifications(), fetchUnreadCount()]).then(([list, count]) => {
      setItems(list)
      setUnread(count)
      setLoading(false)
      loadedRef.current = true
    })
  }, [user])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && user) {
      // Rafraîchit à chaque ouverture + marque tout lu à la fermeture.
      void Promise.all([fetchNotifications(), fetchUnreadCount()]).then(([list, count]) => {
        setItems(list)
        setUnread(count)
      })
    } else if (!next && unread > 0) {
      void markAllNotificationsRead().then(() => setUnread(0))
    }
  }

  // Retrait immédiat, rétabli (liste et compteur) si la base refuse.
  const removeItem = async (item: AppNotification) => {
    const previousItems = items
    const previousUnread = unread
    setItems((current) => current.filter((row) => row.id !== item.id))
    if (!item.read) setUnread((count) => Math.max(0, count - 1))
    if (!(await deleteNotification(item.id))) {
      setItems(previousItems)
      setUnread(previousUnread)
      toast.error(t('notif.deleteError'))
    }
  }

  if (!user) {
    return showWhenLoggedOut ? (
      <Link
        to={localize('/login')}
        aria-label={t('nav.notifications')}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline-strong text-secondary-text transition-colors hover:bg-secondary-bg"
      >
        <Bell className="h-5 w-5" />
      </Link>
    ) : null
  }

  const unreadItems = items.filter((item) => !item.read)

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.notifications')}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-hairline-strong text-secondary-text transition-colors hover:bg-secondary-bg"
        >
          <Bell className="h-5 w-5" />
          {displayedUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-deep px-1 text-[10px] font-bold text-brand-deep-foreground">
              {displayedUnread > 9 ? '9+' : displayedUnread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <p className="text-sm font-bold">{t('nav.notifications')}</p>
          {unread > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-black">
              {unreadItems.length} {t('nav.unread')}
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-secondary-text">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-secondary-text">
              {t('nav.noNotifications')}
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className={`flex items-start border-b border-hairline ${item.read ? 'opacity-60' : ''}`}>
              <Link
                to={item.artist_id ? localize(`/artist/${item.artist_id}`) : localize('/globe')}
                onClick={() => void markNotificationRead(item.id)}
                className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary-bg"
              >
                <span className="mt-0.5 text-lg" aria-hidden="true">
                  {notificationIcon(item.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug">
                    {item.message ?? item.artist_name ?? t('nav.notifications')}
                  </span>
                  {item.artist_name && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-brand-deep">
                      <Music2 className="h-3 w-3" /> {item.artist_name}
                      {item.city ? ` · ${item.city}` : ''}
                    </span>
                  )}
                </span>
                {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-deep" />}
              </Link>
              <button
                type="button"
                aria-label={t('notif.delete')}
                onClick={() => void removeItem(item)}
                className="mr-2 mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary-text transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-hairline p-2">
          <Link
            to={localize('/notifications')}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold text-brand-deep transition-colors hover:bg-brand-soft"
          >
            {t('notif.viewAll')}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
