import { badgeIcon } from '../badgeIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { getLevelInfo, radii, spacing } from '@musimaps/shared';
import { useI18n, type MessageKey } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { Button, Card, ScreenHeader, Section } from '../ui';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Badges'>;

type Lang = 'fr' | 'en'

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

function formatDate(timestamp: number, lang: Lang, t: Translate): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return t('badges.today', {
      time: `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`,
    });
  }
  const yesterday = new Date(now.getTime() - 86400000);
  if (date.toDateString() === yesterday.toDateString()) return t('badges.yesterday');
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Écran dédié : niveau, points, badges débloqués (historique) et à débloquer. */
export function BadgesScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { badges, earnedBadges, points } = useApp();
  const level = getLevelInfo(points);
  const earnedCount = badges.filter((badge) => badge.earned).length;

  // Historique du plus récent au plus ancien.
  const history = useMemo(
    () =>
      earnedBadges
        .slice()
        .sort((a, b) => b.earnedAt - a.earnedAt)
        .map((entry) => ({
          ...entry,
          def: badges.find((badge) => badge.id === entry.id),
        }))
        .filter((entry) => entry.def),
    [earnedBadges, badges],
  );

  const locked = badges.filter((badge) => !badge.earned);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader title={t('badges.title')} onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/*
          Même carte de niveau que le dashboard web : aplat doux `brand-soft`
          vers la surface, jamais un dégradé de marque saturé. Le lime ne sert
          qu'à terminer la barre de progression.
        */}
        <LinearGradient
          colors={[colors.brandSoft, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroEyebrow}>{t('badges.level', { level: level.level })}</Text>
              <Text style={styles.heroTitle}>{level.title}</Text>
            </View>
            <View style={styles.heroPoints}>
              <Text style={styles.heroPointsValue}>{points}</Text>
              <Text style={styles.heroPointsLabel}>{t('common.pts')}</Text>
            </View>
          </View>
          <View style={styles.heroTrack}>
            <LinearGradient
              colors={[colors.brandPrimary, colors.brandSecondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.heroFill, { width: `${level.progress * 100}%` }]}
            />
          </View>
          <Text style={styles.heroHint}>
            {level.nextMin !== null
              ? t('profile.progressHint', { n: level.nextMin - points, m: level.level + 1 })
              : t('profile.maxLevel')}
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{earnedCount}</Text>
              <Text style={styles.heroStatLabel}>{t('badges.unlocked')}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{badges.length}</Text>
              <Text style={styles.heroStatLabel}>{t('badges.total')}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{level.level}</Text>
              <Text style={styles.heroStatLabel}>{t('badges.levelLabel')}</Text>
            </View>
          </View>
        </LinearGradient>

        <Section title={t('badges.rewards')} style={styles.section}>
          {history.length === 0 ? (
            <Card style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="trophy-outline" size={34} color={colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>{t('badges.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('badges.emptyText')}</Text>
            </Card>
          ) : (
            history.map((entry) => (
              <Card key={entry.id} style={styles.row}>
                <View style={styles.rewardMedal}>
                  <Ionicons name={badgeIcon(entry.def!.icon)} size={22} color={colors.black} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{entry.def!.label}</Text>
                  <Text style={styles.rowMeta}>
                    {t('badges.earnedDate', { date: formatDate(entry.earnedAt, lang, t) })}
                  </Text>
                </View>
                <View style={styles.rewardPoints}>
                  <Ionicons name="sparkles" size={13} color={colors.brandPrimary} />
                  <Text style={styles.rewardPointsText}>+{entry.def!.points}</Text>
                </View>
              </Card>
            ))
          )}
        </Section>

        <Section title={t('badges.toUnlock')} style={styles.section}>
          {locked.length === 0 ? (
            <Card style={styles.completeCard}>
              <Ionicons name="trophy" size={22} color={colors.black} />
              <Text style={styles.completeText}>{t('badges.allUnlocked')}</Text>
            </Card>
          ) : (
            locked.map((badge) => (
              <Card key={badge.id} style={[styles.row, styles.lockedRow]}>
                <View style={styles.lockedIcon}>
                  <Ionicons name="lock-closed" size={16} color={colors.muted} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowLabel, styles.lockedLabel]}>{badge.label}</Text>
                  <Text style={styles.lockedDesc}>{badge.description}</Text>
                </View>
                <View style={styles.lockedPoints}>
                  <Ionicons name="sparkles-outline" size={13} color={colors.muted} />
                  <Text style={styles.lockedPointsText}>+{badge.points}</Text>
                </View>
              </Card>
            ))
          )}
        </Section>

        <Button
          block
          size="lg"
          style={styles.cta}
          label={t('badges.continueExploring')}
          icon={<Ionicons name="globe-outline" size={20} color={colors.white} />}
          onPress={() => navigation.navigate('Main', { screen: 'Explore' })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

    hero: {
      borderRadius: radii['3xl'],
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.xl,
      marginTop: spacing.sm,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    heroIdentity: { flex: 1 },
    heroEyebrow: {
      color: colors.brandPrimary,
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 28, letterSpacing: -1, marginTop: 2 },
    heroPoints: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
    heroPointsValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 30, letterSpacing: -1 },
    heroPointsLabel: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 13 },
    heroTrack: {
      height: 8,
      borderRadius: radii.full,
      backgroundColor: colors.line,
      overflow: 'hidden',
      marginTop: spacing.lg,
    },
    heroFill: { height: '100%', borderRadius: radii.full },
    heroHint: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.sm },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
      borderRadius: radii['2xl'],
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: spacing.md,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 18 },
    heroStatLabel: { color: colors.inkSoft, fontFamily: fonts.medium, fontSize: 10, marginTop: 1 },
    heroDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.line },

    section: { marginTop: spacing['2xl'] },

    empty: { alignItems: 'center', padding: spacing['2xl'] },
    emptyIcon: {
      width: 68,
      height: 68,
      borderRadius: radii.full,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    emptyText: {
      color: colors.inkSoft,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },

    /** Ligne de badge — la carte du socle, posée à l'horizontale. */
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    rowCopy: { flex: 1 },
    rowLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    rowMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

    rewardMedal: {
      width: 50,
      height: 50,
      borderRadius: radii.full,
      backgroundColor: colors.brandSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rewardPoints: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.full,
      backgroundColor: colors.brandSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    rewardPointsText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 13 },

    lockedRow: { opacity: 0.82 },
    lockedIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockedLabel: { color: colors.inkSoft },
    lockedDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    lockedPoints: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    lockedPointsText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },

    completeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.brandSecondary,
      borderColor: colors.brandSecondary,
    },
    completeText: { flex: 1, color: colors.black, fontFamily: fonts.bold, fontSize: 14 },

    cta: { marginTop: spacing['2xl'] },
  });
