import { badgeIcon } from '../badgeIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar } from '../components/AppBar';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { getLevelInfo, radii, spacing } from '@musimaps/shared';
import { useI18n } from '../i18n';
import { fetchUnreadCount } from '@musimaps/shared';
import { checkin, type StreakInfo } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Card } from '../ui';
import { fonts, type AppColors } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { colors, theme, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { t, langPref, setLangPref } = useI18n();
  const { profile, favorites, visitedCities, badges, points } = useApp();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const name = profile?.displayName ?? t('profile.defaultName');
  const city = profile?.city ?? t('profile.defaultCity');
  const level = getLevelInfo(points);
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const earnedBadgesList = badges.filter((badge) => badge.earned);
  const lockedCount = badges.length - earnedCount;
  // Notifications (même table que le web → sync) + streak quotidien.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void fetchUnreadCount().then((n) => {
        if (active) setUnread(n);
      });
      if (user) {
        void checkin().then((s) => {
          if (active && s) setStreak(s);
        });
      }
      return () => {
        active = false;
      };
    }, [user]),
  );

  const shareApp = () => {
    Share.share({
      title: 'Musimaps',
      message: t('profile.shareMessage', { name }),
    }).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.appBarWrap, { paddingTop: insets.top + 10 }]}>
        <AppBar navigation={navigation} />
      </View>
      {/*
        Même couverture que le dashboard web : bleu de marque fondu au noir.
        Elle était pâle et figée (vert et bleu clairs codés en dur), donc
        illisible en thème sombre — le fond restait clair sous une interface
        sombre. Le noir des tokens est sombre dans les deux thèmes.
      */}
      <LinearGradient colors={[colors.brandPrimary, colors.black, colors.black]} style={styles.cover}>
        <View style={styles.coverOrbOne} />
        <View style={styles.coverOrbTwo} />
      </LinearGradient>

      {/* Avatar : bleu → lime, initiales sombres — `from-brand-deep to-brand text-black` du web. */}
      <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.avatar}>
        <Text style={styles.initials}>
          {name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </Text>
      </LinearGradient>

      <View style={styles.identity}>
        <View style={styles.identityTitle}>
          <Text style={styles.name}>{name}</Text>
          <Pressable style={styles.editMini} onPress={() => navigation.navigate('ProfileEdit')}>
            <Ionicons name="pencil" size={17} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.email}>{city}</Text>
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      <Card style={styles.stats}>
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Saved')}>
          <Text style={styles.statValue}>{favorites.length}</Text>
          <Text style={styles.statLabel}>{t('profile.statSaved')}</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Discover')}>
          <Text style={styles.statValue}>{visitedCities.length}</Text>
          <Text style={styles.statLabel}>{t('profile.statCities')}</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Discover')}>
          <Text style={styles.statValue}>{profile?.favoriteGenres.length ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.statGenres')}</Text>
        </Pressable>
      </Card>

      {user && streak && (
        <Card style={styles.streakCard} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.streakIcon}>
            <Ionicons name="flame" size={24} color={colors.black} />
          </View>
          <View style={styles.streakCopy}>
            <Text style={styles.streakTitle}>{t('streak.title')}</Text>
            <Text style={styles.streakText}>
              {t('streak.days', { current: streak.current, best: streak.best })}
            </Text>
          </View>
          {streak.checkedToday && (
            <View style={styles.streakDone}>
              <Text style={styles.streakDoneText}>{t('streak.checked')}</Text>
            </View>
          )}
        </Card>
      )}

      <Card
        accessibilityLabel={t('profile.seeBadgesAria')}
        style={styles.progressCard}
        onPress={() => navigation.navigate('Badges')}
      >
        <View style={styles.progressHeader}>
          <View style={styles.levelBadge}>
            <Ionicons name="trophy" size={20} color={colors.black} />
            <Text style={styles.levelTitle}>{t('profile.level', { level: level.level, title: level.title })}</Text>
          </View>
          <View style={styles.pointsChip}>
            <Text style={styles.pointsValue}>{points}</Text>
            <Text style={styles.pointsLabel}>{t('common.pts')}</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${level.progress * 100}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          {level.nextMin !== null
            ? t('profile.progressHint', { n: level.nextMin - points, m: level.level + 1 })
            : t('profile.maxLevel')}
        </Text>
        <View style={styles.badgeRow}>
          {earnedBadgesList.map((badge) => (
            <View key={badge.id} style={styles.badgeItemEarned}>
              <Ionicons name={badgeIcon(badge.icon)} size={17} color={colors.black} />
            </View>
          ))}
          {lockedCount > 0 && (
            <View style={styles.badgeItemMore}>
              {earnedBadgesList.length === 0 ? (
                <Ionicons name="lock-closed-outline" size={15} color={colors.muted} />
              ) : (
                <Text style={styles.badgeMoreText}>+{lockedCount}</Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.badgesRow}>
          <Text style={styles.badgesLabel}>
            {t('profile.badgesUnlocked', { earned: earnedCount, total: badges.length })}
          </Text>
          <View style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('profile.seeAll')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.brandPrimary} />
          </View>
        </View>
      </Card>

      <View style={styles.menu}>
        <Card style={styles.primaryCard} onPress={() => navigation.navigate('ProfileEdit')}>
          <View style={styles.menuIconBrand}>
            <Ionicons name={profile ? 'create-outline' : 'person-add-outline'} size={23} color={colors.black} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, styles.primaryTitle]}>
              {profile ? t('profile.editProfile') : t('profile.createProfile')}
            </Text>
            <Text style={[styles.menuText, styles.primaryText]}>{t('profile.editHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.white} />
        </Card>

        <Card style={styles.menuItem} onPress={() => navigation.navigate('Badges')}>
          <View style={styles.menuIcon}>
            <Ionicons name="trophy-outline" size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('badges.title')}</Text>
            <Text style={styles.menuText}>{t('profile.badgesHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>

        <Card style={styles.menuItem} onPress={() => navigation.navigate('ArtistJoin')}>
          <View style={styles.menuIcon}>
            <Ionicons name="mic-outline" size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.artist')}</Text>
            <Text style={styles.menuText}>{t('profile.artistHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>

        <Card style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.menuIcon}>
            <Ionicons name="notifications-outline" size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('notif.title')}</Text>
            <Text style={styles.menuText}>{t('notif.hint')}</Text>
          </View>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          )}
        </Card>

        <Card style={styles.menuItem} onPress={toggleTheme}>
          <View style={styles.menuIcon}>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.appearance')}</Text>
            <Text style={styles.menuText}>
              {theme === 'dark' ? t('profile.themeDark') : t('profile.themeLight')}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={20} color={colors.muted} />
        </Card>

        <Card style={styles.menuItem}>
          <View style={styles.menuIcon}>
            <Ionicons name="language-outline" size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.language')}</Text>
            <View style={styles.langRow}>
              {(['system', 'fr', 'en'] as const).map((pref) => {
                const active = langPref === pref;
                return (
                  <Pressable
                    key={pref}
                    accessibilityRole="button"
                    style={[styles.langChip, active && styles.langChipActive]}
                    onPress={() => setLangPref(pref)}
                  >
                    <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                      {pref === 'system'
                        ? t('lang.system')
                        : pref === 'fr'
                          ? t('lang.french')
                          : t('lang.english')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        <Card style={styles.menuItem} onPress={shareApp}>
          <View style={styles.menuIcon}>
            <Ionicons name="share-social-outline" size={22} color={colors.brandPrimary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.share')}</Text>
            <Text style={styles.menuText}>{t('profile.shareHint')}</Text>
          </View>
          <Ionicons name="share-outline" size={20} color={colors.muted} />
        </Card>

      </View>
    </ScrollView>
  );
}

/** Marge latérale de l'écran — la couverture, les cartes et le menu s'alignent dessus. */
const GUTTER = spacing.xl;

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  /** Dégagement pour le dock flottant. */
  content: { paddingBottom: 120 },
  appBarWrap: { paddingHorizontal: GUTTER, paddingBottom: spacing.md },
  cover: { height: 205, margin: GUTTER, marginTop: spacing.xs, borderRadius: radii['3xl'], overflow: 'hidden' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  langChip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  langChipActive: { backgroundColor: colors.brandPrimary },
  langChipText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
  langChipTextActive: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  /**
   * Halos décoratifs de la couverture. L'opacité est portée par la vue et non
   * cuite dans un `rgba` : la teinte reste celle des tokens, donc elle suit le
   * thème et une éventuelle évolution de la palette.
   */
  coverOrbOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: radii.full,
    backgroundColor: colors.brandSecondary,
    opacity: 0.35,
    right: -20,
    top: -25,
  },
  coverOrbTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: radii.full,
    backgroundColor: colors.brandPrimary,
    opacity: 0.45,
    left: 35,
    bottom: -45,
  },
  avatar: {
    width: 124,
    height: 124,
    borderRadius: radii.full,
    borderWidth: 6,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -93,
    marginLeft: spacing['3xl'],
  },
  initials: { color: colors.black, fontFamily: fonts.displayBlack, fontSize: 36 },
  identity: { paddingHorizontal: spacing['2xl'], marginTop: spacing.lg },
  identityTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 29, letterSpacing: -1.1 },
  editMini: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: { color: colors.inkSoft, fontFamily: fonts.body, marginTop: 3 },
  bio: { color: colors.inkSoft, fontFamily: fonts.body, lineHeight: 20, marginTop: spacing.md },
  stats: { flexDirection: 'row', alignItems: 'center', margin: GUTTER, paddingVertical: spacing.lg },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20 },
  statLabel: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.line },
  progressCard: { margin: GUTTER, marginTop: 0, padding: spacing.lg, gap: spacing.md },
  badgesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 12 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brandSecondary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  levelTitle: { color: colors.black, fontFamily: fonts.bold, fontSize: 14 },
  pointsChip: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pointsValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 26, letterSpacing: -0.8 },
  pointsLabel: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
  progressTrack: { height: 8, borderRadius: radii.full, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full, backgroundColor: colors.brandPrimary },
  progressHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  badgeItemEarned: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: colors.brandSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeItemMore: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMoreText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
  badgesLabel: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  menu: { paddingHorizontal: GUTTER, gap: spacing.md },
  primaryCard: {
    minHeight: 88,
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  menuItem: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  /** Pastille lime sur la carte bleue — l'accent secondaire de la landing. */
  menuIconBrand: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.brandSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
  menuText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  primaryTitle: { color: colors.white },
  primaryText: { color: colors.white, opacity: 0.8 },
  streakCard: {
    marginHorizontal: GUTTER,
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  streakIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.brandSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: { flex: 1 },
  streakTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
  streakText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  streakDone: {
    borderRadius: radii.full,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  streakDoneText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 11 },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  unreadBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
});
