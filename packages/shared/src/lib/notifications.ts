/**
 * Notifications — partagé web + mobile.
 *
 * Le client Supabase est injecté via `configureRuntime` : aucun import de
 * plateforme ici. Toutes les fonctions dégradent en silence quand Supabase
 * n'est pas configuré — une notification ne doit jamais bloquer un écran.
 */
import { getSupabase } from '../runtime';
import type { MapLocation } from '../map/location';

export type NotificationType =
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

export interface AppNotification {
  id: string;
  type: NotificationType;
  artist_id: string | null;
  artist_name: string | null;
  city: string | null;
  country: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
}

/** Durée relative localisée, partagée par les listes web et mobile. */
export function formatNotificationTime(iso: string, lang: 'fr' | 'en', now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (seconds < 60) return rtf.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR');
}

/**
 * Icône par type de notification.
 *
 * Existait en double : `notificationIcon()` côté mobile et l'objet
 * `NOTIF_ICONS` dans Dashboard.tsx côté web — mêmes 10 entrées, mêmes
 * emojis, même repli. Une seule table désormais.
 */
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  discovery: '✨',
  followed_artist: '🔔',
  preference: '🎯',
  nearby: '📍',
  follow: '➕',
  like: '💚',
  booking: '🎤',
  booking_status: '📅',
  streak: '🔥',
  achievement: '🏆',
};

/** Icône d'un type, avec repli sur la cloche pour un type inconnu. */
export function notificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type as NotificationType] ?? '🔔';
}

/** Notifications de l'utilisateur connecté, les plus récentes d'abord. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  } catch {
    /* silencieux */
  }
}

/** Marque toutes les notifications comme lues. */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
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
  id: string;
  name: string;
  genre: string;
  city: string;
  country: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.rpc('notify_discovery', {
      p_artist_id: artist.id,
      p_artist_name: artist.name,
      p_genre: artist.genre ?? '',
      p_city: artist.city ?? '',
      p_country: artist.country ?? '',
    });
  } catch {
    /* silencieux : la notif ne bloque jamais l'ajout */
  }
}

/**
 * Crée une seule alerte récapitulative pour l'utilisateur connecté après une
 * autorisation de localisation. Le RPC ne conserve jamais les coordonnées :
 * il les utilise uniquement pour compter les artistes proches.
 */
export async function notifyNearbyLocation(
  location: MapLocation,
  message: string,
): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const [lng, lat] = location.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return 0;
  try {
    const { data, error } = await supabase.rpc('notify_nearby_location', {
      p_lat: lat,
      p_lng: lng,
      p_label: location.label ?? '',
      p_city: location.city ?? '',
      p_country: location.country ?? location.countryCode ?? '',
      p_message: message,
    });
    if (error) return 0;
    return typeof data === 'number' ? data : Number(data ?? 0) || 0;
  } catch {
    return 0;
  }
}
