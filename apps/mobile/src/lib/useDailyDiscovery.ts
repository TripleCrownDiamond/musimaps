import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { countryByName, DAILY_DISCOVERY_HOUR, DAILY_PROMPT_DELAY_MS, type Artist, type MapLocation } from '@musimaps/shared';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { enableDaily, markDailyAsked, refreshDailyDiscoveries, shouldAskDaily } from './dailyDiscovery';

/**
 * Artiste du jour depuis la carte : reprogramme les notifications dès que
 * les artistes (et la position) sont connus, et propose une fois la
 * fonction après un moment d'exploration — jamais au premier lancement.
 *
 * Sans position, on part de la ville du profil (premier artiste de cette
 * ville sur la carte), sinon de toute la carte.
 */
export function useDailyDiscovery(artists: Artist[], location: MapLocation | null) {
  const { favorites, showToast } = useApp();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const asked = useRef(false);

  const origin = (() => {
    if (location) return { coordinates: location.coordinates, countryCode: location.countryCode ?? null };
    const city = user?.city?.trim().toLowerCase();
    const anchor = city ? artists.find((artist) => artist.city.trim().toLowerCase() === city) : undefined;
    if (!anchor) return null;
    const country = user?.country ?? '';
    return { coordinates: anchor.coordinates, countryCode: country.length === 2 ? country : countryByName(country)?.code ?? null };
  })();
  const originKey = origin ? origin.coordinates.join(',') : 'none';

  useEffect(() => {
    if (artists.length === 0) return;
    void refreshDailyDiscoveries({ artists, origin, exclude: favorites, lang }).catch(() => undefined);
    // origin est recalculé à chaque rendu : on suit sa clé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists, originKey, favorites, lang]);

  useEffect(() => {
    if (artists.length === 0 || asked.current) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void shouldAskDaily().then((ask) => {
        if (cancelled || !ask) return;
        asked.current = true;
        Alert.alert(t('daily.promptTitle'), t('daily.promptText', { hour: DAILY_DISCOVERY_HOUR }), [
          { text: t('daily.promptLater'), style: 'cancel', onPress: () => void markDailyAsked() },
          {
            text: t('daily.promptYes'),
            onPress: () => {
              void enableDaily(lang).then((result) => {
                if (result === 'denied') return showToast(t('daily.permissionDenied'), 'notifications-off-outline', 'error');
                showToast(t('daily.enabled', { hour: DAILY_DISCOVERY_HOUR }), 'notifications-outline');
                void refreshDailyDiscoveries({ artists, origin, exclude: favorites, lang });
              });
            },
          },
        ]);
      });
    }, DAILY_PROMPT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Une seule proposition par session, déclenchée quand la carte est prête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists.length > 0]);
}
