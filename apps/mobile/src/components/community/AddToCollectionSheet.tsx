import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addToCollection,
  COLLECTION_MAX_ITEMS,
  COLLECTION_TITLE_MAX,
  createCollection,
  fetchCollectionsContaining,
  fetchMyCollections,
  radii,
  removeFromCollection,
  spacing,
  type CollectionSummary,
} from '@musimaps/shared';
import { useApp } from '../../context/AppContext';
import { useAppTheme } from '../../context/ThemeContext';
import { useI18n } from '../../i18n';
import { fonts, type AppColors } from '../../theme';

/**
 * Ranger un artiste dans une sélection, ou en créer une — même parcours que
 * `AddToCollectionDialog` côté web ; logique dans `@musimaps/shared/lib/community`.
 */
export function AddToCollectionSheet({ artistId, onClose }: { artistId: string; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { showToast } = useApp();
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [containing, setContaining] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchMyCollections(), fetchCollectionsContaining(artistId)]).then(([mine, inside]) => {
      if (cancelled) return;
      setCollections(mine);
      setContaining(new Set(inside));
    });
    return () => {
      cancelled = true;
    };
  }, [artistId]);

  const toggle = async (collection: CollectionSummary) => {
    setBusy(collection.id);
    const inside = containing.has(collection.id);
    const result = inside
      ? await removeFromCollection(collection.id, artistId)
      : await addToCollection(collection.id, artistId);
    setBusy(null);
    if (!result.ok) {
      const message = result.error === 'collection_full'
        ? t('collection.full', { max: COLLECTION_MAX_ITEMS })
        : t('community.error');
      return showToast(message, 'alert-circle', 'error');
    }
    setContaining((current) => {
      const next = new Set(current);
      if (inside) next.delete(collection.id);
      else next.add(collection.id);
      return next;
    });
    showToast(t(inside ? 'collection.removed' : 'collection.added', { title: collection.title }), 'checkmark-circle');
  };

  const create = async () => {
    if (!title.trim()) return showToast(t('collection.titleRequired'), 'alert-circle', 'error');
    setBusy('new');
    const created = await createCollection({ title });
    if ('error' in created) {
      setBusy(null);
      return showToast(t('community.error'), 'alert-circle', 'error');
    }
    const added = await addToCollection(created.id, artistId);
    setBusy(null);
    if (!added.ok) return showToast(t('community.error'), 'alert-circle', 'error');
    const fresh: CollectionSummary = {
      id: created.id, title: title.trim(), description: '', isPublic: true,
      updatedAt: new Date().toISOString(), itemCount: 1, likeCount: 0, covers: [],
    };
    setCollections((current) => [fresh, ...(current ?? [])]);
    setContaining((current) => new Set(current).add(created.id));
    setTitle('');
    showToast(t('collection.added', { title: fresh.title }), 'checkmark-circle');
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scrim}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{t('collection.addTo')}</Text>
                <Text style={styles.subtitle}>{t('collection.addToHint')}</Text>
              </View>
              <Pressable accessibilityLabel={t('report.cancel')} style={styles.close} onPress={onClose}>
                <Ionicons name="close" size={18} color={colors.ink} />
              </Pressable>
            </View>

            {collections === null ? (
              <ActivityIndicator color={colors.brandPrimary} style={styles.loader} />
            ) : collections.length === 0 ? (
              <Text style={styles.subtitle}>{t('collection.noneYet')}</Text>
            ) : (
              collections.map((collection) => {
                const inside = containing.has(collection.id);
                return (
                  <Pressable
                    key={collection.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: inside }}
                    disabled={busy !== null}
                    style={[styles.option, inside && styles.optionActive]}
                    onPress={() => void toggle(collection)}
                  >
                    <View style={styles.headerCopy}>
                      <Text numberOfLines={1} style={styles.optionText}>{collection.title}</Text>
                      <Text style={styles.subtitle}>{t('collection.artists', { n: collection.itemCount })}</Text>
                    </View>
                    {busy === collection.id ? (
                      <ActivityIndicator color={colors.brandPrimary} />
                    ) : (
                      <Ionicons name={inside ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={inside ? colors.brandDeep : colors.inkSoft} />
                    )}
                  </Pressable>
                );
              })
            )}

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
              <Pressable
                accessibilityRole="button"
                disabled={busy !== null}
                style={[styles.createBtn, busy !== null && styles.disabled]}
                onPress={() => void create()}
              >
                {busy === 'new' ? <ActivityIndicator color={colors.white} /> : <Ionicons name="add" size={20} color={colors.white} />}
                <Text style={styles.createText}>{t('collection.create')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,10,20,0.55)' },
    dismiss: { flex: 1 },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, maxHeight: '88%' },
    handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
    content: { paddingHorizontal: 20, paddingBottom: 28 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    headerCopy: { flex: 1, minWidth: 0 },
    title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20, letterSpacing: -0.6 },
    subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    loader: { marginVertical: spacing.xl },
    option: {
      minHeight: 52,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 10,
    },
    optionActive: { borderColor: colors.brandDeep, backgroundColor: colors.brandSoft },
    optionText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.full,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 14,
    },
    createBtn: {
      minHeight: 48,
      borderRadius: radii.full,
      backgroundColor: colors.brandDeep,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 16,
    },
    createText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
    disabled: { opacity: 0.5 },
  });
