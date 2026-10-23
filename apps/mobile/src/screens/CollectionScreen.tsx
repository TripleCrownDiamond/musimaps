import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_TITLE_MAX,
  collectionUrl,
  deleteCollection,
  fetchCollection,
  likeCollection,
  onUserBlocked,
  radii,
  removeFromCollection,
  spacing,
  unlikeCollection,
  updateCollection,
  type CollectionDetail,
} from '@musimaps/shared';
import { AccountAvatar } from '../components/AccountMedia';
import { ReportSheet } from '../components/ReportSheet';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { Button, ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Collection'>;

/** Sélection d'artistes — même contenu que la page web `/selection/:id`. */
export function CollectionScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { showToast } = useApp();
  const [collection, setCollection] = useState<CollectionDetail | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', isPublic: true });
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCollection(undefined);
    void fetchCollection(id).then((data) => {
      if (!cancelled) setCollection(data);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  useEffect(() => onUserBlocked(() => navigation.goBack()), [navigation]);

  if (collection === undefined) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  if (collection === null) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={() => navigation.goBack()} />
        <Text style={[styles.muted, styles.empty]}>{t('collection.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const ownerName = collection.owner.displayName || collection.owner.handle || '—';
  const fail = () => showToast(t('community.error'), 'alert-circle', 'error');

  const toggleLike = async () => {
    if (!user) return showToast(t('collection.loginToLike'), 'alert-circle', 'error');
    setBusy(true);
    const result = collection.likedByMe ? await unlikeCollection(collection.id) : await likeCollection(collection.id);
    setBusy(false);
    if (!result.ok) return fail();
    setCollection({
      ...collection,
      likedByMe: !collection.likedByMe,
      likeCount: collection.likeCount + (collection.likedByMe ? -1 : 1),
    });
  };

  const save = async () => {
    if (!draft.title.trim()) return showToast(t('collection.titleRequired'), 'alert-circle', 'error');
    setBusy(true);
    const result = await updateCollection(collection.id, draft);
    setBusy(false);
    if (!result.ok) return fail();
    setCollection({ ...collection, ...draft, title: draft.title.trim(), description: draft.description.trim() });
    setEditing(false);
  };

  const confirmDelete = () => {
    Alert.alert(t('collection.delete'), t('collection.deleteConfirm'), [
      { text: t('report.cancel'), style: 'cancel' },
      {
        text: t('collection.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteCollection(collection.id).then((result) => (result.ok ? navigation.goBack() : fail()));
        },
      },
    ]);
  };

  const removeArtist = async (artistId: string) => {
    const result = await removeFromCollection(collection.id, artistId);
    if (!result.ok) return fail();
    setCollection({
      ...collection,
      artists: collection.artists.filter((artist) => artist.id !== artistId),
      itemCount: collection.itemCount - 1,
    });
    showToast(t('collection.removed', { title: collection.title }), 'checkmark-circle');
  };

  const share = () => {
    const link = collectionUrl(collection.id, lang);
    void Share.share({ title: collection.title, message: `${collection.title} ${link}`, url: link }).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {editing ? (
          <View style={styles.form}>
            <Text style={styles.label}>{t('collection.titleLabel')}</Text>
            <TextInput
              value={draft.title}
              maxLength={COLLECTION_TITLE_MAX}
              onChangeText={(title) => setDraft({ ...draft, title })}
              style={styles.input}
            />
            <Text style={styles.label}>{t('collection.description')}</Text>
            <TextInput
              value={draft.description}
              maxLength={COLLECTION_DESCRIPTION_MAX}
              onChangeText={(description) => setDraft({ ...draft, description })}
              multiline
              style={[styles.input, styles.textarea]}
            />
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>{draft.isPublic ? t('collection.public') : t('collection.private')}</Text>
                <Text style={styles.muted}>{t('collection.publicHint')}</Text>
              </View>
              <Switch value={draft.isPublic} onValueChange={(isPublic) => setDraft({ ...draft, isPublic })} />
            </View>
            <View style={styles.actions}>
              <Button loading={busy} label={t('collection.save')} onPress={() => void save()} />
              <Button variant="outline" label={t('report.cancel')} onPress={() => setEditing(false)} />
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.titleRow}>
              {!collection.isPublic && <Ionicons name="lock-closed" size={18} color={colors.inkSoft} />}
              <Text style={styles.title}>{collection.title}</Text>
            </View>
            {collection.description ? <Text style={styles.description}>{collection.description}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={!collection.owner.handle}
              style={styles.owner}
              onPress={() => collection.owner.handle && navigation.push('PublicProfile', { handle: collection.owner.handle })}
            >
              <AccountAvatar name={ownerName} image={collection.owner.avatarUrl} variant="row" />
              <View style={styles.flex}>
                <Text style={styles.ownerName}>{t('collection.by', { name: ownerName })}</Text>
                <Text style={styles.muted}>
                  {t('collection.artists', { n: collection.itemCount })}  ·  {t('collection.likes', { n: collection.likeCount })}
                </Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              {!collection.isMine && (
                <Button
                  variant={collection.likedByMe ? 'brand' : 'outline'}
                  loading={busy}
                  label={t('collection.like')}
                  icon={<Ionicons name={collection.likedByMe ? 'heart' : 'heart-outline'} size={17} color={collection.likedByMe ? colors.black : colors.ink} />}
                  onPress={() => void toggleLike()}
                />
              )}
              {collection.isPublic && (
                <Button
                  variant="outline"
                  label={t('community.share')}
                  icon={<Ionicons name="share-outline" size={17} color={colors.ink} />}
                  onPress={share}
                />
              )}
              {collection.isMine && (
                <>
                  <Button
                    variant="outline"
                    label={t('collection.edit')}
                    icon={<Ionicons name="pencil" size={16} color={colors.ink} />}
                    onPress={() => {
                      setDraft({ title: collection.title, description: collection.description, isPublic: collection.isPublic });
                      setEditing(true);
                    }}
                  />
                  <Button variant="ghost" label={t('collection.delete')} onPress={confirmDelete} />
                </>
              )}
            </View>
          </View>
        )}

        <View style={styles.list}>
          {collection.artists.length === 0 ? (
            <Text style={styles.muted}>{t('collection.empty')}</Text>
          ) : (
            collection.artists.map((artist) => (
              <View key={artist.id} style={styles.artistRow}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.artistMain}
                  onPress={() => navigation.navigate('ArtistProfile', { artistId: artist.id })}
                >
                  <AccountAvatar name={artist.name} image={artist.image} variant="row" />
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.ownerName}>{artist.name}</Text>
                    <Text numberOfLines={1} style={styles.muted}>{[artist.genre, artist.city].filter(Boolean).join(' · ')}</Text>
                  </View>
                </Pressable>
                {collection.isMine && (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('collection.remove')} hitSlop={8} onPress={() => void removeArtist(artist.id)}>
                    <Ionicons name="close" size={20} color={colors.inkSoft} />
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>

        {!collection.isMine && user && (
          <Pressable accessibilityRole="button" style={styles.report} onPress={() => setReportOpen(true)}>
            <Ionicons name="flag" size={13} color={colors.danger} />
            <Text style={styles.reportText}>{t('collection.report')}</Text>
          </Pressable>
        )}
      </ScrollView>
      {reportOpen && (
        <ReportSheet
          target={{ kind: 'collection', id: collection.id }}
          name={ownerName}
          blockUserId={collection.owner.id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1, minWidth: 0 },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    empty: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
    muted: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    title: { flexShrink: 1, color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 26 },
    description: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
    owner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    ownerName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
    list: { marginTop: spacing.xl, gap: spacing.sm },
    artistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii['2xl'],
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    artistMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    form: { gap: spacing.sm, marginTop: spacing.sm },
    label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    input: {
      borderRadius: radii['2xl'],
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 14,
    },
    textarea: { minHeight: 96, textAlignVertical: 'top' },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii['2xl'],
      backgroundColor: colors.surfaceMuted,
    },
    switchTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: spacing['2xl'] },
    reportText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 12 },
  });
