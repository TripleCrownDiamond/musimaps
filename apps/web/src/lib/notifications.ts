import { supabase, hasSupabase } from './supabase'

export interface AppNotification {
  id: string
  type:
    | 'discovery'
    | 'followed_artist'
    | 'preference'
    | 'nearby'
    | 'follow'
    | 'like'
    | 'booking'
    | 'booking_status'
    | 'streak'
    | 'achievement'
  artist_id: string | null
  artist_name: string | null
  city: string | null
  country: string | null
  message: string | null
  read: boolean
  created_at: string
}

/** Notifications de l'utilisateur connecté, les plus récentes d'abord. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  if (!hasSupabase()) return []
  const { data, error } = await supabase!
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return []
  return (data ?? []) as AppNotification[]
}

/** Nombre de notifications non lues. */
export async function fetchUnreadCount(): Promise<number> {
  if (!hasSupabase()) return 0
  const { count, error } = await supabase!
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false)
  if (error) return 0
  return count ?? 0
}

/** Marque une notification comme lue. */
export async function markNotificationRead(id: string): Promise<void> {
  if (!hasSupabase()) return
  try {
    await supabase!.from('notifications').update({ read: true }).eq('id', id)
  } catch {
    /* silencieux */
  }
}

/** Marque toutes les notifications comme lues. */
export async function markAllNotificationsRead(): Promise<void> {
  if (!hasSupabase()) return
  try {
    await supabase!.from('notifications').update({ read: true }).eq('read', false)
  } catch {
    /* silencieux */
  }
}

/**
 * Signale un nouvel artiste ajouté à la carte (RPC notify_discovery) :
 * les utilisateurs de la même ville, des genres préférés et les abonnés
 * des artistes de la zone sont notifiés. Fire-and-forget.
 */
export async function triggerDiscoveryNotification(artist: {
  id: string
  name: string
  genre: string
  city: string
  country: string
}): Promise<void> {
  if (!hasSupabase()) return
  try {
    await supabase!.rpc('notify_discovery', {
      p_artist_id: artist.id,
      p_artist_name: artist.name,
      p_genre: artist.genre ?? '',
      p_city: artist.city ?? '',
      p_country: artist.country ?? '',
    })
  } catch {
    /* silencieux : la notif ne bloque jamais l'ajout */
  }
}
