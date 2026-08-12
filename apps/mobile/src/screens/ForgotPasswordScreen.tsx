import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { AuthLayout, Button, Field, Input } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { resetPasswordForEmail } = useAuth();
  const { showToast } = useApp();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      return showToast(t('auth.invalidEmail'), 'alert-circle', 'error');
    }
    setBusy(true);
    const err = await resetPasswordForEmail(email);
    setBusy(false);
    if (err) showToast(err.message, 'alert-circle', 'error');
    else setSent(true);
  };

  return (
    <AuthLayout
      icon={sent ? 'mail-outline' : 'key-outline'}
      title={sent ? t('auth.forgotSent') : t('auth.forgotTitle')}
      subtitle={sent ? t('auth.forgotSentText') : t('auth.forgotSubtitle')}
      onBack={() => navigation.goBack()}
      footer={{
        linkLabel: t('auth.forgotBackToLogin'),
        onPress: () => navigation.navigate('Login'),
      }}
    >
      {!sent && (
        <>
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

          <Button
            block
            size="lg"
            loading={busy}
            label={t('auth.forgotSend')}
            onPress={() => void submit()}
            icon={<Ionicons name="send-outline" size={20} color={colors.white} />}
          />
        </>
      )}
    </AuthLayout>
  );
}
