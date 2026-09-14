import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  artists as catalogue,
  compactCount,
  displayGenre,
  fetchArtistBooking,
  fetchArtistFollowers,
  fetchArtistLikes,
  appleMusicSearchUrl,
  artistUrl,
  trackListenUrl,
  fetchFollowing,
  GUEST_NUDGE_DURATION_MS,
  loadArtistTracks,
  fetchMapArtists,
  ARTIST_AVATAR_SIZE,
  ARTIST_AVATAR_OVERLAP,
  PROFILE_GUTTER,
  PROFILE_HEADER_HEIGHT,
  radii,
  recordProfileView,
  spacing,
  viewerCountryFromCity,
  toArtist,
  toggleFollow,
  type Artist,
  type ArtistBooking,
  type StreamedTrack,
} from '@musimaps/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_BAR_ACTION_SIZE } from '../components/AppBar';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { BookingModal } from '../components/BookingModal';
import { NotificationButton } from '../components/NotificationButton';
import { DockPill, DOCK_BOTTOM_PAD, DOCK_PILL_HEIGHT, type DockItem } from '../components/DockPill';
import { ProfileHeader } from '../components/ProfileHeader';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts } from '../theme';
import { Button, Card, Section } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistProfile'>;

type ProfileTrack = Pick<StreamedTrack, 'title' | 'album' | 'duration' | 'artwork' | 'url'>;

export function ArtistProfileScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { favorites, toggleFavorite, deviceId, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const headerHeight = PROFILE_HEADER_HEIGHT;
  const [artist, setArtist] = useState<Artist | null>(null);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<ProfileTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [following, setFollowing] = useState(false);
  const [booking, setBooking] = useState<ArtistBooking | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMapArtists()
      .then((rows) => {
        if (cancelled) return;
        const byId = new Map<string, Artist>();
        for (const item of catalogue) byId.set(item.id, item);
        for (const item of rows.map(toArtist)) byId.set(item.id, item);
        const merged = [...byId.values()];
        setAllArtists(merged);
        setArtist(merged.find((item) => item.id === route.params.artistId) ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAllArtists(catalogue);
        setArtist(catalogue.find((item) => item.id === route.params.artistId) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route.params.artistId]);

  useEffect(() => {
    if (loading || artist) return;
    navigation.replace('Main', { screen: 'Explore', params: { skipLocation: true } });
  }, [artist, loading, navigation]);

  useEffect(() => {
    if (!artist) return;
    let cancelled = false;
    void recordProfileView(artist.id, {
      viewerKey: deviceId ?? undefined,
      country: viewerCountryFromCity(user?.city),
    });
    void Promise.all([
      fetchArtistFollowers(artist.id),
      fetchArtistLikes(artist.id),
      fetchFollowing(),
      fetchArtistBooking(artist.id),
    ]).then(([followersCount, likesCount, followingIds, artistBooking]) => {
      if (cancelled) return;
      setFollowers(followersCount);
      setLikes(likesCount);
      setFollowing(followingIds.includes(artist.id));
      setBooking(artistBooking);
    });
    return () => {
      cancelled = true;
    };
  }, [artist, deviceId, user?.city]);

  useEffect(() => {
    if (!artist) return;
    if (artist.tracks.length > 0) {
      setTracks(
        artist.tracks.map((track) => ({
          title: track.title,
          album: '',
          duration: track.duration,
          artwork: '',
          url: appleMusicSearchUrl(artist.name, track.title),
        })),
      );
      return;
    }
    setTracksLoading(true);
    return loadArtistTracks(artist.name, (items) => {
      setTracks(items);
      setTracksLoading(false);
    });
  }, [artist]);

  const links = useMemo(
    () => Object.entries({ ...(artist?.platforms ?? {}), ...(artist?.socials ?? {}) })
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
    [artist],
  );
  const nearby = useMemo(
    () => allArtists.filter((item) => item.id !== artist?.id && item.country === artist?.country).slice(0, 6),
    [allArtists, artist],
  );
  const saved = artist ? favorites.includes(artist.id) : false;

  const requireUser = () => {
    if (user) return true;
    showToast(t('guest.authRequired'), 'person-add-outline', 'success', {
      durationMs: GUEST_NUDGE_DURATION_MS,
      action: {
        label: t('guest.createAccount'),
        onPress: () => navigation.navigate('Signup'),
      },
    });
    return false;
  };

  const follow = async () => {
    if (!artist || !requireUser()) return;
    const message =
      lang === 'fr'
        ? `${user?.displayName ?? "Quelqu'un"} a commencé à te suivre`
        : `${user?.displayName ?? 'Someone'} started following you`;
    const result = await toggleFollow(artist.id, message);
    if (!result.ok) return showToast(t('sheet.followError'), 'alert-circle', 'error');
    setFollowing(result.following);
    setFollowers((count) => Math.max(0, count + (result.following ? 1 : -1)));
    showToast(
      result.following
        ? t('sheet.followToast', { name: artist.name })
        : t('sheet.unfollowToast', { name: artist.name }),
      result.following ? 'person-add' : 'person-remove',
    );
  };

  const save = () => {
    if (!artist || !requireUser()) return;
    const nextSaved = !saved;
    void toggleFavorite(artist.id);
    showToast(
      nextSaved
        ? t('sheet.saveToast', { name: artist.name })
        : t('sheet.unsaveToast', { name: artist.name }),
      nextSaved ? 'heart' : 'heart-dislike',
    );
  };

  const seeOnMap = () => {
    if (!artist) return;
    navigation.navigate('Main', {
      screen: 'Explore',
      params: { artistId: artist.id, searchKey: Date.now(), skipLocation: true },
    });
  };

  if (loading || !artist) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={[styles.muted, { color: colors.inkSoft }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  const dockItems: DockItem[] = [
    { key: 'Explore', label: t('tab.explore'), focused: false },
    { key: 'Discover', label: t('tab.discover'), focused: true },
    { key: 'Saved', label: t('tab.saved'), focused: false },
    { key: 'Profile', label: t('tab.profile'), focused: false },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ProfileHeader
        headerHeight={headerHeight}
        background={colors.background}
        topBarBackground="transparent"
        stickyTopBarColor={colors.brandPrimary}
        topBar={
          <View style={styles.heroActionsBand}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={[styles.back, { backgroundColor: colors.surface }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={27} color={colors.ink} />
            </Pressable>
            <NotificationButton onPress={() => navigation.navigate('Notifications')} />
          </View>
        }
        cover={
        <View style={[styles.hero, { backgroundColor: colors.brandPrimary }]}>
          {artist.image ? (
            <Image source={{ uri: artist.image }} style={styles.cover} resizeMode="cover" />
          ) : null}
          <View style={[styles.coverVeil, { backgroundColor: colors.brandPrimary }]} />
          {/* Photo de profil : moitié sur la cover, moitié en dehors. */}
          <View style={styles.avatarOverlap}>
            <ArtistAvatar
              artist={artist}
              size={ARTIST_AVATAR_SIZE}
              gradient={[colors.brandPrimary, colors.brandSecondary]}
              initialsColor={colors.black}
              borderless
            />
          </View>
        </View>
        }
      >
        <View style={styles.content}>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.ink }]}>{artist.name}</Text>
              {artist.verified ? (
                <Ionicons name="checkmark-circle" size={25} color={colors.brandPrimary} />
              ) : null}
            </View>
            <View style={[styles.locationBadge, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.locationText, { color: colors.brandPrimary }]}>
                {artist.flag} {[artist.district, artist.city, artist.country].filter(Boolean).join(', ')}
              </Text>
            </View>
            {artist.trending ? (
              <View style={[styles.trending, { backgroundColor: colors.danger }]}>
                <Ionicons name="flame" size={15} color={colors.white} />
                <Text style={[styles.trendingText, { color: colors.white }]}>{t('profile.trending')}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button
              style={styles.followButton}
              size="lg"
              variant={following ? 'default' : 'brand'}
              label={following ? t('sheet.following') : t('sheet.follow')}
              onPress={() => void follow()}
              icon={<Ionicons name={following ? 'checkmark-circle' : 'person-add-outline'} size={19} color={following ? colors.white : colors.ink} />}
            />
            <Button
              size="icon"
              variant="outline"
              accessibilityLabel={t('sheet.save')}
              onPress={save}
              icon={<Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.danger : colors.ink} />}
            />
            <Button
              size="icon"
              variant="outline"
              accessibilityLabel={t('sheet.shareAria')}
              onPress={() => {
                const url = artistUrl(artist.slug || artist.id);
                void Share.share({
                  title: artist.name,
                  message: `${t('sheet.shareMessage', { name: artist.name, genre: artist.genre, city: artist.city })} ${url}`,
                  url,
                }).catch(() => undefined);
              }}
              icon={<Ionicons name="share-outline" size={22} color={colors.ink} />}
            />
          </View>

          <Section title={t('profile.about')}>
            <Text style={[styles.bio, { color: colors.inkSoft }]}>{artist.bio}</Text>
          </Section>

          <Card>
            <Stat icon="musical-notes" text={displayGenre(artist.genre, t('common.unknown'))} />
            <Stat icon="people" text={t('profile.followers', { count: compactCount(followers) })} />
            <Stat icon="heart" text={t('profile.likes', { count: likes })} />
            <Stat
              icon="disc"
              text={`${tracks.length} ${tracks.length > 1 ? t('profile.trackMany') : t('profile.trackOne')}`}
            />
            <Button block size="lg" label={t('profile.seeOnMap')} onPress={seeOnMap} icon={<Ionicons name="earth" size={19} color={colors.white} />} />
            {booking?.bookable && user?.accountType === 'business' ? (
              <Button block size="lg" variant="secondary" label={t('sheet.book')} onPress={() => setBookingOpen(true)} icon={<Ionicons name="calendar" size={19} color={colors.ink} />} />
            ) : null}
          </Card>

          <Section title={t('profile.tracks')}>
            {tracksLoading ? (
              <Card style={styles.centerCard}>
                <ActivityIndicator color={colors.brandPrimary} />
                <Text style={[styles.muted, { color: colors.inkSoft }]}>{t('sheet.loadingTracks')}</Text>
              </Card>
            ) : tracks.length === 0 ? (
              <Card><Text style={[styles.muted, { color: colors.inkSoft }]}>{t('sheet.noTracks')}</Text></Card>
            ) : (
              <Card style={styles.listCard}>
                {tracks.map((track, index) => (
                  <Pressable key={`${track.title}-${index}`} style={[styles.row, { borderBottomColor: colors.line }]} onPress={() => Linking.openURL(trackListenUrl(track, artist)).catch(() => {})}>
                    {track.artwork ? <Image source={{ uri: track.artwork }} style={styles.trackArt} /> : (
                      <View style={[styles.trackTile, { backgroundColor: colors.brandSoft }]}><Text style={[styles.trackIndex, { color: colors.brandPrimary }]}>{index + 1}</Text></View>
                    )}
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.ink }]}>{track.title}</Text>
                      {track.album ? <Text numberOfLines={1} style={[styles.rowMeta, { color: colors.inkSoft }]}>{track.album}</Text> : null}
                    </View>
                    <Text style={[styles.rowMeta, { color: colors.inkSoft }]}>{track.duration}</Text>
                    <Ionicons name="play-circle" size={28} color={colors.brandPrimary} />
                  </Pressable>
                ))}
              </Card>
            )}
          </Section>

          <Section title={t('profile.events')}>
            {artist.events.length === 0 ? (
              <Card><Text style={[styles.muted, { color: colors.inkSoft }]}>{t('sheet.noEvents')}</Text></Card>
            ) : artist.events.map((event) => (
              <Card key={event.label} style={styles.eventCard}>
                <View style={[styles.eventDate, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.eventDateText, { color: colors.ink }]}>{event.date}</Text>
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]}>{event.label}</Text>
                  <Text style={[styles.rowMeta, { color: colors.inkSoft }]}>{event.venue}</Text>
                </View>
              </Card>
            ))}
          </Section>

          {links.length > 0 ? (
            <Section title={t('profile.links')}>
              <Card>
                {links.map(([key, url]) => (
                  <Pressable key={key} style={styles.link} onPress={() => Linking.openURL(url).catch(() => {})}>
                    <Ionicons name="open-outline" size={18} color={colors.brandPrimary} />
                    <Text style={[styles.linkText, { color: colors.ink }]}>{key.replace('_', ' ')}</Text>
                  </Pressable>
                ))}
              </Card>
            </Section>
          ) : null}

          {nearby.length > 0 ? (
            <Section title={t('profile.alsoIn', { country: artist.country })}>
              <Card style={styles.listCard}>
                {nearby.map((other) => (
                  <Pressable key={other.id} style={[styles.row, { borderBottomColor: colors.line }]} onPress={() => navigation.push('ArtistProfile', { artistId: other.id })}>
                    <ArtistAvatar artist={other} size={44} gradient={[colors.brandPrimary, colors.brandSecondary]} initialsColor={colors.black} borderless />
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]}>{other.name}</Text>
                      <Text style={[styles.rowMeta, { color: colors.inkSoft }]}>{displayGenre(other.genre, t('common.unknown'))} · {other.city}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
                  </Pressable>
                ))}
              </Card>
            </Section>
          ) : null}

          {/* Dégagement pour le dock flottant. */}
          <View style={{ height: insets.bottom + DOCK_BOTTOM_PAD + DOCK_PILL_HEIGHT }} />
        </View>
      </ProfileHeader>
      {bookingOpen ? <BookingModal artist={artist} onClose={() => setBookingOpen(false)} /> : null}

      {/* Dock flottant, gardé visible sur le profil empilé (comme sur les onglets). */}
      <View pointerEvents="box-none" style={[styles.dockOverlay, { paddingBottom: insets.bottom + DOCK_BOTTOM_PAD }]}>
        <DockPill
          items={dockItems}
          onNavigate={(item) => navigation.navigate('Main', { screen: item.key })}
        />
      </View>
    </View>
  );

  function Stat({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
    return (
      <View style={styles.stat}>
        <Ionicons name={icon} size={20} color={colors.brandPrimary} />
        <Text style={[styles.statText, { color: colors.ink }]}>{text}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hero: { flex: 1, paddingHorizontal: PROFILE_GUTTER },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.42 },
  coverVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.48 },
  avatarOverlap: { position: 'absolute', left: PROFILE_GUTTER, bottom: -ARTIST_AVATAR_OVERLAP },
  back: { width: APP_BAR_ACTION_SIZE, height: APP_BAR_ACTION_SIZE, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  heroActionsBand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationBadge: { alignSelf: 'flex-start', borderRadius: radii.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  locationText: { fontFamily: fonts.medium, fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1, fontFamily: fonts.displayBlack, fontSize: 42, letterSpacing: -1.5 },
  trending: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  trendingText: { fontFamily: fonts.bold, fontSize: 12 },
  identity: { gap: spacing.md, marginTop: spacing.lg + ARTIST_AVATAR_OVERLAP },
  content: { padding: PROFILE_GUTTER, paddingBottom: spacing['4xl'], gap: spacing.xl },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  followButton: { flex: 1 },
  bio: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statText: { fontFamily: fonts.medium, fontSize: 14 },
  centerCard: { alignItems: 'center' },
  listCard: { paddingVertical: 0, gap: 0 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: spacing.xs },
  trackArt: { width: 46, height: 46, borderRadius: radii.lg },
  trackTile: { width: 46, height: 46, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  trackIndex: { fontFamily: fonts.bold, fontSize: 13 },
  eventCard: { flexDirection: 'row', alignItems: 'center' },
  eventDate: { minWidth: 70, minHeight: 52, borderRadius: radii['2xl'], alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  eventDateText: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, textTransform: 'capitalize' },
  muted: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
});
