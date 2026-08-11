import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar } from '../components/AppBar';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { artists } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Saved'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function SavedScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { favorites, toggleFavorite } = useApp();
  const savedArtists = artists.filter((artist) => favorites.includes(artist.id));

  return (
    <View style={styles.container}>
      {/* App bar : logo + notifications + thème, comme la navbar web */}
      <View style={[styles.appBarWrap, { paddingTop: insets.top + 10 }]}>
        <AppBar navigation={navigation} />
      </View>

      <View style={styles.header}>
        <Text style={styles.kicker}>{t('saved.kicker')}</Text>
        <Text style={styles.title}>{t('saved.title')}</Text>
        <Text style={styles.subtitle}>{t('saved.subtitle')}</Text>
      </View>

      {savedArtists.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={38} color={colors.brandDeep} />
          </View>
          <Text style={styles.emptyTitle}>{t('saved.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('saved.emptyText')}</Text>
          <Pressable style={styles.exploreButton} onPress={() => navigation.navigate('Explore')}>
            <Text style={styles.exploreButtonText}>{t('saved.explore')}</Text>
            <Ionicons name="arrow-forward" size={19} color={colors.white} />
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {savedArtists.map((artist) => (
            <Pressable
              key={artist.id}
              style={styles.card}
              onPress={() => navigation.navigate('Explore', { artistId: artist.id })}
            >
              <ArtistAvatar artist={artist} size={72} />
              <View style={styles.copy}>
                <Text style={styles.artistName}>{artist.name}</Text>
                <Text style={styles.meta}>
                  {artist.genre} · {artist.city}
                </Text>
                <Text style={styles.location}>
                  {artist.flag} {artist.country}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={t('saved.removeFavorite', { name: artist.name })}
                hitSlop={10}
                onPress={() => toggleFavorite(artist.id)}
              >
                <Ionicons name="heart" size={25} color={colors.danger} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBarWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  header: { paddingHorizontal: 21, paddingTop: 10 },
  kicker: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6 },
  title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 34, letterSpacing: -1.5, marginTop: 7 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38, paddingBottom: 70 },
  emptyIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 24, letterSpacing: -0.8, marginTop: 20 },
  emptyText: { color: colors.inkSoft, fontFamily: fonts.body, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  exploreButton: { minHeight: 55, borderRadius: 28, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 22, marginTop: 24 },
  exploreButtonText: { color: colors.white, fontFamily: fonts.bold },
  list: { padding: 20, paddingTop: 28, paddingBottom: 120, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 25, backgroundColor: colors.surface, padding: 13 },
  copy: { flex: 1 },
  artistName: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 19, letterSpacing: -0.5 },
  meta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginTop: 3 },
  location: { color: colors.ink, fontFamily: fonts.medium, fontSize: 12, marginTop: 5 },
});
