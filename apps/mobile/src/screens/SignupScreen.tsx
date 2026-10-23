import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { checkin } from '@musimaps/shared';
import { LocationFields } from '../components/LocationFields';
import { PasswordGauge } from '../components/PasswordGauge';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { AccountRole } from '@musimaps/shared';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { RolePicker } from '../components/RolePicker';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { AuthLayout, Button, Field, Input, PasswordInput } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


export function SignupScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { signUp, resendSignUpConfirmation } = useAuth();
  const { showToast } = useApp();
  const [role, setRole] = useState<AccountRole | null>(route.params?.role ?? null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!role) return showToast(t('auth.missingRole'), 'alert-circle', 'error');
    if (!name.trim()) return showToast(t('auth.missingName'), 'alert-circle', 'error');
    if (!city.trim()) return showToast(t('auth.missingCity'), 'alert-circle', 'error');
    if (!country.trim()) return showToast(t('auth.missingCountry'), 'alert-circle', 'error');
    if (!EMAIL_RE.test(email.trim())) return showToast(t('auth.invalidEmail'), 'alert-circle', 'error');
    if (password.length < 8) return showToast(t('auth.passwordShort'), 'alert-circle', 'error');
    if (password !== confirm) return showToast(t('auth.passwordMismatch'), 'alert-circle', 'error');
    setBusy(true);
    const result = await signUp({ email, password, role, displayName: name, city, country });
    setBusy(false);
    if (result.error) {
      showToast(/already registered|already been registered/i.test(result.error.message) ? t('auth.emailTaken') : result.error.message, 'alert-circle', 'error');
    } else if (result.needsConfirmation) {
      setSent(true);
    } else {
      void checkin(); // streak de connexion quotidienne (fire-and-forget)
      showToast(t('toast.welcomeBack'), 'checkmark-circle');
      navigation.navigate('Main', { screen: 'Explore' });
    }
  };


  if (sent) {
    return (
      <AuthLayout
        icon="mail-outline"
        title={t('auth.checkEmail')}
        subtitle={t('auth.checkEmailText')}
      >
        <Text style={[styles.sentEmail, { color: colors.ink }]}>{email.trim()}</Text>
        <Button
          block
          variant="secondary"
          size="lg"
          loading={resending}
          label={t('auth.resendConfirmation')}
          onPress={() => {
            setResending(true);
            void resendSignUpConfirmation(email).then((error) => {
              setResending(false);
              showToast(error ? error.message : t('auth.confirmationResent'), error ? 'alert-circle' : 'mail-outline', error ? 'error' : undefined);
            });
          }}
          icon={<Ionicons name="mail-outline" size={20} color={colors.brandDeep} />}
        />
        <Button
          block
          size="lg"
          label={t('auth.login')}
          onPress={() => navigation.navigate('Login')}
          icon={<Ionicons name="log-in-outline" size={20} color={colors.white} />}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon="musical-notes"
      title={t('auth.signupTitle')}
      subtitle={t('auth.signupSubtitle')}
      onBack={() => navigation.goBack()}
      footer={{
        text: t('auth.haveAccount'),
        linkLabel: t('auth.loginLink'),
        onPress: () => navigation.navigate('Login'),
      }}
    >
      <SocialAuthButtons
        onSignedIn={(needsProfile) => {
          void checkin();
          showToast(t('toast.welcomeBack'), 'checkmark-circle');
          // Nouveau compte Google/Apple : rôle, nom et ville d'abord.
          if (needsProfile) navigation.replace('ProfileEdit', { complete: true });
          else navigation.navigate('Main', { screen: 'Explore' });
        }}
        onError={(message) => showToast(message, 'alert-circle', 'error')}
      />

      <Field label={t('auth.role')}>
        <RolePicker value={role} onChange={setRole} />
      </Field>

      <Field label={t('auth.name')}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Jean Martin"
        />
      </Field>

      <LocationFields
        city={city}
        country={country}
        onChange={(location) => {
          setCity(location.city);
          setCountry(location.country);
        }}
      />

      <Field label={t('auth.email')}>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="vous@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </Field>

      <Field label={t('auth.password')}>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="8 caractères min."
          autoComplete="new-password"
        />
        {password.length > 0 && (
          <PasswordGauge password={password} />
        )}
      </Field>

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
        label={t('auth.signup')}
        onPress={() => void submit()}
        icon={<Ionicons name="person-add-outline" size={20} color={colors.white} />}
      />

    </AuthLayout>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    sentEmail: { fontFamily: fonts.bold, fontSize: 15, textAlign: 'center' },
  });
