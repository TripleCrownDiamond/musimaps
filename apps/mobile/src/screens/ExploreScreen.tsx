import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cities,
  compactCount,
  countryByName,
  flagFor,
  geoCountryOf,
  parseFollowersCount,
  popularityTier,
  POPULARITY_RING_COLORS,
  type Artist,
} from '@musimaps/shared';
import { Pause, Play } from 'lucide-react-native';
import { AppBar } from '../components/AppBar';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { ArtistSheet } from '../components/ArtistSheet';
import { PlacePanel, type PlacePanelData } from '../components/PlacePanel';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import {
  addMapArtist,
  addOrUpdateMapArtist,
  fetchMapArtists,
  locateArtist,
  searchArtistOnline,
  searchNeighborhoods,
  toArtist,
  type DiscoveredArtist,
  type NeighborhoodSuggestion,
} from '../lib/discovery';
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
} from '../lib/searchHistory';
import { fetchAllArtistPopularity, recordPinView } from '../lib/stats';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { dockStyle, fonts, shadow, type AppColors } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Explore'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const HAS_MAPBOX = Boolean(MAPBOX_TOKEN?.startsWith('pk.'));
const GLOBE_CENTER: [number, number] = [2.4, 8];
const GLOBE_ZOOM = 0.75; // aligné sur le globe web
// Hauteur de l'AppBar partagée + écart avant la search (offset sous la topbar).
const APPBAR_HEIGHT = 56;
const APPBAR_GAP = 12;
/** Seuil de repli de la recherche en icône (comme le web : zoom ≥ 3.2). */
const SEARCH_COLLAPSE_ZOOM = 3.2;
/** Seuil de regroupement local : ~2,2 km (0,02°). */
const SPREAD_BUCKET = 0.02;

const norm = (value: string | null | undefined) =>
  (value ?? '')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Distance approximative en km entre deux points (haversine). */
function distanceKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const isValidCoordinate = (c: [number, number]) =>
  Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]);

const bucketKey = (c: [number, number]) =>
  `${Math.round(c[0] / SPREAD_BUCKET)}|${Math.round(c[1] / SPREAD_BUCKET)}`;

/** Écarte les pins empilés (même point géocodé) en spirale déterministe. */
function declump(items: Artist[], zoom: number): Map<string, [number, number]> {
  const groups = new Map<string, Artist[]>();
  for (const artist of items) {
    if (!isValidCoordinate(artist.coordinates)) continue;
    const key = bucketKey(artist.coordinates);
    const group = groups.get(key);
    if (group) group.push(artist);
    else groups.set(key, [artist]);
  }
  const out = new Map<string, [number, number]>();
  const golden = 2.399963229728653;
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.set(group[0].id, group[0].coordinates);
      continue;
    }
    group.sort((a, b) => a.name.localeCompare(b.name));
    const cLng = group.reduce((s, a) => s + a.coordinates[0], 0) / group.length;
    const cLat = group.reduce((s, a) => s + a.coordinates[1], 0) / group.length;
    // Facteur d'écartement : 1 à z9, ~1,9 à z16 — les pins se détachent au
    // zoom quartier sans déformer la vraie zone géographique en vue large.
    const spreadFactor = Math.min(1.9, Math.max(1, 1 + (zoom - 9) * 0.13));
    group.forEach((artist, i) => {
      const angle = i * golden;
      const radius = (0.012 + 0.007 * Math.sqrt(i)) * spreadFactor;
      out.set(artist.id, [
        cLng + Math.cos(angle) * radius,
        Math.min(85, Math.max(-85, cLat + Math.sin(angle) * radius)),
      ]);
    });
  }
  return out;
}

/** Niveau de popularité d'un artiste (score réel sinon followers parsés). */
function tierOf(artist: Artist, popularityById?: Map<string, number>): number {
  const real = popularityById?.get(artist.id);
  const count = real && real > 0 ? real : parseFollowersCount(artist.followers) ?? 0;
  return popularityTier(count);
}

/** Couleur hex → rgba (halo lumineux des pins, parité web). */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return hex;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Couleur du pin par DENSITÉ (tier) : fond + halo, parité web. */
function tierColor(tier: number): string {
  return POPULARITY_RING_COLORS[tier as 0 | 1 | 2 | 3];
}

/** Regroupe des artistes par clé (pays ou ville) et calcule le barycentre. */
function clusterBy(
  artists: Artist[],
  keyOf: (a: Artist) => string,
): Array<{ key: string; label: string; flag: string; count: number; coordinates: [number, number] }> {
  const map = new Map<string, { label: string; flag: string; count: number; lng: number; lat: number }>();
  for (const artist of artists) {
    if (!isValidCoordinate(artist.coordinates)) continue;
    const key = keyOf(artist) || 'unknown';
    const current = map.get(key);
    if (current) {
      current.count += 1;
      current.lng += artist.coordinates[0];
      current.lat += artist.coordinates[1];
    } else {
      map.set(key, {
        label: key === 'unknown' ? '' : key,
        flag: artist.flag,
        count: 1,
        lng: artist.coordinates[0],
        lat: artist.coordinates[1],
      });
    }
  }
  return [...map.entries()].map(([key, c]) => ({
    key,
    label: c.label,
    flag: c.flag,
    count: c.count,
    coordinates: [c.lng / c.count, c.lat / c.count] as [number, number],
  }));
}

type ClusterLevel = 'country' | 'city' | 'sub' | 'spread';
const levelFor = (z: number): ClusterLevel => {
  if (z < 3.2) return 'country';
  if (z < 6) return 'city';
  if (z < 9) return 'sub';
  return 'spread';
};

type Pin =
  | { key: string; kind: 'artist'; artist: Artist; coords: [number, number]; tier: number }
  | { key: string; kind: 'cluster'; label: string; flag: string; count: number; coords: [number, number]; zoomTo: number; variant?: 'sub'; members: Artist[]; tier: number; place?: Omit<PlacePanelData, 'artists'> };

type VisibleRegion = {
  properties: {
    bounds: { ne: number[]; sw: number[] };
    zoom: number;
  };
};

type PlaceResult = { city: string; country: string; flag: string; coordinates: [number, number]; count: number };
type CountryResult = { code: string; name: string; flag: string; coordinates: [number, number]; count: number };
type GenreResult = { genre: string; count: number };

if (HAS_MAPBOX) Mapbox.setAccessToken(MAPBOX_TOKEN!);

export function ExploreScreen({ navigation, route }: Props) {
  const { colors, theme } = useAppTheme();
  const { deviceId, recordCityVisit } = useApp();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, theme === 'dark'), [colors, theme]);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapViewRef = useRef<Mapbox.MapView>(null);
  const centerRef = useRef<[number, number]>(GLOBE_CENTER);

  // --- État (miroir de la page globe web) ---
  const [selected, setSelected] = useState<Artist | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlacePanelData | null>(null);
  const [placeIndex, setPlaceIndex] = useState(0);
  // Pin mis en évidence par la nav flèches de la mini-barre « lieu ».
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [spinning, setSpinning] = useState(true);
  const [mapZoom, setMapZoom] = useState(GLOBE_ZOOM);
  const [region, setRegion] = useState<{ east: number; north: number; west: number; south: number } | null>(null);
  const [visiblePins, setVisiblePins] = useState<Artist[]>([]);
  const [mapArtists, setMapArtists] = useState<Artist[]>([]);
  // Score de popularité (vues profil + pin) par artiste — anneaux des pins.
  const [popularityById, setPopularityById] = useState<Map<string, number>>(
    new Map(),
  );
  const [onlineResults, setOnlineResults] = useState<DiscoveredArtist[]>([]);
  const [searchingWeb, setSearchingWeb] = useState(false);
  // Quartiers / localités (Mapbox) pendant la saisie — comme le web.
  const [neighborhoodResults, setNeighborhoodResults] = useState<NeighborhoodSuggestion[]>([]);
  const [searchingNeighborhoods, setSearchingNeighborhoods] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [discoverCity, setDiscoverCity] = useState('');
  const [discoverGenre, setDiscoverGenre] = useState('');
  // Pin survolé (web) — affiche le nom comme sur le web. Sur natif (pas de
  // hover), le nom s'affiche en zoom quartier (z ≥ 12.5, pins détachés).
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isNative = Platform.OS !== 'web';
  // Web : un seul nom à la fois (celui du pin survolé). Natif : tous les noms
  // en zoom quartier (z ≥ 12.5, pins détachés), pas de survol tactile.
  const showPinNameFor = (key: string) => (isNative ? mapZoom >= 12.5 : hoveredId === key);

  // --- Localisation : le premier écran demande l'autorisation si nécessaire ---
  const [locState, setLocState] = useState<'checking' | 'granted' | 'denied' | 'skipped'>('checking');
  const [requesting, setRequesting] = useState(false);
  const locSkippedRef = useRef(false);
  /** Position à centrer une fois le globe monté (après autorisation). */
  const [pendingLoc, setPendingLoc] = useState<[number, number] | null>(null);

  const searchCollapsed = selected !== null || mapZoom >= SEARCH_COLLAPSE_ZOOM;

  // La fiche et le panneau ne coexistent pas (comme le web : ouvrir la
  // recherche referme la fiche, sinon les overlays se superposent).
  const openSearch = () => {
    setSelected(null);
    setSearchOpen(true);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  // Masque le dock pendant la fiche ou la recherche (le panneau occupe le bas).
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: selected || searchOpen ? { display: 'none' } : dockStyle(colors, insets.bottom + 22),
    });
  }, [selected, searchOpen, navigation, colors, insets.bottom]);

  // Charge les artistes de la carte (table partagée web + mobile) à chaque focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchMapArtists().then((rows) => {
        if (cancelled) return;
        setMapArtists(rows.map((row) => toArtist(row)));
      });
      void fetchAllArtistPopularity().then((map) => {
        if (!cancelled) setPopularityById(map);
      });
      return () => {
        cancelled = true;
      };
    },
    []),
  );

  // Autorisation de localisation : si non accordée, l'écran affiche la demande
  // (Autoriser / Explorer le globe) au lieu du globe. « Explorer le globe »
  // reste ignoré pour la session en cours.
  useFocusEffect(
    useCallback(() => {
      if (locSkippedRef.current) return;
      // Venu de l'écran Welcome (localisation déjà tranchée) : on saute la
      // demande d'autorisation — la carte s'affiche directement (et se centre
      // sur les coordonnées passées, si présentes).
      if (route.params?.skipLocation) {
        locSkippedRef.current = true;
        setLocState(route.params?.coordinates ? 'granted' : 'skipped');
        return;
      }
      let cancelled = false;
      void Location.getForegroundPermissionsAsync()
        .then((permission) => {
          if (cancelled) return;
          setLocState(permission.status === 'granted' ? 'granted' : 'denied');
        })
        .catch(() => {
          if (!cancelled) setLocState('denied');
        });
      return () => {
        cancelled = true;
      };
    }, [route.params?.skipLocation, route.params?.coordinates]),
  );

  // Source unique (comme le web) : tout pin du globe vit dans map_artists.
  const allArtists = useMemo(() => mapArtists, [mapArtists]);

  // --- Résultats typés (nom / lieux / pays / genres), miroir du web ---
  const artistResults = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const seen = new Set<string>();
    return allArtists.filter((a) => {
      if (seen.has(a.id)) return false;
      if (norm(a.name).includes(q)) {
        seen.add(a.id);
        return true;
      }
      return false;
    });
  }, [allArtists, query]);

  const placeResults = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const map = new Map<string, PlaceResult>();
    for (const a of allArtists) {
      if (!norm(`${a.city} ${a.country}`).includes(q)) continue;
      const key = `${norm(a.city)}·${norm(a.country)}`;
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { city: a.city, country: a.country, flag: a.flag, coordinates: a.coordinates, count: 1 });
    }
    return [...map.values()];
  }, [allArtists, query]);

  const countryResults = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const map = new Map<string, CountryResult>();
    for (const a of allArtists) {
      const code = (a.country ?? '').toUpperCase();
      if (!code) continue;
      const info = countryByName(code);
      const name = info ? info.en : a.country ?? '';
      const flag = info ? flagFor(code) : a.flag;
      const matches =
        norm(name).includes(q) ||
        code.includes(q.toUpperCase()) ||
        (info && (norm(info.fr).includes(q) || norm(info.en).includes(q)));
      if (!matches) continue;
      const current = map.get(code);
      if (current) current.count += 1;
      else map.set(code, { code, name, flag, coordinates: a.coordinates, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [allArtists, query]);

  const genreResults = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const map = new Map<string, GenreResult>();
    for (const a of allArtists) {
      if (!a.genre || !norm(a.genre).includes(q)) continue;
      const current = map.get(a.genre);
      map.set(a.genre, { genre: a.genre, count: (current?.count ?? 0) + 1 });
    }
    return [...map.values()];
  }, [allArtists, query]);

  /** Pins affichés en direct pendant la saisie (jamais « tous »). */
  const livePins = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const ids = new Set<string>();
    const out: Artist[] = [];
    const push = (a: Artist) => {
      if (ids.has(a.id)) return;
      ids.add(a.id);
      out.push(a);
    };
    for (const a of artistResults) push(a);
    for (const p of placeResults) {
      for (const a of allArtists) if (a.city === p.city && a.country === p.country) push(a);
    }
    for (const c of countryResults) {
      for (const a of allArtists) if ((a.country ?? '').toUpperCase() === c.code.toUpperCase()) push(a);
    }
    for (const g of genreResults) {
      for (const a of allArtists) if (a.genre === g.genre) push(a);
    }
    // Quartiers : les artistes situés à ≤ ~4,4 km du quartier.
    for (const n of neighborhoodResults) {
      for (const a of allArtists) {
        if (Math.abs(a.coordinates[0] - n.lng) <= 0.04 && Math.abs(a.coordinates[1] - n.lat) <= 0.04) {
          push(a);
        }
      }
    }
    return out;
  }, [query, artistResults, placeResults, countryResults, genreResults, neighborhoodResults, allArtists]);

  // Pendant la saisie : les pins correspondants apparaissent en direct.
  useEffect(() => {
    if (!searchOpen) return;
    if (query.trim()) setVisiblePins(livePins);
  }, [searchOpen, query, livePins]);

  // Recherche en ligne (Musibrainz) dès 2 caractères, comme le web.
  const knownNames = useMemo(
    () => new Set(allArtists.map((a) => a.name.trim().toLowerCase())),
    [allArtists],
  );
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOnlineResults([]);
      setSearchingWeb(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchingWeb(true);
      void searchArtistOnline(q, controller.signal).then((found) => {
        if (controller.signal.aborted) return;
        setOnlineResults(found.filter((r) => !knownNames.has(r.name.trim().toLowerCase())));
        setSearchingWeb(false);
      });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, knownNames]);

  // Quartiers / localités pendant la saisie (comme le web).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setNeighborhoodResults([]);
      setSearchingNeighborhoods(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchingNeighborhoods(true);
      void searchNeighborhoods(q, controller.signal).then((found) => {
        if (controller.signal.aborted) return;
        setNeighborhoodResults(found);
        setSearchingNeighborhoods(false);
      });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Historique au montage.
  useEffect(() => {
    void getSearchHistory().then(setHistory);
  }, []);

  const rememberQuery = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q) return;
    void addSearchHistory(q).then(setHistory);
  }, []);

  // Zoom courant dans une ref (le tick d'animation en dépend).
  const mapZoomRef = useRef(mapZoom);
  mapZoomRef.current = mapZoom;
  // Intervalle d'animation du zoom pendant un vol : il pilote mapZoom à
  // travers les seuils de cluster (pays → villes → groupes → pins) pour que
  // les clusters se scindent PROGRESSIVEMENT pendant l'animation. Fonctionne
  // sur toutes les plateformes (le preview web ne transmet pas les events
  // caméra du composant natif, mais l'animation locale si).
  const flyAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (flyAnimRef.current) clearInterval(flyAnimRef.current);
    };
  }, []);

  const flyTo = (coordinates: [number, number], zoomLevel: number, duration = 900) => {
    // Arrête la rotation immédiatement (clear synchrone de l'intervalle) :
    // sinon le prochain tick (120 ms) sauterait la caméra et annulerait le vol.
    stopSpinImmediate();
    // Interpole mapZoom de sa valeur courante vers la cible pendant la
    // durée du vol (easeOutCubic) : à chaque seuil franchi, le clustering
    // se met à jour et les clusters se scindent avec l'animation.
    if (flyAnimRef.current) clearInterval(flyAnimRef.current);
    const startZoom = mapZoomRef.current;
    const startTime = Date.now();
    flyAnimRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const z = startZoom + (zoomLevel - startZoom) * eased;
      setMapZoom((prev) => (Math.abs(prev - z) < 0.02 ? prev : z));
      if (t >= 1 && flyAnimRef.current) {
        clearInterval(flyAnimRef.current);
        flyAnimRef.current = null;
      }
    }, 60);
    cameraRef.current?.setCamera({
      centerCoordinate: coordinates,
      zoomLevel,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  };

  const resetView = () => {
    setSpinning(false);
    setSelected(null);
    setSelectedPlace(null);
    setPlaceIndex(0);
    setHighlightedId(null);
    setVisiblePins([]);
    flyTo(GLOBE_CENTER, GLOBE_ZOOM, 900);
  };

  // Demande l'autorisation de localisation, puis révèle les artistes locaux.
  const authorizeLocation = useCallback(async () => {
    setRequesting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        setLocState('granted');
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          // Centré une fois le globe monté (cameraRef disponible au prochain render).
          setPendingLoc([position.coords.longitude, position.coords.latitude]);
        } catch {
          /* position indisponible : on garde la vue monde */
        }
      }
    } catch {
      setLocState('denied');
    } finally {
      setRequesting(false);
    }
  }, []);

  // Passe directement au globe sans localisation (session en cours).
  const exploreGlobe = useCallback(() => {
    locSkippedRef.current = true;
    setLocState('skipped');
  }, []);

  // Applique le centrage sur la position autorisée une fois la carte montée
  // (pendingLoc n'est posé que quand locState devient 'granted').
  useEffect(() => {
    if (!pendingLoc) return;
    flyTo(pendingLoc, 10, 1100);
    setPendingLoc(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLoc]);

  const goToArtist = useCallback(
    (artist: Artist, rawQuery?: string) => {
      rememberQuery(rawQuery ?? query);
      setSelected(artist);
      setSearchOpen(false);
      setQuery('');
      setVisiblePins([artist]);
      recordCityVisit(`${artist.city}, ${artist.country}`).catch(() => {});
      void recordPinView(artist.id, { viewerKey: deviceId ?? undefined });
      flyTo(artist.coordinates, 9, 800);
    },
    [query, rememberQuery, deviceId, recordCityVisit],
  );

  const goToCity = useCallback(
    (c: PlaceResult) => {
      rememberQuery(`${c.city}, ${c.country}`);
      const cityArtists = allArtists.filter(
        (a) => a.city.trim().toLowerCase() === c.city.trim().toLowerCase() &&
          a.country.trim().toLowerCase() === c.country.trim().toLowerCase(),
      );
      setSearchOpen(false);
      setQuery('');
      setSelected(null);
      setHighlightedId(null);
      setVisiblePins(cityArtists.length > 0 ? cityArtists : []);
      // Panneau « lieu » : stats de la ville + nav artiste-à-artiste.
      const code = geoCountryOf(c.city, c.country);
      setSelectedPlace({
        kind: 'city',
        name: c.city,
        code,
        flag: flagFor(code),
        artists: cityArtists,
      });
      setPlaceIndex(0);
      recordCityVisit(`${c.city}, ${c.country}`).catch(() => {});
      // Atterrit sur le PREMIER pin de la ville (position dés-empilée) :
      // comme un clic sur cluster, on ne tombe pas dans le vide.
      if (cityArtists.length > 0) {
        const firstArtist = cityArtists[0];
        if (firstArtist && isValidCoordinate(firstArtist.coordinates)) {
          setHighlightedId(firstArtist.id);
          const spread = declump(cityArtists, 13);
          const rendered = spread.get(firstArtist.id);
          flyTo(rendered ?? firstArtist.coordinates, 13, 950);
          return;
        }
      }
      flyTo(c.coordinates, 13, 950);
    },
    [allArtists, rememberQuery, recordCityVisit],
  );

  const goToNeighborhood = useCallback(
    (n: NeighborhoodSuggestion) => {
      rememberQuery(n.name);
      // Quartier : artistes « proches » (≤ ~4,4 km) de ce quartier.
      const radius = 0.04;
      const nearArtists = allArtists.filter((a) => {
        const dLng = Math.abs(a.coordinates[0] - n.lng);
        const dLat = Math.abs(a.coordinates[1] - n.lat);
        return dLng <= radius && dLat <= radius;
      });
      setSearchOpen(false);
      setQuery('');
      setSelected(null);
      setHighlightedId(null);
      setVisiblePins(nearArtists.length > 0 ? nearArtists : []);
      // Panneau « lieu » : stats + nav artiste-à-artiste (comme une ville).
      const code = n.countryCode ?? '';
      setSelectedPlace({
        kind: 'city',
        name: n.name,
        code,
        flag: flagFor(code),
        artists: nearArtists,
      });
      setPlaceIndex(0);
      recordCityVisit(`${n.name}, ${n.city}`).catch(() => {});
      // Atterrit sur le PREMIER pin du quartier (position dés-empilée).
      if (nearArtists.length > 0) {
        const firstArtist = nearArtists[0];
        if (firstArtist && isValidCoordinate(firstArtist.coordinates)) {
          setHighlightedId(firstArtist.id);
          const spread = declump(nearArtists, 14);
          const rendered = spread.get(firstArtist.id);
          flyTo(rendered ?? firstArtist.coordinates, 14, 950);
          return;
        }
      }
      flyTo([n.lng, n.lat], 14, 950);
    },
    [allArtists, rememberQuery, recordCityVisit],
  );

  const goToCountry = useCallback(
    (c: CountryResult) => {
      rememberQuery(c.name);
      const countryArtists = allArtists.filter(
        (a) => (a.country ?? '').toUpperCase() === c.code.toUpperCase(),
      );
      setSearchOpen(false);
      setQuery('');
      setSelected(null);
      setHighlightedId(null);
      setVisiblePins(countryArtists.length > 0 ? countryArtists : []);
      // Panneau « lieu » : stats du pays + nav artiste-à-artiste.
      setSelectedPlace({
        kind: 'country',
        name: c.name,
        code: c.code,
        flag: c.flag,
        artists: countryArtists,
      });
      setPlaceIndex(0);
      // Atterrit sur le PREMIER pin du pays (position dés-empilée).
      if (countryArtists.length > 0) {
        const firstArtist = countryArtists[0];
        if (firstArtist && isValidCoordinate(firstArtist.coordinates)) {
          setHighlightedId(firstArtist.id);
          const spread = declump(countryArtists, 12);
          const rendered = spread.get(firstArtist.id);
          flyTo(rendered ?? firstArtist.coordinates, 12);
          return;
        }
      }
      flyTo(c.coordinates, 12);
    },
    [allArtists, rememberQuery],
  );

  // Navigation artiste-à-artiste dans le lieu sélectionné : saute à
  // l'artiste (vol + highlight) sans quitter la carte. Le pin cible est mis
  // en évidence (grossi + nom affiché) pendant que la carte vole vers lui.
  const jumpPlaceArtist = useCallback(
    (i: number) => {
      setPlaceIndex(i);
      const artist = selectedPlace?.artists[i];
      if (artist && isValidCoordinate(artist.coordinates)) {
        setSelected(null);
        setHighlightedId(artist.id);
        // Vole vers la position AFFICHÉE du pin (dés-empilement inclus) pour
        // qu'il arrive au centre de l'écran — pas dans un coin au zoom.
        const spread = declump(selectedPlace.artists, 13);
        const rendered = spread.get(artist.id) ?? artist.coordinates;
        flyTo(rendered, 13, 900);
      }
    },
    [selectedPlace],
  );

  const goToGenre = useCallback(
    (genre: string) => {
      rememberQuery(genre);
      const genreArtists = allArtists.filter((a) => a.genre === genre);
      setSearchOpen(false);
      setQuery('');
      setSelected(null);
      setHighlightedId(null);
      setVisiblePins(genreArtists);
      if (genreArtists.length > 0) flyTo(genreArtists[0].coordinates, 11);
    },
    [allArtists, rememberQuery],
  );

  // --- Découverte : filtres ville/genre + tirage au hasard ---
  const discoverCities = useMemo(() => {
    const set = new Set(allArtists.map((a) => a.city.trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [allArtists]);
  const discoverGenres = useMemo(() => {
    const set = new Set(allArtists.map((a) => a.genre.trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [allArtists]);
  const discoverPool = useMemo(
    () =>
      allArtists.filter((a) => {
        if (discoverCity && a.city.trim().toLowerCase() !== discoverCity.trim().toLowerCase()) return false;
        if (discoverGenre && a.genre.trim().toLowerCase() !== discoverGenre.trim().toLowerCase()) return false;
        return true;
      }),
    [allArtists, discoverCity, discoverGenre],
  );
  const discoverRandom = useCallback(() => {
    if (discoverPool.length === 0) {
      Alert.alert(t('globe.discover'), t('globe.discoverEmpty'));
      return;
    }
    goToArtist(discoverPool[Math.floor(Math.random() * discoverPool.length)]);
  }, [discoverPool, goToArtist, t]);

  // --- Ajout d'un artiste Musibrainz à la carte (miroir du web) ---
  const openRefer = useCallback(
    (candidate: DiscoveredArtist) => {
      setSearchOpen(false);
      navigation.navigate('ArtistJoin', {
        artistName: candidate.name,
        genre: candidate.genre,
        bio: candidate.bio,
      });
    },
    [navigation],
  );

  const addToMap = useCallback(
    async (candidate: DiscoveredArtist) => {
      setAddingId(candidate.id);
      const located = await locateArtist(candidate);
      if (located.error || !located.artist?.lat || !located.artist?.lng) {
        setAddingId(null);
        openRefer(candidate);
        return;
      }
      const fresh = located.artist;
      const nameKey = fresh.name.trim().toLowerCase();
      const existing = mapArtists.find((a) => a.name.trim().toLowerCase() === nameKey);
      let artist: Artist;
      if (existing) {
        const result = await addOrUpdateMapArtist({ ...fresh, id: existing.id });
        if (!result.ok) {
          setAddingId(null);
          setSearchOpen(false);
          setQuery('');
          setSelected(existing);
          setVisiblePins([existing]);
          flyTo(existing.coordinates, 9, 800);
          return;
        }
        artist = {
          ...existing,
          ...toArtist(fresh),
          id: existing.id,
          verified: existing.verified,
          claimedBy: existing.claimedBy,
          bio: fresh.bio || existing.bio,
          image: fresh.image || existing.image,
          genre: fresh.genre || existing.genre,
          city: fresh.city || existing.city,
          country: fresh.country || existing.country,
          platforms: { ...existing.platforms, ...fresh.platforms },
          socials: { ...existing.socials, ...fresh.socials },
        };
        setMapArtists((prev) => prev.map((a) => (a.id === existing.id ? artist : a)));
      } else {
        const result = await addOrUpdateMapArtist(fresh);
        if (!result.ok) {
          const fallback = await addMapArtist(fresh);
          if (!fallback.ok) {
            setAddingId(null);
            return;
          }
        }
        artist = toArtist(fresh);
        setMapArtists((prev) => [...prev.filter((a) => a.id !== artist.id), artist]);
      }
      setAddingId(null);
      setOnlineResults((prev) => prev.filter((r) => r.id !== candidate.id));
      setSearchOpen(false);
      setQuery('');
      setSelected(artist);
      setVisiblePins([artist]);
      flyTo(artist.coordinates, 9, 800);
    },
    [mapArtists, openRefer],
  );

  // --- Artistes à moins de 500 km (onglet fiche, comme le web) ---
  const nearby = useMemo(() => {
    if (!selected) return [];
    return allArtists
      .filter((a) => a.id !== selected.id)
      .map((a) => ({ artist: a, d: distanceKm(selected.coordinates, a.coordinates) }))
      .filter(({ d }) => d < 500)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map(({ artist }) => artist);
  }, [selected, allArtists]);

  // --- Région visible + zoom (pins par niveau de cluster) ---
  const regionArtists = useMemo(() => {
    if (!region) return allArtists;
    const { east, north, west, south } = region;
    const crossesAntimeridian = west > east;
    return allArtists.filter((artist) => {
      const [longitude, latitude] = artist.coordinates;
      if (!isValidCoordinate(artist.coordinates)) return false;
      const longitudeIsVisible = crossesAntimeridian
        ? longitude >= west || longitude <= east
        : longitude >= west && longitude <= east;
      return longitudeIsVisible && latitude >= south && latitude <= north;
    });
  }, [region, allArtists]);

  const pins = useMemo(() => {
    const target = visiblePins;
    let base: Artist[];
    if (target.length > 0) {
      const ids = new Set(target.map((a) => a.id));
      base = allArtists.filter((a) => ids.has(a.id));
    } else if (searchOpen && query.trim()) {
      base = [];
    } else {
      base = regionArtists;
    }
    if (base.length === 0) return [];
    const valid = base.filter((a) => isValidCoordinate(a.coordinates));
    const level = levelFor(mapZoom);
    const out: Pin[] = [];
    if (level === 'country') {
      const byGeo = new Map<string, { code: string; flag: string }>();
      const located = valid.filter((a) => (a.city ?? '').trim() || (a.country ?? '').trim());
      const geoKey = (a: Artist) => {
        const code = geoCountryOf(a.city, a.country);
        if (!byGeo.has(code)) byGeo.set(code, { code, flag: flagFor(code) });
        return code;
      };
      for (const c of clusterBy(located, geoKey)) {
        const geo = byGeo.get(c.key) ?? { code: c.key, flag: c.flag };
        // 10 = niveau « pins individuels » : un clic suffit, les clusters se
        // scindent progressivement pendant le vol. Les pins sont scopés aux
        // artistes du cluster (pas de voisins au bord du viewport).
        const members = located.filter((a) => geoKey(a) === c.key);
        out.push({
          key: `c-${geo.code}`,
          kind: 'cluster',
          label: geo.code,
          flag: geo.flag,
          count: c.count,
          coords: c.coordinates,
          zoomTo: 12,
          members,
          tier: Math.max(0, ...members.map((a) => tierOf(a, popularityById))),
          place: {
            kind: 'country',
            name: geo.code,
            code: geo.code,
            flag: geo.flag,
          },
        });
      }
    } else if (level === 'city') {
      const flagByCity = new Map<string, string>();
      const located = valid.filter((a) => (a.country ?? '').trim() && (a.city ?? '').trim());
      const cityKey = (a: Artist) => {
        const code = geoCountryOf(a.city, a.country);
        if (!flagByCity.has(code)) flagByCity.set(code, flagFor(code));
        return `${a.city}|${code}`;
      };
      for (const c of clusterBy(located, cityKey)) {
        const code = c.key.split('|')[1] ?? '';
        const members = located.filter((a) => cityKey(a) === c.key);
        out.push({
          key: `p-${c.key}`,
          kind: 'cluster',
          label: c.label.split('|')[0],
          flag: flagByCity.get(code) ?? c.flag,
          count: c.count,
          coords: c.coordinates,
          zoomTo: 13,
          members,
          tier: Math.max(0, ...members.map((a) => tierOf(a, popularityById))),
          place: {
            kind: 'city',
            name: c.label.split('|')[0],
            code,
            flag: flagByCity.get(code) ?? c.flag,
          },
        });
      }
    } else if (level === 'sub') {
      const groups = new Map<string, Artist[]>();
      for (const artist of valid) {
        const key = bucketKey(artist.coordinates);
        const group = groups.get(key);
        if (group) group.push(artist);
        else groups.set(key, [artist]);
      }
      for (const group of groups.values()) {
        group.sort((a, b) => a.name.localeCompare(b.name));
        if (group.length === 1) {
          out.push({ key: `a-${group[0].id}`, kind: 'artist', artist: group[0], coords: group[0].coordinates, tier: tierOf(group[0], popularityById) });
          continue;
        }
        const cLng = group.reduce((s, a) => s + a.coordinates[0], 0) / group.length;
        const cLat = group.reduce((s, a) => s + a.coordinates[1], 0) / group.length;
        out.push({ key: `s-${group[0].id}`, kind: 'cluster', label: group[0].name, flag: group[0].flag, count: group.length, coords: [cLng, cLat], zoomTo: 13.5, variant: 'sub', members: group, tier: Math.max(0, ...group.map((a) => tierOf(a, popularityById))) });
      }
    } else {
      const spread = declump(valid, mapZoom);
      for (const artist of valid) {
        out.push({ key: `a-${artist.id}`, kind: 'artist', artist, coords: spread.get(artist.id) ?? artist.coordinates, tier: tierOf(artist, popularityById) });
      }
    }
    return out;
  }, [regionArtists, visiblePins, searchOpen, query, allArtists, mapZoom, popularityById]);

  // Taille des pins individuels : petits de loin (carte épurée), ils
  // grossissent à l'approche — même échelle que la page globe web (base 34px,
  // facteur adouci pour des pins plus discrets par zoom).
  const pinScale = Math.min(1.15, Math.max(0.22, 0.22 + (mapZoom - 1) * 0.07));
  const pinSize = Math.max(11, Math.round(34 * pinScale));

  const loadRegion = ({ properties }: VisibleRegion) => {
    const [east, north] = properties.bounds.ne;
    const [west, south] = properties.bounds.sw;
    const z = properties.zoom;
    centerRef.current = [(west + east) / 2, (south + north) / 2];
    setMapZoom((prev) => (Math.abs(prev - z) < 0.02 ? prev : z));
    setRegion((prev) =>
      prev && Math.abs(prev.east - east) < 1 && Math.abs(prev.north - north) < 1
        ? prev
        : { east, north, west, south },
    );
  };

  // Rotation automatique (intervalle, comme le flyTo jumpTo du web). Coupe
  // dès qu'on vole vers une cible, qu'on tape la carte, ou qu'un geste de
  // l'utilisateur est détecté.
  //
  // Détection déterministe des gestes : chaque tick de rotation « réserve »
  // l'événement caméra qui en découle (pendingSpinMoveRef). Tout changement de
  // caméra qui n'est pas notre tick = manipulation du globe → arrêt immédiat.
  // (L'ancienne fenêtre temporelle de 160 ms était inefficace : les ticks
  // étant espacés de 120 ms, tous les événements tombaient dans la fenêtre et
  // la rotation ne s'arrêtait jamais au contact.)
  const spinRef = useRef(spinning);
  const spinSetIdRef = useRef(0);
  const pendingSpinMoveRef = useRef(0);
  /** Intervalle de rotation stocké dans une ref : sur le moindre contact
   *  utilisateur on le clear SYNCHRONEMENT (sans attendre un re-render), pour
   *  que le prochain tick ne saute pas la caméra pendant un drag. */
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    spinRef.current = spinning;
  }, [spinning]);
  useEffect(() => {
    if (!spinning) return;
    const interval = setInterval(() => {
      spinSetIdRef.current += 1;
      pendingSpinMoveRef.current = spinSetIdRef.current;
      centerRef.current = [centerRef.current[0] - 0.12, centerRef.current[1]];
      cameraRef.current?.setCamera({
        centerCoordinate: centerRef.current,
        animationDuration: 0,
        // moveTo = saut INSTANTANÉ (équivalent du jumpTo web). Surtout pas
        // 'flyTo' : même avec duration 0, le mode FLIGHT lance une animation
        // caméra native qui bloque / reprend le dessus sur les gestes de
        // l'utilisateur — le globe semble figé au toucher pendant la rotation.
        animationMode: 'moveTo',
      });
      // Filet de sécurité : si aucun événement caméra ne suit ce tick, le
      // marquage ne doit pas masquer les gestes utilisateur ultérieurs.
      // 110 ms < intervalle de 120 ms : on laisse l'événement du tick arriver
      // sans laisser le marquage masquer les gestes suivants.
      setTimeout(() => {
        if (pendingSpinMoveRef.current === spinSetIdRef.current) {
          pendingSpinMoveRef.current = 0;
        }
      }, 110);
    }, 120);
    spinIntervalRef.current = interval;
    return () => {
      clearInterval(interval);
      spinIntervalRef.current = null;
    };
  }, [spinning]);

  /** Arrête la rotation IMMÉDIATEMENT (ref, pas d'attente de re-render). */
  const stopSpinImmediate = useCallback(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    setSpinning(false);
  }, []);

  // Gestes utilisateur (drag) : la rotation s'arrête comme sur le web.
  const stopSpinOnGesture = useCallback(() => {
    if (!spinRef.current) return;
    // L'événement correspond à notre tick de rotation → on l'ignore.
    if (pendingSpinMoveRef.current !== 0) {
      pendingSpinMoveRef.current = 0;
      return;
    }
    // Sinon c'est un geste utilisateur → on coupe la rotation immédiatement.
    stopSpinImmediate();
  }, [stopSpinImmediate]);

  /** Toucher : arrête la rotation immédiatement (clear interval synchrone). */
  const handleTouchStart = useCallback(() => {
    if (spinRef.current) stopSpinImmediate();
  }, [stopSpinImmediate]);

  // Ouverture d'un artiste passé en paramètre (recherche / sauvegardés).
  // Garde-fou : ne se rejoue pas à chaque rechargement de map_artists quand
  // la navigation vient de la liste des sauvegardés (sans searchKey).
  const handledSearchKeyRef = useRef<number | null>(null);
  const handledArtistIdRef = useRef<string | null>(null);
  useEffect(() => {
    const key = route.params?.searchKey ?? null;
    const artistId = route.params?.artistId;
    if (handledSearchKeyRef.current === key && key !== null) return;
    if (handledArtistIdRef.current === artistId && artistId != null && key === null) return;
    const artist = artistId ? allArtists.find((item) => item.id === artistId) : undefined;
    if (artist) {
      handledSearchKeyRef.current = key;
      handledArtistIdRef.current = artistId ?? null;
      setSelected(artist);
      setVisiblePins([artist]);
      recordCityVisit(`${artist.city}, ${artist.country}`).catch(() => {});
      flyTo(artist.coordinates, 9, 800);
    }
  }, [route.params?.artistId, route.params?.searchKey, allArtists, recordCityVisit]);

  // Ville passée en paramètre (recherche de lieu).
  useEffect(() => {
    const requestedPlace = route.params?.city;
    if (!requestedPlace) return;
    const searchedCoordinates = route.params?.coordinates;
    const normalizedRequest = norm(requestedPlace);
    const requestedCity = norm(requestedPlace.split(',')[0] ?? requestedPlace);
    const city = allArtists.find((item) => {
      const fullName = norm(`${item.city}, ${item.country}`);
      return fullName === normalizedRequest || norm(item.city) === requestedCity;
    });
    // Repli sur le catalogue de villes partagé : une ville sans artiste sur
    // la carte (encore) centre quand même le globe (ex. « search instead »).
    const catalogCity = cities.find((item) => {
      const fullName = norm(`${item.city}, ${item.country}`);
      return fullName === normalizedRequest || norm(item.city) === requestedCity;
    });
    const target = searchedCoordinates ?? city?.coordinates ?? catalogCity?.coordinates;
    if (!target) return;
    setSelected(null);
    const artistsInPlace = allArtists
      .filter((artist) => {
        if (norm(artist.city) === requestedCity) return true;
        const [longitude, latitude] = artist.coordinates;
        const longitudeDelta = longitude - target[0];
        const latitudeDelta = latitude - target[1];
        return Math.hypot(longitudeDelta, latitudeDelta) <= 2.4;
      })
      .map((artist) => artist.id);
    const cityArtists = allArtists.filter((a) => artistsInPlace.includes(a.id));
    setVisiblePins(cityArtists);
    const visited = city ? `${city.city}, ${city.country}` : catalogCity ? `${catalogCity.city}, ${catalogCity.country}` : requestedPlace;
    recordCityVisit(visited).catch(() => {});
    flyTo(target, 10, 950);
  }, [
    route.params?.city,
    route.params?.coordinates?.[0],
    route.params?.coordinates?.[1],
    route.params?.searchKey,
    recordCityVisit,
    allArtists,
  ]);

  // Entrée du panneau de recherche (comme le web : slide + fade).
  const sheetAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (searchOpen) {
      sheetAnim.setValue(0);
      Animated.timing(sheetAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [searchOpen, sheetAnim]);

  if (!HAS_MAPBOX) {
    return (
      <View style={[styles.container, styles.missingToken]}>
        <Ionicons name="globe-outline" size={58} color={colors.brand} />
        <Text style={styles.missingTitle}>{t('explore.globeUnavailable')}</Text>
        <Text style={styles.missingText}>{t('explore.globeUnavailableText')}</Text>
      </View>
    );
  }

  const showMap = locState === 'granted' || locState === 'skipped';

  // Même style que le globe web : carte MONOCHROME selon le thème
  // (dark-v11 en sombre, light-v11 en clair) — aucun vert ni relief coloré.
  const globeStyleUrl =
    theme === 'dark'
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';
  // Frontières aux couleurs de la marque (parité web) : on charge le style
  // Mapbox une fois, on teinte le trait des pays en bleu brand, puis on le
  // passe en styleJSON. Repli silencieux vers le style brut si le fetch
  // échoue (offline, token…) — la carte reste toujours visible.
  const [tintedStyle, setTintedStyle] = useState<string | null>(null);
  useEffect(() => {
    if (!HAS_MAPBOX) return;
    let cancelled = false;
    // Bascule immédiate sur le style URL du thème pendant le fetch : pas de
    // couleur de frontière obsolète (thème précédent) le temps du rechargement.
    setTintedStyle(null);
    fetch(
      `https://api.mapbox.com/styles/v1/mapbox/${theme === 'dark' ? 'dark' : 'light'}-v11?access_token=${MAPBOX_TOKEN}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((style: Record<string, unknown>) => {
        if (cancelled) return;
        const brand = theme === 'dark' ? 'rgba(47, 82, 224, 0.75)' : 'rgba(47, 82, 224, 0.5)';
        const layers = (style.layers as Array<{ id: string; type: string; paint?: Record<string, unknown> }>) ?? [];
        for (const layer of layers) {
          if (layer.type === 'line' && /^admin-0-boundary(-disputed)?$/i.test(layer.id)) {
            layer.paint = { ...layer.paint, 'line-color': brand };
          }
        }
        setTintedStyle(JSON.stringify(style));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [theme]);

  // Clusters « points » en vue globe : petits ronds discrets qui grossissent
  // au zoom (même courbe d'échelle que le web : 0.22 → 1.15, avec un plancher
  // de 0.85 pour que le point de 22px reste visible (~19px) comme sur le web).
  const globeView = mapZoom < 3.5;
  const clusterScale = Math.min(1.15, Math.max(0.85, 0.22 + (mapZoom - 1) * 0.07));

  return (
    <View style={styles.container}>
      {!showMap ? (
        /* Premier écran : demande de localisation (Autoriser / Explorer le globe). */
        <View style={styles.locView}>
          {locState === 'checking' ? (
            <>
              <ActivityIndicator color={colors.brandDeep} />
              <Text style={styles.locChecking}>{t('loc.checking')}</Text>
            </>
          ) : (
            <>
              <View style={styles.locIconTile}>
                <Ionicons name="navigate" size={54} color="#111111" />
              </View>
              <Text style={styles.locTitle}>{t('loc.title')}</Text>
              <Text style={styles.locSubtitle}>{t('loc.subtitle')}</Text>
              <Pressable
                accessibilityRole="button"
                style={[styles.locAllowBtn, requesting && styles.locBtnBusy]}
                disabled={requesting}
                onPress={() => void authorizeLocation()}
              >
                {requesting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="navigate" size={18} color={colors.white} />
                )}
                <Text style={styles.locAllowText}>{t('loc.allow')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.locExploreBtn, requesting && styles.locBtnBusy]}
                disabled={requesting}
                onPress={exploreGlobe}
              >
                <Ionicons name="globe-outline" size={18} color={colors.brandDeep} />
                <Text style={styles.locExploreText}>{t('loc.exploreGlobe')}</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        // Le moindre contact arrête la rotation : sinon le tick de spin
        // (120 ms) re-cale la caméra en continu et le globe semble figé au
        // toucher. La View observe le toucher sans bloquer les gestes de la
        // carte (elle ne devient pas responder).
        <View
          style={StyleSheet.absoluteFill}
          onTouchStart={handleTouchStart}
        >
        <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        ref={mapViewRef}
        styleURL={tintedStyle ? undefined : globeStyleUrl}
        styleJSON={tintedStyle ?? undefined}
        projection="globe"
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={() => {
          setSpinning(false);
          setSelected(null);
        }}
        onRegionIsChanging={stopSpinOnGesture}
        onMapIdle={loadRegion}
        // Pendant un vol, le zoom évolue en continu : on met à jour le niveau
        // de cluster dès qu'un seuil est franchi (pays → villes → groupes →
        // pins) pour que les clusters se scindent progressivement, comme le
        // zoom tick du globe web. On ne met à jour que sur changement de
        // niveau discret pour éviter un re-render par frame.
        onCameraChanged={({ properties, gestures }) => {
          // Natif : un geste actif (drag/pinch) arrête la rotation
          // immédiatement (clear synchrone de l'intervalle), même si
          // onRegionIsChanging a attribué le premier mouvement à notre tick.
          if (gestures?.isGestureActive && spinRef.current) {
            stopSpinImmediate();
          }
          const z = properties.zoom
          setMapZoom((prev) => {
            if (levelFor(prev) === levelFor(z)) return prev
            return z
          })
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: GLOBE_CENTER, zoomLevel: GLOBE_ZOOM, pitch: 0, heading: 0 }}
          minZoomLevel={0.45}
          maxZoomLevel={18}
        />
        {/* Atmosphere n'est pas exporté par @rnmapbox/maps sur web (natif uniquement). */}
        {Mapbox.Atmosphere != null && (
          <Mapbox.Atmosphere
            style={{
              color: theme === 'dark' ? 'rgb(14, 16, 20)' : 'rgb(226, 229, 234)',
              highColor: theme === 'dark' ? 'rgb(30, 35, 42)' : 'rgb(188, 195, 204)',
              spaceColor: theme === 'dark' ? 'rgb(4, 5, 8)' : 'rgb(240, 242, 245)',
              horizonBlend: 0.08,
              starIntensity: theme === 'dark' ? 0.18 : 0,
            }}
          />
        )}
        {pins.map((pin) =>
          pin.kind === 'cluster' ? (
            <Mapbox.MarkerView key={pin.key} id={`pin-${pin.key}`} coordinate={pin.coords} allowOverlap>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${pin.label} — ${pin.count} artistes`}
                style={[
                  styles.clusterPin,
                  pin.variant === 'sub' && styles.clusterPinSub,
                  globeView && styles.clusterPinDot,
                  // Fond + bordure colorés par DENSITÉ (tier max du groupe),
                  // comme sur le web — le halo lumineux suit la couleur.
                  !globeView && pin.variant !== 'sub'
                    ? {
                        backgroundColor: tierColor(pin.tier),
                        borderColor: tierColor(pin.tier),
                      }
                    : globeView
                      ? { backgroundColor: tierColor(pin.tier) }
                      : null,
                  { transform: [{ scale: clusterScale }] },
                ]}
                onPress={() => {
                  // Scope les pins aux artistes du cluster (comme le web) :
                  // au zoom cible, seuls ses pins s'affichent, pas les
                  // pays/villes voisins au bord du viewport.
                  if (pin.members.length > 0) setVisiblePins(pin.members);
                  // Cluster de LIEU (pays/ville) : ouvre le panneau bas
                  // avec les stats + nav artiste-à-artiste (comme le web).
                  // Le PREMIER pin du cluster est mis en évidence — on
                  // atterrit dessus (position dés-empilée), pas dans le vide.
                  if (pin.members.length > 0) {
                    setHighlightedId(pin.members[0]?.id ?? null);
                  }
                  if (pin.place) {
                    setSelectedPlace({ ...pin.place, artists: pin.members });
                    setPlaceIndex(0);
                  }
                  // Vole vers le PREMIER artiste du cluster (position
                  // dés-empilée) au lieu du barycentre : on atterrit toujours
                  // sur un pin visible et mis en évidence.
                  let targetCoords = pin.coords;
                  let targetZoom = pin.zoomTo;
                  if (pin.members.length > 0) {
                    const firstMember = pin.members[0];
                    if (firstMember && isValidCoordinate(firstMember.coordinates)) {
                      const spread = declump(pin.members, 13);
                      const rendered = spread.get(firstMember.id);
                      if (rendered) {
                        targetCoords = rendered;
                        targetZoom = 13;
                      }
                    }
                  }
                  flyTo(targetCoords, targetZoom);
                }}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.popRing,
                    {
                      borderColor: POPULARITY_RING_COLORS[pin.tier as 0 | 1 | 2 | 3],
                    },
                  ]}
                />
                {!globeView && (
                  <>
                    {/* Encre contrastée : blanche sur fonds sombres, sombre sur
                        lime (tier 3) — lisibilité sur le fond coloré du pin. */}
                    <Text
                      style={[
                        styles.clusterPinMain,
                        pin.variant !== 'sub' && {
                          color: pin.tier === 3 ? '#0b1420' : '#ffffff',
                        },
                      ]}
                    >
                      {pin.variant === 'sub' ? `${pin.count}` : `${pin.flag} ${pin.label} · ${pin.count}`}
                    </Text>
                    {(() => {
                      const fans = pin.members.reduce(
                        (s, a) => s + (parseFollowersCount(a.followers) || 0),
                        0,
                      )
                      return fans > 0 ? (
                        <Text
                          style={[
                            styles.clusterPinStats,
                            pin.variant !== 'sub' && {
                              color: pin.tier === 3 ? '#0b1420' : '#ffffff',
                            },
                          ]}
                        >
                          {`${compactCount(fans)} fans`}
                        </Text>
                      ) : null
                    })()}
                  </>
                )}
              </Pressable>
            </Mapbox.MarkerView>
          ) : (
            <Mapbox.MarkerView key={pin.key} id={`pin-${pin.key}`} coordinate={pin.coords} allowOverlap>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('explore.seeArtist', { name: pin.artist.name })}
                style={styles.markerWrap}
                onHoverIn={() => setHoveredId(pin.key)}
                onHoverOut={() => setHoveredId((prev) => (prev === pin.key ? null : prev))}
                onPress={() => goToArtist(pin.artist)}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.popRing,
                    pin.artist.id === highlightedId && styles.popRingSelected,
                    {
                      borderColor:
                        pin.artist.id === highlightedId
                          ? colors.brand
                          : POPULARITY_RING_COLORS[pin.tier as 0 | 1 | 2 | 3],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.halo,
                    pin.artist.trending && styles.haloTrending,
                    pin.artist.id === highlightedId && styles.haloSelected,
                    // Halo LUMINEUX coloré par densité (parité web : le pin
                    // irradie dans la couleur de son tier de popularité).
                    !pin.artist.trending &&
                      pin.artist.id !== highlightedId && {
                        backgroundColor: hexToRgba(tierColor(pin.tier), 0.34),
                      },
                  ]}
                />
                <ArtistAvatar
                  artist={pin.artist}
                  size={pin.artist.id === highlightedId ? Math.round(pinSize * 1.25) : pinSize}
                />
                <View style={styles.markerTip} />
                {(showPinNameFor(pin.key) || pin.artist.id === highlightedId) && (
                  <Text
                    style={[styles.pinName, pin.artist.id === highlightedId && styles.pinNameSelected]}
                    numberOfLines={1}
                  >
                    {pin.artist.name}
                  </Text>
                )}
              </Pressable>
            </Mapbox.MarkerView>
          ),
        )}
      </Mapbox.MapView>
        </View>
      )}

      {/* Topbar commune : logo + notifications. Quand la recherche est repliée
          (zoom/fiche ouverte), l'icône search remplace la cloche (comme le web). */}
      <View style={[styles.appBarWrap, { top: insets.top + 10 }]}>
        <AppBar
          navigation={navigation}
          // Repliée seulement hors panneau : une fois la recherche ouverte,
          // la cloche revient (la search n'est plus « repliée »).
          searchCollapsed={searchCollapsed && !searchOpen}
          onOpenSearch={openSearch}
          // Fiche artiste ouverte : le logo devient un bouton retour (comme le
          // web) — ferme la fiche et revient au header normal logo + cloche.
          backOverride={selected !== null}
          onBack={() => {
            setSelected(null);
            setSearchOpen(false);
            setQuery('');
          }}
        />
      </View>

      {/* Barre de recherche sous la topbar — se replie en icône dès qu'on
          zoome ou qu'une fiche s'ouvre, comme sur le web. */}
      {showMap && !searchOpen && (
        <>
          {!searchCollapsed && (
            <View style={[styles.searchBarWrap, { top: insets.top + 10 + APPBAR_HEIGHT + APPBAR_GAP }]}>
              <Pressable
                accessibilityRole="button"
                style={styles.searchBar}
                onPress={openSearch}
              >
                <Ionicons name="search" size={20} color={colors.inkSoft} />
                <Text numberOfLines={1} style={styles.searchBarText}>
                  {t('globe.searchPlaceholder')}
                </Text>
              </Pressable>
            </View>
          )}
          {/* Repliée : l'icône search est portée par la topbar (remplace la cloche). */}
        </>
      )}

      {/* Contrôles bas : vue globe + rotation, comme le web */}
      {showMap && !selected && !searchOpen && (
        <View style={[styles.bottomControls, { bottom: 104 + insets.bottom }]}>
          <Pressable style={styles.controlBtn} onPress={resetView}>
            <Ionicons name="globe-outline" size={17} color={colors.brandDeep} />
            <Text style={styles.controlBtnText}>{t('globe.globeView')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('globe.rotateAria')}
            style={styles.rotateBtn}
            onPress={() => setSpinning((s) => !s)}
          >
            {spinning ? (
              // Icône PLEINE bleu foncé, comme le bouton web (fill-current) :
              // `fill="currentColor"` ne se résout pas en React Native et
              // laisserait l'icône vide (seulement les contours en bleu).
              <Pause size={20} color={colors.brandDeep} fill={colors.brandDeep} strokeWidth={2.2} />
            ) : (
              <Play size={20} color={colors.brandDeep} fill={colors.brandDeep} strokeWidth={2.2} />
            )}
          </Pressable>
        </View>
      )}

      {/* Panneau de recherche (comme le web : scrim flouté + sheet bas) */}
      {searchOpen && (
        <View style={styles.searchPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('globe.closeSearch')}
            style={styles.scrim}
            onPress={closeSearch}
          >
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          </Pressable>
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: insets.bottom + 14,
                opacity: sheetAnim,
                transform: [
                  {
                    translateY: sheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [28, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('globe.back')}
                style={styles.sheetBack}
                onPress={closeSearch}
              >
                <Ionicons name="chevron-back" size={22} color={colors.ink} />
              </Pressable>
              <Text style={styles.sheetTitle}>{t('globe.searchPlaceholder')}</Text>
              <View style={styles.sheetBackSpacer} />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="search" size={19} color={colors.inkSoft} />
              <TextInput
                autoFocus
                value={query}
                underlineColorAndroid="transparent"
                onChangeText={setQuery}
                onSubmitEditing={() => {
                  rememberQuery(query);
                  if (artistResults.length === 1 && placeResults.length === 0 && genreResults.length === 0) {
                    goToArtist(artistResults[0], query);
                  }
                }}
                placeholder={t('globe.searchPh')}
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                style={styles.input}
              />
              {query.length > 0 && (
                <Pressable accessibilityLabel={t('globe.clear')} hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={19} color={colors.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!query && (
                <>
                  {/* Historique */}
                  <View style={styles.sectionHeader}>
                    <Ionicons name="time-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('globe.history')}</Text>
                  </View>
                  {history.length === 0 ? (
                    <Text style={styles.historyEmpty}>{t('globe.historyEmpty')}</Text>
                  ) : (
                    <View style={styles.chips}>
                      {history.map((item) => (
                        <Pressable key={item} style={styles.chip} onPress={() => setQuery(item)}>
                          <Ionicons name="time-outline" size={14} color={colors.inkSoft} />
                          <Text style={styles.chipText} numberOfLines={1}>{item}</Text>
                        </Pressable>
                      ))}
                      <Pressable onPress={() => void clearSearchHistory().then(() => setHistory([]))}>
                        <Text style={styles.clearHistory}>{t('globe.clearHistory')}</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Découverte */}
                  <View style={styles.discoverCard}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="shuffle" size={13} color={colors.inkSoft} />
                      <Text style={styles.sectionLabel}>{t('globe.discover')}</Text>
                    </View>
                    <Text style={styles.discoverSub}>{t('globe.discoverSub')}</Text>
                    <View style={styles.discoverFilters}>
                      <DiscoverSelect
                        label={t('globe.discoverCity')}
                        value={discoverCity}
                        options={discoverCities}
                        onChange={setDiscoverCity}
                        colors={colors}
                        styles={styles}
                      />
                      <DiscoverSelect
                        label={t('globe.discoverGenre')}
                        value={discoverGenre}
                        options={discoverGenres}
                        onChange={setDiscoverGenre}
                        colors={colors}
                        styles={styles}
                      />
                    </View>
                    <View style={styles.discoverActions}>
                      <Pressable
                        style={[styles.shuffleBtn, discoverPool.length === 0 && styles.shuffleBtnDisabled]}
                        disabled={discoverPool.length === 0}
                        onPress={discoverRandom}
                      >
                        <Ionicons name="shuffle" size={16} color={colors.white} />
                        <Text style={styles.shuffleBtnText}>{t('globe.discoverShuffle')}</Text>
                      </Pressable>
                      <Text style={styles.discoverPool}>
                        {t('globe.discoverPool', { count: discoverPool.length, s: discoverPool.length > 1 ? 's' : '' })}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.hint}>{t('globe.hint')}</Text>
                </>
              )}

              {query && countryResults.length === 0 && placeResults.length === 0 && neighborhoodResults.length === 0 && artistResults.length === 0 && genreResults.length === 0 && onlineResults.length === 0 && !searchingWeb && !searchingNeighborhoods && (
                <Text style={styles.noResults}>{t('globe.noResults', { query })}</Text>
              )}

              {searchingWeb && (
                <View style={styles.webLoading}>
                  <ActivityIndicator color={colors.brandDeep} />
                  <Text style={styles.webLoadingText}>{t('discovery.searching')}</Text>
                </View>
              )}

              {countryResults.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="globe-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('globe.countries')}</Text>
                  </View>
                  {countryResults.map((c) => (
                    <Pressable key={c.code} style={styles.resultRow} onPress={() => goToCountry(c)}>
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultFlag}>{c.flag}</Text>
                      </View>
                      <View style={styles.resultCopy}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{c.name}</Text>
                        <Text style={styles.resultMeta}>
                          {t('globe.countryArtistsShort', { count: c.count, s: c.count > 1 ? 's' : '' })}
                        </Text>
                      </View>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{t('globe.typeCountry')}</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {neighborhoodResults.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="location-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('globe.neighborhoods')}</Text>
                  </View>
                  {neighborhoodResults.map((n) => (
                    <Pressable
                      key={`${n.name}·${n.lng}·${n.lat}`}
                      style={styles.resultRow}
                      onPress={() => goToNeighborhood(n)}
                    >
                      <View style={styles.resultAvatar}>
                        <Ionicons name="location" size={20} color={colors.brandDeep} />
                      </View>
                      <View style={styles.resultCopy}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{n.name}</Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {[n.city, n.country].filter(Boolean).join(', ') || '—'}
                        </Text>
                      </View>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{t('globe.typeNeighborhood')}</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {placeResults.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="location-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('globe.places')}</Text>
                  </View>
                  {placeResults.map((c) => (
                    <Pressable key={`${c.city}·${c.country}`} style={styles.resultRow} onPress={() => goToCity(c)}>
                      <View style={styles.resultAvatar}>
                        <Ionicons name="location" size={20} color={colors.brandDeep} />
                      </View>
                      <View style={styles.resultCopy}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{c.flag} {c.city}</Text>
                        <Text style={styles.resultMeta}>
                          {c.country} · {t('globe.placeArtistsShort', { count: c.count, s: c.count > 1 ? 's' : '' })}
                        </Text>
                      </View>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{t('globe.typePlace')}</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {artistResults.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="mic-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('globe.artists')}</Text>
                  </View>
                  {artistResults.map((a) => (
                    <Pressable key={a.id} style={styles.resultRow} onPress={() => goToArtist(a)}>
                      {/* Même avatar que le web : dégradé brandDeep→brand, initiales noires, sans bordure. */}
                      <ArtistAvatar
                        artist={a}
                        size={44}
                        gradient={[colors.brandDeep, colors.brand]}
                        initialsColor={colors.black}
                        borderless
                      />
                      <View style={styles.resultCopy}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{a.name}</Text>
                        <Text style={styles.resultMeta}>
                          {a.genre} · {[a.city, a.country].filter(Boolean).join(', ') || '—'}
                        </Text>
                      </View>
                      {/* Badge vérifié lime ✓ au-dessus du badge type (comme le web). */}
                      <View style={styles.resultSide}>
                        {a.verified && (
                          // Badge décoratif (le nom + vérifié sont déjà lus via le label de la rangée).
                          <View accessible={false} style={styles.verifiedBadge}>
                            <Text style={styles.verifiedBadgeText}>✓</Text>
                          </View>
                        )}
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{t('globe.typeArtist')}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {genreResults.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="musical-notes-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('globe.genres')}</Text>
                  </View>
                  {genreResults.map((g) => (
                    <Pressable key={g.genre} style={styles.resultRow} onPress={() => goToGenre(g.genre)}>
                      <View style={styles.resultAvatar}>
                        <Ionicons name="musical-note" size={20} color={colors.brandDeep} />
                      </View>
                      <View style={styles.resultCopy}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{g.genre}</Text>
                        <Text style={styles.resultMeta}>
                          {t('globe.genreArtistsShort', { count: g.count, s: g.count > 1 ? 's' : '' })}
                        </Text>
                      </View>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{t('globe.typeGenre')}</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              {/* Suggestions Musibrainz : artistes pas encore sur la carte */}
              {onlineResults.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="search-outline" size={13} color={colors.inkSoft} />
                    <Text style={styles.sectionLabel}>{t('discovery.title')}</Text>
                  </View>
                  {onlineResults.map((candidate) => {
                    const hasCity = Boolean(candidate.city?.trim());
                    return (
                      <View key={candidate.id} style={styles.onlineCard}>
                        <View style={styles.onlineTop}>
                          <View style={styles.resultAvatar}>
                            {candidate.image ? (
                              <Image
                                source={{ uri: candidate.image }}
                                style={styles.onlineAvatar}
                              />
                            ) : (
                              <Text style={styles.onlineInitials}>
                                {candidate.name
                                  .split(' ')
                                  .map((w) => w[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={styles.resultCopy}>
                            <View style={styles.resultTitleRow}>
                              <Text style={styles.resultTitle} numberOfLines={1}>{candidate.name}</Text>
                              <View style={styles.typeBadge}>
                                <Text style={styles.typeBadgeText}>{t('globe.typeArtist')}</Text>
                              </View>
                            </View>
                            <Text style={styles.resultMeta} numberOfLines={1}>
                              {candidate.genre} · {[candidate.city, candidate.country].filter(Boolean).join(', ') || '—'}
                            </Text>
                          </View>
                        </View>
                        {hasCity ? (
                          <Pressable
                            style={[styles.addBtn, addingId === candidate.id && styles.addBtnBusy]}
                            disabled={addingId !== null}
                            onPress={() => void addToMap(candidate)}
                          >
                            {addingId === candidate.id ? (
                              <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                              <Ionicons name="add" size={17} color={colors.white} />
                            )}
                            <Text style={styles.addBtnText}>{t('discovery.addShort')}</Text>
                          </Pressable>
                        ) : (
                          <Pressable style={styles.referBtn} onPress={() => openRefer(candidate)}>
                            <Ionicons name="paper-plane-outline" size={15} color={colors.brandDeep} />
                            <Text style={styles.referBtnText}>{t('discovery.refer')}</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Panneau « lieu » : stats de la ville/pays + nav artiste-à-artiste */}
      {selectedPlace && !searchOpen && !selected && (
        <PlacePanel
          place={selectedPlace}
          index={placeIndex}
          onJump={jumpPlaceArtist}
          onSelect={(a) => goToArtist(a)}
          onClose={() => {
            setSelectedPlace(null);
            setPlaceIndex(0);
            setHighlightedId(null);
          }}
        />
      )}

      {selected && (
        <ArtistSheet
          artist={selected}
          nearby={nearby}
          onClose={() => setSelected(null)}
          onSelectArtist={goToArtist}
          onRequireAuth={() => navigation.navigate('Login')}
        />
      )}
    </View>
  );
}

// Sélecteur style web (pilule + liste modale) pour la découverte.
function DiscoverSelect({
  label,
  value,
  options,
  onChange,
  colors,
  styles,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" style={styles.discoverSelect} onPress={() => setOpen(true)}>
        <Text
          style={[styles.discoverSelectText, !value && styles.discoverSelectPlaceholder]}
          numberOfLines={1}
        >
          {value || label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.inkSoft} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.pickerScrim} onPress={() => setOpen(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{label}</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const active = opt === value;
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="button"
                    style={styles.pickerRow}
                    onPress={() => {
                      onChange(active ? '' : opt);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]} numberOfLines={1}>
                      {opt}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={colors.brandDeep} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: AppColors, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    missingToken: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    missingTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20, textAlign: 'center' },
    missingText: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    markerWrap: { width: 64, height: 74, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(168,255,53,0.3)' },
    haloTrending: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,78,91,0.26)' },
    haloSelected: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(47,82,224,0.32)' },
    markerTip: { position: 'absolute', bottom: 12, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.white },
    clusterPin: {
      minWidth: 52,
      borderRadius: 15,
      backgroundColor: isDark ? 'rgba(20,24,31,0.96)' : 'rgba(255,255,255,0.97)',
      borderWidth: 1.5,
      borderColor: colors.brandDeep,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 11,
      paddingVertical: 5,
      ...shadow,
    },
    // Vue globe : les clusters deviennent de TRÈS PETITS points fins et
    // discrets (texte masqué), comme sur le web — ils grossissent au zoom.
    clusterPinDot: {
      width: 10,
      height: 10,
      minWidth: 0,
      borderRadius: 5,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.55)',
      backgroundColor: colors.brandDeep,
    },
    clusterPinSub: { backgroundColor: colors.brand, borderColor: colors.brand },
    clusterPinMain: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, lineHeight: 15 },
    clusterPinStats: {
      color: colors.muted,
      fontFamily: fonts.bold,
      fontSize: 10,
      lineHeight: 12,
      marginTop: 1,
    },
    popRing: {
      position: 'absolute',
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      borderRadius: 999,
      borderWidth: 2,
      opacity: 0.9,
    },
    popRingSelected: { top: -8, left: -8, right: -8, bottom: -8, borderWidth: 3, opacity: 1 },
    pinName: {
      position: 'absolute',
      top: -26,
      left: 0,
      right: 0,
      alignItems: 'center',
      backgroundColor: 'rgba(13,15,19,0.92)',
      color: '#fff',
      fontFamily: fonts.medium,
      fontSize: 11,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      overflow: 'hidden',
      maxWidth: 140,
      alignSelf: 'center',
    },
    pinNameSelected: {
      backgroundColor: colors.brand,
      color: '#0b1420',
      fontFamily: fonts.bold,
      fontSize: 12,
      maxWidth: 160,
    },
    appBarWrap: { position: 'absolute', left: 20, right: 20, zIndex: 20 },
    rotateBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.94)',
      ...shadow,
    },
    locView: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 40 },
    locIconTile: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 22, ...shadow },
    locTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 24, lineHeight: 31, letterSpacing: -0.8, textAlign: 'center' },
    locSubtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10, marginBottom: 28 },
    locAllowBtn: { minHeight: 58, borderRadius: 29, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30, alignSelf: 'stretch' },
    locAllowText: { color: colors.white, fontFamily: fonts.bold, fontSize: 17 },
    locExploreBtn: { minHeight: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30, alignSelf: 'stretch', marginTop: 10 },
    locExploreText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 16 },
    locChecking: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, marginTop: 10 },
    locBtnBusy: { opacity: 0.7 },
    searchBarWrap: { position: 'absolute', left: 20, right: 20, zIndex: 20 },
    searchBar: {
      minHeight: 46,
      borderRadius: 23,
      backgroundColor: isDark ? 'rgba(16,28,45,0.92)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 16,
      ...shadow,
    },
    searchBarText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 14 },
    bottomControls: { position: 'absolute', left: 20, right: 20, zIndex: 20, flexDirection: 'row', justifyContent: 'center', gap: 10 },
    controlBtn: {
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(16,28,45,0.92)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 15,
      ...shadow,
    },
    controlBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    controlBtnText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    controlBtnTextActive: { color: colors.black },
    searchPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,10,20,0.25)', zIndex: 0 },
    sheet: {
      height: '62%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 20,
      paddingTop: 12,
      borderWidth: 1,
      borderColor: colors.line,
      zIndex: 1,
      ...shadow,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sheetBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sheetBackSpacer: { width: 44 },
    sheetTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 17, letterSpacing: -0.4 },
    inputWrap: {
      minHeight: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    input: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 0, borderWidth: 0, outlineWidth: 0 },
    resultsScroll: { flex: 1 },
    resultsContent: { paddingBottom: 20, gap: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, marginBottom: 6 },
    sectionLabel: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
    historyEmpty: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      maxWidth: '78%',
    },
    chipText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
    clearHistory: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 12, paddingVertical: 7 },
    discoverCard: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 6 },
    discoverSub: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginBottom: 10 },
    discoverFilters: { gap: 10 },
    discoverSelect: {
      minHeight: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 16,
    },
    discoverSelectText: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
    discoverSelectPlaceholder: { color: colors.muted },
    pickerScrim: { flex: 1, backgroundColor: 'rgba(3,10,20,0.35)', justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      maxHeight: '62%',
    },
    pickerTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 17, letterSpacing: -0.4, marginBottom: 10 },
    pickerList: { flexGrow: 0, maxHeight: 320 },
    pickerRow: {
      minHeight: 48,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 12,
    },
    pickerRowText: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 15 },
    pickerRowTextActive: { color: colors.brandDeep, fontFamily: fonts.bold },
    discoverActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    shuffleBtn: { minHeight: 42, borderRadius: 21, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18 },
    shuffleBtnDisabled: { opacity: 0.45 },
    shuffleBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
    discoverPool: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
    hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 16 },
    noResults: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center', paddingVertical: 26 },
    webLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 22 },
    webLoadingText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 62, borderRadius: 18, padding: 12 },
    resultAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    resultFlag: { fontSize: 20, color: colors.ink },
    onlineAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted },
    onlineInitials: { color: colors.brandDeep, fontFamily: fonts.displayBlack, fontSize: 15 },
    resultCopy: { flex: 1, minWidth: 0 },
    resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    resultTitle: { flex: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    resultMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    resultSide: { alignItems: 'flex-end', gap: 4 },
    verifiedBadge: { borderRadius: 999, backgroundColor: colors.brand, paddingHorizontal: 8, paddingVertical: 2 },
    verifiedBadgeText: { color: colors.black, fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
    typeBadge: { borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 4 },
    typeBadgeText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 11 },
    onlineCard: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 12, marginVertical: 4 },
    onlineTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    addBtn: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 19, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, marginTop: 10 },
    addBtnBusy: { opacity: 0.7 },
    addBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
    referBtn: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, marginTop: 10 },
    referBtnText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 12 },
  });
