import Ionicons from '@expo/vector-icons/Ionicons';
import { Headphones, MicVocal } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  checkin,
  radii,
  spacing,
} from '@musimaps/shared';
import { LocationFields } from '../components/LocationFields';
import { PasswordGauge } from '../components/PasswordGauge';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { AccountRole } from '@musimaps/shared';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { AuthLayout, Button, Field, Input, PasswordInput } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Mêmes icônes que le web (lucide) : micro chanteur (avec fil) pour l'artiste, casque pour le mélomane.
const ROLE_ICONS: Record<AccountRole, typeof MicVocal | typeof Headphones> = {
  artist: MicVocal,
  melomane: Headphones,
};

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
      navigation.navigate('Main', { screen: 'Profile' });
    }
  };

  const roles: { value: AccountRole; label: string; hint: string }[] = [
    { value: 'artist', label: t('auth.roleArtist'), hint: t('auth.roleArtistHint') },
    { value: 'melomane', label: t('auth.roleMelomane'), hint: t('auth.roleMelomaneHint') },
  ];

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
      <Field label={t('auth.role')}>
        <View style={styles.roles}>
          {roles.map(({ value, label, hint }) => {
            const active = role === value;
            return (
              <Pressable
                key={value}
                style={[styles.roleCard, active && styles.roleCardActive]}
                onPress={() => setRole(value)}
              >
                <View style={[styles.roleIcon, active && styles.roleIconActive]}>
                  {(() => {
                    const RoleIcon = ROLE_ICONS[value];
                    return (
                      <RoleIcon
                        size={22}
                        color={active ? colors.black : colors.brandPrimary}
                      />
                    );
                  })()}
                </View>
                <View style={styles.roleCopy}>
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{label}</Text>
                  <Text style={styles.roleHint}>{hint}</Text>
                </View>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.brandPrimary}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
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
    roles: { gap: spacing.md },
    roleCard: {
      minHeight: 74,
      borderRadius: radii['3xl'],
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    roleCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandSoft },
    roleIcon: {
      width: 46,
      height: 46,
      borderRadius: radii.full,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleIconActive: { backgroundColor: colors.brandSecondary },
    roleCopy: { flex: 1 },
    roleLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    // Actif : en clair le fond est lime pâle (texte sombre), en sombre le
    // fond est bleu nuit (texte clair) — ink s'adapte aux deux.
    roleLabelActive: { color: colors.ink },
    roleHint: {
      color: colors.inkSoft,
      fontFamily: fonts.body,
      fontSize: 11,
      marginTop: spacing.xs,
      lineHeight: 16,
    },
  });
