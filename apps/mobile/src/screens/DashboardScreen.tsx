import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n';
import { fetchBookings, type BookingRecord, type BookingStatus } from '@musimaps/shared';
import {
  fetchArtistIdByName,
  fetchArtistStatsDetail,
  fetchFollowing,
  type ArtistStatsDetail,
} from '../lib/stats';
import { BarChart, ChartCard, HBarList, SegmentedBar } from '../components/Charts';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

function statusColor(status: BookingStatus): string {
  if (status === 'confirmed') return '#1B7F45';
  if (status === 'rejected') return '#C62828';
  return '#8A5B00';
}

export function DashboardScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const { favorites } = useApp();
  const [bookings, setBookings] = useState<BookingRecord[] | null>(null);
  const [detailStats, setDetailStats] = useState<ArtistStatsDetail | null>(null);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      // Réservations : chargées uniquement pour les comptes business (la
      // section est masquée pour les autres).
      const rows = user.accountType === 'business' ? await fetchBookings() : [];
      if (cancelled) return;
      const mine =
        user.role === 'artist'
          ? rows.filter((b) => b.artist_name.toLowerCase() === user.displayName?.toLowerCase())
          : rows;
      setBookings(mine);

      // Analytique de l'artiste revendiqué : même RPC que le web.
      if (user.role === 'artist' && user.displayName) {
        const artistId = await fetchArtistIdByName(user.displayName);
        if (artistId && !cancelled) {
          const detail = await fetchArtistStatsDetail(artistId);
          if (detail && !cancelled) setDetailStats(detail);
        }
      } else if (user.role !== 'artist') {
        const following = await fetchFollowing();
        if (!cancelled) setFollowingCount(following.length);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.root, styles.center, styles.gap]}>
        <Text style={styles.emptyText}>{t('booking.loginText')}</Text>
        <Pressable style={styles.primaryCta} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryCtaText}>{t('auth.login')}</Text>
        </Pressable>
      </View>
    );
  }

  const isArtist = user.role === 'artist';
  const month = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable accessibilityLabel={t('common.back')} style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={27} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={isArtist ? 'mic' : 'headset'} size={28} color={colors.black} />
        </View>
        <Text style={styles.heroTitle}>{t('dash.welcome', { name: user.displayName ?? user.email })}</Text>
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText}>{isArtist ? t('auth.roleArtist') : t('auth.roleMelomane')}</Text>
        </View>
        <Text style={styles.heroMeta}>
          {month} · {user.email}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.actionPrimary} onPress={() => navigation.navigate('Main', { screen: 'Explore' })}>
          <Ionicons name="globe-outline" size={20} color={colors.white} />
          <Text style={styles.actionPrimaryText}>{t('dash.explore')}</Text>
        </Pressable>
        <Pressable style={styles.actionGhost} onPress={() => navigation.navigate('ProfileEdit')}>
          <Ionicons name="create-outline" size={20} color={colors.ink} />
          <Text style={styles.actionGhostText}>{t('dash.editProfile')}</Text>
        </Pressable>
      </View>

      {/* Graphiques — artiste : audience 14 jours, top pays, engagement */}
      {isArtist && detailStats && (
        <>
          <Text style={styles.sectionTitle}>{t('dash.chartAudience')}</Text>
          <ChartCard title={t('dash.analyticsDays')} colors={colors}>
            {detailStats.by_day.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.inkSoft }]}>{t('dash.analyticsNoDataShort')}</Text>
            ) : (
              <BarChart
                data={detailStats.by_day.map((d) => ({
                  label: new Date(d.day).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit' }),
                  value: d.views,
                }))}
                colors={colors}
              />
            )}
          </ChartCard>
          <ChartCard title={t('dash.analyticsCountries')} colors={colors}>
            {detailStats.top_countries.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.inkSoft }]}>{t('dash.analyticsNoDataShort')}</Text>
            ) : (
              <HBarList
                data={detailStats.top_countries.map((c) => ({
                  label: c.country,
                  value: c.views,
                  sub: c.unique_viewers > 0 ? String(c.unique_viewers) : undefined,
                }))}
                colors={colors}
              />
            )}
          </ChartCard>
          <ChartCard title={t('dash.chartEngagement')} colors={colors}>
            <SegmentedBar
              segments={[
                { label: t('dash.statProfileViews'), value: detailStats.profile_views, color: colors.brandDeep },
                { label: t('dash.statPinViews'), value: detailStats.pin_views, color: colors.brand },
                { label: t('dash.statLikes'), value: detailStats.likes ?? 0, color: colors.brandSoft },
              ]}
              colors={colors}
            />
          </ChartCard>
        </>
      )}

      {/* Graphique — mélomane : activité (favoris / suivis), sans réservation
          pour les comptes non-business */}
      {!isArtist && (
        <ChartCard title={t('dash.chartActivity')} colors={colors}>
          <SegmentedBar
            segments={[
              { label: t('dash.statFavorites'), value: favorites.length, color: colors.brandDeep },
              { label: t('dash.statFollowing'), value: followingCount, color: colors.brand },
              ...(user?.accountType === 'business'
                ? [{ label: t('dash.statBookings'), value: bookings?.length ?? 0, color: colors.brandSoft }]
                : []),
            ]}
            colors={colors}
          />
        </ChartCard>
      )}

      {/* Réservations : section masquée pour les comptes non-business */}
      {user?.accountType === 'business' && (
      <>
      <Text style={styles.sectionTitle}>
        {isArtist ? t('dash.receivedBookings') : t('dash.myBookings')}
      </Text>

      {bookings === null ? (
        <View style={styles.card}>
          <ActivityIndicator color={colors.brandDeep} />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.cardEmpty}>
          <Ionicons name="calendar-outline" size={30} color={colors.muted} />
          <Text style={styles.emptyText}>
            {isArtist ? t('dash.noReceived') : t('dash.noBookings')}
          </Text>
        </View>
      ) : (
        bookings.map((booking) => (
          <View key={booking.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="calendar" size={17} color={colors.brandDeep} />
                <Text style={styles.cardArtist}>{booking.artist_name}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: `${statusColor(booking.status)}18` }]}>
                <Text style={[styles.statusText, { color: statusColor(booking.status) }]}>
                  {t(`dash.status.${booking.status}`)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {booking.event_type} · {booking.flexible_date ? '📆' : '📅'} {booking.event_date ?? t('booking.flexible')}
            </Text>
            {booking.city || booking.country ? (
              <Text style={styles.cardMeta}>📍 {booking.city} {booking.country}</Text>
            ) : null}
            {(booking.budget_range || booking.budget_amount) && (
              <Text style={styles.cardMeta}>💰 {booking.budget_range ?? `~${booking.budget_amount} €`}</Text>
            )}
            {booking.audience_size ? <Text style={styles.cardMeta}>👥 {booking.audience_size}</Text> : null}
            {booking.message ? <Text style={styles.cardMessage}>{booking.message}</Text> : null}
            {booking.contact_name ? (
              <Text style={styles.cardContact}>
                {booking.contact_name}
                {booking.phone ? ` · ${booking.phone}` : ''}
              </Text>
            ) : null}
          </View>
        ))
      )}
      </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    gap: { gap: 14 },
    content: { paddingHorizontal: 20, paddingBottom: 48 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
    back: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: { alignItems: 'center', marginTop: 18, marginBottom: 18 },
    heroIcon: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      color: colors.ink,
      fontFamily: fonts.displayBlack,
      fontSize: 26,
      letterSpacing: -0.9,
      marginTop: 14,
      textAlign: 'center',
    },
    roleChip: { backgroundColor: colors.brandSoft, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 6, marginTop: 10 },
    roleChipText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 12 },
    heroMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginTop: 8 },
    actions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    actionPrimary: {
      flex: 1,
      minHeight: 54,
      borderRadius: 27,
      backgroundColor: colors.brandDeep,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionPrimaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
    actionGhost: {
      flex: 1,
      minHeight: 54,
      borderRadius: 27,
      borderWidth: 1.5,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionGhostText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    sectionTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20, letterSpacing: -0.7, marginTop: 22, marginBottom: 12 },
    card: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 15,
      marginBottom: 10,
      gap: 5,
    },
    cardEmpty: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
      borderStyle: 'dashed',
      padding: 26,
      alignItems: 'center',
      gap: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    cardArtist: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    statusChip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
    statusText: { fontFamily: fonts.bold, fontSize: 11 },
    cardMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
    cardMessage: {
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      padding: 11,
      marginTop: 7,
    },
    cardContact: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
    emptyText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
    primaryCta: {
      minHeight: 54,
      borderRadius: 27,
      backgroundColor: colors.brandDeep,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    primaryCtaText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  });
