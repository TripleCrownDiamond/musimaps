import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
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
import { updatePassword } from '@musimaps/shared';
import type { RootStackParamList } from '../navigation/types';
import { AuthLayout, Button, Field, PasswordInput } from '../ui';

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
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) showToast(err.message, 'alert-circle', 'error');
    else setDone(true);
  };

  // Icône, titre et sous-titre dérivent de l'état : l'écran en a quatre
  // (vérification, lien invalide, saisie, succès) et chacun redéfinissait
  // son propre bloc « hero » identique.
  const hero =
    ready === 'invalid'
      ? { icon: 'key-outline' as const, title: t('auth.resetTitle'), subtitle: t('auth.resetInvalidLink') }
      : done
        ? { icon: 'checkmark-circle-outline' as const, title: t('auth.resetDone'), subtitle: t('auth.resetDoneText') }
        : { icon: 'lock-closed-outline' as const, title: t('auth.resetTitle'), subtitle: t('auth.resetSubtitle') };

  return (
    <AuthLayout
      icon={hero.icon}
      title={hero.title}
      subtitle={hero.subtitle}
      onBack={() => navigation.goBack()}
    >
      {ready === 'checking' && (
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      )}

      {ready === 'invalid' && (
        <Button
          block
          size="lg"
          label={t('auth.forgotTitle')}
          onPress={() => navigation.navigate('ForgotPassword')}
          icon={<Ionicons name="mail-outline" size={20} color={colors.white} />}
        />
      )}

      {ready === 'ok' && !done && (
        <>
          <Field label={t('auth.password')}>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              placeholder="8 caractères min."
              autoComplete="new-password"
            />
          </Field>
          <PasswordGauge password={password} />

          <Field label={t('auth.passwordConfirm')}>
            <PasswordInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>

          <Button
            block
            size="lg"
            loading={busy}
            label={t('auth.resetSubmit')}
            onPress={() => void submit()}
            icon={<Ionicons name="lock-closed-outline" size={20} color={colors.white} />}
          />
        </>
      )}

      {done && (
        <Button
          block
          size="lg"
          label={t('auth.resetGoLogin')}
          onPress={() => navigation.navigate('Login')}
          icon={<Ionicons name="log-in-outline" size={20} color={colors.white} />}
        />
      )}
    </AuthLayout>
  );
}
