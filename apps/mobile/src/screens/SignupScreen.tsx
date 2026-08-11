import Ionicons from '@expo/vector-icons/Ionicons';
import { Headphones, MicVocal } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
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
import { COUNTRIES, continentName, countryName, flagFor } from '@musimaps/shared';
import { PasswordGauge } from '../components/PasswordGauge';
import { SearchablePicker, type PickerItem } from '../components/SearchablePicker';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { checkin } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { suggestCities } from '../lib/discovery';
import { useI18n } from '../i18n';
import type { AccountRole } from '@musimaps/shared';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Mêmes icônes que le web (lucide) : micro chanteur (avec fil) pour l'artiste, casque pour le mélomane.
const ROLE_ICONS: Record<AccountRole, typeof MicVocal | typeof Headphones> = {
  artist: MicVocal,
  melomane: Headphones,
};

export function SignupScreen({ navigation }: Props) {
  const { colors, theme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { signUp } = useAuth();
  const { showToast } = useApp();
  const [role, setRole] = useState<AccountRole | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityItems, setCityItems] = useState<PickerItem[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // Liste des pays filtrée par la recherche (dataset partagé @musimaps/shared).
  const countryItems = useMemo<PickerItem[]>(() => {
    const q = countryQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return COUNTRIES.filter((c) => {
      const name = (lang === 'fr' ? c.fr : c.en).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return !q || name.includes(q) || c.code.toLocaleLowerCase() === q;
    }).map((c) => ({
      key: c.code,
      label: lang === 'fr' ? c.fr : c.en,
      sublabel: continentName(c.continent, lang),
      emoji: flagFor(c.code),
    }));
  }, [countryQuery, lang]);

  // Suggestions de villes (Mapbox) filtrées par le pays choisi.
  useEffect(() => {
    if (!cityOpen) return;
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCityItems([]);
      setCityLoading(false);
      return;
    }
    let cancelled = false;
    setCityLoading(true);
    const timer = setTimeout(() => {
      void suggestCities(q, country || null)
        .then((res) => {
          if (cancelled) return;
          setCityItems(
            res.map((r) => ({
              key: `${r.lng},${r.lat},${r.city}`,
              label: r.label,
              value: r.city,
              sublabel: r.countryCode ? countryName(r.countryCode, lang) : undefined,
            })),
          );
        })
        .finally(() => {
          if (!cancelled) setCityLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityOpen, cityQuery, country, lang]);

  // Remplit pays + ville automatiquement via la géolocalisation de l'appareil.
  const geolocate = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        showToast(t('auth.locationDenied'), 'alert-circle', 'error');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      const cityName = place?.city || place?.subregion || place?.region || '';
      const code = (place?.isoCountryCode ?? '').toUpperCase();
      if (!cityName && !code) {
        showToast(t('auth.locationNotFound'), 'alert-circle', 'error');
        return;
      }
      if (cityName) setCity(cityName);
      if (code) setCountry(code);
      showToast(t('auth.locationFilled'), 'checkmark-circle');
    } catch {
      showToast(t('auth.locationNotFound'), 'alert-circle', 'error');
    } finally {
      setLocating(false);
    }
  };

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
      navigation.navigate('Dashboard');
    }
  };

  const roles: { value: AccountRole; label: string; hint: string }[] = [
    { value: 'artist', label: t('auth.roleArtist'), hint: t('auth.roleArtistHint') },
    { value: 'melomane', label: t('auth.roleMelomane'), hint: t('auth.roleMelomaneHint') },
  ];

  if (sent) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: colors.brand }]}>
              <Ionicons name="mail-outline" size={30} color={colors.black} />
            </View>
            <Text style={styles.title}>{t('auth.checkEmail')}</Text>
            <Text style={styles.subtitle}>{t('auth.checkEmailText')}</Text>
            <Text style={[styles.subtitle, { marginTop: 4, fontFamily: fonts.bold, color: colors.ink }]}>{email.trim()}</Text>
          </View>
          <Pressable style={styles.submit} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="log-in-outline" size={20} color={colors.white} />
            <Text style={styles.submitText}>{t('auth.login')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
            <Ionicons name="musical-notes" size={28} color={colors.black} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{t('auth.signupTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.signupSubtitle')}</Text>
          </View>
        </View>

        <Text style={styles.label}>{t('auth.role')}</Text>
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
                        color={active ? colors.black : theme === 'dark' ? colors.brand : colors.brandDeep}
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
                    color={theme === 'dark' ? colors.brand : colors.brandDeep}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('auth.name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Jean Martin"
          placeholderTextColor={colors.muted}
          underlineColorAndroid="transparent"
          style={styles.input}
        />

        <View style={styles.locationHeader}>
          <Text style={styles.label}>{t('auth.location')} *</Text>
          <Pressable
            style={styles.geoButton}
            disabled={locating}
            onPress={() => void geolocate()}
          >
            {locating ? (
              <ActivityIndicator size="small" color={theme === 'dark' ? colors.brand : colors.brandDeep} />
            ) : (
              <Ionicons name="locate" size={18} color={theme === 'dark' ? colors.brand : colors.brandDeep} />
            )}
            <Text
              style={[styles.geoText, theme === 'dark' && { color: colors.brand }]}
            >
              {t('auth.geolocate')}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.pickerField} onPress={() => setCountryOpen(true)}>
          <View style={styles.pickerCopy}>
            {country ? (
              <>
                <Text style={styles.pickerEmoji}>{flagFor(country)}</Text>
                <Text numberOfLines={1} style={styles.pickerValue}>
                  {countryName(country, lang)}
                </Text>
              </>
            ) : (
              <Text style={styles.pickerPlaceholder}>{t('auth.country')}</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={20} color={colors.inkSoft} />
        </Pressable>

        <Pressable
          style={styles.pickerField}
          onPress={() => {
            setCityQuery('');
            setCityItems([]);
            setCityOpen(true);
          }}
        >
          <View style={styles.pickerCopy}>
            {city ? (
              <>
                <Ionicons name="location" size={18} color={colors.brandDeep} />
                <Text numberOfLines={1} style={styles.pickerValue}>
                  {city}
                </Text>
              </>
            ) : (
              <Text style={styles.pickerPlaceholder}>{t('auth.city')}</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={20} color={colors.inkSoft} />
        </Pressable>

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
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={23} color={colors.inkSoft} />
          </Pressable>
        </View>
        {password.length > 0 && (
          <PasswordGauge password={password} />
        )}

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
            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={23} color={colors.inkSoft} />
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
            <Ionicons name="person-add-outline" size={20} color={colors.white} />
          )}
          <Text style={styles.submitText}>{t('auth.signup')}</Text>
        </Pressable>

        <Pressable style={styles.switchLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.switchText}>
            {t('auth.haveAccount')} <Text style={styles.switchLinkText}>{t('auth.loginLink')}</Text>
          </Text>
        </Pressable>
      </ScrollView>

      <SearchablePicker
        visible={countryOpen}
        onClose={() => setCountryOpen(false)}
        title={t('auth.country')}
        placeholder={t('auth.searchCountry')}
        query={countryQuery}
        onQueryChange={setCountryQuery}
        items={countryItems}
        emptyText={t('auth.noCountry')}
        onSelect={(item) => {
          setCountry(item.key);
          setCity('');
          setCountryOpen(false);
          setCountryQuery('');
        }}
      />

      <SearchablePicker
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        title={t('auth.city')}
        placeholder={t('auth.searchCity')}
        query={cityQuery}
        onQueryChange={setCityQuery}
        items={cityItems}
        loading={cityLoading}
        emptyText={cityQuery.trim().length < 2 ? t('auth.typeMin2') : t('auth.noCity')}
        onSelect={(item) => {
          setCity(item.value ?? item.label.split(',')[0].trim());
          setCityOpen(false);
          setCityQuery('');
        }}
      />
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
    hero: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
    heroIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: { alignItems: 'center', marginTop: 18 },
    title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 30, letterSpacing: -1, textAlign: 'center' },
    subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
    label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginBottom: 7, marginTop: 6 },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    geoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8 },
    geoText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 13 },
    pickerField: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    pickerCopy: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    pickerEmoji: { fontSize: 20 },
    pickerValue: { color: colors.ink, fontFamily: fonts.medium, fontSize: 15 },
    pickerPlaceholder: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15 },
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
    roles: { gap: 10, marginBottom: 6 },
    roleCard: {
      minHeight: 74,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 13,
    },
    roleCardActive: { borderColor: colors.brandDeep, backgroundColor: colors.brandSoft },
    roleIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleIconActive: { backgroundColor: colors.brand },
    roleCopy: { flex: 1 },
    roleLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    // Actif : en clair le fond est lime pâle (texte sombre), en sombre le
    // fond est bleu nuit (texte clair) — ink s'adapte aux deux.
    roleLabelActive: { color: colors.ink },
    roleHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, marginTop: 2, lineHeight: 15 },
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
