import { badgeIcon } from '../badgeIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { getLevelInfo } from '@musimaps/shared';
import { useI18n, type MessageKey } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
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
      <View style={styles.header}>
        <Pressable accessibilityLabel={t('common.back')} style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={27} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('badges.title')}</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient colors={['#A8FF35', '#2F52E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>{t('badges.level', { level: level.level })}</Text>
              <Text style={styles.heroTitle}>{level.title}</Text>
            </View>
            <View style={styles.heroPoints}>
              <Text style={styles.heroPointsValue}>{points}</Text>
              <Text style={styles.heroPointsLabel}>{t('common.pts')}</Text>
            </View>
          </View>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${level.progress * 100}%` }]} />
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

        <Text style={styles.sectionTitle}>{t('badges.rewards')}</Text>
        {history.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="trophy-outline" size={34} color={colors.brandDeep} />
            </View>
            <Text style={styles.emptyTitle}>{t('badges.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('badges.emptyText')}</Text>
          </View>
        ) : (
          history.map((entry) => (
            <View key={entry.id} style={styles.reward}>
              <View style={styles.rewardMedal}>
                <Ionicons name={badgeIcon(entry.def!.icon)} size={22} color={colors.black} />
              </View>
              <View style={styles.rewardCopy}>
                <Text style={styles.rewardLabel}>{entry.def!.label}</Text>
                <Text style={styles.rewardDate}>
                  {t('badges.earnedDate', { date: formatDate(entry.earnedAt, lang, t) })}
                </Text>
              </View>
              <View style={styles.rewardPoints}>
                <Ionicons name="sparkles" size={13} color={colors.brandDeep} />
                <Text style={styles.rewardPointsText}>+{entry.def!.points}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>{t('badges.toUnlock')}</Text>
        {locked.length === 0 ? (
          <View style={styles.completeCard}>
            <Ionicons name="trophy" size={22} color={colors.black} />
            <Text style={styles.completeText}>{t('badges.allUnlocked')}</Text>
          </View>
        ) : (
          locked.map((badge) => (
            <View key={badge.id} style={styles.lockedRow}>
              <View style={styles.lockedIcon}>
                <Ionicons name="lock-closed" size={16} color={colors.muted} />
              </View>
              <View style={styles.rewardCopy}>
                <Text style={[styles.rewardLabel, styles.lockedLabel]}>{badge.label}</Text>
                <Text style={styles.lockedDesc}>{badge.description}</Text>
              </View>
              <View style={styles.lockedPoints}>
                <Ionicons name="sparkles-outline" size={13} color={colors.muted} />
                <Text style={styles.lockedPointsText}>+{badge.points}</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.ctaWrap}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => navigation.navigate('Main', { screen: 'Explore' })}
          >
            <Ionicons name="globe-outline" size={20} color={colors.white} />
            <Text style={styles.ctaText}>{t('badges.continueExploring')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    back: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    backSpacer: { width: 46 },
    headerTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20, letterSpacing: -0.6 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    hero: { borderRadius: 28, padding: 20, marginTop: 8 },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroEyebrow: { color: '#123A42', fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
    heroTitle: { color: colors.black, fontFamily: fonts.displayBlack, fontSize: 28, letterSpacing: -1, marginTop: 2 },
    heroPoints: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    heroPointsValue: { color: colors.black, fontFamily: fonts.displayBlack, fontSize: 30, letterSpacing: -1 },
    heroPointsLabel: { color: '#123A42', fontFamily: fonts.bold, fontSize: 13 },
    heroTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.18)', overflow: 'hidden', marginTop: 16 },
    heroFill: { height: '100%', borderRadius: 4, backgroundColor: colors.black },
    heroHint: { color: '#123A42', fontFamily: fonts.medium, fontSize: 12, marginTop: 8 },
    heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.28)', paddingVertical: 13 },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatValue: { color: colors.black, fontFamily: fonts.displayBlack, fontSize: 18 },
    heroStatLabel: { color: '#123A42', fontFamily: fonts.medium, fontSize: 10, marginTop: 1 },
    heroDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: 'rgba(0,0,0,0.22)' },
    sectionTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 19, letterSpacing: -0.7, marginTop: 26, marginBottom: 12 },
    empty: { borderRadius: 24, backgroundColor: colors.surface, padding: 26, alignItems: 'center' },
    emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16, marginTop: 14 },
    emptyText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
    reward: { minHeight: 78, borderRadius: 22, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, marginBottom: 10 },
    rewardMedal: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
    rewardCopy: { flex: 1 },
    rewardLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    rewardDate: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    rewardPoints: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 6 },
    rewardPointsText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 13 },
    lockedRow: { minHeight: 72, borderRadius: 22, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, marginBottom: 10, opacity: 0.82 },
    lockedIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    lockedLabel: { color: colors.inkSoft },
    lockedDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    lockedPoints: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 6 },
    lockedPointsText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },
    completeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 22, backgroundColor: colors.brand, padding: 16 },
    completeText: { flex: 1, color: colors.black, fontFamily: fonts.bold, fontSize: 14 },
    ctaWrap: { marginTop: 26 },
    cta: { minHeight: 60, borderRadius: 30, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    ctaPressed: { opacity: 0.82 },
    ctaText: { color: colors.white, fontFamily: fonts.bold, fontSize: 17 },
  });
