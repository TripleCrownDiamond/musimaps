import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { compactCount, spacing, type Artist } from '@musimaps/shared';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchArtistFollowers,
  fetchArtistLikes,
  fetchFollowing,
  recordProfileView,
  toggleFollow,
} from '@musimaps/shared';
import { fetchArtistBooking, type ArtistBooking } from '@musimaps/shared';
import { fetchArtistTracks, type StreamedTrack } from '@musimaps/shared';
import { requestClaim } from '@musimaps/shared';
import { fonts, shadow, type AppColors } from '../theme';
import { ArtistAvatar } from './ArtistAvatar';
import { BookingModal } from './BookingModal';

const tabs = ['About', 'Musics', 'Events', 'Nearby'] as const;
type Tab = (typeof tabs)[number];

interface ArtistSheetProps {
  artist: Artist;
  /** Artistes à moins de 500 km (onglet À proximité, comme le web). */
  nearby?: Artist[];
  onClose: () => void;
  onSelectArtist?: (artist: Artist) => void;
  /** Ouvre la page artiste complète ; la sheet reste un aperçu rapide. */
  onOpenProfile?: () => void;
  /** Redirige vers la connexion quand une action exige un compte (comme le web). */
  onRequireAuth?: () => void;
}

/** Icônes par plateforme (comme le web). */
const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶️',
  spotify: '🎧',
  apple_music: '🍎',
  bandcamp: '🎸',
  soundcloud: '☁️',
  deezer: '🎵',
  website: '🌐',
  facebook: 'f',
  instagram: '📷',
  twitter: '𝕏',
  tiktok: '🎬',
  wikipedia: '📖',
};

export function ArtistSheet({ artist, nearby = [], onClose, onSelectArtist, onOpenProfile, onRequireAuth }: ArtistSheetProps) {
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('About');
  const [playing, setPlaying] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [booking, setBooking] = useState<ArtistBooking | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  // Titres récupérés automatiquement (iTunes) quand le profil n'en liste aucun.
  const [autoTracks, setAutoTracks] = useState<StreamedTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const { favorites, toggleFavorite, deviceId, showToast } = useApp();
  const { user } = useAuth();

  /** Liens publics d'écoute (YouTube, Spotify…) et réseaux sociaux. */
  const externalLinks = useMemo(() => {
    const platforms = artist.platforms ?? {};
    const socials = artist.socials ?? {};
    const links: Array<{ key: string; url: string; label: string }> = [];
    const add = (key: string, url: string | undefined, label: string) => {
      if (url) links.push({ key, url, label });
    };
    add('youtube', platforms.youtube, 'YouTube');
    add('spotify', platforms.spotify, 'Spotify');
    add('apple_music', platforms.apple_music, 'Apple Music');
    add('deezer', platforms.deezer, 'Deezer');
    add('soundcloud', platforms.soundcloud, 'SoundCloud');
    add('bandcamp', platforms.bandcamp, 'Bandcamp');
    add('website', platforms.website, t('sheet.website'));
    add('instagram', socials.instagram, 'Instagram');
    add('facebook', socials.facebook, 'Facebook');
    add('twitter', socials.twitter, 'X / Twitter');
    add('tiktok', socials.tiktok, 'TikTok');
    add('wikipedia', socials.wikipedia, 'Wikipedia');
    return links;
  }, [artist.platforms, artist.socials, t]);

  const saved = favorites.includes(artist.id);

  // Vue profil mobile → mêmes analytics que le web (vues uniques par appareil).
  useEffect(() => {
    void recordProfileView(artist.id, {
      viewerKey: deviceId ?? undefined,
      country: user?.city ? user.city.split(',').pop()?.trim() : null,
    });
  }, [artist.id, deviceId, user?.city]);

  // Données de l'artiste (abonnés, likes, réservation) — garde-fou sur le
  // dernier id affiché (la fiche reste montée quand on change d'artiste via
  // « À proximité ») : une réponse lente de l'artiste précédent ne doit pas
  // écraser celle du courant (même logique que la fiche web).
  const lastArtistIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastArtistIdRef.current === artist.id) return;
    lastArtistIdRef.current = artist.id;
    // Suivre : abonnement Supabase (distinct du like local). Repli silencieux.
    void fetchFollowing()
      .then((ids) => {
        if (lastArtistIdRef.current === artist.id) setFollowing(ids.includes(artist.id));
      })
      .catch(() => {});
    // Vrais abonnés Musimaps (compteur réel, pas la valeur du catalogue).
    void fetchArtistFollowers(artist.id)
      .then((n) => {
        if (lastArtistIdRef.current === artist.id) setFollowersCount(n);
      })
      .catch(() => {});
    // Likes (favoris) de l'artiste sur Musimaps.
    void fetchArtistLikes(artist.id)
      .then((n) => {
        if (lastArtistIdRef.current === artist.id) setLikesCount(n);
      })
      .catch(() => {});
    // Réservable + forfaits (migration 00048).
    void fetchArtistBooking(artist.id)
      .then((b) => {
        if (lastArtistIdRef.current === artist.id) setBooking(b);
      })
      .catch(() => {});
  }, [artist.id]);

  // Peuplement automatique de l'onglet Musiques depuis Apple Music/iTunes.
  useEffect(() => {
    if (artist.tracks.length > 0) return;
    const controller = new AbortController();
    setTracksLoading(true);
    void fetchArtistTracks(artist.name, controller.signal).then((list) => {
      setAutoTracks(list);
      setTracksLoading(false);
    });
    return () => controller.abort();
  }, [artist.id, artist.name, artist.tracks.length]);

  /** Revendique le profil (l'artiste prouve que c'est bien lui). */
  const claim = async () => {
    setClaiming(true);
    const result = await requestClaim(artist.id);
    setClaiming(false);
    showToast(
      result.ok ? t('sheet.claimSent') : t('sheet.claimFailed'),
      result.ok ? 'checkmark-circle' : 'alert-circle',
    );
  };

  const toggleFollowClick = async () => {
    const followMsg =
      lang === 'fr'
        ? `${user?.displayName ?? "Quelqu'un"} a commencé à te suivre`
        : `${user?.displayName ?? 'Someone'} started following you`;
    const result = await toggleFollow(artist.id, followMsg);
    if (result.ok) {
      setFollowing(result.following);
      setFollowersCount((n) => Math.max(0, n + (result.following ? 1 : -1)));
      showToast(
        result.following
          ? t('sheet.followToast', { name: artist.name })
          : t('sheet.unfollowToast', { name: artist.name }),
        result.following ? 'person-add' : 'person-remove',
      );
    }
  };

  const requireAuth = () => onRequireAuth?.();

  const platforms = artist.platforms ?? {};

  // Fermeture par glissement vers le bas (poignée) — comme les sheets natifs.
  const sheetY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.9) {
          onClose();
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.scrim} pointerEvents="box-none">
      {/* Fond flouté (comme le web : backdrop-blur + voile sombre). */}
      <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable accessibilityLabel={t('sheet.closeAria')} style={styles.dismiss} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        {/* Poignée + fermer (comme le web). La poignée sert aussi à fermer
            en glissant vers le bas. */}
        <View style={styles.header} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('sheet.closeAria')}
            style={styles.close}
            onPress={onClose}
          >
            <Ionicons name="close" size={18} color={colors.ink} />
          </Pressable>
        </View>

        {/* Onglets — même liste que le web : À propos, Musiques, Événements, À proximité. */}
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>
                {item === 'About'
                  ? t('sheet.about')
                  : item === 'Musics'
                    ? t('sheet.musics')
                    : item === 'Events'
                      ? t('sheet.events')
                      : t('sheet.nearby')}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'About' && (
            <View style={styles.about}>
              <ArtistAvatar
                artist={artist}
                size={112}
                gradient={[colors.brandDeep, colors.brand]}
                initialsColor={colors.black}
                borderless
              />
              <View style={styles.aboutCopy}>
                {artist.trending && (
                  <View style={styles.trending}>
                    <Ionicons name="flame" size={16} color={colors.danger} />
                    <Text style={styles.trendingText}>{t('sheet.trending')}</Text>
                  </View>
                )}
                <View style={styles.titleRow}>
                  <Text numberOfLines={1} style={styles.artistName}>
                    {artist.name}
                  </Text>
                  {artist.verified && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />
                  )}
                </View>
                <Text style={styles.bio} numberOfLines={3}>
                  {artist.bio}
                </Text>
                <Text style={styles.location}>
                  {artist.flag}  {[artist.district, artist.city, artist.country].filter(Boolean).join(', ')}
                </Text>
                <Text style={styles.meta}>
                  {artist.genre} · {t('sheet.followers', { count: compactCount(followersCount) })} ·{' '}
                  {t('sheet.likes', { count: likesCount })}
                </Text>
                {/* Liens plateformes + réseaux (comme le web, dans l'onglet À propos). */}
                {externalLinks.length > 0 && (
                  <View style={styles.links}>
                    {externalLinks.map((link) => (
                      <Pressable
                        key={link.key}
                        accessibilityRole="link"
                        style={styles.linkChip}
                        onPress={() => Linking.openURL(link.url).catch(() => {})}
                      >
                        <Text style={styles.linkChipIcon}>{PLATFORM_ICONS[link.key] ?? '🔗'}</Text>
                        <Text style={styles.linkChipText}>{link.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {tab === 'Musics' && (
            <>
              {tracksLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.brandDeep} />
                  <Text style={styles.emptyText}>{t('sheet.loadingTracks')}</Text>
                </View>
              )}
              {!tracksLoading && artist.tracks.length === 0 && autoTracks.length === 0 && (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyText}>
                    {platforms.spotify ? t('sheet.listenSpotify') : t('sheet.noTracks')}
                  </Text>
                </View>
              )}
              {artist.tracks.map((track, index) => (
                <Pressable
                  key={track.title}
                  onPress={() => setPlaying(playing === track.title ? null : track.title)}
                  style={styles.track}
                >
                  <Text style={styles.trackIndex}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={styles.trackCopy}>
                    <Text style={styles.trackTitle}>{track.title}</Text>
                    <Text style={styles.trackMeta}>{artist.name}</Text>
                  </View>
                  <Text style={styles.trackDuration}>{track.duration}</Text>
                  <View style={[styles.playMini, playing === track.title && styles.playMiniActive]}>
                    <Ionicons
                      name={playing === track.title ? 'pause' : 'play'}
                      size={16}
                      color={playing === track.title ? colors.black : colors.ink}
                    />
                  </View>
                </Pressable>
              ))}
              {autoTracks.map((track) => (
                <Pressable
                  key={track.url}
                  style={styles.track}
                  onPress={() =>
                    track.previewUrl
                      ? setPlaying(playing === track.url ? null : track.url)
                      : Linking.openURL(track.url).catch(() => {})
                  }
                >
                  {track.artwork ? (
                    <Image source={{ uri: track.artwork }} style={styles.trackArt} />
                  ) : (
                    <View style={styles.trackArtTile}>
                      <Ionicons name="musical-notes" size={16} color={colors.brandDeep} />
                    </View>
                  )}
                  <View style={styles.trackCopy}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    {track.album ? (
                      <Text style={styles.trackMeta} numberOfLines={1}>
                        {track.album}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.trackDuration}>{track.duration}</Text>
                  <View style={[styles.playMini, playing === track.url && styles.playMiniActive]}>
                    <Ionicons
                      name={playing === track.url ? 'pause' : 'play'}
                      size={16}
                      color={playing === track.url ? colors.black : colors.brandDeep}
                    />
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {tab === 'Events' && (
            <>
              {artist.events.length === 0 && (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyText}>{t('sheet.noEvents')}</Text>
                  {platforms.website && (
                    <Pressable
                      style={styles.seeDates}
                      onPress={() => Linking.openURL(platforms.website!).catch(() => {})}
                    >
                      <Ionicons name="calendar-outline" size={16} color={colors.white} />
                      <Text style={styles.seeDatesText}>{t('sheet.seeDates')}</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {artist.events.map((event) => (
                <View key={event.label} style={styles.event}>
                  <View style={styles.eventDate}>
                    {event.date.split(' ').map((part) => (
                      <Text key={part} style={styles.eventDatePart}>
                        {part}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventLabel} numberOfLines={1}>
                      {event.label}
                    </Text>
                    <Text style={styles.eventVenue}>{event.venue}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {tab === 'Nearby' && (
            <>
              {nearby.length === 0 && (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyText}>{t('sheet.noNearby')}</Text>
                </View>
              )}
              {nearby.map((other) => (
                <Pressable
                  key={other.id}
                  style={styles.nearbyRow}
                  onPress={() => onSelectArtist?.(other)}
                >
                  <ArtistAvatar
                    artist={other}
                    size={44}
                    gradient={[colors.brandDeep, colors.brand]}
                    initialsColor={colors.black}
                    borderless
                  />
                  <View style={styles.nearbyCopy}>
                    <Text style={styles.nearbyName} numberOfLines={1}>
                      {other.name}
                    </Text>
                    <Text style={styles.nearbyMeta}>
                      {other.genre} · {other.city}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>

        {onOpenProfile ? (
          <Pressable style={styles.fullProfile} onPress={onOpenProfile}>
            <Ionicons name="open-outline" size={17} color={colors.brandPrimary} />
            <Text style={styles.fullProfileText}>{t('sheet.fullProfile')}</Text>
          </Pressable>
        ) : null}

        {/* Forfaits de réservation — l'artiste réservable affiche ses prestations (comme le web). */}
        {booking?.bookable && booking.plans.some((p) => p.active) && (
          <View style={styles.plans}>
            <View style={styles.plansHead}>
              <Ionicons name="calendar-outline" size={15} color={colors.brandDeep} />
              <Text style={styles.plansTitle}>{t('sheet.plansTitle')}</Text>
              <View style={styles.bookableBadge}>
                <Text style={styles.bookableBadgeText}>{t('sheet.bookable')}</Text>
              </View>
            </View>
            {booking.plans.filter((p) => p.active).map((plan) => (
              <View key={plan.id} style={styles.plan}>
                <View style={styles.planCopy}>
                  <Text numberOfLines={1} style={styles.planName}>
                    {plan.name}
                  </Text>
                  {plan.duration ? (
                    <Text numberOfLines={1} style={styles.planMeta}>
                      {plan.duration}
                      {plan.description ? ` · ${plan.description}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.planPrice}>
                  {plan.price > 0
                    ? `${plan.price.toLocaleString('fr-FR')} ${plan.currency}`
                    : t('sheet.priceOnRequest')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions — même disposition que le web : réservation, suivre, coeur, partager. */}
        <View style={styles.actions}>
          {booking?.bookable && user?.accountType === 'business' && (
            <Pressable style={styles.book} onPress={() => setBookingOpen(true)}>
              <Ionicons name="calendar" size={21} color={colors.white} />
              <Text style={styles.bookText}>{t('sheet.book')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.follow, following && styles.followActive]}
            onPress={() => (user ? void toggleFollowClick() : requireAuth())}
          >
            <Ionicons
              name={following ? 'checkmark-circle' : 'person-add-outline'}
              size={21}
              color={following ? colors.white : colors.black}
            />
            <Text style={[styles.followText, following && styles.followTextActive]}>
              {following ? t('sheet.following') : t('sheet.follow')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t('sheet.save')}
            style={styles.iconBtn}
            onPress={() => {
              if (!user) {
                requireAuth();
                return;
              }
              const nextSaved = !saved;
              void toggleFavorite(artist.id);
              showToast(
                nextSaved
                  ? t('sheet.saveToast', { name: artist.name })
                  : t('sheet.unsaveToast', { name: artist.name }),
                nextSaved ? 'heart' : 'heart-dislike',
              );
            }}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={23}
              color={saved ? colors.danger : colors.ink}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={t('sheet.shareAria')}
            style={styles.iconBtn}
            onPress={() =>
              Share.share({
                title: artist.name,
                message: t('sheet.shareMessage', {
                  name: artist.name,
                  genre: artist.genre,
                  city: artist.city,
                }),
              })
            }
          >
            <Ionicons name="share-outline" size={23} color={colors.ink} />
          </Pressable>
        </View>

        {/* Revendication : réservée à un compte artiste connecté (comme le web). */}
        {artist.source === 'musicbrainz' && !artist.claimedBy && user?.role === 'artist' && (
          <Pressable
            style={styles.claim}
            onPress={() => void claim()}
            disabled={claiming}
          >
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.brandDeep} />
            <Text style={styles.claimText}>
              {claiming ? t('sheet.claiming') : t('sheet.claim')}
            </Text>
          </Pressable>
        )}
      </Animated.View>
      {bookingOpen && <BookingModal artist={artist} onClose={() => setBookingOpen(false)} />}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    scrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1500, // au-dessus des pins sélectionnés (zIndex: 1200-1300)
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(3,10,20,0.48)',
    },
    dismiss: { flex: 1 },
    sheet: {
      height: '58%',
      minHeight: 420,
      backgroundColor: colors.background,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 16,
      ...shadow,
    },
    // Hauteur = celle du bouton fermer, pour qu'il ne déborde pas sous les
    // onglets (en RN, les siblings suivants peignent au-dessus de l'absolute).
    header: { alignItems: 'center', justifyContent: 'center', marginBottom: 12, minHeight: 38 },
    handle: { height: 6, width: 48, borderRadius: 3, backgroundColor: colors.muted, opacity: 0.5 },
    close: {
      position: 'absolute',
      top: 2,
      right: 0,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    tabs: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 24, padding: 4, marginBottom: 14 },
    tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
    tabActive: { backgroundColor: colors.surface },
    tabText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 12 },
    tabTextActive: { color: colors.brandDeep },
    content: { flex: 1, minHeight: 0 },
    // Le conteneur du scroll s'étend toujours à la hauteur visible : l'onglet
    // À propos (contenu court) est centré verticalement, sans espace vide en
    // bas de la section stats. Les onglets longs (Musiques) scrollent.
    contentInner: { flexGrow: 1 },
    about: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 17, paddingBottom: 12 },
    aboutCopy: { flex: 1, paddingTop: 3 },
    trending: { alignSelf: 'flex-start', flexDirection: 'row', gap: 4, borderRadius: 16, backgroundColor: '#FFE4E8', paddingHorizontal: 9, paddingVertical: 5 },
    trendingText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    artistName: { maxWidth: '86%', color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 26, letterSpacing: -1.2 },
    bio: { color: colors.inkSoft, fontFamily: fonts.body, lineHeight: 20, marginTop: 3 },
    location: { color: colors.ink, fontFamily: fonts.medium, marginTop: 9 },
    meta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    linkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 6 },
    linkChipIcon: { fontSize: 12 },
    linkChipText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 12 },
    // États vides/chargement : centrés verticalement (le conteneur du scroll
    // s'étend toujours à la hauteur visible) — pas de vide sous le contenu.
    loadingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 22 },
    emptyBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 26, paddingHorizontal: 8, gap: 12 },
    emptyText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
    seeDates: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, backgroundColor: colors.brandDeep, paddingHorizontal: 18, paddingVertical: 10 },
    seeDatesText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
    track: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    trackIndex: { width: 22, color: colors.muted, fontFamily: fonts.medium },
    trackArt: { width: 40, height: 40, borderRadius: 10 },
    trackArtTile: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
    trackCopy: { flex: 1 },
    trackTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    trackMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    trackDuration: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12 },
    playMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    playMiniActive: { backgroundColor: colors.brand },
    event: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
    eventDate: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    eventDatePart: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, lineHeight: 14 },
    eventCopy: { flex: 1 },
    eventLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    eventVenue: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
    nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 10, marginBottom: 4 },
    nearbyCopy: { flex: 1 },
    nearbyName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    nearbyMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
    plans: { marginTop: 4, gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    fullProfile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    fullProfileText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 13 },
    plansHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    plansTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, flex: 1 },
    bookableBadge: { borderRadius: 999, backgroundColor: colors.brand, paddingHorizontal: 8, paddingVertical: 2 },
    bookableBadgeText: { color: colors.black, fontFamily: fonts.bold, fontSize: 10 },
    plan: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 11 },
    planCopy: { flex: 1 },
    planName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    planMeta: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
    planPrice: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingTop: 14, marginTop: 10 },
    book: { flex: 1.1, minHeight: 54, borderRadius: 27, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    bookText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
    follow: { flex: 1.4, minHeight: 54, borderRadius: 27, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    followActive: { backgroundColor: colors.brandDeep },
    followText: { color: colors.black, fontFamily: fonts.bold, fontSize: 15 },
    followTextActive: { color: colors.white },
    iconBtn: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    claim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.brandDeep, backgroundColor: colors.brandSoft, paddingVertical: 11 },
    claimText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 13 },
  });
