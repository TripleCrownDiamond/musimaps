import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { LocationFields } from '../components/LocationFields';
import { NotificationButton } from '../components/NotificationButton';
import { NeighborhoodField } from '../components/NeighborhoodField';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { fetchMyArtistProfile, updateMyArtistProfile, uploadArtistImage } from '@musimaps/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistJoin'>;

const PLATFORMS = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'youtube', label: 'YouTube Music' },
  { key: 'apple_music', label: 'Apple Music' },
  { key: 'deezer', label: 'Deezer' },
  { key: 'soundcloud', label: 'SoundCloud' },
] as const;

const SOCIALS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'twitter', label: 'X (Twitter)' },
  { key: 'facebook', label: 'Facebook' },
] as const;

interface FormState {
  artistName: string;
  email: string;
  city: string;
  country: string;
  district: string;
  genre: string;
  bio: string;
  platform: string;
  platformUrl: string;
  social: string;
  socialUrl: string;
  photo: string;
}

const initialForm: FormState = {
  artistName: '',
  email: '',
  city: '',
  country: '',
  district: '',
  genre: '',
  bio: '',
  platform: 'spotify',
  platformUrl: '',
  social: 'instagram',
  socialUrl: '',
  photo: '',
};

export function ArtistJoinScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { applyAsArtist } = useApp();
  const { user, loading: authLoading } = useAuth();
  const prefill = route.params ?? {};

  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    artistName: prefill.artistName ?? '',
    genre: prefill.genre ?? '',
    bio: prefill.bio ?? '',
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const platformLabel = PLATFORMS.find((p) => p.key === form.platform)?.label ?? form.platform;
  const socialLabel = SOCIALS.find((s) => s.key === form.social)?.label ?? form.social;

  // ── Auto-fill from logged-in user profile + claimed profile ─────────
  const filledRef = useRef(false);
  useEffect(() => {
    if (!user || filledRef.current) return;
    filledRef.current = true;
    setForm((f) => ({
      ...f,
      artistName: f.artistName || user.displayName || '',
      email: f.email || user.email || '',
      city: f.city || user.city || '',
      country: f.country || user.country || '',
      district: f.district || user.district || '',
    }));
    // Load claimed profile for genre/bio/photo/platforms/socials
    void fetchMyArtistProfile().then((claimed) => {
      if (!claimed) return;
      setForm((f) => ({
        ...f,
        genre: f.genre || claimed.genre || '',
        bio: f.bio || claimed.bio || '',
        photo: f.photo || claimed.image || '',
        platformUrl:
          f.platformUrl || claimed.platforms?.spotify || claimed.platforms?.youtube || '',
        platform: claimed.platforms?.spotify
          ? 'spotify'
          : claimed.platforms?.youtube
            ? 'youtube'
            : f.platform,
        socialUrl: f.socialUrl || claimed.socials?.instagram || '',
      }));
    });
  }, [user]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Photo upload ────────────────────────────────────────────────────
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    const uploadResult = await uploadArtistImage(
      { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' },
      'artists',
    );
    setUploading(false);
    if (uploadResult.error) setError(uploadResult.error);
    else setForm((f) => ({ ...f, photo: uploadResult.url }));
  };

  const platformUrlPlaceholder = (p: string) => {
    switch (p) {
      case 'spotify': return 'https://open.spotify.com/…';
      case 'youtube': return 'https://youtube.com/…';
      case 'apple_music': return 'https://music.apple.com/…';
      case 'deezer': return 'https://deezer.com/…';
      case 'soundcloud': return 'https://soundcloud.com/…';
      default: return 'https://…';
    }
  };

  const socialUrlPlaceholder = (s: string) => {
    switch (s) {
      case 'instagram': return 'https://instagram.com/…';
      case 'tiktok': return 'https://tiktok.com/@…';
      case 'twitter': return 'https://x.com/…';
      case 'facebook': return 'https://facebook.com/…';
      default: return 'https://…';
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────
  const submit = async () => {
    if (!form.artistName.trim() || !form.city.trim() || !form.country.trim() || !form.email.includes('@')) {
      return setError(t('join.errRequired'));
    }
    setLoading(true);
    setError(null);
    const message = await applyAsArtist({
      artistName: form.artistName.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      district: form.district.trim(),
      genre: form.genre.trim(),
      bio: form.bio.trim(),
      link: form.platformUrl.trim() || form.socialUrl.trim(),
      spotify: form.platform === 'spotify' ? form.platformUrl.trim() : '',
      youtube: form.platform === 'youtube' ? form.platformUrl.trim() : '',
      instagram: form.social === 'instagram' ? form.socialUrl.trim() : '',
      userId: user?.id,
    });
    setLoading(false);
    if (message) return setError(message);

    // Sync to claimed profile (best-effort, like web)
    if (user) {
      await updateMyArtistProfile({
        bio: form.bio.trim() || undefined,
        genre: form.genre.trim() || undefined,
        image: form.photo || undefined,
        platforms:
          form.platformUrl.trim() && form.platform
            ? { [form.platform]: form.platformUrl.trim() }
            : undefined,
        socials:
          form.socialUrl.trim() && form.social
            ? { [form.social]: form.socialUrl.trim() }
            : undefined,
      });
    }

    navigation.replace('Confirmation', {
      email: form.email.trim(),
      profile: 'artiste',
      artistName: form.artistName.trim(),
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.ink} />
          </Pressable>
          <NotificationButton onPress={() => navigation.navigate('Notifications')} />
        </View>

        <Text style={styles.title}>{t('join.title')}</Text>
        <Text style={styles.subtitle}>{t('join.subtitle')}</Text>

        <View style={styles.form}>
          {/* ── Core fields ───────────────────────────── */}
          <Field colors={colors} styles={styles} label={t('join.artistName')} value={form.artistName} placeholder="Votre nom de scène" onChangeText={(v) => update('artistName', v)} />
          <Field colors={colors} styles={styles} label={t('join.email')} value={form.email} placeholder="vous@email.com" keyboardType="email-address" onChangeText={(v) => update('email', v)} />
          <LocationFields
            city={form.city}
            country={form.country}
            onChange={(location) => setForm((current) => ({
              ...current,
              city: location.city,
              country: location.country,
            }))}
          />
          <View style={styles.field}>
            <Text style={styles.label}>{t('join.district')}</Text>
            <NeighborhoodField
              value={form.district}
              onChange={(value, suggestion) => setForm((current) => ({
                ...current,
                district: value,
                city: suggestion?.city || current.city,
                country: suggestion?.countryCode || current.country,
              }))}
            />
            <Text style={styles.hint}>{t('join.districtHint')}</Text>
          </View>
          <Field colors={colors} styles={styles} label={t('join.genre')} value={form.genre} placeholder="Afro-Soul" onChangeText={(v) => update('genre', v)} />
          <Field colors={colors} styles={styles} label={t('join.bio')} value={form.bio} placeholder={t('join.bioPlaceholder')} multiline onChangeText={(v) => update('bio', v)} />

          {/* ── Photo ─────────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('join.photo')}</Text>
            <View style={styles.photoRow}>
              {form.photo ? (
                <Image source={{ uri: form.photo }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <Ionicons name="camera-outline" size={28} color={colors.muted} />
                </View>
              )}
              <View style={styles.photoButtons}>
                <Pressable style={styles.photoBtn} onPress={pickPhoto} disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.brandDeep} />
                  ) : (
                    <Ionicons name="image-outline" size={16} color={colors.brandDeep} />
                  )}
                  <Text style={styles.photoBtnText}>
                    {form.photo ? t('join.photoChange') : t('join.photoAdd')}
                  </Text>
                </Pressable>
                {form.photo ? (
                  <Pressable onPress={() => update('photo', '')}>
                    <Text style={styles.photoRemove}>{t('join.photoRemove')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          {/* ── Links ─────────────────────────────────── */}
          <View style={styles.linksSection}>
            <View style={styles.linksHeader}>
              <View style={styles.linksTitleRow}>
                <Ionicons name="link-outline" size={16} color={colors.brandDeep} />
                <Text style={styles.linksTitle}>{t('join.linksTitle')}</Text>
              </View>
              <View style={styles.linksBadge}>
                <Text style={styles.linksBadgeText}>{t('join.linksLimit')}</Text>
              </View>
            </View>

            <Field colors={colors} styles={styles} label={t('join.platform').replace('{platform}', platformLabel)} value={form.platformUrl} placeholder={platformUrlPlaceholder(form.platform)} autoCapitalize="none" onChangeText={(v) => update('platformUrl', v)} />

            {/* Platform selector */}
            <View style={styles.selectorRow}>
              {PLATFORMS.map((p) => (
                <Pressable
                  key={p.key}
                  style={[styles.selectorChip, form.platform === p.key && styles.selectorChipActive]}
                  onPress={() => update('platform', p.key)}
                >
                  <Text style={[styles.selectorText, form.platform === p.key && styles.selectorTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Field colors={colors} styles={styles} label={t('join.social').replace('{social}', socialLabel)} value={form.socialUrl} placeholder={socialUrlPlaceholder(form.social)} autoCapitalize="none" onChangeText={(v) => update('socialUrl', v)} />

            {/* Social selector */}
            <View style={styles.selectorRow}>
              {SOCIALS.map((s) => (
                <Pressable
                  key={s.key}
                  style={[styles.selectorChip, form.social === s.key && styles.selectorChipActive]}
                  onPress={() => update('social', s.key)}
                >
                  <Text style={[styles.selectorText, form.social === s.key && styles.selectorTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.premiumHint}>{t('join.premiumHint')}</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable disabled={loading || authLoading} style={[styles.submit, (loading || authLoading) && styles.submitBusy]} onPress={submit}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.submitText}>{t('join.submit')}</Text>
                <Ionicons name="paper-plane" size={19} color={colors.white} />
              </>
            )}
          </Pressable>
          <Text style={styles.privacy}>{t('join.privacy')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Reusable field ──────────────────────────────────────────────────── */

function Field({
  label,
  colors,
  styles,
  ...props
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        underlineColorAndroid="transparent"
        style={[styles.input, props.multiline && styles.inputMultiline]}
        multiline={props.multiline}
        {...props}
      />
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 21, paddingTop: 54, paddingBottom: 55 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  badgeText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 40, lineHeight: 45, letterSpacing: -2, marginTop: 52 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 23, marginTop: 10 },
  form: { gap: 15, marginTop: 30 },
  field: { gap: 7 },
  label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginLeft: 4 },
  hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginLeft: 4, marginTop: -2 },
  input: { height: 59, borderRadius: 20, backgroundColor: colors.surface, color: colors.ink, fontFamily: fonts.body, fontSize: 16, paddingHorizontal: 17, borderWidth: 0, outlineWidth: 0 },
  inputMultiline: { height: 110, paddingTop: 15, textAlignVertical: 'top' },
  /* Photo */
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoPreview: { width: 80, height: 80, borderRadius: 20 },
  photoPlaceholder: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  photoButtons: { flex: 1, gap: 6 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10 },
  photoBtnText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
  photoRemove: { color: colors.danger, fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 14 },
  /* Links section */
  linksSection: { borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted + '60', padding: 18, gap: 12 },
  linksHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linksTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  linksTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  linksBadge: { backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  linksBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.black },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectorChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  selectorChipActive: { borderColor: colors.brandDeep, backgroundColor: colors.brandSoft },
  selectorText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  selectorTextActive: { color: colors.brandDeep, fontFamily: fonts.bold },
  premiumHint: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  /* Submit */
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, backgroundColor: colors.surface, borderRadius: 16, padding: 12 },
  submit: { minHeight: 62, borderRadius: 31, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 6, paddingHorizontal: 20 },
  submitBusy: { opacity: 0.6 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  privacy: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 22 },
});
