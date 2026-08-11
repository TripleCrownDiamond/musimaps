import { supabase } from './supabase';

export interface AppNotification {
  id: string;
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
    | 'achievement';
  artist_id: string | null;
  artist_name: string | null;
  city: string | null;
  country: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
}

/** Notifications de l'utilisateur connecté — même table que le web (sync). */
export async function fetchNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as AppNotification[];
}

/** Nombre de notifications non lues. */
export async function fetchUnreadCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

/** Marque une notification comme lue. */
export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  } catch {
    /* silencieux */
  }
}

/** Marque toutes les notifications comme lues. */
export async function markAllNotificationsRead(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
  } catch {
    /* silencieux */
  }
}

/** Icône par type (même mapping que la cloche web). */
export function notificationIcon(type: string): string {
  switch (type) {
    case 'discovery':
      return '✨';
    case 'followed_artist':
      return '🔔';
    case 'preference':
      return '🎯';
    case 'nearby':
      return '📍';
    case 'follow':
      return '➕';
    case 'like':
      return '💚';
    case 'booking':
      return '🎤';
    case 'booking_status':
      return '📅';
    case 'streak':
      return '🔥';
    case 'achievement':
      return '🏆';
    default:
      return '🔔';
  }
}
