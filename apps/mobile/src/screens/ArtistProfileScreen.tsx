import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  compactCount,
  fetchArtistBooking,
  fetchArtistFollowers,
  fetchArtistLikes,
  fetchArtistTracks,
  fetchFollowing,
  fetchMapArtists,
  hexToRgba,
  radii,
  recordProfileView,
  spacing,
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
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { BookingModal } from '../components/BookingModal';
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
    void fetchMapArtists().then((rows) => {
      if (cancelled) return;
      const mapped = rows.map(toArtist);
      const found = mapped.find((item) => item.id === route.params.artistId) ?? null;
      setAllArtists(mapped);
      setArtist(found);
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
      country: user?.city ? user.city.split(',').pop()?.trim() : null,
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
          url: `https://music.apple.com/search?term=${encodeURIComponent(`${artist.name} ${track.title}`)}`,
        })),
      );
      return;
    }
    const controller = new AbortController();
    setTracksLoading(true);
    void fetchArtistTracks(artist.name, controller.signal).then((items) => {
      if (!controller.signal.aborted) {
        setTracks(items);
        setTracksLoading(false);
      }
    });
    return () => controller.abort();
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
    navigation.navigate('Login');
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.brandPrimary, paddingTop: insets.top + spacing.md }]}>
          {artist.image ? (
            <Image source={{ uri: artist.image }} style={styles.cover} resizeMode="cover" />
          ) : null}
          <View style={[styles.coverVeil, { backgroundColor: colors.brandPrimary }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[styles.back, { backgroundColor: colors.surface }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={27} color={colors.ink} />
          </Pressable>
          <View style={styles.heroContent}>
            <ArtistAvatar
              artist={artist}
              size={120}
              gradient={[colors.brandPrimary, colors.brandSecondary]}
              initialsColor={colors.black}
              borderless
            />
            <View style={[styles.locationBadge, { backgroundColor: hexToRgba(colors.white, 0.16) }]}>
              <Text style={[styles.locationText, { color: colors.white }]}>
                {artist.flag} {[artist.district, artist.city, artist.country].filter(Boolean).join(', ')}
              </Text>
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.white }]}>{artist.name}</Text>
              {artist.verified ? (
                <Ionicons name="checkmark-circle" size={25} color={colors.brandSecondary} />
              ) : null}
            </View>
            {artist.trending ? (
              <View style={[styles.trending, { backgroundColor: colors.danger }]}>
                <Ionicons name="flame" size={15} color={colors.white} />
                <Text style={[styles.trendingText, { color: colors.white }]}>{t('profile.trending')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.actions}>
            <Button
              style={styles.followButton}
              size="lg"
              variant={following ? 'default' : 'secondary'}
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
              onPress={() => void Share.share({ title: artist.name, message: t('sheet.shareMessage', { name: artist.name, genre: artist.genre, city: artist.city }) })}
              icon={<Ionicons name="share-outline" size={22} color={colors.ink} />}
            />
          </View>

          <Section title={t('profile.about')}>
            <Text style={[styles.bio, { color: colors.inkSoft }]}>{artist.bio}</Text>
          </Section>

          <Card>
            <Stat icon="musical-notes" text={artist.genre} />
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
                  <Pressable key={`${track.title}-${index}`} style={[styles.row, { borderBottomColor: colors.line }]} onPress={() => Linking.openURL(track.url).catch(() => {})}>
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
                      <Text style={[styles.rowMeta, { color: colors.inkSoft }]}>{other.genre} · {other.city}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
                  </Pressable>
                ))}
              </Card>
            </Section>
          ) : null}
        </View>
      </ScrollView>
      {bookingOpen ? <BookingModal artist={artist} onClose={() => setBookingOpen(false)} /> : null}
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hero: { minHeight: 430, overflow: 'hidden', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.42 },
  coverVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.48 },
  back: { width: 46, height: 46, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  heroContent: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', gap: spacing.md },
  locationBadge: { borderRadius: radii.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  locationText: { fontFamily: fonts.medium, fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1, fontFamily: fonts.displayBlack, fontSize: 42, letterSpacing: -1.5 },
  trending: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  trendingText: { fontFamily: fonts.bold, fontSize: 12 },
  content: { padding: spacing['2xl'], paddingBottom: spacing['4xl'], gap: spacing['3xl'] },
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
