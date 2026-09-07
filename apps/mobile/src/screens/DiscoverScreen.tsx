import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  artists as catalogue,
  fetchAllArtistPopularity,
  fetchMapArtists,
  parseFollowersCount,
  radii,
  spacing,
  toArtist,
  type Artist,
} from '@musimaps/shared';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { AppBar } from '../components/AppBar';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Button, Section } from '../ui';
import { fonts, type AppColors } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Discover'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DISCOVER_INITIAL_RESULT_LIMIT = 12;
const DISCOVER_TRENDING_LIMIT = 8;

/**
 * Onglet Découvrir.
 *
 * Il remplace l'ancien onglet « Rechercher », qui dupliquait mot pour mot la
 * recherche déjà présente dans l'écran Carte : ses six actions renvoyaient
 * toutes vers `Explore`. On quittait la carte pour y être ramené.
 *
 * Le panneau « Découverte » (filtres ville/genre + tirage au sort) existait
 * déjà, mais enfoui dans la feuille de recherche de la carte — visible
 * uniquement si l'on ouvrait la recherche SANS rien taper. Il remonte ici,
 * dans un onglet qui a enfin une raison d'exister.
 */
export function DiscoverScreen({ navigation }: Props) {
  const { colors, theme } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, theme === 'dark'), [colors, theme]);

  const [genre, setGenre] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [mapArtists, setMapArtists] = useState<Artist[]>([]);
  const [popularityById, setPopularityById] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Même source et même score que la carte : un retour sur l'onglet reflète
  // immédiatement les artistes ajoutés ou les nouvelles vues.
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void Promise.all([fetchMapArtists(), fetchAllArtistPopularity()])
      .then(([rows, popularity]) => {
        if (cancelled) return;
        setMapArtists(rows.map((row) => toArtist(row)));
        setPopularityById(popularity);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  /** Catalogue éditorial + artistes découverts, comme sur la carte. */
  const allArtists = useMemo<Artist[]>(
    () => {
      const byId = new Map<string, Artist>();
      for (const artist of catalogue) byId.set(artist.id, artist);
      // La donnée publiée remplace le catalogue si les deux partagent un id.
      for (const artist of mapArtists) byId.set(artist.id, artist);
      return [...byId.values()];
    },
    [mapArtists],
  );

  /** Genres présents, du plus fourni au moins fourni. */
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of allArtists) {
      const g = a.genre?.trim();
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
      .map(([label, count]) => ({ label, count }));
  }, [allArtists]);

  /** Villes présentes, du plus fourni au moins fourni. */
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of allArtists) {
      const c = a.city?.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
      .map(([label, count]) => ({ label, count }));
  }, [allArtists]);

  /** Artistes retenus par les filtres — alimente le tirage et le compteur. */
  const pool = useMemo(
    () =>
      allArtists.filter((a) => {
        if (genre && a.genre?.trim() !== genre) return false;
        if (city && a.city?.trim() !== city) return false;
        return true;
      }),
    [allArtists, genre, city],
  );

  const scoreFor = useCallback(
    (artist: Artist) => (popularityById.get(artist.id) ?? 0) + parseFollowersCount(artist.followers),
    [popularityById],
  );

  // Les tendances viennent des scores réels (vues + abonnés), avec le flag
  // éditorial comme départage. Aucun nom d'artiste n'est injecté dans l'UI.
  const trending = useMemo(() => {
    return [...allArtists]
      .sort((a, b) => {
        const editorial = Number(Boolean(b.trending)) - Number(Boolean(a.trending));
        return editorial || scoreFor(b) - scoreFor(a) || a.name.localeCompare(b.name, 'fr');
      })
      .slice(0, DISCOVER_TRENDING_LIMIT);
  }, [allArtists, scoreFor]);

  const visibleResults = useMemo(
    () => (showAll ? pool : pool.slice(0, DISCOVER_INITIAL_RESULT_LIMIT)),
    [pool, showAll],
  );

  /** Ouvre un artiste sur la carte — la carte reste la surface de lecture. */
  const openArtist = (artist: Artist) =>
    navigation.navigate('Explore', { artistId: artist.id, searchKey: Date.now() });

  const shuffle = () => {
    if (pool.length === 0) return;
    openArtist(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.appBarWrap, { paddingTop: insets.top + 10 }]}>
        <AppBar navigation={navigation} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('discover.title')} subtitle={t('discover.subtitle')} />

        {loading && (
          <View style={styles.loadingRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>{t('discover.loading')}</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('discover.loadError')}</Text>
            <Button variant="outline" size="sm" label={t('discover.retry')} onPress={load} />
          </View>
        )}

        {allArtists.length === 0 && !loading ? (
          <Text style={styles.empty}>{t('discover.empty')}</Text>
        ) : (
          <>
            <Section title={t('discover.byGenre')}>
              <ChipRow
                options={genres}
                selected={genre}
                onSelect={setGenre}
                allLabel={t('globe.discoverGenre')}
                styles={styles}
              />
            </Section>

            <Section title={t('discover.byCity')}>
              <ChipRow
                options={cities}
                selected={city}
                onSelect={setCity}
                allLabel={t('globe.discoverCity')}
                styles={styles}
              />
            </Section>

            <View style={styles.shuffleRow}>
              <Button
                block
                size="lg"
                label={t('globe.discoverShuffle')}
                onPress={shuffle}
                disabled={pool.length === 0}
                icon={<Ionicons name="shuffle" size={18} color={colors.white} />}
              />
              <Text style={styles.poolCount}>
                {t('discover.resultCount', {
                  count: pool.length,
                  s: pool.length > 1 ? 's' : '',
                })}
              </Text>
            </View>

            <Section title={t('discover.results')} subtitle={t('discover.resultsSub')}>
              {pool.length === 0 ? (
                <Text style={styles.empty}>{t('discover.noResults')}</Text>
              ) : (
                <View style={styles.resultsList}>
                  {visibleResults.map((artist) => (
                    <Pressable
                      key={artist.id}
                      accessibilityRole="button"
                      accessibilityLabel={t('explore.seeArtist', { name: artist.name })}
                      onPress={() => openArtist(artist)}
                      style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
                    >
                      <ArtistAvatar
                        artist={artist}
                        size={50}
                        gradient={[colors.brandPrimary, colors.brandSecondary]}
                        initialsColor={colors.black}
                        borderless
                      />
                      <View style={styles.resultCopy}>
                        <Text style={styles.resultName} numberOfLines={1}>{artist.name}</Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {[artist.genre, artist.city, artist.country].filter(Boolean).join(' · ') || t('discover.unknownLocation')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </Pressable>
                  ))}
                  {pool.length > DISCOVER_INITIAL_RESULT_LIMIT && (
                    <Button
                      variant="link"
                      size="sm"
                      label={showAll ? t('discover.showLess') : t('discover.seeAll')}
                      onPress={() => setShowAll((value) => !value)}
                      style={styles.resultsToggle}
                    />
                  )}
                </View>
              )}
            </Section>

            {trending.length > 0 && (
              <Section title={t('discover.trending')} subtitle={t('discover.trendingSub')}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingRow}
                >
                  {trending.map((artist) => (
                    <Pressable
                      key={artist.id}
                      accessibilityRole="button"
                      accessibilityLabel={t('explore.seeArtist', { name: artist.name })}
                      onPress={() => openArtist(artist)}
                      style={({ pressed }) => [styles.trendingCard, pressed && styles.pressed]}
                    >
                      <ArtistAvatar artist={artist} size={64} />
                      <Text style={styles.trendingName} numberOfLines={1}>
                        {artist.name}
                      </Text>
                      <Text style={styles.trendingMeta} numberOfLines={1}>
                        {artist.city}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Bande de puces défilante — « Tous » plus une puce par valeur. */
function ChipRow({
  options,
  selected,
  onSelect,
  allLabel,
  styles,
}: {
  options: Array<{ label: string; count: number }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
  allLabel: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <Chip label={allLabel} active={selected === null} onPress={() => onSelect(null)} styles={styles} />
      {options.map((option) => (
        <Chip
          key={option.label}
          label={`${option.label} · ${option.count}`}
          active={selected === option.label}
          onPress={() => onSelect(selected === option.label ? null : option.label)}
          styles={styles}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: AppColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    appBarWrap: { paddingHorizontal: 20, paddingBottom: spacing.md },
    content: { paddingHorizontal: 20, paddingTop: spacing.lg, gap: spacing['2xl'] },
    empty: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    loadingText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
    errorBox: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii['2xl'], backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.line },
    errorText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
    chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
    chipText: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 13 },
    chipTextActive: { color: colors.white, fontFamily: fonts.bold },
    shuffleRow: { gap: spacing.sm },
    poolCount: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
    resultsList: { gap: spacing.sm },
    resultCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii['2xl'], backgroundColor: isDark ? colors.surfaceMuted : colors.surface, borderWidth: 1, borderColor: colors.line },
    resultCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
    resultName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    resultMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
    resultsToggle: { alignSelf: 'center' },
    trendingRow: { gap: spacing.lg, paddingRight: spacing.lg },
    trendingCard: {
      width: 96,
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: radii['2xl'],
      backgroundColor: isDark ? colors.surfaceMuted : colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    trendingName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },
    trendingMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, textAlign: 'center' },
    pressed: { opacity: 0.75 },
  });
