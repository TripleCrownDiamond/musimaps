import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  artists as catalogue,
  fetchMapArtists,
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

  // Artistes découverts (map_artists), comme la carte les charge.
  useEffect(() => {
    let cancelled = false;
    void fetchMapArtists().then((rows) => {
      if (!cancelled) setMapArtists(rows.map((row) => toArtist(row)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Catalogue éditorial + artistes découverts, comme sur la carte. */
  const allArtists = useMemo<Artist[]>(
    () => [...catalogue, ...mapArtists],
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

  const trending = useMemo(
    () => allArtists.filter((a) => a.trending).slice(0, 8),
    [allArtists],
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
      <AppBar navigation={navigation} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('discover.title')} subtitle={t('discover.subtitle')} />

        {allArtists.length === 0 ? (
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
    content: { paddingHorizontal: 20, paddingTop: spacing.lg, gap: spacing['2xl'] },
    empty: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
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
