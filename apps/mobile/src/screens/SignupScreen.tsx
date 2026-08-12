import Ionicons from '@expo/vector-icons/Ionicons';
import { Headphones, MicVocal } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COUNTRIES,
  checkin,
  continentName,
  countryName,
  flagFor,
  radii,
  spacing,
  suggestCities,
} from '@musimaps/shared';
import { PasswordGauge } from '../components/PasswordGauge';
import { SearchablePicker, type PickerItem } from '../components/SearchablePicker';
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
  const { t, lang } = useI18n();
  const { signUp } = useAuth();
  const { showToast } = useApp();
  const [role, setRole] = useState<AccountRole | null>(route.params?.role ?? null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
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
      <AuthLayout
        icon="mail-outline"
        title={t('auth.checkEmail')}
        subtitle={t('auth.checkEmailText')}
      >
        <Text style={[styles.sentEmail, { color: colors.ink }]}>{email.trim()}</Text>
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

      <Field>
        <View style={styles.locationHeader}>
          <Text style={[styles.locationLabel, { color: colors.inkSoft }]}>
            {t('auth.location')} *
          </Text>
          <Button
            variant="link"
            size="sm"
            disabled={locating}
            loading={locating}
            label={t('auth.geolocate')}
            onPress={() => void geolocate()}
            icon={<Ionicons name="locate" size={18} color={colors.brandPrimary} />}
          />
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
                <Ionicons name="location" size={18} color={colors.brandPrimary} />
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
      </Field>

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
    </AuthLayout>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    sentEmail: { fontFamily: fonts.bold, fontSize: 15, textAlign: 'center' },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    locationLabel: {
      fontFamily: fonts.bold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    pickerField: {
      minHeight: 52,
      borderRadius: radii['2xl'],
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    pickerEmoji: { fontSize: 20 },
    pickerValue: { color: colors.ink, fontFamily: fonts.medium, fontSize: 15 },
    pickerPlaceholder: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15 },
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
