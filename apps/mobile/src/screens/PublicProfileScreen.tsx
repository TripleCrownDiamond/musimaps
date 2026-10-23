import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchPublicProfile,
  followPerson,
  onUserBlocked,
  profileUrl,
  radii,
  spacing,
  unfollowPerson,
  type PublicProfile,
} from '@musimaps/shared';
import { AccountAvatar } from '../components/AccountMedia';
import { CollectionCard } from '../components/community/CommunityCards';
import { ReportSheet } from '../components/ReportSheet';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { Button, ScreenHeader } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicProfile'>;

/** Profil public d'un mélomane — même contenu que la page web `/m/:handle`. */
export function PublicProfileScreen({ navigation, route }: Props) {
  const { handle } = route.params;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { showToast } = useApp();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    void fetchPublicProfile(handle).then((data) => {
      if (!cancelled) setProfile(data);
    });
    return () => {
      cancelled = true;
    };
  }, [handle, user?.id]);

  useEffect(() => onUserBlocked(() => navigation.goBack()), [navigation]);

  const toggleFollow = async () => {
    if (!profile) return;
    if (!user) return navigation.navigate('Login');
    setBusy(true);
    const result = profile.isFollowing ? await unfollowPerson(profile.id) : await followPerson(profile.id);
    setBusy(false);
    if (!result.ok) return showToast(t('community.error'), 'alert-circle', 'error');
    setProfile({
      ...profile,
      isFollowing: !profile.isFollowing,
      followerCount: profile.followerCount + (profile.isFollowing ? -1 : 1),
    });
  };

  const share = (name: string, link: string) => {
    void Share.share({ title: name, message: `${name} ${link}`, url: link }).catch(() => undefined);
  };

  if (profile === undefined) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </SafeAreaView>
    );
  }

  if (profile === null) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScreenHeader onBack={() => navigation.goBack()} />
        <Text style={[styles.muted, styles.empty]}>{t('community.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const name = profile.displayName || profile.handle || '—';
  const joined = new Date(profile.joinedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <ScreenHeader onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AccountAvatar name={name} image={profile.avatarUrl} />
          <Text style={styles.name}>{name}</Text>
          {profile.handle ? <Text style={styles.muted}>@{profile.handle}</Text> : null}
          <Text style={styles.muted}>
            {[profile.city, t('community.memberSince', { date: joined })].filter(Boolean).join('  ·  ')}
          </Text>
          <Text style={styles.counts}>
            {t('community.followers', { n: profile.followerCount })}  ·  {t('community.followingCount', { n: profile.followingCount })}
          </Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {profile.favoriteGenres.length > 0 && (
            <View style={styles.chips}>
              {profile.favoriteGenres.map((genre) => (
                <Text key={genre} style={styles.chip}>{genre}</Text>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {profile.isMe ? (
              <Button variant="outline" label={t('profile.editProfile')} onPress={() => navigation.navigate('ProfileEdit')} />
            ) : (
              <Button
                variant={profile.isFollowing ? 'outline' : 'default'}
                loading={busy}
                label={profile.isFollowing ? t('community.unfollow') : t('community.follow')}
                icon={<Ionicons name={profile.isFollowing ? 'person-remove-outline' : 'person-add-outline'} size={17} color={profile.isFollowing ? colors.ink : colors.white} />}
                onPress={() => void toggleFollow()}
              />
            )}
            {profile.handle && profile.isPublic ? (
              <Button
                variant="outline"
                label={t('community.share')}
                icon={<Ionicons name="share-outline" size={17} color={colors.ink} />}
                onPress={() => share(name, profileUrl(profile.handle!, lang))}
              />
            ) : null}
          </View>
          {profile.isMe && !profile.isPublic ? <Text style={styles.notice}>{t('community.privateNotice')}</Text> : null}
        </View>

        <Text style={styles.section}>{t('community.collections')}</Text>
        {profile.collections.length === 0 ? (
          <Text style={styles.muted}>{t('community.noCollections')}</Text>
        ) : (
          profile.collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onPress={() => navigation.push('Collection', { id: collection.id })}
            />
          ))
        )}

        <Text style={styles.section}>{t('community.followedArtists')}</Text>
        {profile.followedArtists.length === 0 ? (
          <Text style={styles.muted}>{t('community.noArtists')}</Text>
        ) : (
          <View style={styles.artists}>
            {profile.followedArtists.map((artist) => (
              <Pressable
                key={artist.id}
                accessibilityRole="button"
                style={styles.artist}
                onPress={() => navigation.navigate('ArtistProfile', { artistId: artist.id })}
              >
                <AccountAvatar name={artist.name} image={artist.image} variant="edit" />
                <Text numberOfLines={2} style={styles.artistName}>{artist.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!profile.isMe && user && (
          <Pressable accessibilityRole="button" style={styles.report} onPress={() => setReportOpen(true)}>
            <Ionicons name="flag" size={13} color={colors.danger} />
            <Text style={styles.reportText}>{t('community.reportProfile')}</Text>
          </Pressable>
        )}
      </ScrollView>
      {reportOpen && (
        <ReportSheet
          target={{ kind: 'profile', id: profile.id }}
          name={name}
          blockUserId={profile.id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
    name: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 26, marginTop: spacing.sm, textAlign: 'center' },
    muted: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
    empty: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
    counts: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginTop: spacing.xs },
    bio: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
    chip: {
      color: colors.brandDeep,
      backgroundColor: colors.brandSoft,
      fontFamily: fonts.bold,
      fontSize: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
    notice: {
      color: colors.inkSoft,
      backgroundColor: colors.surfaceMuted,
      fontFamily: fonts.body,
      fontSize: 13,
      padding: spacing.md,
      borderRadius: radii['2xl'],
      overflow: 'hidden',
      marginTop: spacing.md,
      textAlign: 'center',
    },
    section: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, marginTop: spacing.xl, marginBottom: spacing.md },
    artists: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    artist: { width: 92, alignItems: 'center', gap: spacing.xs },
    artistName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, textAlign: 'center' },
    report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: spacing['2xl'] },
    reportText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 12 },
  });
