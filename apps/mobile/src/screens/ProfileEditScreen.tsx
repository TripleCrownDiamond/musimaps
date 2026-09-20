import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationFields } from '../components/LocationFields';
import { NotificationButton } from '../components/NotificationButton';
import { AccountAvatar, AccountCover } from '../components/AccountMedia';
import { NeighborhoodField } from '../components/NeighborhoodField';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import {
  deleteAccount,
  setAccountType,
  updateEmail,
  updatePassword,
  verifyCurrentPassword,
  updateProfile as updateAccountProfile,
  uploadProfileImage,
  radii,
  PROFILE_MEDIA,
  spacing,
  hexToRgba,
  geoCountryOf,
} from '@musimaps/shared';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { StatusBarScrim } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { profile, saveProfile, deleteProfile } = useApp();
  const { user, signOut, refresh: refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [country, setCountry] = useState(profile?.country ?? user?.country ?? '');
  const [district, setDistrict] = useState(profile?.district ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [genres, setGenres] = useState(profile?.favoriteGenres.join(', ') ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(user?.coverUrl ?? null);
  const [mediaBusy, setMediaBusy] = useState<'avatar' | 'cover' | null>(null);
  // Affichée dans la carte photo/cover : l'erreur du formulaire vit tout en
  // bas de l'écran, hors de vue quand on vient de toucher la cover.
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email ?? '');
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Le profil est chargé de façon asynchrone (AsyncStorage) : dès qu'il
  // arrive, on pré-remplit les champs pour ne jamais afficher un formulaire
  // vide quand on clique « Modifier mon profil ».
  useEffect(() => {
    if (!profile) return;
    setDisplayName((current) => current || profile.displayName);
    setCity((current) => current || profile.city);
    setCountry((current) => current || profile.country || user?.country || '');
    setDistrict((current) => current || profile.district);
    setBio((current) => current || profile.bio);
    setGenres((current) => current || profile.favoriteGenres.join(', '));
  }, [profile]);

  // L'utilisateur (session) arrive de façon asynchrone : on pré-remplit
  // l'email du compte dès qu'il est disponible.
  useEffect(() => {
    if (user?.email) setNewEmail((current) => current || user.email);
  }, [user?.email]);

  useEffect(() => {
    if (user?.country) setCountry((current) => current || user.country || '');
  }, [user?.country]);

  // Compte sans pays enregistré mais avec une ville connue (« Cotonou ») : le
  // sélecteur restait vide au-dessus de la ville. On déduit le pays sans
  // jamais écraser un choix.
  useEffect(() => {
    if (country || !city) return;
    const code = geoCountryOf(city, '');
    if (code) setCountry(code);
  }, [city, country]);

  useEffect(() => {
    if (!user) return;
    setAvatarUrl(user.avatarUrl);
    setCoverUrl(user.coverUrl);
  }, [user?.avatarUrl, user?.coverUrl]);

  const finish = () => {
    if (route.params?.fromStart) navigation.replace('Main', { screen: 'Profile' });
    else navigation.goBack();
  };

  const submit = async () => {
    if (!displayName.trim()) return setError(t('pedit.errName'));
    if (!city.trim()) return setError(t('pedit.errCity'));
    if (!country.trim()) return setError(t('auth.missingCountry'));
    await saveProfile({
      displayName,
      city,
      country,
      district,
      bio,
      favoriteGenres: genres.split(','),
    });
    finish();
  };

  const handleImage = async (kind: 'avatar' | 'cover') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMediaError(t('profile.mediaPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'cover' ? [...PROFILE_MEDIA.coverAspect] : [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setMediaBusy(kind);
    setMediaError(null);
    const upload = await uploadProfileImage(
      { uri: asset.uri, name: asset.fileName ?? `${kind}.jpg`, type: asset.mimeType ?? 'image/jpeg' },
      kind,
    );
    if (upload.error) {
      setMediaBusy(null);
      setMediaError(upload.error);
      return;
    }
    const { error: updateError } = await updateAccountProfile(
      kind === 'avatar' ? { avatarUrl: upload.url } : { coverUrl: upload.url },
    );
    setMediaBusy(null);
    if (updateError) {
      setMediaError(updateError.message);
      return;
    }
    if (kind === 'avatar') setAvatarUrl(upload.url);
    else setCoverUrl(upload.url);
    await refreshUser();
  };

  const removeImage = async (kind: 'avatar' | 'cover') => {
    setMediaBusy(kind);
    setMediaError(null);
    const { error: updateError } = await updateAccountProfile(
      kind === 'avatar' ? { avatarUrl: null } : { coverUrl: null },
    );
    setMediaBusy(null);
    if (updateError) {
      setMediaError(updateError.message);
      return;
    }
    if (kind === 'avatar') setAvatarUrl(null);
    else setCoverUrl(null);
    await refreshUser();
  };

  const changePassword = async () => {
    if (!currentPassword.trim()) {
      setAccountMsg({ ok: false, text: t('account.passCurrentRequired') });
      return;
    }
    if (newPassword.trim().length < 6) {
      setAccountMsg({ ok: false, text: t('account.passWeak') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountMsg({ ok: false, text: t('account.passMismatch') });
      return;
    }
    setAccountBusy('pass');
    setAccountMsg(null);
    // On exige le mot de passe actuel avant toute modification (ré-authentification).
    const { ok, error: verifyErr } = await verifyCurrentPassword(
      user?.email ?? '',
      currentPassword,
    );
    if (!ok) {
      setAccountBusy(null);
      setAccountMsg({ ok: false, text: verifyErr?.message ?? t('account.passCurrentWrong') });
      return;
    }
    const { error: err } = await updatePassword(newPassword.trim());
    setAccountBusy(null);
    setAccountMsg(err ? { ok: false, text: err.message } : { ok: true, text: t('account.passDone') });
    if (!err) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const changeEmail = async () => {
    if (!newEmail.trim()) return;
    // Email inchangé : rien à faire, surtout ne pas annoncer un email de
    // confirmation qui ne partira pas.
    if (user?.email && newEmail.trim() === user.email.trim()) {
      setAccountMsg({ ok: true, text: t('account.emailUnchanged') });
      return;
    }
    setAccountBusy('email');
    const { error: err } = await updateEmail(newEmail);
    setAccountBusy(null);
    setAccountMsg(err ? { ok: false, text: err.message } : { ok: true, text: t('account.emailDone') });
  };

  const upgrade = async (type: 'premium' | 'business') => {
    // Un compte premium n'est pas concerné par cette bascule : la faire jouer
    // écrirait 'business' et détruirait le palier (même garde-fou que le web).
    if (user?.accountType === 'premium') return;
    setAccountBusy(type);
    const res = await setAccountType(type);
    setAccountBusy(null);
    setAccountMsg(
      res.ok
        ? { ok: true, text: t('account.upgradeDone') }
        : { ok: false, text: t('account.msgErr', { msg: res.error ?? '?' }) },
    );
  };

  const runDeleteAccount = async () => {
    setDeleteBusy(true);
    const res = await deleteAccount(user?.email ?? '');
    setDeleteBusy(false);
    if (!res.ok) {
      setAccountMsg({ ok: false, text: t('account.msgErr', { msg: res.error ?? '?' }) });
      return;
    }
    await signOut();
    navigation.replace('Start');
  };

  const confirmDeleteAccount = () => {
    Alert.alert(t('account.deleteTitle'), t('account.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: () => void runDeleteAccount(),
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      t('pedit.clearLocalTitle'),
      t('pedit.clearLocalMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteProfile();
            navigation.replace('Start');
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={27} color={colors.ink} />
          </Pressable>
          <NotificationButton onPress={() => navigation.navigate('Notifications')} />
        </View>

        <Text style={styles.kicker}>{t(user ? 'pedit.kicker' : 'pedit.kickerDevice')}</Text>
        <Text style={styles.title}>
          {profile ? t('profile.editProfile') : t('profile.createProfile')}
        </Text>
        <Text style={styles.subtitle}>{t(user ? 'pedit.subtitle' : 'pedit.subtitleDevice')}</Text>

        {user && <View style={styles.mediaCard}>
          <AccountCover image={coverUrl}>
            <View style={styles.coverFooter}>
              <LinearGradient pointerEvents="none" colors={[hexToRgba(PROFILE_MEDIA.fallbackCoverColors[1], 0), hexToRgba(PROFILE_MEDIA.fallbackCoverColors[1], PROFILE_MEDIA.coverShadeOpacity)]} style={StyleSheet.absoluteFill} />
              <View style={styles.coverCopy}>
                <Text style={styles.coverTitle}>{t('profile.coverTitle')}</Text>
                <Text numberOfLines={2} style={styles.coverHint}>{t('profile.coverHint')}</Text>
              </View>
              <View style={styles.mediaActions}>
                {coverUrl && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.removeCover')}
                    style={styles.mediaIconBtn}
                    disabled={mediaBusy !== null}
                    onPress={() => void removeImage('cover')}
                  >
                    {mediaBusy === 'cover' ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Ionicons name="trash-outline" size={17} color={colors.white} />
                    )}
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.uploadCover')}
                  style={styles.mediaBtn}
                  disabled={mediaBusy !== null}
                  onPress={() => void handleImage('cover')}
                >
                  {mediaBusy === 'cover' ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="image-outline" size={17} color={colors.white} />
                  )}
                </Pressable>
              </View>
            </View>
          </AccountCover>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              <AccountAvatar name={displayName} image={avatarUrl} variant="edit" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.uploadAvatar')}
                style={styles.avatarEdit}
                disabled={mediaBusy !== null}
                onPress={() => void handleImage('avatar')}
              >
                {mediaBusy === 'avatar' ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera-outline" size={17} color={colors.white} />
                )}
              </Pressable>
            </View>
            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>{t('profile.avatarTitle')}</Text>
              <Text style={styles.avatarHint}>{t('profile.avatarHint')}</Text>
              {avatarUrl && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.removeAvatar')}
                  disabled={mediaBusy !== null}
                  onPress={() => void removeImage('avatar')}
                  style={styles.removeMediaLink}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  <Text style={styles.removeMediaText}>{t('profile.removeAvatar')}</Text>
                </Pressable>
              )}
            </View>
          </View>
          {mediaError && <Text accessibilityRole="alert" style={styles.mediaError}>{mediaError}</Text>}
        </View>}

        <View style={styles.form}>
          <Field label={t('pedit.nameLabel')} value={displayName} onChangeText={setDisplayName} placeholder={t('pedit.namePh')} colors={colors} styles={styles} />
          <LocationFields
            city={city}
            country={country}
            onChange={(location) => {
              setCity(location.city);
              setCountry(location.country);
            }}
          />
          <View style={styles.field}>
            <Text style={styles.label}>{t('pedit.districtLabel')}</Text>
            <NeighborhoodField
              value={district}
              onChange={(value, suggestion) => {
                setDistrict(value);
                if (suggestion?.city) setCity(suggestion.city);
                if (suggestion?.countryCode) setCountry(suggestion.countryCode);
              }}
            />
          </View>
          <Field label={t('pedit.genresLabel')} value={genres} onChangeText={setGenres} placeholder={t('pedit.genresPlaceholder')} colors={colors} styles={styles} />
          <View style={styles.field}>
            <Text style={styles.label}>{t('pedit.bioLabel')}</Text>
            <TextInput
              multiline
              value={bio}
              onChangeText={setBio}
              placeholder={t('pedit.bioPh')}
              placeholderTextColor={colors.muted}
              underlineColorAndroid="transparent"
              style={[styles.input, styles.bioInput]}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.save} onPress={submit}>
            <Text style={styles.saveText}>
              {profile ? t('pedit.saveEdit') : t('profile.createProfile')}
            </Text>
            <Ionicons name="checkmark" size={21} color={colors.white} />
          </Pressable>

          {user && (
            <>
              <View style={styles.accountDivider} />
              <Text style={styles.accountKicker}>{t('account.kicker')}</Text>
              <Text style={styles.accountSubtitle}>{t('account.subtitle')}</Text>

              <View style={styles.accountCard}>
                <Text style={styles.accountLabel}>{t('account.passCurrentLabel')}</Text>
                <PasswordField
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder={t('account.passCurrentPh')}
                  colors={colors}
                  styles={styles}
                />
                <Text style={styles.accountLabel}>{t('account.passLabel')}</Text>
                <PasswordField
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t('account.passPh')}
                  colors={colors}
                  styles={styles}
                />
                <Text style={styles.accountLabel}>{t('account.passConfirmLabel')}</Text>
                <PasswordField
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('account.passConfirmPh')}
                  colors={colors}
                  styles={styles}
                />
                <Pressable
                  style={[styles.accountBtn, accountBusy === 'pass' && styles.accountBtnDisabled]}
                  disabled={accountBusy === 'pass'}
                  onPress={() => void changePassword()}
                >
                  <Ionicons name="key-outline" size={18} color={colors.black} />
                  <Text style={styles.accountBtnText}>{t('account.passBtn')}</Text>
                </Pressable>

                <Text style={[styles.accountLabel, styles.accountLabelGap]}>{t('account.emailLabel')}</Text>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="email@exemple.com"
                  placeholderTextColor={colors.muted}
                  underlineColorAndroid="transparent"
                  style={styles.accountInput}
                />
                <Pressable
                  style={[styles.accountBtn, accountBusy === 'email' && styles.accountBtnDisabled]}
                  disabled={accountBusy === 'email'}
                  onPress={() => void changeEmail()}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.black} />
                  <Text style={styles.accountBtnText}>{t('account.emailBtn')}</Text>
                </Pressable>

                {user.accountType !== 'premium' && (
                  <>
                    <Pressable
                      style={[
                        styles.accountBtn,
                        styles.accountBtnBrand,
                        accountBusy === 'premium' && styles.accountBtnDisabled,
                      ]}
                      disabled={accountBusy === 'premium'}
                      onPress={() => void upgrade('premium')}
                    >
                      <Ionicons name="diamond-outline" size={18} color={colors.white} />
                      <Text style={[styles.accountBtnText, styles.accountBtnBrandText]}>
                        {t('account.premiumTitle')}
                      </Text>
                    </Pressable>
                    <Text style={styles.accountHint}>{t('account.premiumText')}</Text>
                  </>
                )}

                {user.role === 'artist' && user.accountType !== 'premium' && (
                  <>
                    <Pressable
                      style={[
                        styles.accountBtn,
                        styles.accountBtnBrand,
                        accountBusy === 'business' && styles.accountBtnDisabled,
                      ]}
                      disabled={accountBusy === 'business'}
                      onPress={() => void upgrade('business')}
                    >
                      <Ionicons name="briefcase-outline" size={18} color={colors.white} />
                      <Text style={[styles.accountBtnText, styles.accountBtnBrandText]}>
                        {t('account.businessTitle')}
                      </Text>
                    </Pressable>
                    <Text style={styles.accountHint}>{t('account.businessText')}</Text>
                  </>
                )}
              </View>

              {accountMsg && (
                <Text style={accountMsg.ok ? styles.accountMsgOk : styles.accountMsgErr}>
                  {accountMsg.text}
                </Text>
              )}

              <Pressable
                style={[styles.accountDelete, deleteBusy && styles.accountBtnDisabled]}
                disabled={deleteBusy}
                onPress={confirmDeleteAccount}
              >
                <Ionicons name="trash" size={19} color={colors.danger} />
                <Text style={styles.accountDeleteText}>{t('account.deleteBtn')}</Text>
              </Pressable>
            </>
          )}

          {profile && !user && (
            <Pressable style={styles.clearLocal} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={styles.clearLocalText}>{t('pedit.clearLocalData')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <StatusBarScrim color={colors.background} />
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  colors,
  styles,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        underlineColorAndroid="transparent"
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function PasswordField({
  value,
  onChangeText,
  placeholder,
  colors,
  styles,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passWrap}>
      <TextInput
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        underlineColorAndroid="transparent"
        style={styles.passInput}
      />
      <Pressable
        accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        style={styles.passEye}
        onPress={() => setVisible((v) => !v)}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={23} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 21, paddingBottom: 50 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, marginTop: 48 },
  title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 37, letterSpacing: -1.7, marginTop: 7 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: 8 },
  mediaCard: { marginTop: 24, borderRadius: radii['3xl'], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  coverFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing['4xl'] },
  coverCopy: { flex: 1 },
  coverTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  coverHint: { color: colors.white, opacity: 0.78, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: 2 },
  mediaActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mediaBtn: { width: PROFILE_MEDIA.actionSize, height: PROFILE_MEDIA.actionSize, borderRadius: radii.full, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  mediaIconBtn: { width: PROFILE_MEDIA.actionSize, height: PROFILE_MEDIA.actionSize, borderRadius: radii.full, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg },
  avatarWrap: { width: PROFILE_MEDIA.avatarSize.edit, height: PROFILE_MEDIA.avatarSize.edit },
  avatarEdit: { position: 'absolute', right: -spacing.xs, bottom: -spacing.xs, width: PROFILE_MEDIA.actionSize, height: PROFILE_MEDIA.actionSize, borderRadius: radii.full, backgroundColor: colors.brandPrimary, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarCopy: { flex: 1, minWidth: 0 },
  avatarTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
  avatarHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  removeMediaLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  removeMediaText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 11 },
  form: { gap: 15, marginTop: 30 },
  field: { gap: 7 },
  label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginLeft: 4 },
  input: {
    minHeight: 59,
    borderRadius: 20,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 17,
    borderWidth: 0,
    outlineWidth: 0,
  },
  bioInput: { minHeight: 120, paddingTop: 16, textAlignVertical: 'top' },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, backgroundColor: colors.surface, borderRadius: 16, padding: 12 },
  mediaError: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  save: { minHeight: 62, borderRadius: 31, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 5 },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  clearLocal: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  clearLocalText: { color: colors.inkSoft, fontFamily: fonts.bold, fontSize: 13 },
  accountDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 26 },
  accountKicker: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6 },
  accountSubtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 6 },
  accountCard: { marginTop: 18, borderRadius: 26, backgroundColor: colors.surface, padding: 17, gap: 9 },
  accountLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginLeft: 4 },
  accountLabelGap: { marginTop: 10 },
  accountInput: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.background,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    outlineWidth: 0,
  },
  passWrap: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passInput: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 15,
    outlineWidth: 0,
  },
  passEye: { paddingHorizontal: 13, paddingVertical: 12 },
  accountBtn: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accountBtnBrand: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep, marginTop: 4 },
  accountBtnBrandText: { color: colors.white },
  accountBtnDisabled: { opacity: 0.55 },
  accountBtnText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
  accountHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  accountMsgOk: { color: colors.brandDeep, fontFamily: fonts.medium, fontSize: 13, backgroundColor: colors.brandSoft, borderRadius: 16, padding: 12, marginTop: 14 },
  accountMsgErr: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginTop: 14 },
  accountDelete: {
    minHeight: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  accountDeleteText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 14 },
});
