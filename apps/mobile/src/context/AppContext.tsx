import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WaitlistEntry } from '@musimaps/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { DEFAULT_BADGES, getLevelInfo, parseBadges, satisfiesRule, type BadgeDef, type EarnedBadge } from '../gamification';
import { updateProfile } from '@musimaps/shared';
import { supabase } from '../lib/supabase';

const FAVORITES_KEY = 'musimaps.mobile.favorites';
const PROFILE_KEY = 'musimaps.mobile.profile';
const VISITED_CITIES_KEY = 'musimaps.mobile.visited-cities';
const BADGES_KEY = 'musimaps.mobile.badges';
const DEVICE_KEY = 'musimaps.mobile.device-id';

export interface LocalProfile {
  displayName: string;
  city: string;
  district: string;
  bio: string;
  favoriteGenres: string[];
}

type ArtistApplication = Required<
  Pick<WaitlistEntry, 'artistName' | 'email' | 'city' | 'genre' | 'link'>
> & {
  userId?: string;
  bio?: string;
  district?: string;
  spotify?: string;
  youtube?: string;
  instagram?: string;
};

interface AppContextValue {
  profile: LocalProfile | null;
  favorites: string[];
  visitedCities: string[];
  /** Clé d'appareil anonyme et stable (vues artistes, sync gamification). */
  deviceId: string | null;
  badges: (BadgeDef & { earned: boolean })[];
  /** Badges débloqués avec leur date d'obtention (historique, du plus récent au plus ancien). */
  earnedBadges: EarnedBadge[];
  points: number;
  lastEarnedBadge: BadgeDef | null;
  clearLastEarnedBadge: () => void;
  /** Toast générique (message + icône Ionicons + ton succès/erreur), auto-fermeture 2,5 s. */
  toast: { id: number; message: string; icon?: string; tone?: 'success' | 'error' } | null;
  showToast: (message: string, icon?: string, tone?: 'success' | 'error') => void;
  saveProfile: (profile: LocalProfile) => Promise<void>;
  deleteProfile: () => Promise<void>;
  recordCityVisit: (city: string) => Promise<void>;
  toggleFavorite: (artistId: string) => Promise<void>;
  applyAsArtist: (application: ArtistApplication) => Promise<string | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [visitedCities, setVisitedCities] = useState<string[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [lastEarnedBadge, setLastEarnedBadge] = useState<BadgeDef | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; icon?: string; tone?: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  /** Catalogue actif : publié par le CMS (site_content, clé 'badges'), sinon défauts. */
  const [badgeDefs, setBadgeDefs] = useState<BadgeDef[]>(DEFAULT_BADGES);
  const loadedRef = useRef(false);
  const firstAwardRef = useRef(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(FAVORITES_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(VISITED_CITIES_KEY),
      AsyncStorage.getItem(BADGES_KEY),
    ])
      .then(([savedFavorites, savedProfile, savedCities, savedBadges]) => {
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        if (savedProfile) setProfile(JSON.parse(savedProfile));
        if (savedCities) setVisitedCities(JSON.parse(savedCities));
        if (savedBadges) {
          const parsed: unknown = JSON.parse(savedBadges);
          // Compatibilité : l'ancien format était un simple tableau d'ids.
          if (Array.isArray(parsed)) {
            const migrated = parsed
              .map((item): EarnedBadge => {
                if (typeof item === 'string') return { id: item, earnedAt: Date.now() };
                const record = item as { id?: unknown; earnedAt?: unknown };
                return {
                  id: typeof record.id === 'string' ? record.id : '',
                  earnedAt: typeof record.earnedAt === 'number' ? record.earnedAt : Date.now(),
                };
              })
              .filter((item) => DEFAULT_BADGES.some((badge) => badge.id === item.id));
            setEarnedBadges(migrated);
            // Re-persiste la forme migrée (avec dates) si le stockage était au format ancien
            // (un simple tableau d'ids sans dates).
            if (parsed.some((raw) => typeof raw === 'string')) {
              AsyncStorage.setItem(BADGES_KEY, JSON.stringify(migrated)).catch(() => {});
            }
          }
        }
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });

    // Clé d'appareil stable pour la synchro anonyme (dashboard admin).
    AsyncStorage.getItem(DEVICE_KEY)
      .then((existing) => {
        if (existing) {
          setDeviceId(existing);
        } else {
          const generated = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
          AsyncStorage.setItem(DEVICE_KEY, generated).catch(() => {});
          setDeviceId(generated);
        }
      })
      .catch(() => {});
  }, []);

  // Catalogue des badges piloté par le CMS : lit la version PUBLIÉE (vue
  // site_content_public, clé 'badges') et retombe sur les défauts sinon.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const loadBadges = async () => {
      try {
        const { data } = await client
          .from('site_content_public')
          .select('key, content')
          .eq('key', 'badges')
          .maybeSingle();
        const parsed = parseBadges(data?.content);
        if (parsed) setBadgeDefs(parsed);
      } catch {
        /* hors-ligne : on garde le catalogue par défaut */
      }
    };
    void loadBadges();
  }, []);

  const saveProfile = useCallback(async (nextProfile: LocalProfile) => {
    const normalized = {
      ...nextProfile,
      displayName: nextProfile.displayName.trim(),
      city: nextProfile.city.trim(),
      // Profils stockés avant la migration « district » : repli sur chaîne vide.
      district: (nextProfile.district ?? '').trim(),
      bio: nextProfile.bio.trim(),
      favoriteGenres: nextProfile.favoriteGenres.map((genre) => genre.trim()).filter(Boolean),
    };
    setProfile(normalized);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
    // Sync vers le compte Supabase (mêmes données que le web) : le profil
    // persiste sur le compte, pas seulement sur l'appareil.
    void updateProfile({
      displayName: normalized.displayName,
      city: normalized.city,
      district: normalized.district,
      bio: normalized.bio,
      favoriteGenres: normalized.favoriteGenres,
    });
  }, []);

  const deleteProfile = useCallback(async () => {
    setProfile(null);
    setFavorites([]);
    setVisitedCities([]);
    await AsyncStorage.multiRemove([PROFILE_KEY, FAVORITES_KEY, VISITED_CITIES_KEY]);
  }, []);

  const recordCityVisit = useCallback(async (city: string) => {
    const normalized = city.trim();
    if (!normalized) return;
    setVisitedCities((current) => {
      if (current.includes(normalized)) return current;
      const next = [normalized, ...current].slice(0, 30);
      AsyncStorage.setItem(VISITED_CITIES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(async (artistId: string) => {
    setFavorites((current) => {
      const next = current.includes(artistId)
        ? current.filter((id) => id !== artistId)
        : [...current, artistId];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const applyAsArtist = useCallback(async (application: ArtistApplication) => {
    if (!supabase) return 'Supabase n’est pas configuré. La demande n’a pas pu être envoyée.';
    const enriched = {
      email: application.email.trim(),
      profile: 'artiste',
      artist_name: application.artistName.trim(),
      city: application.city.trim(),
      district: application.district?.trim() || null,
      genre: application.genre.trim(),
      link: application.link.trim(),
      bio: application.bio?.trim() || null,
      spotify: application.spotify?.trim() || null,
      youtube: application.youtube?.trim() || null,
      instagram: application.instagram?.trim() || null,
      user_id: application.userId ?? null,
    };
    const { error } = await supabase.from('waitlist').upsert(enriched, { onConflict: 'email' });
    // Colonnes bio/photo/liens absentes (migration 00021 pas encore appliquée) :
    // on retombe sur l'upsert historique pour ne jamais perdre la waitlist.
    if (error && /bio|photo|spotify|youtube|instagram|user_id/i.test(error.message)) {
      const retry = await supabase.from('waitlist').upsert(
        {
          email: application.email.trim(),
          profile: 'artiste',
          artist_name: application.artistName.trim(),
          city: application.city.trim(),
          district: application.district?.trim() || null,
          genre: application.genre.trim(),
          link: application.link.trim(),
        },
        { onConflict: 'email' },
      );
      return retry.error?.message ?? null;
    }
    return error?.message ?? null;
  }, []);

  // Gamification : calcule les badges à débloquer dès que l'état évolue.
  useEffect(() => {
    if (!loadedRef.current) return;
    const conditions = {
      visitedCitiesCount: visitedCities.length,
      favoritesCount: favorites.length,
      hasProfile: profile !== null,
    };
    const earnedIds = earnedBadges.map((badge) => badge.id);
    const nextEarned = badgeDefs
      .filter((badge) => satisfiesRule(badge.condition, conditions))
      .map((badge) => badge.id);
    const newlyEarned = badgeDefs.filter(
      (badge) => satisfiesRule(badge.condition, conditions) && !earnedIds.includes(badge.id),
    );
    // Pas de toast rétroactif au chargement initial (badges déjà mérités).
    if (newlyEarned.length > 0 && !firstAwardRef.current) {
      setLastEarnedBadge(newlyEarned.reduce((a, b) => (b.points > a.points ? b : a)));
    }
    firstAwardRef.current = false;
    const changed =
      nextEarned.length !== earnedIds.length ||
      nextEarned.some((id) => !earnedIds.includes(id));
    if (changed) {
      const now = Date.now();
      const next = nextEarned.map((id) => {
        const existing = earnedBadges.find((badge) => badge.id === id);
        return existing ? existing : { id, earnedAt: now };
      });
      setEarnedBadges(next);
      AsyncStorage.setItem(BADGES_KEY, JSON.stringify(next)).catch(() => {});
    }
  }, [visitedCities, favorites, profile, earnedBadges, badgeDefs]);

  const clearLastEarnedBadge = useCallback(() => setLastEarnedBadge(null), []);

  const showToast = useCallback((message: string, icon?: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), message, icon, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const points = useMemo(
    () =>
      earnedBadges.reduce(
        (sum, badge) => sum + (badgeDefs.find((item) => item.id === badge.id)?.points ?? 0),
        0,
      ),
    [earnedBadges, badgeDefs],
  );

  const badges = useMemo(
    () =>
      badgeDefs.map((badge) => ({
        ...badge,
        earned: earnedBadges.some((item) => item.id === badge.id),
      })),
    [earnedBadges, badgeDefs],
  );

  // Synchro anonyme vers Supabase (table gamification) pour le dashboard admin.
  // Debounce court : on n'écrit que quand la gamification se stabilise.
  useEffect(() => {
    const client = supabase;
    if (!client || !deviceId || !loadedRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const levelInfo = getLevelInfo(points);
      client
        .from('gamification')
        .upsert(
          {
            user_key: deviceId,
            display_name: profile?.displayName ?? null,
            points,
            level: levelInfo.level,
            level_title: levelInfo.title,
            badges: earnedBadges,
            badge_count: earnedBadges.length,
            visited_cities: visitedCities.length,
            favorites: favorites.length,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_key' },
        )
        .then(() => {}, () => {});
    }, 900);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [deviceId, points, earnedBadges, profile, visitedCities, favorites]);

  const value = useMemo(
    () => ({
      profile,
      favorites,
      visitedCities,
      badges,
      earnedBadges,
      points,
      lastEarnedBadge,
      clearLastEarnedBadge,
      toast,
      showToast,
      saveProfile,
      deleteProfile,
      recordCityVisit,
      toggleFavorite,
      applyAsArtist,
      deviceId,
    }),
    [
      profile,
      favorites,
      visitedCities,
      badges,
      earnedBadges,
      points,
      lastEarnedBadge,
      clearLastEarnedBadge,
      toast,
      showToast,
      saveProfile,
      deleteProfile,
      deviceId,
      recordCityVisit,
      toggleFavorite,
      applyAsArtist,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
