import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { resetPasswordForEmail } = useAuth();
  const { showToast } = useApp();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) return showToast(t('auth.invalidEmail'), 'alert-circle', 'error');
    setBusy(true);
    const err = await resetPasswordForEmail(email);
    setBusy(false);
    if (err) showToast(err.message, 'alert-circle', 'error');
    else setSent(true);
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

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name={sent ? 'mail-outline' : 'key-outline'}
              size={30}
              color={colors.black}
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{sent ? t('auth.forgotSent') : t('auth.forgotTitle')}</Text>
            <Text style={styles.subtitle}>
              {sent ? t('auth.forgotSentText') : t('auth.forgotSubtitle')}
            </Text>
          </View>
        </View>

        {!sent && (
          <>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="vous@email.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              underlineColorAndroid="transparent"
              style={styles.input}
            />

            <Pressable
              style={[styles.submit, busy && styles.submitDisabled]}
              disabled={busy}
              onPress={() => void submit()}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Ionicons name="send-outline" size={20} color={colors.white} />
              )}
              <Text style={styles.submitText}>{t('auth.forgotSend')}</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.switchLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.switchText}>
            <Text style={styles.switchLinkText}>{t('auth.forgotBackToLogin')}</Text>
          </Text>
        </Pressable>
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
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 15,
      marginBottom: 14,
      backgroundColor: colors.surface,
      outlineWidth: 0,
    },
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
    switchLink: { alignItems: 'center', marginTop: 20 },
    switchText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
    switchLinkText: { color: colors.brandDeep, fontFamily: fonts.bold },
  });
