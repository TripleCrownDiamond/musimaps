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
import { checkin } from '../lib/stats';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { signIn } = useAuth();
  const { showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) return showToast(t('auth.invalidEmail'), 'alert-circle', 'error');
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
            <Ionicons name="headset" size={30} color={colors.black} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{t('auth.loginTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
          </View>
        </View>

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

        <Text style={styles.label}>{t('auth.password')}</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
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

        <Pressable
          style={styles.forgotRow}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotLink}>{t('auth.forgotPassword')}</Text>
        </Pressable>

        <Pressable
          style={[styles.submit, busy && styles.submitDisabled]}
          disabled={busy}
          onPress={() => void submit()}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name="log-in-outline" size={20} color={colors.white} />
          )}
          <Text style={styles.submitText}>{t('auth.login')}</Text>
        </Pressable>

        <Pressable style={styles.switchLink} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.switchText}>
            {t('auth.noAccount')} <Text style={styles.switchLinkText}>{t('auth.signupLink')}</Text>
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
    passwordWrap: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 16,
      marginBottom: 14,
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
    forgotRow: { alignSelf: 'flex-start', marginTop: -6, marginBottom: 18 },
    forgotLink: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 13 },
    switchLink: { alignItems: 'center', marginTop: 20 },
    switchText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13 },
    switchLinkText: { color: colors.brandDeep, fontFamily: fonts.bold },
  });
