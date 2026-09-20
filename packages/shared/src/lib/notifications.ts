/**
 * Notifications — partagé web + mobile.
 *
 * Le client Supabase est injecté via `configureRuntime` : aucun import de
 * plateforme ici. Toutes les fonctions dégradent en silence quand Supabase
 * n'est pas configuré — une notification ne doit jamais bloquer un écran.
 */
import { getSupabase } from '../runtime';
import { translate } from '../i18n';
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
  /** Clé de dédoublonnage d'une alerte personnelle (ex. identifiant du badge). */
  ref?: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Durée relative localisée, partagée par les listes web et mobile.
 *
 * Sans `Intl.RelativeTimeFormat` : Hermes (moteur JS du mobile Android) ne
 * l'implémente pas, et la liste native plantait l'app dès qu'elle contenait
 * une seule notification. Les libellés viennent des clés i18n, identiques sur
 * les deux surfaces.
 */
export function formatNotificationTime(iso: string, lang: 'fr' | 'en', now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return translate(lang, 'time.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translate(lang, 'time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(lang, 'time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return translate(lang, 'time.yesterday');
  if (days < 7) return translate(lang, 'time.daysAgo', { n: days });
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

/** Où mène une notification ouverte — même règle sur le web et le mobile. */
export type NotificationDestination =
  | { kind: 'artist'; artistId: string }
  /** Artiste le plus proche de l'appareil, navigation par flèches dans la zone. */
  | { kind: 'nearby' }
  | { kind: 'achievement'; badgeId: string }
  /** Tous les accomplissements (niveau, badges, série). */
  | { kind: 'achievements' }
  | { kind: 'globe' };

/**
 * Destination d'une notification.
 *
 * Toute alerte sans artiste ouvrait le globe centré sur la position : « des
 * artistes près de vous » ne montrait aucun artiste, et un badge débloqué
 * renvoyait sur la carte. Une alerte de proximité mène désormais à l'artiste
 * le plus proche ; un badge, à sa fiche ; une série, aux accomplissements.
 */
export function notificationDestination(
  item: Pick<AppNotification, 'type' | 'artist_id' | 'ref'>,
): NotificationDestination {
  if (item.type === 'achievement') {
    return item.ref ? { kind: 'achievement', badgeId: item.ref } : { kind: 'achievements' };
  }
  if (item.type === 'streak') return { kind: 'achievements' };
  if (item.artist_id) return { kind: 'artist', artistId: item.artist_id };
  if (item.type === 'nearby') return { kind: 'nearby' };
  return { kind: 'globe' };
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
 * Supprime une notification du compte connecté (politique RLS
 * notifications_delete_own, migration 00064). Renvoie `false` si rien n'a été
 * supprimé : sans politique DELETE, la base ignore la demande sans erreur, et
 * l'écran doit alors rétablir la ligne retirée par anticipation.
 */
export async function deleteNotification(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from('notifications').delete().eq('id', id).select('id');
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Vide l'historique du compte connecté (la RLS limite aux lignes du compte). */
export async function deleteAllNotifications(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    // PostgREST refuse un DELETE sans filtre : « id non nul » couvre toutes les
    // lignes visibles, c'est-à-dire celles du compte.
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .not('id', 'is', null)
      .select('id');
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Inscrit un badge débloqué dans l'historique du compte connecté (RPC
 * notify_self, migration 00064). Dédoublonné par la base : un badge n'y
 * apparaît qu'une fois, même débloqué sur le web puis le mobile.
 * Fire-and-forget.
 */
export async function notifyAchievement(badgeId: string, message: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.rpc('notify_self', { p_type: 'achievement', p_ref: badgeId, p_message: message });
  } catch {
    /* silencieux : l'historique ne bloque jamais le toast */
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
