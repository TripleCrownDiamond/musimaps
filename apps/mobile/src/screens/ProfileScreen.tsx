import { badgeIcon } from '../badgeIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { ProfileHeader } from '../components/ProfileHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { PROFILE_GUTTER, PROFILE_MEDIA, PROFILE_HEADER_HEIGHT, LEGAL_LINKS, SITE_URL, getLevelInfo, radii, siteUrl, spacing } from '@musimaps/shared';
import { AccountAvatar, AccountCover } from '../components/AccountMedia';
import { useI18n } from '../i18n';
import { checkin, type StreakInfo } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Card } from '../ui';
import { fonts, type AppColors } from '../theme';
import { levelTitle } from '../lib/gamificationText';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { colors, theme, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang, langPref, setLangPref } = useI18n();
  const { profile, favorites, visitedCities, badges, points } = useApp();
  const { user, signOut, refresh: refreshUser } = useAuth();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const name = user?.displayName || profile?.displayName || t('profile.defaultName');
  const city = user?.city || profile?.city || t('profile.defaultCity');
  const isArtist = user?.role === 'artist';
  const isBusiness = user?.accountType === 'business';
  const openAccountAction = () => {
    if (user) navigation.navigate('ProfileEdit');
    else navigation.navigate('Signup');
  };
  const level = getLevelInfo(points);
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const earnedBadgesList = badges.filter((badge) => badge.earned);
  const lockedCount = badges.length - earnedCount;
  // Notifications (même table que le web → sync) + streak quotidien.
  useFocusEffect(
    useCallback(() => {
      let active = true;
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
    // Le message d'invitation n'embarquait aucun lien : impossible pour le
    // destinataire de rejoindre Musimaps.
    Share.share({
      title: 'Musimaps',
      message: `${t('profile.shareMessage', { name })} ${SITE_URL}`,
      url: SITE_URL,
    }).catch(() => {});
  };

  // Le profil peut être modifié depuis le web (ou un autre appareil) pendant
  // que l'app mobile reste ouverte. Recharge les médias au retour sur l'onglet
  // pour ne pas rester bloqué sur les initiales mises en cache.
  useFocusEffect(
    useCallback(() => {
      void refreshUser();
    }, [refreshUser]),
  );

  return (
    <View style={styles.container}>
      <ProfileHeader
        headerHeight={PROFILE_HEADER_HEIGHT}
        background={colors.background}
        topBarBackground="transparent"
        stickyTopBarColor={colors.brandPrimary}
        contentStyle={styles.content}
        topBar={<AppBar navigation={navigation} brandTone="light" />}
        cover={
          <View style={styles.accountMedia}>
            <AccountCover image={user?.coverUrl} height={PROFILE_HEADER_HEIGHT} />
            <Pressable accessibilityRole="button" accessibilityLabel={user ? t('profile.editProfile') : t('profile.createProfile')}
              onPress={openAccountAction}
              style={[styles.profileAvatar, { position: 'absolute', left: PROFILE_GUTTER, bottom: -PROFILE_MEDIA.profileOverlap }]}>
              <AccountAvatar name={name} image={user?.avatarUrl} />
            </Pressable>
          </View>
        }
      >
      <View style={styles.identity}>
        <View style={styles.identityTitle}>
          <Text style={styles.name}>{name}</Text>
          <Pressable style={styles.editMini} onPress={openAccountAction}>
            <Ionicons name={user ? 'pencil' : 'person-add-outline'} size={17} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.email}>{city}</Text>
        {user && (
          <View style={styles.roleRow}>
            <View style={styles.roleChip}>
              <Ionicons name={isArtist ? 'mic-outline' : 'headset-outline'} size={14} color={colors.brandDeep} />
              <Text style={styles.roleChipText}>{isArtist ? t('dash.roleArtist') : t('dash.roleMelomane')}</Text>
            </View>
            {isBusiness && (
              <View style={styles.businessChip}>
                <Text style={styles.businessChipText}>{t('dash.business')}</Text>
              </View>
            )}
          </View>
        )}
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>

      {/* Même hiérarchie d'actions que le Dashboard web : explorer d'abord,
          puis modifier le compte. */}
      <View style={styles.actionRow}>
        <Pressable style={styles.actionPrimary} onPress={() => navigation.navigate('Explore')}>
          <Ionicons name="globe-outline" size={19} color={colors.white} />
          <Text style={styles.actionPrimaryText}>{t('dash.explore')}</Text>
        </Pressable>
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

      {/*
        La gamification (badges, niveaux, points) est réservée aux comptes
        connectés. Avant connexion, la carte de progression est masquée pour
        éviter de montrer des grades qui évoluent sans compte.
      */}
      {user && (
        <Card
          accessibilityLabel={t('profile.seeBadgesAria')}
          style={styles.progressCard}
          onPress={() => navigation.navigate('Badges')}
        >
          <View style={styles.progressHeader}>
            <View style={styles.levelBadge}>
              <Ionicons name="trophy" size={20} color={colors.black} />
              <Text style={styles.levelTitle}>{t('profile.level', { level: level.level, title: levelTitle(t, level) })}</Text>
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
      )}

      {user && (
        <Card style={styles.accountInfoCard}>
          <Text style={styles.accountInfoTitle}>{t('dash.accountInfo')}</Text>
          <View style={styles.accountInfoRow}>
            <Ionicons name="mail-outline" size={17} color={colors.brandDeep} />
            <Text style={styles.accountInfoText} numberOfLines={1}>{user.email}</Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Ionicons name="location-outline" size={17} color={colors.brandDeep} />
            <Text style={styles.accountInfoText}>{user.city ?? city}</Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Ionicons name="person-outline" size={17} color={colors.brandDeep} />
            <Text style={styles.accountInfoText}>
              {t('dash.roleLabel')} : {isArtist ? t('auth.roleArtist') : t('auth.roleMelomane')}
            </Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Ionicons name="briefcase-outline" size={17} color={colors.brandDeep} />
            <Text style={styles.accountInfoText}>
              {t('dash.accountType')} : {isBusiness ? t('dash.business') : t('dash.personal')}
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.menu}>
        <Card style={styles.primaryCard} onPress={openAccountAction}>
          <View style={styles.menuIconBrand}>
            <Ionicons name={user ? 'create-outline' : 'person-add-outline'} size={23} color={colors.black} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, styles.primaryTitle]}>
              {user ? t('profile.editProfile') : t('profile.createProfile')}
            </Text>
            <Text style={[styles.menuText, styles.primaryText]}>{t('profile.editHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.white} />
        </Card>

        {user && (
          <Card style={styles.menuItem} onPress={() => navigation.navigate('Dashboard')}>
            <View style={styles.menuIcon}>
              <Ionicons name="stats-chart-outline" size={22} color={colors.brandPrimary} />
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>{t('profile.activity')}</Text>
              <Text style={styles.menuText}>{t('profile.activityHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Card>
        )}

        {user && (
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
        )}

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

        {user && (
          <Card style={styles.menuItem} onPress={() => {
            void signOut().then(() => navigation.replace('Start'));
          }}>
            <View style={styles.menuIcon}>
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            </View>
            <View style={styles.menuCopy}>
              <Text style={[styles.menuTitle, { color: colors.danger }]}>{t('auth.logout')}</Text>
              <Text style={styles.menuText}>{t('profile.logoutHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Card>
        )}

        <View style={{ gap: spacing.md, paddingVertical: spacing.lg }}>
          {LEGAL_LINKS.map((link) => (
            <Pressable key={link.document} accessibilityRole="link"
              onPress={() => void Linking.openURL(siteUrl(link.path, lang)).catch(() => Alert.alert(t('legal.title'), t('legal.openFailed')))}
              style={{ paddingVertical: spacing.sm }}>
              <Text style={[styles.menuText, { textAlign: 'center', textDecorationLine: 'underline' }]}>{t(link.label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      </ProfileHeader>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  /** Dégagement pour le dock flottant. */
  content: { paddingBottom: 120 },
  /** Cover pleine largeur sous la barre du haut — le contenant suit la
      hauteur repliable du header ; l'image est recadrée par overflow. */
  accountMedia: { flex: 1, backgroundColor: colors.surface },
  // Photo : ancrée au bas du header (bottom: 0), elle suit le bord inférieur
  // du header pendant le repli (position absolute posée en ligne au-dessus).
  profileAvatar: {},
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
  identity: { paddingHorizontal: PROFILE_GUTTER, marginTop: spacing.lg + PROFILE_MEDIA.profileOverlap },
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
  roleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, backgroundColor: colors.brandSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  roleChipText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11 },
  businessChip: { borderRadius: radii.full, backgroundColor: colors.black, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  businessChipText: { color: colors.brandSecondary, fontFamily: fonts.bold, fontSize: 10 },
  bio: { color: colors.inkSoft, fontFamily: fonts.body, lineHeight: 20, marginTop: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: PROFILE_GUTTER, marginTop: spacing.lg },
  actionPrimary: { flex: 1, borderRadius: radii.full, backgroundColor: colors.brandPrimary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  actionPrimaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  stats: { flexDirection: 'row', alignItems: 'center', margin: PROFILE_GUTTER, paddingVertical: spacing.lg },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20 },
  statLabel: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.line },
  progressCard: { margin: PROFILE_GUTTER, marginTop: 0, padding: spacing.lg, gap: spacing.md },
  accountInfoCard: { marginHorizontal: PROFILE_GUTTER, marginTop: 0, padding: spacing.lg, gap: spacing.sm },
  accountInfoTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, marginBottom: spacing.xs },
  accountInfoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountInfoText: { flex: 1, color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
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
  menu: { paddingHorizontal: PROFILE_GUTTER, gap: spacing.md },
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
    marginHorizontal: PROFILE_GUTTER,
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
  });
