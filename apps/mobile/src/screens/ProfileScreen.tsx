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
import { getLevelInfo } from '../gamification';
import { useI18n } from '../i18n';
import { fetchUnreadCount } from '../lib/notifications';
import { checkin, type StreakInfo } from '../lib/stats';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
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
      <LinearGradient colors={['#F3FBE1', '#E0E9FF']} style={styles.cover}>
        <View style={styles.coverOrbOne} />
        <View style={styles.coverOrbTwo} />
      </LinearGradient>

      <LinearGradient colors={['#A8FF35', '#2F52E0']} style={styles.avatar}>
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

      <View style={styles.stats}>
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Saved')}>
          <Text style={styles.statValue}>{favorites.length}</Text>
          <Text style={styles.statLabel}>{t('profile.statSaved')}</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Search')}>
          <Text style={styles.statValue}>{visitedCities.length}</Text>
          <Text style={styles.statLabel}>{t('profile.statCities')}</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable style={styles.stat} onPress={() => navigation.navigate('Search')}>
          <Text style={styles.statValue}>{profile?.favoriteGenres.length ?? 0}</Text>
          <Text style={styles.statLabel}>{t('profile.statGenres')}</Text>
        </Pressable>
      </View>

      {user && streak && (
        <Pressable style={styles.streakCard} onPress={() => navigation.navigate('Notifications')}>
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
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.seeBadgesAria')}
        style={({ pressed }) => [styles.progressCard, pressed && styles.progressCardPressed]}
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
              <Ionicons name={badge.icon} size={17} color={colors.black} />
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
            <Ionicons name="chevron-forward" size={15} color={colors.brandDeep} />
          </View>
        </View>
      </Pressable>

      <View style={styles.menu}>
        <Pressable style={styles.primaryCard} onPress={() => navigation.navigate('ProfileEdit')}>
          <View style={styles.menuIconBrand}>
            <Ionicons name={profile ? 'create-outline' : 'person-add-outline'} size={23} color={colors.white} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, styles.primaryTitle]}>
              {profile ? t('profile.editProfile') : t('profile.createProfile')}
            </Text>
            <Text style={[styles.menuText, styles.primaryText]}>{t('profile.editHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.white} />
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Badges')}>
          <View style={styles.menuIcon}>
            <Ionicons name="trophy-outline" size={22} color={colors.brandDeep} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('badges.title')}</Text>
            <Text style={styles.menuText}>{t('profile.badgesHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('ArtistJoin')}>
          <View style={styles.menuIcon}>
            <Ionicons name="mic-outline" size={22} color={colors.brandDeep} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.artist')}</Text>
            <Text style={styles.menuText}>{t('profile.artistHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.menuIcon}>
            <Ionicons name="notifications-outline" size={22} color={colors.brandDeep} />
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
        </Pressable>

        <Pressable style={styles.menuItem} onPress={toggleTheme}>
          <View style={styles.menuIcon}>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.brandDeep} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.appearance')}</Text>
            <Text style={styles.menuText}>
              {theme === 'dark' ? t('profile.themeDark') : t('profile.themeLight')}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={20} color={colors.muted} />
        </Pressable>

        <View style={styles.menuItem}>
          <View style={styles.menuIcon}>
            <Ionicons name="language-outline" size={22} color={colors.brandDeep} />
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
        </View>

        <Pressable style={styles.menuItem} onPress={shareApp}>
          <View style={styles.menuIcon}>
            <Ionicons name="share-social-outline" size={22} color={colors.brandDeep} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>{t('profile.share')}</Text>
            <Text style={styles.menuText}>{t('profile.shareHint')}</Text>
          </View>
          <Ionicons name="share-outline" size={20} color={colors.muted} />
        </Pressable>

      </View>
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  appBarWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  cover: { height: 205, margin: 20, marginTop: 4, borderRadius: 30, overflow: 'hidden' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  langChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surfaceMuted },
  langChipActive: { backgroundColor: colors.brandDeep },
  langChipText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
  langChipTextActive: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  coverOrbOne: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(168,255,53,0.35)', right: -20, top: -25 },
  coverOrbTwo: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.6)', left: 35, bottom: -45 },
  avatar: { width: 124, height: 124, borderRadius: 62, borderWidth: 6, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', marginTop: -93, marginLeft: 38 },
  initials: { color: colors.white, fontFamily: fonts.displayBlack, fontSize: 36 },
  identity: { paddingHorizontal: 28, marginTop: 14 },
  identityTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 29, letterSpacing: -1.1 },
  editMini: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  email: { color: colors.inkSoft, fontFamily: fonts.body, marginTop: 3 },
  bio: { color: colors.inkSoft, fontFamily: fonts.body, lineHeight: 20, marginTop: 10 },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 25, margin: 20, paddingVertical: 17 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20 },
  statLabel: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.line },
  progressCard: { margin: 20, marginTop: 0, borderRadius: 26, backgroundColor: colors.surface, padding: 18, gap: 10 },
  progressCardPressed: { opacity: 0.85 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 12 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  levelTitle: { color: colors.black, fontFamily: fonts.bold, fontSize: 14 },
  pointsChip: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pointsValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 26, letterSpacing: -0.8 },
  pointsLabel: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.brandDeep },
  progressHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  badgeItem: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  badgeItemEarned: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  badgeItemMore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMoreText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
  badgesLabel: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  menu: { paddingHorizontal: 20, gap: 11 },
  primaryCard: { minHeight: 88, borderRadius: 24, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  menuItem: { minHeight: 82, borderRadius: 24, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  menuIconBrand: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  menuIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
  menuText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  primaryTitle: { color: colors.white },
  primaryText: { color: 'rgba(255,255,255,0.8)' },
  toggle: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.brand, padding: 3, alignItems: 'flex-end' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  streakCard: {
    marginHorizontal: 20,
    marginTop: 0,
    borderRadius: 24,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
  },
  streakIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  streakCopy: { flex: 1 },
  streakTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
  streakText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  streakDone: { borderRadius: 14, backgroundColor: colors.brandSoft, paddingHorizontal: 11, paddingVertical: 6 },
  streakDoneText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11 },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
});
