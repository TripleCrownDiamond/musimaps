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
import { DEFAULT_BADGES, appliesToRole, computeBadges, parseBadges, satisfiesRule, syncGamification, type BadgeDef, type BadgeState, type EarnedBadge } from '@musimaps/shared';
import {
  checkin,
  fetchBookings,
  fetchFollowing,
  getSessionProfile,
  mergeLocalFavorites,
  toggleFavorite as sharedToggleFavorite,
  updateProfile,
} from '@musimaps/shared';
import { supabase } from '../lib/supabase';

const FAVORITES_KEY = 'musimaps.mobile.favorites';
const PROFILE_KEY = 'musimaps.mobile.profile';
const VISITED_CITIES_KEY = 'musimaps.mobile.visited-cities';
const BADGES_KEY = 'musimaps.mobile.badges';
const DEVICE_KEY = 'musimaps.mobile.device-id';

export interface LocalProfile {
  displayName: string;
  city: string;
  country: string;
  district: string;
  bio: string;
  favoriteGenres: string[];
}

type ArtistApplication = Required<
  Pick<WaitlistEntry, 'artistName' | 'email' | 'city' | 'genre' | 'link'>
> & {
  userId?: string;
  country?: string;
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
  toast: {
    id: number;
    message: string;
    icon?: string;
    tone?: 'success' | 'error';
    action?: { label: string; onPress: () => void };
    durationMs?: number;
  } | null;
  showToast: (
    message: string,
    icon?: string,
    tone?: 'success' | 'error',
    options?: { action?: { label: string; onPress: () => void }; durationMs?: number },
  ) => void;
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
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    icon?: string;
    tone?: 'success' | 'error';
    action?: { label: string; onPress: () => void };
    durationMs?: number;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  /** Catalogue actif : publié par le CMS (site_content, clé 'badges'), sinon défauts. */
  const [badgeDefs, setBadgeDefs] = useState<BadgeDef[]>(DEFAULT_BADGES);
  const loadedRef = useRef(false);
  const firstAwardRef = useRef(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Un compte est connecté : les favoris passent par Supabase, pas AsyncStorage. */
  const [signedIn, setSignedIn] = useState(false);
  /** ID Supabase du compte connecté (UUID). Utilisé comme userKey pour
   *  la synchro gamification — même compte sur web et mobile écrit la
   *  même ligne en base. */
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  /** Rôle du compte connecté ('artist' | 'melomane'). Utilisé pour la
   *  gamification : les artistes débloquent les badges artistes, les
   *  mélomanes les badges audience. Synchronisé avec le web. */
  const [userRole, setUserRole] = useState<'artist' | 'melomane'>('melomane');
  /** Rôle gamification : mappe 'melomane' → 'audience' (BadgeState.role). */
  const gamRole = userRole === 'artist' ? 'artist' as const : 'audience' as const;
  // Métriques gamification partagées web + mobile.
  // Récupérées depuis Supabase quand le compte est connecté, pour
  // que les badges (streak, following, bookings…) soient identiques
  // sur les deux plateformes.
  const [streakCount, setStreakCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);

  // Synchronisation des favoris avec le compte.
  //
  // `AppProvider` enveloppe `AuthProvider` (App.tsx) : on ne peut pas lire le
  // contexte d'authentification ici, on écoute donc Supabase directement.
  // À la connexion, les favoris posés hors ligne sont repris dans le compte,
  // puis le cache local est vidé — sans quoi ils seraient réinjectés dans le
  // compte suivant qui se connecterait sur le même appareil.
  useEffect(() => {
    let cancelled = false;

    const sync = async (hasSession: boolean, userId?: string) => {
      if (cancelled) return;
      setSignedIn(hasSession);
      setAuthUserId(userId ?? null);
      if (!hasSession) {
        // Déconnexion : reset des métriques partagées.
        setStreakCount(0);
        setFollowingCount(0);
        setBookingsCount(0);
        return;
      }
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      const local: string[] = raw ? JSON.parse(raw) : [];
      const merged = await mergeLocalFavorites(local);
      if (cancelled) return;
      setFavorites(merged);
      if (local.length > 0) await AsyncStorage.removeItem(FAVORITES_KEY);

      // Profil : le COMPTE fait autorité. `saveProfile` poussait déjà le
      // profil local vers le compte, mais rien ne faisait le chemin inverse —
      // après une inscription, l'app redemandait un nom et une ville que
      // l'utilisateur venait de saisir.
      const account = await getSessionProfile();
      if (cancelled || !account) return;
      setUserRole(account.role);
      setProfile((current) => {
        const next: LocalProfile = {
          displayName: account.displayName ?? current?.displayName ?? '',
          city: account.city ?? current?.city ?? '',
          country: account.country ?? current?.country ?? '',
          district: account.district ?? current?.district ?? '',
          // La bio ne vit que sur l'appareil : le compte ne la porte pas, on
          // ne l'écrase donc jamais avec du vide.
          bio: current?.bio ?? '',
          favoriteGenres: account.favoriteGenres?.length
            ? account.favoriteGenres
            : (current?.favoriteGenres ?? []),
        };
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    };

    void supabase?.auth.getSession().then(({ data }) => {
      void sync(Boolean(data.session), data.session?.user?.id);
    });
    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      void sync(Boolean(session), session?.user?.id);
    });

    return () => {
      cancelled = true;
      listener?.data.subscription.unsubscribe();
    };
  }, []);

  // Métriques gamification partagées : streak, following, bookings.
  // Mêmes appels RPC que le web (Dashboard.tsx) — garantit que les badges
  // débloqués sont identiques quel que soit le terminal utilisé.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const load = async () => {
      const [streakInfo, followIds, bookings] = await Promise.all([
        checkin().catch(() => null),
        fetchFollowing().catch(() => [] as string[]),
        fetchBookings().catch(() => [] as Awaited<ReturnType<typeof fetchBookings>>),
      ]);
      if (cancelled) return;
      setStreakCount(streakInfo?.current ?? 0);
      setFollowingCount(followIds.length);
      setBookingsCount(bookings.length);
    };
    void load();
    return () => { cancelled = true; };
  }, [signedIn]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(FAVORITES_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(VISITED_CITIES_KEY),
      AsyncStorage.getItem(BADGES_KEY),
    ])
      .then(([savedFavorites, savedProfile, savedCities, savedBadges]) => {
        // Affichage immédiat depuis le cache local ; dès qu'un compte est
        // connecté, l'effet de synchronisation ci-dessous fait autorité.
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
      country: (nextProfile.country ?? '').trim(),
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
      country: normalized.country,
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

  const toggleFavorite = useCallback(
    async (artistId: string) => {
      // Connecté : la table `favorites` fait autorité, comme sur le web —
      // un artiste sauvé ici apparaît sur l'autre plateforme.
      if (signedIn) {
        const result = await sharedToggleFavorite(artistId);
        if (!result.ok) return;
        setFavorites((current) =>
          result.liked
            ? current.includes(artistId)
              ? current
              : [...current, artistId]
            : current.filter((id) => id !== artistId),
        );
        return;
      }
      // Déconnecté : cache local, repris en base à la prochaine connexion.
      setFavorites((current) => {
        const next = current.includes(artistId)
          ? current.filter((id) => id !== artistId)
          : [...current, artistId];
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [signedIn],
  );

  const applyAsArtist = useCallback(async (application: ArtistApplication) => {
    if (!supabase) return 'Supabase n\'est pas configuré. La demande n\'a pas pu être envoyée.';
    const enriched = {
      email: application.email.trim(),
      profile: 'artiste',
      artist_name: application.artistName.trim(),
      city: application.city.trim(),
      country: application.country?.trim() || null,
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
    if (error && /bio|photo|spotify|youtube|instagram|user_id|country/i.test(error.message)) {
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
  // ⚠️ La gamification est réservée aux comptes connectés : sans
  // authentification, les badges ne se déclenchent pas (ni le toast, ni
  // la sync Supabase). Les villes visitées et favoris restent enregistrés
  // localement pour être repris à l'inscription.
  //
  // Les métriques streak, following, bookings sont les MÊMES que celles du
  // web (Dashboard.tsx) : même appel RPC, même clé de synchro (user.id).
  // Les badges débloqués sont donc identiques sur les deux plateformes.
  useEffect(() => {
    if (!loadedRef.current || !signedIn) return;
    const conditions: BadgeState = {
      role: gamRole,
      cities: visitedCities.length,
      favorites: favorites.length,
      hasProfile: profile !== null,
      streak: streakCount,
      following: followingCount,
      bookingsSent: bookingsCount,
    };
    const applicable = badgeDefs.filter((badge) => appliesToRole(badge, conditions.role));
    const earnedIds = earnedBadges.map((badge) => badge.id);
    const nextEarned = applicable
      .filter((badge) => satisfiesRule(badge.condition, conditions))
      .map((badge) => badge.id);
    const newlyEarned = applicable.filter(
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
  }, [signedIn, gamRole, visitedCities, favorites, profile, streakCount, followingCount, bookingsCount, earnedBadges, badgeDefs]);

  const clearLastEarnedBadge = useCallback(() => setLastEarnedBadge(null), []);

  const showToast = useCallback((
    message: string,
    icon?: string,
    tone: 'success' | 'error' = 'success',
    options?: { action?: { label: string; onPress: () => void }; durationMs?: number },
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({
      id: Date.now(),
      message,
      icon,
      tone,
      action: options?.action,
      durationMs: options?.durationMs,
    });
    const duration = options?.durationMs ?? 2500;
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
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

  // Synchro vers Supabase (table gamification) pour le dashboard admin.
  // Uniquement pour les comptes connectés — l'écriture anonyme par deviceId
  // est supprimée : les grades ne vivent que pour un compte authentifié.
  // Les métriques sont les mêmes que le web pour que la ligne en base
  // soit unique et complète.
  useEffect(() => {
    const client = supabase;
    if (!client || !loadedRef.current || !signedIn) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      void syncGamification({
        userKey: authUserId ?? deviceId ?? 'unknown',
        displayName: profile?.displayName ?? null,
        badges: computeBadges(badgeDefs, {
          role: gamRole,
          cities: visitedCities.length,
          favorites: favorites.length,
          hasProfile: profile !== null,
          streak: streakCount,
          following: followingCount,
          bookingsSent: bookingsCount,
        }),
        cities: visitedCities.length,
        favorites: favorites.length,
        earnedAt: Object.fromEntries(earnedBadges.map((b) => [b.id, b.earnedAt])),
      });
    }, 900);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [signedIn, gamRole, authUserId, deviceId, points, earnedBadges, profile, visitedCities, favorites, streakCount, followingCount, bookingsCount]);

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
