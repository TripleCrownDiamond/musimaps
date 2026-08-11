import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Loader2, Music2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@musimaps/shared'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'

/** Icône par type de notification. */
const TYPE_ICONS: Record<string, string> = {
  discovery: '✨',
  followed_artist: '🔔',
  preference: '🎯',
  nearby: '📍',
}

export default function NotificationBell() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
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

  if (!user) return null

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
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-deep px-1 text-[10px] font-bold text-brand-deep-foreground">
              {unread > 9 ? '9+' : unread}
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
              <Link
                key={item.id}
                to={item.artist_id ? localize(`/artist/${item.artist_id}`) : localize('/globe')}
                onClick={() => void markNotificationRead(item.id)}
                className={`flex items-start gap-3 border-b border-hairline px-4 py-3 transition-colors hover:bg-secondary-bg ${
                  item.read ? 'opacity-60' : ''
                }`}
              >
                <span className="mt-0.5 text-lg" aria-hidden="true">
                  {TYPE_ICONS[item.type] ?? '✨'}
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
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
