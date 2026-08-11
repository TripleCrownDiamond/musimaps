import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
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
import { BrandMark } from '../components/Brand';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { deleteAccount, setAccountType, updateEmail, updatePassword } from '../lib/auth';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { profile, saveProfile, deleteProfile } = useApp();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [district, setDistrict] = useState(profile?.district ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [genres, setGenres] = useState(profile?.favoriteGenres.join(', ') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
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
    setDistrict((current) => current || profile.district);
    setBio((current) => current || profile.bio);
    setGenres((current) => current || profile.favoriteGenres.join(', '));
  }, [profile]);

  // L'utilisateur (session) arrive de façon asynchrone : on pré-remplit
  // l'email du compte dès qu'il est disponible.
  useEffect(() => {
    if (user?.email) setNewEmail((current) => current || user.email);
  }, [user?.email]);

  const finish = () => {
    if (route.params?.fromStart) navigation.replace('Main', { screen: 'Profile' });
    else navigation.goBack();
  };

  const submit = async () => {
    if (!displayName.trim()) return setError(t('pedit.errName'));
    if (!city.trim()) return setError(t('pedit.errCity'));
    await saveProfile({
      displayName,
      city,
      district,
      bio,
      favoriteGenres: genres.split(','),
    });
    finish();
  };

  const changePassword = async () => {
    if (newPassword.trim().length < 6) {
      setAccountMsg({ ok: false, text: t('account.passWeak') });
      return;
    }
    setAccountBusy('pass');
    const err = await updatePassword(newPassword.trim());
    setAccountBusy(null);
    setAccountMsg(err ? { ok: false, text: err.message } : { ok: true, text: t('account.passDone') });
    if (!err) setNewPassword('');
  };

  const changeEmail = async () => {
    if (!newEmail.trim()) return;
    setAccountBusy('email');
    const err = await updateEmail(newEmail);
    setAccountBusy(null);
    setAccountMsg(err ? { ok: false, text: err.message } : { ok: true, text: t('account.emailDone') });
  };

  const upgrade = async (type: 'premium' | 'business') => {
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
      t('pedit.deleteTitle'),
      t('pedit.deleteMessage'),
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={27} color={colors.ink} />
          </Pressable>
          <BrandMark size={40} />
        </View>

        <Text style={styles.kicker}>{t('pedit.kickerDevice')}</Text>
        <Text style={styles.title}>
          {profile ? t('profile.editProfile') : t('profile.createProfile')}
        </Text>
        <Text style={styles.subtitle}>{t('pedit.subtitleDevice')}</Text>

        <View style={styles.form}>
          <Field label={t('pedit.nameLabel')} value={displayName} onChangeText={setDisplayName} placeholder={t('pedit.namePh')} colors={colors} styles={styles} />
          <Field label={t('pedit.cityLabel')} value={city} onChangeText={setCity} placeholder="Cotonou, Bénin" colors={colors} styles={styles} />
          <Field label={t('pedit.districtLabel')} value={district} onChangeText={setDistrict} placeholder="Ex. Yopougon, Bastille…" colors={colors} styles={styles} />
          <Field label={t('pedit.genresLabel')} value={genres} onChangeText={setGenres} placeholder="Afrobeats, Soul, Rap" colors={colors} styles={styles} />
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
                <Text style={styles.accountLabel}>{t('account.passLabel')}</Text>
                <View style={styles.passWrap}>
                  <TextInput
                    secureTextEntry={!showPass}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={t('account.passPh')}
                    placeholderTextColor={colors.muted}
                    underlineColorAndroid="transparent"
                    style={styles.passInput}
                  />
                  <Pressable
                    accessibilityLabel={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
                    style={styles.passEye}
                    onPress={() => setShowPass((v) => !v)}
                  >
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={23} color={colors.inkSoft} />
                  </Pressable>
                </View>
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

                {user.role === 'artist' && (
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

          {profile && (
            <Pressable style={styles.delete} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={styles.deleteText}>{t('pedit.deleteData')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
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

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 21, paddingTop: 48, paddingBottom: 50 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, marginTop: 48 },
  title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 37, letterSpacing: -1.7, marginTop: 7 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: 8 },
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
  save: { minHeight: 62, borderRadius: 31, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 5 },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  delete: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 13 },
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
