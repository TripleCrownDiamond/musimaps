import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  DAILY_DISCOVERY_MEMORY,
  dayKeyOf,
  displayGenre,
  nextDailySlots,
  pickDailyArtists,
  translate,
  type Artist,
  type Lang,
} from '@musimaps/shared';

/**
 * « Votre artiste du jour » — notifications LOCALES programmées sur le
 * téléphone : chaque ouverture de l'app reprogramme les prochains jours avec
 * des artistes proches (choix dans `@musimaps/shared/lib/dailyDiscovery`).
 * Ni serveur ni jeton de push : la position ne quitte pas l'appareil.
 */

const ENABLED_KEY = 'musimaps.dailyDiscovery.enabled';
const ASKED_KEY = 'musimaps.dailyDiscovery.asked';
/** Programmation en cours : `{ id, at }` — sert à mémoriser ce qui a été proposé. */
const SCHEDULED_KEY = 'musimaps.dailyDiscovery.scheduled';
/** Artistes déjà proposés (les plus récents en tête). */
const NOTIFIED_KEY = 'musimaps.dailyDiscovery.notified';
const CHANNEL_ID = 'daily-discovery';
/** Marque des notifications de cette fonction (données de la notification). */
export const DAILY_NOTIFICATION_KIND = 'daily-discovery';

type Scheduled = { id: string; at: number };

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function isDailyEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY).catch(() => null)) === '1';
}

/** Vrai tant que la question n'a jamais été posée et que la fonction est coupée. */
export async function shouldAskDaily(): Promise<boolean> {
  const [asked, enabled] = await Promise.all([AsyncStorage.getItem(ASKED_KEY).catch(() => '1'), isDailyEnabled()]);
  return !asked && !enabled;
}

export async function markDailyAsked(): Promise<void> {
  await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => undefined);
}

/** Active la fonction : demande l'autorisation système si besoin. */
export async function enableDaily(lang: Lang): Promise<'granted' | 'denied'> {
  await markDailyAsked();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: translate(lang, 'daily.channel'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return 'denied';
  await AsyncStorage.setItem(ENABLED_KEY, '1');
  return 'granted';
}

async function cancelDailyNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === DAILY_NOTIFICATION_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function disableDaily(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, '0');
  await cancelDailyNotifications();
  await AsyncStorage.removeItem(SCHEDULED_KEY).catch(() => undefined);
}

/**
 * Reprogramme les prochains jours. À appeler quand la carte a chargé ses
 * artistes (et la position si on l'a) : sans effet si la fonction est
 * coupée ou l'autorisation retirée dans les réglages.
 */
export async function refreshDailyDiscoveries(params: {
  artists: Artist[];
  origin: { coordinates: [number, number]; countryCode?: string | null } | null;
  exclude: string[];
  lang: Lang;
}): Promise<void> {
  if (params.artists.length === 0 || !(await isDailyEnabled())) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  // Ce qui a déjà été montré rejoint la mémoire, pour ne pas le reproposer.
  const now = Date.now();
  const [previous, notified] = await Promise.all([
    readJson<Scheduled[]>(SCHEDULED_KEY, []),
    readJson<string[]>(NOTIFIED_KEY, []),
  ]);
  const shown = previous.filter((item) => item.at <= now).map((item) => item.id);
  const memory = [...shown, ...notified.filter((id) => !shown.includes(id))].slice(0, DAILY_DISCOVERY_MEMORY);

  const slots = nextDailySlots(new Date(now));
  const picks = pickDailyArtists(params.artists, params.origin, {
    exclude: [...params.exclude, ...memory],
    count: slots.length,
    dayKey: dayKeyOf(new Date(now)),
  });

  await cancelDailyNotifications();
  const plan: Scheduled[] = [];
  for (const [index, artist] of picks.entries()) {
    const at = slots[index];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: translate(params.lang, 'daily.notifTitle'),
        body: translate(params.lang, 'daily.notifBody', {
          name: artist.name,
          genre: displayGenre(artist.genre, translate(params.lang, 'common.unknown')),
          city: artist.city,
        }),
        data: { kind: DAILY_NOTIFICATION_KIND, artistId: artist.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
    plan.push({ id: artist.id, at: at.getTime() });
  }
  await AsyncStorage.multiSet([
    [SCHEDULED_KEY, JSON.stringify(plan)],
    [NOTIFIED_KEY, JSON.stringify(memory)],
  ]).catch(() => undefined);
}
