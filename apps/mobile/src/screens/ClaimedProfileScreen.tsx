import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchMyArtistProfile,
  fetchArtistBooking,
  updateMyArtistProfile,
  updateArtistBooking,
  uploadArtistImage,
  slugify,
  artistUrl,
  PROFILE_GUTTER,
  spacing,
  type ClaimedArtistProfile,
  type ArtistBooking,
  type BookingPlan,
} from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { Button, Card, Field, Input, Section } from '../ui';
import { APP_BAR_ACTION_SIZE } from '../components/AppBar';
import { ProfileHeader } from '../components/ProfileHeader';
import { NotificationButton } from '../components/NotificationButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ClaimedProfile'>;

export function ClaimedProfileScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState<ClaimedArtistProfile | null>(null);
  const [booking, setBooking] = useState<ArtistBooking | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [genreDraft, setGenreDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [districtDraft, setDistrictDraft] = useState('');
  const [slugDraft, setSlugDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Chargement ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [profile, bookingData] = await Promise.all([
        fetchMyArtistProfile(),
        fetchMyArtistProfile().then((p) => (p ? fetchArtistBooking(p.id) : null)),
      ]);
      if (cancelled) return;
      setClaimed(profile);
      setBioDraft(profile?.bio ?? '');
      setGenreDraft(profile?.genre ?? '');
      setCityDraft(profile?.city ?? '');
      setDistrictDraft(profile?.district ?? '');
      setSlugDraft(profile?.slug ?? '');
      setBooking(bookingData);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // ── Image helpers ─────────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { canceled: true, assets: null } as ImagePicker.ImagePickerResult;
    }
    return ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
  }, []);

  const handleImage = useCallback(async () => {
    if (!claimed) return;
    const result = await pickImage();
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setSavingProfile(true);
    const upload = await uploadArtistImage({
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
    if (upload.error) {
      setSavingProfile(false);
      setStatusMsg({ ok: false, text: upload.error });
      return;
    }
    const update = await updateMyArtistProfile({ image: upload.url });
    setSavingProfile(false);
    if (!update.ok) {
      setStatusMsg({ ok: false, text: update.error ?? t('dash.saveFailed') });
      return;
    }
    setClaimed((prev) => prev ? { ...prev, image: upload.url } : prev);
    setStatusMsg({ ok: true, text: t('dash.changePhoto') });
  }, [claimed, pickImage, t]);

  const clearImage = useCallback(async () => {
    if (!claimed) return;
    setSavingProfile(true);
    const update = await updateMyArtistProfile({ image: '' });
    setSavingProfile(false);
    if (!update.ok) {
      setStatusMsg({ ok: false, text: update.error ?? t('dash.saveFailed') });
      return;
    }
    setClaimed((prev) => prev ? { ...prev, image: '' } : prev);
  }, [claimed, t]);

  // ── Bio / Genre save ──────────────────────────────────────────────
  const saveBio = useCallback(async () => {
    if (!claimed) return;
    setSavingProfile(true);
    const result = await updateMyArtistProfile({ bio: bioDraft.trim(), genre: genreDraft.trim(), city: cityDraft.trim(), district: districtDraft.trim() });
    setSavingProfile(false);
    if (!result.ok) {
      setStatusMsg({ ok: false, text: result.error ?? t('dash.saveFailed') });
      return;
    }
    setClaimed((prev) => prev ? { ...prev, bio: bioDraft.trim(), genre: genreDraft.trim(), city: cityDraft.trim(), district: districtDraft.trim() } : prev);
    setStatusMsg({ ok: true, text: '✅' });
  }, [claimed, bioDraft, genreDraft, cityDraft, districtDraft, t]);

  // ── Booking plans ─────────────────────────────────────────────────
  const patchPlan = useCallback((index: number, patch: Partial<BookingPlan>) => {
    setBooking((prev) => {
      if (!prev) return prev;
      const plans = [...prev.plans];
      plans[index] = { ...plans[index], ...patch };
      return { ...prev, plans };
    });
  }, []);

  const addPlan = useCallback(() => {
    setBooking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plans: [
          ...prev.plans,
          { id: `new-${Date.now()}`, name: '', price: 0, currency: 'EUR', active: true, duration: '', description: '' },
        ],
      };
    });
  }, []);

  const removePlan = useCallback((index: number) => {
    setBooking((prev) => {
      if (!prev) return prev;
      return { ...prev, plans: prev.plans.filter((_, i) => i !== index) };
    });
  }, []);

  const saveBooking = useCallback(async () => {
    if (!claimed || !booking) return;
    setSavingBooking(true);
    const result = await updateArtistBooking(
      claimed.id,
      booking.bookable,
      booking.plans.filter((p) => p.name.trim()).map((p) => ({
        name: p.name,
        description: p.description || null,
        price: p.price,
        currency: p.currency || 'EUR',
        duration: p.duration || null,
        active: p.active,
      })),
    );
    setSavingBooking(false);
    if (!result.ok) {
      setStatusMsg({ ok: false, text: result.error ?? t('dash.saveFailed') });
      return;
    }
    // Re-fetch
    const fresh = await fetchArtistBooking(claimed.id);
    if (fresh) setBooking(fresh);
    setStatusMsg({ ok: true, text: t('dash.bookingSaved') });
  }, [claimed, booking, t]);

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }

  if (!claimed) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="mic-outline" size={48} color={colors.muted} />
        {/* Aucun profil carte rattaché au compte : ce n'est pas « aucun titre ». */}
        <Text style={[styles.emptyText, { color: colors.ink, marginTop: 12 }]}>
          {t('dash.claimedEmptyTitle')}
        </Text>
        <Text style={[styles.emptyText, { color: colors.inkSoft, marginTop: 6 }]}>
          {t('dash.claimedEmptyText')}
        </Text>
        <Button variant="ghost" label={t('common.back')} onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <ProfileHeader
      background={colors.background}
      contentStyle={styles.content}
      topBar={
        <View style={styles.header}>
          <Pressable accessibilityLabel={t('common.back')} style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={27} color={colors.ink} />
          </Pressable>
          <Text style={[styles.title, { color: colors.ink }]}>{t('dash.claimedProfile')}</Text>
          <NotificationButton onPress={() => navigation.navigate('Notifications')} />
        </View>
      }
      header={
        <View style={styles.claimedHeader}>
          <View style={styles.photoWrap}>
            {claimed.image ? (
              <Image source={{ uri: claimed.image }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, { backgroundColor: colors.brand }]}>
                <Text style={styles.photoInitial}>{claimed.name[0]}</Text>
              </View>
            )}
            <Pressable style={styles.photoEdit} disabled={savingProfile} onPress={() => void handleImage()}>
              {savingProfile ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.white} />
              )}
            </Pressable>
          </View>
          <View style={styles.headerIdentity}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.artistName, { color: colors.ink }]} numberOfLines={1}>{claimed.name}</Text>
              {claimed.verified ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />
              ) : null}
            </View>
            <Text style={[styles.artistMeta, { color: colors.inkSoft }]} numberOfLines={1}>
              {claimed.flag} {claimed.city}, {claimed.country} · {claimed.genre}
            </Text>
            <View style={styles.headerActions}>
              <Button
                size="sm"
                variant="outline"
                disabled={savingProfile}
                onPress={() => void handleImage()}
                icon={<Ionicons name="camera-outline" size={14} color={colors.ink} />}
                label={t('dash.changePhoto')}
              />
              {claimed.image && (
                <Pressable style={styles.removePhoto} disabled={savingProfile} onPress={() => void clearImage()}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={[styles.removePhotoText, { color: colors.danger }]}>{t('dash.removePhoto')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      }
    >
      {/* ── Bio / Genre ── */}
      <Section title={t('profile.about')}>
        <Card>
          <Field label={t('dash.planDesc')}>
            <TextInput
              value={bioDraft}
              onChangeText={setBioDraft}
              multiline
              numberOfLines={3}
              placeholder={t('dash.planDesc')}
              placeholderTextColor={colors.muted}
              style={[styles.textArea, { color: colors.ink, borderColor: colors.line }]}
            />
          </Field>
          <Field label={t('auth.genres')}>
            <Input
              value={genreDraft}
              onChangeText={setGenreDraft}
              placeholder="Afrobeat, R&B…"
              placeholderTextColor={colors.muted}
            />
          </Field>
          <Field label={t('pedit.cityLabel')}>
            <Input
              value={cityDraft}
              onChangeText={setCityDraft}
              placeholder="Cotonou, Bénin"
              placeholderTextColor={colors.muted}
            />
          </Field>
          <Field label={t('pedit.districtLabel')}>
            <Input
              value={districtDraft}
              onChangeText={setDistrictDraft}
              placeholder="Ex. Yopougon, Bastille…"
              placeholderTextColor={colors.muted}
            />
          </Field>
          <Button
            block
            label={t('dash.bookingSave')}
            onPress={() => void saveBio()}
            loading={savingProfile}
          />
        </Card>
      </Section>

      {/* ── Lien perso (slug) ── */}
      <Section title={t('mapAdmin.slug') || 'Lien perso'} subtitle={t('mapAdmin.slugHint') || 'musimaps.com/artist/'}>
        <Card>
          <View style={styles.fieldRow}>
            <Text style={[styles.slugPrefix, { color: colors.inkSoft }]}>musimaps.com/artist/</Text>
            <Input
              value={slugDraft}
              onChangeText={setSlugDraft}
              placeholder={claimed.id}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Button
            block
            label={t('dash.bookingSave')}
            onPress={async () => {
              const s = slugify(slugDraft);
              if (!s) return;
              setSavingProfile(true);
              const result = await updateMyArtistProfile({ slug: s });
              setSavingProfile(false);
              if (!result.ok) {
                setStatusMsg({ ok: false, text: result.error ?? t('dash.saveFailed') });
                return;
              }
              setSlugDraft(s);
              setClaimed((prev) => prev ? { ...prev, slug: s } : prev);
              setStatusMsg({ ok: true, text: '✅ ' + artistUrl(s) });
            }}
            loading={savingProfile}
          />
        </Card>
      </Section>

      {/* ── Booking plans ── */}
      <Section title={t('dash.bookingTitle')} subtitle={t('dash.bookingDesc')}>
        {booking && (
          <Card>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.ink }]}>{t('dash.bookable')}</Text>
              <Switch
                value={booking.bookable}
                onValueChange={(val) => setBooking((prev) => prev ? { ...prev, bookable: val } : prev)}
                trackColor={{ true: colors.brandDeep, false: colors.muted }}
              />
            </View>

            {booking.bookable && (
              <>
                {booking.plans.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.inkSoft }]}>{t('dash.bookingEmpty')}</Text>
                )}
                {booking.plans.map((plan, index) => (
                  <View key={plan.id} style={[styles.planCard, { borderColor: colors.line }]}>
                    <Field label={t('dash.planName')}>
                      <Input
                        value={plan.name}
                        onChangeText={(val) => patchPlan(index, { name: val })}
                        placeholder="Concert privé"
                        placeholderTextColor={colors.muted}
                      />
                    </Field>
                    <View style={styles.planRow}>
                      <View style={{ flex: 1 }}>
                        <Field label={t('dash.planPrice')}>
                          <Input
                            value={String(plan.price)}
                            onChangeText={(val) => patchPlan(index, { price: Number(val) || 0 })}
                            keyboardType="numeric"
                            placeholderTextColor={colors.muted}
                          />
                        </Field>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field label={t('dash.planCurrency')}>
                          <Input
                            value={plan.currency}
                            onChangeText={(val) => patchPlan(index, { currency: val })}
                            placeholderTextColor={colors.muted}
                          />
                        </Field>
                      </View>
                    </View>
                    <View style={styles.planRow}>
                      <View style={{ flex: 1 }}>
                        <Field label={t('dash.planDuration')}>
                          <Input
                            value={plan.duration ?? ''}
                            onChangeText={(val) => patchPlan(index, { duration: val })}
                            placeholder="2h"
                            placeholderTextColor={colors.muted}
                          />
                        </Field>
                      </View>
                      <View style={styles.planToggle}>
                        <Text style={[styles.toggleLabel, { color: colors.ink, fontSize: 13 }]}>{t('dash.planActive')}</Text>
                        <Switch
                          value={plan.active}
                          onValueChange={(val) => patchPlan(index, { active: val })}
                          trackColor={{ true: colors.brandDeep, false: colors.muted }}
                        />
                      </View>
                      <Pressable
                        style={styles.planRemove}
                        onPress={() => removePlan(index)}
                        accessibilityLabel={t('dash.planRemove')}
                      >
                        <Ionicons name="trash" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                    <Field label={t('dash.planDesc')}>
                      <Input
                        value={plan.description ?? ''}
                        onChangeText={(val) => patchPlan(index, { description: val })}
                        placeholder="Set complet…"
                        placeholderTextColor={colors.muted}
                      />
                    </Field>
                  </View>
                ))}
                <Button variant="secondary" block label={t('dash.planAdd')} onPress={addPlan} icon={<Ionicons name="add-circle-outline" size={18} color={colors.ink} />} />
                <Button block            label={t('dash.bookingSave')} onPress={() => void saveBooking()} loading={savingBooking} />
              </>
            )}
          </Card>
        )}
      </Section>

      {/* Status */}
      {statusMsg && (
        <Text style={[styles.status, { color: statusMsg.ok ? colors.success : colors.danger }]}>
          {statusMsg.text}
        </Text>
      )}

      <View style={{ height: 48 }} />
    </ProfileHeader>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: 48 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    back: { width: APP_BAR_ACTION_SIZE, height: APP_BAR_ACTION_SIZE, borderRadius: APP_BAR_ACTION_SIZE / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: fonts.displayBlack, fontSize: 20, letterSpacing: -0.5 },
    // En-tête sans cover : photo à gauche, identité et actions à droite.
    claimedHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, paddingHorizontal: PROFILE_GUTTER, marginTop: spacing.lg },
    photoWrap: { position: 'relative' },
    photo: { width: 88, height: 88, borderRadius: 44 },
    photoInitial: { fontFamily: fonts.displayBlack, fontSize: 34, color: colors.black, textAlign: 'center', lineHeight: 88 },
    photoEdit: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
    headerIdentity: { flex: 1, minWidth: 0 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    artistName: { flexShrink: 1, fontFamily: fonts.displayBlack, fontSize: 24, letterSpacing: -0.8 },
    artistMeta: { fontFamily: fonts.body, fontSize: 13, marginTop: 3, flexShrink: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    removePhoto: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
    removePhotoText: { fontFamily: fonts.medium, fontSize: 12 },
    // Booking
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleLabel: { fontFamily: fonts.bold, fontSize: 14 },
    planCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
    planRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
    planToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    planRemove: { padding: 8 },
    // Misc
    textArea: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 14 },
    emptyText: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
    status: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: 8 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    slugPrefix: { fontFamily: fonts.body, fontSize: 13, flexShrink: 0 },
  });
