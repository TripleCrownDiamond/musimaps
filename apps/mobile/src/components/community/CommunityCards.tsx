import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, type CollectionSummary, type PublicPerson } from '@musimaps/shared';
import { useAppTheme } from '../../context/ThemeContext';
import { useI18n } from '../../i18n';
import { fonts, type AppColors } from '../../theme';
import { AccountAvatar } from '../AccountMedia';

/** Vignette d'une sélection : mosaïque des photos d'artistes, titre, compteurs (même carte que le web). */
export function CollectionCard({ collection, onPress }: { collection: CollectionSummary; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const covers = collection.covers.filter(Boolean).slice(0, 4) as string[];
  return (
    <Pressable accessibilityRole="button" style={styles.card} onPress={onPress}>
      <View style={styles.mosaic}>
        {covers.length > 0 ? (
          covers.map((uri) => <Image key={uri} source={{ uri }} style={styles.cover} />)
        ) : (
          <View style={styles.coverEmpty}>
            <Ionicons name="musical-notes-outline" size={26} color={colors.brandPrimary} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          {!collection.isPublic && <Ionicons name="lock-closed" size={13} color={colors.inkSoft} />}
          <Text numberOfLines={1} style={styles.title}>{collection.title}</Text>
        </View>
        {collection.owner?.displayName ? (
          <Text numberOfLines={1} style={styles.meta}>{t('collection.by', { name: collection.owner.displayName })}</Text>
        ) : null}
        <Text style={styles.meta}>
          {t('collection.artists', { n: collection.itemCount })}
          {collection.likeCount > 0 ? `  ·  ♥ ${collection.likeCount}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

/** Ligne d'un mélomane : avatar, nom, @identifiant, ville. */
export function PersonRow({ person, onPress }: { person: PublicPerson; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const name = person.displayName || person.handle || '—';
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} style={styles.person} onPress={onPress}>
      <AccountAvatar name={name} image={person.avatarUrl} variant="row" />
      <View style={styles.personCopy}>
        <Text numberOfLines={1} style={styles.title}>{name}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[person.handle ? `@${person.handle}` : null, person.city].filter(Boolean).join('  ·  ')}
        </Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />}
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radii['3xl'],
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    mosaic: { flexDirection: 'row', aspectRatio: 2, backgroundColor: colors.surfaceMuted, gap: 2 },
    cover: { flex: 1, height: '100%' },
    coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cardBody: { padding: spacing.md, gap: spacing.xs },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    title: { flexShrink: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    meta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
    person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    personCopy: { flex: 1, minWidth: 0 },
  });
