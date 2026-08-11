import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchAll } from '@musimaps/shared';
import { AppBar } from '../components/AppBar';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import {
  addOrUpdateMapArtist,
  locateArtist,
  searchArtistOnline,
  type DiscoveredArtist,
} from '../lib/discovery';
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { fonts, shadow, type AppColors } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Search'>,
  NativeStackScreenProps<RootStackParamList>
>;

type GeocodedPlace = {
  id: string;
  label: string;
  coordinates: [number, number];
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export function SearchScreen({ navigation }: Props) {
  const { colors, theme } = useAppTheme();
  const { t } = useI18n();
  const { showToast } = useApp();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, theme === 'dark'), [colors, theme]);
  /** Position verticale des panneaux de résultats, sous l'AppBar + la recherche. */
  const panelTop = insets.top + 162;
  const [query, setQuery] = useState('');
  const [remotePlaces, setRemotePlaces] = useState<GeocodedPlace[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [webResults, setWebResults] = useState<DiscoveredArtist[]>([]);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  /** Candidat dont le géocodage a échoué : on bascule sur le référencement. */
  const [locateFailedId, setLocateFailedId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const results = useMemo(() => searchAll(query), [query]);
  const hasResults = query.length > 0 && (
    results.cities.length > 0 ||
    results.artists.length > 0 ||
    remotePlaces.length > 0 ||
    webResults.length > 0 ||
    searchingWeb
  );

  // Musibrainz : résultats web dès 2 caractères, en complément du catalogue.
  // On ne garde pas les artistes déjà connus (catalogue ou carte) : un même
  // artiste n'apparaît jamais deux fois dans la recherche.
  const knownNames = useMemo(() => {
    const names = new Set(results.artists.map((a) => a.name.trim().toLowerCase()));
    return names;
  }, [results.artists]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setWebResults([]);
      setSearchingWeb(false);
      setLocateFailedId(null);
      return;
    }
    // Nouvelle requête : on repart d'un état propre (géocodage échoué, etc.).
    setLocateFailedId(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchingWeb(true);
      void searchArtistOnline(q, controller.signal).then((found) => {
        if (controller.signal.aborted) return;
        // Dédup : on retire les artistes déjà présents dans le catalogue local.
        setWebResults(found.filter((r) => !knownNames.has(r.name.trim().toLowerCase())));
        setSearchingWeb(false);
      });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, knownNames]);

  // Charge l'historique à l'ouverture de l'écran.
  useEffect(() => {
    void getSearchHistory().then(setHistory);
  }, []);

  /** Mémorise la requête puis navigue vers la cible. */
  const rememberAndGo = (navigate: () => void) => {
    void addSearchHistory(query).then(setHistory);
    navigate();
  };

  /** Ajoute un artiste Musibrainz à la carte. Sans localisation fiable, on
   *  ne pose PAS de pin au centroïde du pays : le bouton est désactivé et
   *  « Demander le référencement » ouvre le formulaire d'artiste (le web et
   *  le mobile partagent la même table map_artists / waitlist). */
  const addCandidate = async (candidate: DiscoveredArtist) => {
    setAddingId(candidate.id);
    setLocateFailedId(null);
    const located = await locateArtist(candidate);
    if (located.error || !located.artist?.lat || !located.artist?.lng) {
      // Même comportement que le web : pas de pin sans localisation fiable,
      // on propose le référencement (l'admin validera une ville).
      setLocateFailedId(candidate.id);
      setAddingId(null);
      showToast(t('discovery.locationMissing'), 'location');
      return;
    }
    const fresh = located.artist;
    const result = await addOrUpdateMapArtist(fresh);
    setAddingId(null);
    if (!result.ok) {
      showToast(t('discovery.error'), 'alert-circle');
      return;
    }
    showToast(t('discovery.added'), 'checkmark-circle');
    setWebResults((prev) => prev.filter((r) => r.id !== candidate.id));
    rememberAndGo(() => navigation.navigate('Explore', {
      artistId: fresh.id,
      searchKey: Date.now(),
    }));
  };

  /** Ouvre le formulaire de référencement pré-rempli (même chemin web :
   *  l'admin validera la ville avant de poser le pin). */
  const openRefer = (candidate: DiscoveredArtist) => {
    rememberAndGo(() => navigation.navigate('ArtistJoin', {
      artistName: candidate.name,
      genre: candidate.genre,
      bio: candidate.bio,
    }));
  };

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2 || !MAPBOX_TOKEN) {
      setRemotePlaces([]);
      setGeocoding(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const params = new URLSearchParams({
          q: normalizedQuery,
          access_token: MAPBOX_TOKEN,
          limit: '5',
          types: 'place,locality,neighborhood',
          language: 'fr',
        });
        const response = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Geocoding unavailable');
        const payload = await response.json() as {
          features?: Array<{
            id?: string;
            geometry?: { coordinates?: number[] };
            properties?: {
              full_address?: string;
              name?: string;
              place_formatted?: string;
            };
          }>;
        };
        const localLabels = new Set(
          results.cities.map((city) => normalizeLabel(`${city.city}, ${city.country}`)),
        );
        setRemotePlaces(
          (payload.features ?? [])
            .flatMap((feature, index) => {
              const coordinates = feature.geometry?.coordinates;
              const properties = feature.properties;
              const label = properties?.full_address
                ?? [properties?.name, properties?.place_formatted].filter(Boolean).join(', ');
              if (!label || !coordinates || coordinates.length < 2) return [];
              if (localLabels.has(normalizeLabel(label))) return [];
              return [{
                id: feature.id ?? `${label}-${index}`,
                label,
                coordinates: [coordinates[0], coordinates[1]] as [number, number],
              }];
            }),
        );
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setRemotePlaces([]);
      } finally {
        if (!controller.signal.aborted) setGeocoding(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, results.cities]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* App bar : logo + notifications + thème, comme la navbar web */}
      <View style={[styles.appBarWrap, { paddingTop: insets.top + 10 }]}>
        <AppBar navigation={navigation} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={30} color={colors.ink} />
          <TextInput
            autoFocus
            value={query}
            underlineColorAndroid="transparent"
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.input}
          />
          <Ionicons name="mic-outline" size={27} color={colors.ink} />
        </View>
        <Pressable
          accessibilityLabel="Close search"
          style={styles.close}
          onPress={() => navigation.navigate('Explore')}
        >
          <Ionicons name="close" size={35} color={colors.ink} />
        </Pressable>
      </View>

      {hasResults && (
        <View style={[styles.resultsPanel, { top: panelTop, bottom: insets.bottom + 112 }]}>
          <ScrollView
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.cities.map((city) => (
              <Pressable
                key={`${city.city}-${city.country}`}
                style={styles.resultRow}
                onPress={() => rememberAndGo(() => navigation.navigate('Explore', {
                  city: `${city.city}, ${city.country}`,
                  coordinates: city.coordinates,
                  searchKey: Date.now(),
                }))}
              >
                <Ionicons name="navigate-outline" size={26} color={colors.ink} />
                <Text numberOfLines={1} style={styles.resultText}>{city.city}, {city.country}</Text>
              </Pressable>
            ))}

            {remotePlaces.map((place) => (
              <Pressable
                key={place.id}
                style={styles.resultRow}
                onPress={() => rememberAndGo(() => navigation.navigate('Explore', {
                  city: place.label,
                  coordinates: place.coordinates,
                  searchKey: Date.now(),
                }))}
              >
                <Ionicons name="location-outline" size={26} color={colors.ink} />
                <Text numberOfLines={2} style={styles.resultText}>{place.label}</Text>
              </Pressable>
            ))}

            {results.artists.map((artist) => (
              <Pressable
                key={artist.id}
                style={styles.resultRow}
                onPress={() => rememberAndGo(() => navigation.navigate('Explore', {
                  artistId: artist.id,
                  searchKey: Date.now(),
                }))}
              >
                <Ionicons name="person-add-outline" size={26} color={colors.ink} />
                <View style={styles.resultCopy}>
                  <Text numberOfLines={1} style={styles.resultText}>{artist.name}</Text>
                  <Text style={styles.resultMeta}>{artist.genre} · {artist.city}</Text>
                </View>
              </Pressable>
            ))}

            {/* Résultats Musibrainz : artistes pas encore sur la carte. */}
            {searchingWeb && webResults.length === 0 && (
              <View style={styles.webLoading}>
                <ActivityIndicator color={colors.brandDeep} />
                <Text style={styles.webLoadingText}>{t('discovery.searching')}</Text>
              </View>
            )}

            {webResults.length > 0 && (
              <Text style={styles.webSource}>{t('discovery.by')}</Text>
            )}

            {webResults.map((candidate) => {
              const located = Boolean(candidate.city?.trim());
              const failedLocate = locateFailedId === candidate.id;
              const showRefer = !located || failedLocate;
              return (
                <View key={candidate.id} style={styles.webRow}>
                  <View style={styles.resultCopy}>
                    <Text numberOfLines={1} style={styles.resultText}>{candidate.name}</Text>
                    <Text numberOfLines={1} style={styles.resultMeta}>
                      {candidate.genre} · {[candidate.city, candidate.country].filter(Boolean).join(', ') || '—'}
                    </Text>
                    {!located && (
                      <Text numberOfLines={2} style={styles.webHint}>
                        {t('discovery.referDisabled')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.webActions}>
                    {!showRefer && (
                      <Pressable
                        accessibilityRole="button"
                        style={styles.addBtn}
                        disabled={addingId !== null}
                        onPress={() => void addCandidate(candidate)}
                      >
                        {addingId === candidate.id ? (
                          <ActivityIndicator size="small" color={colors.brandDeep} />
                        ) : (
                          <Ionicons name="add" size={18} color={colors.brandDeep} />
                        )}
                        <Text style={styles.addBtnText}>{t('discovery.addShort')}</Text>
                      </Pressable>
                    )}
                    {showRefer && (
                      <Pressable
                        accessibilityRole="button"
                        style={styles.referBtn}
                        onPress={() => openRefer(candidate)}
                      >
                        <Ionicons name="paper-plane-outline" size={15} color={colors.brandDeep} />
                        <Text style={styles.referBtnText}>{t('discovery.refer')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {query.length > 0 && !hasResults && !geocoding && (
        <View style={[styles.empty, { top: panelTop }]}>
          <Ionicons name="search-outline" size={34} color={colors.muted} />
          <Text style={styles.emptyText}>{t('search.noResults')}</Text>
        </View>
      )}

      {query.length === 0 && (
        <View style={[styles.historyPanel, { top: panelTop }]}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>{t('search.history')}</Text>
            {history.length > 0 && (
              <Pressable
                accessibilityLabel={t('search.clearHistoryAria')}
                onPress={() => {
                  void clearSearchHistory().then(() => setHistory([]));
                }}
              >
                <Text style={styles.historyClear}>{t('search.clearHistory')}</Text>
              </Pressable>
            )}
          </View>
          {history.length === 0 ? (
            <Text style={styles.historyEmpty}>{t('search.historyEmpty')}</Text>
          ) : (
            <View style={styles.historyChips}>
              {history.map((item) => (
                <Pressable
                  key={item}
                  accessibilityLabel={t('search.historyAria', { query: item })}
                  onPress={() => setQuery(item)}
                  style={styles.historyChip}
                >
                  <Ionicons name="time-outline" size={16} color={colors.inkSoft} />
                  <Text style={styles.historyChipText} numberOfLines={1}>{item}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBarWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  resultsPanel: { position: 'absolute', left: 20, right: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: isDark ? 'rgba(20,24,31,0.97)' : 'rgba(255,255,255,0.95)', ...shadow },
  resultsContent: { paddingHorizontal: 16, paddingVertical: 10 },
  resultRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  resultCopy: { flex: 1 },
  resultText: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 18 },
  resultMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  webRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  webActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  webSource: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 4 },
  webHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  addBtn: { minHeight: 36, borderRadius: 18, backgroundColor: colors.brandSoft, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11 },
  addBtnDisabled: { backgroundColor: colors.background, opacity: 0.55 },
  addBtnText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 13 },
  addBtnDisabledText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 12 },
  referBtn: { minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9 },
  referBtnText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, maxWidth: 110 },
  webLoading: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  webLoadingText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  empty: { position: 'absolute', left: 20, right: 20, alignSelf: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15 },
  historyPanel: { position: 'absolute', left: 20, right: 20, maxHeight: '52%', borderRadius: 24, padding: 16, backgroundColor: isDark ? 'rgba(20,24,31,0.97)' : 'rgba(255,255,255,0.95)', ...shadow },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyTitle: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  historyClear: { color: colors.brand, fontFamily: fonts.medium, fontSize: 13 },
  historyEmpty: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.background },
  historyChipText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13, maxWidth: 220 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 2 },
  inputWrap: { flex: 1, height: 64, borderRadius: 33, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.line, ...shadow },
  input: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 0, borderWidth: 0, outlineWidth: 0 },
  close: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, ...shadow },
});

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
