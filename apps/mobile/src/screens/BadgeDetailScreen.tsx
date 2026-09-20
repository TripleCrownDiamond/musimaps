import { badgeIcon } from '../badgeIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLevelInfo, radii, spacing, SITE_URL } from '@musimaps/shared';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { Button, Card, ScreenHeader } from '../ui';
import { fonts, type AppColors } from '../theme';
import { badgeText, formatEarnedDate, levelTitle } from '../lib/gamificationText';

type Props = NativeStackScreenProps<RootStackParamList, 'BadgeDetail'>;

/**
 * Fiche d'un accomplissement, ouverte depuis sa notification ou la liste des
 * badges. La notification d'un badge débloqué renvoyait sur la carte, centrée
 * sur la position : rien à voir avec le badge.
 */
export function BadgeDetailScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { badges, earnedBadges, points } = useApp();
  const { user } = useAuth();
  const { badgeId } = route.params;
  const badge = badges.find((item) => item.id === badgeId);
  const earnedAt = earnedBadges.find((entry) => entry.id === badgeId)?.earnedAt;
  const level = getLevelInfo(points);

  const share = () => {
    if (!badge) return;
    const message = `${t('badges.detailShareMessage', {
      name: user?.displayName || t('profile.defaultName'),
      label: badgeText(t, badge.id, 'title', badge.label),
      points: badge.points,
    })} ${SITE_URL}`;
    void Share.share({ message });
  };

  const seeAll = () => navigation.navigate('Badges');

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader title={t('badges.detailTitle')} onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {badge ? (
          <>
            <Card style={styles.hero}>
              <View style={[styles.medal, !badge.earned && styles.medalLocked]}>
                <Ionicons
                  name={badge.earned ? badgeIcon(badge.icon) : 'lock-closed'}
                  size={44}
                  color={badge.earned ? colors.black : colors.muted}
                />
              </View>
              <Text style={[styles.status, !badge.earned && styles.statusLocked]}>
                {badge.earned
                  ? earnedAt
                    ? t('badges.earnedDate', { date: formatEarnedDate(earnedAt, lang, t) })
                    : t('badges.detailUnlocked')
                  : t('badges.detailLocked')}
              </Text>
              <Text style={styles.title}>{badgeText(t, badge.id, 'title', badge.label)}</Text>
              <Text style={styles.description}>{badgeText(t, badge.id, 'desc', badge.description)}</Text>
              <View style={styles.pointsChip}>
                <Ionicons name="sparkles" size={14} color={colors.brandPrimary} />
                <Text style={styles.pointsText}>
                  +{badge.points} {t('common.pts')}
                </Text>
              </View>
            </Card>

            <Card style={styles.levelCard} onPress={seeAll}>
              <View style={styles.levelCopy}>
                <Text style={styles.levelEyebrow}>{t('badges.level', { level: level.level })}</Text>
                <Text style={styles.levelTitle}>
                  {levelTitle(t, level)} · {points} {t('common.pts')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Card>

            {badge.earned ? (
              <Button
                block
                size="lg"
                label={t('badges.detailShare')}
                icon={<Ionicons name="share-social-outline" size={20} color={colors.white} />}
                onPress={share}
              />
            ) : (
              <Button
                block
                size="lg"
                label={t('badges.continueExploring')}
                icon={<Ionicons name="globe-outline" size={20} color={colors.white} />}
                onPress={() => navigation.navigate('Main', { screen: 'Explore' })}
              />
            )}
            <Button
              block
              size="lg"
              variant="outline"
              label={t('badges.seeAllAchievements')}
              icon={<Ionicons name="trophy-outline" size={20} color={colors.brandPrimary} />}
              onPress={seeAll}
            />
          </>
        ) : badges.length > 0 ? (
          <Card style={styles.hero}>
            <Text style={styles.description}>{t('badges.detailMissing')}</Text>
            <Button block size="lg" variant="outline" label={t('badges.seeAllAchievements')} onPress={seeAll} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing['4xl'],
      gap: spacing.lg,
    },
    hero: { alignItems: 'center', padding: spacing['2xl'], gap: spacing.sm },
    medal: {
      width: 104,
      height: 104,
      borderRadius: radii.full,
      backgroundColor: colors.brandSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    medalLocked: { backgroundColor: colors.surfaceMuted },
    status: {
      color: colors.brandPrimary,
      fontFamily: fonts.bold,
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    statusLocked: { color: colors.muted },
    title: {
      color: colors.ink,
      fontFamily: fonts.displayBlack,
      fontSize: 28,
      letterSpacing: -1,
      textAlign: 'center',
    },
    description: {
      color: colors.inkSoft,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    pointsChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.full,
      backgroundColor: colors.brandSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginTop: spacing.sm,
    },
    pointsText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 14 },
    levelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    levelCopy: { flex: 1, gap: spacing.xs },
    levelEyebrow: {
      color: colors.brandPrimary,
      fontFamily: fonts.bold,
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    levelTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
  });
