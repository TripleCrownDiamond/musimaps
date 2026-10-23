import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  COLLECTION_TITLE_MAX,
  createCollection,
  fetchFollowedPeople,
  fetchFollowingCollections,
  fetchMyCollections,
  fetchMyPublicSettings,
  PEOPLE_SEARCH_DEBOUNCE_MS,
  radii,
  searchPeople,
  spacing,
  type CollectionSummary,
  type PublicPerson,
} from '@musimaps/shared';
import { CollectionCard, PersonRow } from '../components/community/CommunityCards';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { Button, ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Community'>;

/**
 * Communauté : rechercher des mélomanes, ses sélections, le fil des
 * mélomanes suivis — même contenu que la page web `/communaute`.
 */
export function CommunityScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { user } = useAuth();
  const { showToast } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicPerson[] | null>(null);
  const [mine, setMine] = useState<CollectionSummary[] | null>(null);
  const [feed, setFeed] = useState<CollectionSummary[]>([]);
  const [followed, setFollowed] = useState<PublicPerson[]>([]);
  const [publicSettings, setPublicSettings] = useState<{ isPublic: boolean; handle: string | null } | null>(null);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Rechargé au retour d'une sélection ou d'un profil (création, suivi…).
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      void Promise.all([fetchMyCollections(), fetchFollowingCollections(), fetchFollowedPeople(), fetchMyPublicSettings()]).then(
        ([collections, following, people, settings]) => {
          if (cancelled) return;
          setMine(collections);
          setFeed(following);
          setFollowed(people);
          setPublicSettings(settings);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchPeople(query).then((people) => {
        if (!cancelled) setResults(people);
      });
    }, PEOPLE_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const create = async () => {
    if (!title.trim()) return showToast(t('collection.titleRequired'), 'alert-circle', 'error');
    setCreating(true);
    const created = await createCollection({ title });
    setCreating(false);
    if ('error' in created) return showToast(t('community.error'), 'alert-circle', 'error');
    setTitle('');
    navigation.navigate('Collection', { id: created.id });
  };

  const openPerson = (person: PublicPerson) => {
    if (person.handle) navigation.navigate('PublicProfile', { handle: person.handle });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader title={t('community.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.muted}>{t('community.subtitle')}</Text>

        {!user && (
          <View style={styles.card}>
            <Text style={styles.cardText}>{t('community.loginRequired')}</Text>
            <Button label={t('auth.login')} onPress={() => navigation.navigate('Login')} />
          </View>
        )}

        {user && publicSettings && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{publicSettings.isPublic ? t('community.publicOn') : t('community.publicOff')}</Text>
            {!publicSettings.isPublic && <Text style={styles.cardText}>{t('community.privateNotice')}</Text>}
            {publicSettings.isPublic && publicSettings.handle ? (
              <Button
                variant="outline"
                label={t('community.viewMyProfile')}
                onPress={() => navigation.navigate('PublicProfile', { handle: publicSettings.handle! })}
              />
            ) : (
              <Button label={t('community.makePublicCta')} onPress={() => navigation.navigate('ProfileEdit')} />
            )}
          </View>
        )}

        {user && (
          <>
            <Text style={styles.section}>{t('collection.my')}</Text>
            <View style={styles.createRow}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={COLLECTION_TITLE_MAX}
                placeholder={t('collection.titlePlaceholder')}
                placeholderTextColor={colors.muted}
                accessibilityLabel={t('collection.new')}
                style={styles.input}
                onSubmitEditing={() => void create()}
              />
              <Pressable accessibilityRole="button" disabled={creating} style={styles.createBtn} onPress={() => void create()}>
                {creating ? <ActivityIndicator color={colors.white} /> : <Ionicons name="add" size={22} color={colors.white} />}
              </Pressable>
            </View>
            {mine === null ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : mine.length === 0 ? (
              <Text style={styles.muted}>{t('collection.noneYet')}</Text>
            ) : (
              mine.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} onPress={() => navigation.navigate('Collection', { id: collection.id })} />
              ))
            )}

            <Text style={styles.section}>{t('community.feedTitle')}</Text>
            {feed.length === 0 ? (
              <Text style={styles.muted}>{t('community.feedEmpty')}</Text>
            ) : (
              feed.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} onPress={() => navigation.navigate('Collection', { id: collection.id })} />
              ))
            )}

            {followed.length > 0 && (
              <>
                <Text style={styles.section}>{t('community.followedPeople')}</Text>
                {followed.map((person) => (
                  <PersonRow key={person.id} person={person} onPress={() => openPerson(person)} />
                ))}
              </>
            )}
          </>
        )}

        <Text style={styles.section}>{t('community.peopleTitle')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('community.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('community.searchPlaceholder')}
          autoCapitalize="none"
          style={[styles.input, styles.search]}
        />
        {results === null ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : results.length === 0 ? (
          <Text style={styles.muted}>{t('community.searchEmpty')}</Text>
        ) : (
          results.map((person) => <PersonRow key={person.id} person={person} onPress={() => openPerson(person)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    muted: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
    card: {
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radii['3xl'],
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      marginTop: spacing.lg,
    },
    cardTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    cardText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
    section: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, marginTop: spacing.xl, marginBottom: spacing.md },
    createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.full,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 14,
    },
    search: { flex: 0, marginBottom: spacing.sm },
    createBtn: {
      width: 48,
      height: 48,
      borderRadius: radii.full,
      backgroundColor: colors.brandDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
