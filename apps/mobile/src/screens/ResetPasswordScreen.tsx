import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PasswordGauge } from '../components/PasswordGauge';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

interface RecoveryParams {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
}

/** Extrait access_token/refresh_token/type de l'URL (query OU hash) du lien de récupération. */
function parseRecoveryUrl(raw: string): RecoveryParams | null {
  if (!raw) return null;
  const parts = raw.split(/[?#]/);
  let params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    for (const pair of parts[i].split('&')) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      try {
        const key = decodeURIComponent(pair.slice(0, eq));
        const value = decodeURIComponent(pair.slice(eq + 1));
        if (!params[key]) params[key] = value;
      } catch {
        return null;
      }
    }
  }
  return {
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    code: params.code,
    type: params.type,
  };
}

/**
 * Écran de réinitialisation de mot de passe (lien envoyé par email).
 * Le lien pointe vers musimaps://reset-password#access_token=…&type=recovery :
 * on extrait la session de l'URL (expo-linking) puis on enregistre le nouveau
 * mot de passe via supabase.auth.updateUser.
 */
export function ResetPasswordScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { showToast } = useApp();
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const detect = async (url: string | null) => {
      if (!url) {
        // Pas de lien de récupération : on affiche le formulaire uniquement si
        // une session est déjà ouverte (cas rare), sinon lien invalide.
        const res = await supabase?.auth.getSession();
        if (!cancelled) setReady(res?.data.session ? 'ok' : 'invalid');
        return;
      }
      if (cancelled) return;
      const parsed = parseRecoveryUrl(url);
      if (!parsed) {
        if (!cancelled) setReady('invalid');
        return;
      }
      const { accessToken, refreshToken, code, type } = parsed;
      if (code && supabase) {
        // Flow PKCE (défaut Supabase) : le lien porte ?code=… au lieu de #access_token=…
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setReady('invalid');
          return;
        }
        if (!cancelled) setReady('ok');
        return;
      }
      if (accessToken && refreshToken && supabase) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (!cancelled) setReady('invalid');
          return;
        }
        if (!cancelled) setReady('ok');
        return;
      }
      if (type === 'recovery') {
        // Vérifie qu'une session de récupération est réellement active avant
        // d'afficher le formulaire (sinon updatePassword échouerait).
        const res = await supabase?.auth.getSession();
        if (!cancelled) setReady(res?.data.session ? 'ok' : 'invalid');
        return;
      }
      const session = await supabase?.auth.getSession();
      if (!cancelled) setReady(session?.data.session ? 'ok' : 'invalid');
    };

    void Linking.getInitialURL().then(detect);
    const sub = Linking.addEventListener('url', ({ url }) => void detect(url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const submit = async () => {
    if (password.length < 8) return showToast(t('auth.passwordShort'), 'alert-circle', 'error');
    if (password !== confirm) return showToast(t('auth.passwordMismatch'), 'alert-circle', 'error');
    setBusy(true);
    const err = await updatePassword(password);
    setBusy(false);
    if (err) showToast(err.message, 'alert-circle', 'error');
    else setDone(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessibilityLabel={t('common.back')} style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={27} color={colors.ink} />
        </Pressable>

        {ready === 'checking' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandDeep} />
          </View>
        )}

        {ready === 'invalid' && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="key-outline" size={30} color={colors.black} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{t('auth.resetTitle')}</Text>
                <Text style={styles.subtitle}>{t('auth.resetInvalidLink')}</Text>
              </View>
            </View>
            <Pressable style={styles.submit} onPress={() => navigation.navigate('ForgotPassword')}>
              <Ionicons name="mail-outline" size={20} color={colors.white} />
              <Text style={styles.submitText}>{t('auth.forgotTitle')}</Text>
            </Pressable>
          </>
        )}

        {ready === 'ok' && !done && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="lock-closed-outline" size={30} color={colors.black} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{t('auth.resetTitle')}</Text>
                <Text style={styles.subtitle}>{t('auth.resetSubtitle')}</Text>
              </View>
            </View>

            <Text style={styles.label}>{t('auth.password')}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="8 caractères min."
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                underlineColorAndroid="transparent"
                style={styles.passwordInput}
              />
              <Pressable
                accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={23}
                  color={colors.inkSoft}
                />
              </Pressable>
            </View>
            <PasswordGauge password={password} />

            <Text style={styles.label}>{t('auth.passwordConfirm')}</Text>
            <View style={[styles.passwordWrap, { marginBottom: 14 }]}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showConfirm}
                autoComplete="new-password"
                underlineColorAndroid="transparent"
                style={styles.passwordInput}
              />
              <Pressable
                accessibilityLabel={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                style={styles.eyeButton}
                onPress={() => setShowConfirm((v) => !v)}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={23}
                  color={colors.inkSoft}
                />
              </Pressable>
            </View>

            <Pressable
              style={[styles.submit, busy && styles.submitDisabled]}
              disabled={busy}
              onPress={() => void submit()}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Ionicons name="lock-closed-outline" size={20} color={colors.white} />
              )}
              <Text style={styles.submitText}>{t('auth.resetSubmit')}</Text>
            </Pressable>
          </>
        )}

        {done && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="checkmark-circle-outline" size={30} color={colors.black} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>{t('auth.resetDone')}</Text>
                <Text style={styles.subtitle}>{t('auth.resetDoneText')}</Text>
              </View>
            </View>
            <Pressable style={styles.submit} onPress={() => navigation.navigate('Login')}>
              <Ionicons name="log-in-outline" size={20} color={colors.white} />
              <Text style={styles.submitText}>{t('auth.resetGoLogin')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
    back: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 90 },
    hero: { alignItems: 'center', marginTop: 18, marginBottom: 30 },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: { alignItems: 'center', marginTop: 18 },
    title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 30, letterSpacing: -1, textAlign: 'center' },
    subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
    label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginBottom: 7, marginTop: 6 },
    passwordWrap: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      marginBottom: 8,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      borderWidth: 0,
      outlineWidth: 0,
    },
    eyeButton: { paddingHorizontal: 14, paddingVertical: 12 },
    submit: {
      minHeight: 56,
      borderRadius: 28,
      backgroundColor: colors.brandDeep,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 6,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 17 },
  });
