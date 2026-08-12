import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { checkin } from '@musimaps/shared';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { AuthLayout, Button, Field, Input } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { signIn } = useAuth();
  const { showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      return showToast(t('auth.invalidEmail'), 'alert-circle', 'error');
    }
    if (!password) return showToast(t('auth.password'), 'alert-circle', 'error');
    setBusy(true);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) showToast(t('auth.error'), 'alert-circle', 'error');
    else {
      void checkin(); // streak de connexion quotidienne (fire-and-forget)
      showToast(t('toast.welcomeBack'), 'checkmark-circle');
      navigation.navigate('Dashboard');
    }
  };

  return (
    <AuthLayout
      icon="headset"
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      onBack={() => navigation.goBack()}
      footer={{
        text: t('auth.noAccount'),
        linkLabel: t('auth.signupLink'),
        onPress: () => navigation.navigate('Signup'),
      }}
    >
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
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              hitSlop={8}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={23}
                color={colors.inkSoft}
              />
            </Pressable>
          }
        />
      </Field>

      <Button
        variant="link"
        size="sm"
        label={t('auth.forgotPassword')}
        onPress={() => navigation.navigate('ForgotPassword')}
      />

      <Button
        block
        size="lg"
        loading={busy}
        label={t('auth.login')}
        onPress={() => void submit()}
        icon={<Ionicons name="log-in-outline" size={20} color={colors.white} />}
      />
    </AuthLayout>
  );
}
