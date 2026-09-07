import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COUNTRIES,
  continentName,
  countryName,
  flagFor,
  radii,
  spacing,
  suggestCities,
} from '@musimaps/shared';
import { SearchablePicker, type PickerItem } from './SearchablePicker';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, type AppColors } from '../theme';

export interface LocationFieldsValue {
  city: string;
  country: string;
  lat?: number;
  lng?: number;
}

/**
 * Localisation commune aux écrans d'inscription, d'édition et de demande
 * artiste. Le pays vient du catalogue partagé, la ville de Mapbox et le
 * bouton « Me localiser » reprend le même flux que l'inscription.
 */
export function LocationFields({
  city,
  country,
  onChange,
  required = true,
}: {
  city: string;
  country: string;
  onChange: (value: LocationFieldsValue) => void;
  required?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { showToast } = useApp();
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityItems, setCityItems] = useState<PickerItem[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const countryItems = useMemo<PickerItem[]>(() => {
    const q = countryQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return COUNTRIES.filter((item) => {
      const name = (lang === 'fr' ? item.fr : item.en)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return !q || name.includes(q) || item.code.toLowerCase() === q;
    }).map((item) => ({
      key: item.code,
      label: lang === 'fr' ? item.fr : item.en,
      sublabel: continentName(item.continent, lang),
      emoji: flagFor(item.code),
    }));
  }, [countryQuery, lang]);

  useEffect(() => {
    if (!cityOpen) return;
    const query = cityQuery.trim();
    if (query.length < 2) {
      setCityItems([]);
      setCityLoading(false);
      return;
    }
    let cancelled = false;
    setCityLoading(true);
    const timer = setTimeout(() => {
      void suggestCities(query, country || null)
        .then((results) => {
          if (cancelled) return;
          setCityItems(
            results.map((result) => ({
              key: `${result.lng},${result.lat},${result.city}`,
              label: result.label,
              value: result.city,
              sublabel: result.countryCode ? countryName(result.countryCode, lang) : undefined,
            })),
          );
        })
        .finally(() => {
          if (!cancelled) setCityLoading(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityOpen, cityQuery, country, lang]);

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
      const nextCity = place?.city || place?.subregion || place?.region || '';
      const nextCountry = (place?.isoCountryCode ?? '').toUpperCase();
      if (!nextCity && !nextCountry) {
        showToast(t('auth.locationNotFound'), 'alert-circle', 'error');
        return;
      }
      onChange({ city: nextCity || city, country: nextCountry || country, lat: position.coords.latitude, lng: position.coords.longitude });
      showToast(t('auth.locationFilled'), 'checkmark-circle');
    } catch {
      showToast(t('auth.locationNotFound'), 'alert-circle', 'error');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.locationHeader}>
        <Text style={styles.label}>{t('auth.location')} {required ? '*' : ''}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.geolocate')}
          disabled={locating}
          onPress={() => void geolocate()}
          style={styles.locateButton}
        >
          {locating ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name="locate" size={17} color={colors.brandPrimary} />}
          <Text style={styles.locateText}>{t('auth.geolocate')}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.pickerField} onPress={() => setCountryOpen(true)}>
        <View style={styles.pickerCopy}>
          {country ? (
            <>
              <Text style={styles.emoji}>{flagFor(country)}</Text>
              <Text numberOfLines={1} style={styles.value}>{countryName(country, lang)}</Text>
            </>
          ) : <Text style={styles.placeholder}>{t('auth.country')}</Text>}
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
              <Text numberOfLines={1} style={styles.value}>{city}</Text>
            </>
          ) : <Text style={styles.placeholder}>{t('auth.city')}</Text>}
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.inkSoft} />
      </Pressable>

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
          onChange({ city: '', country: item.key });
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
          onChange({ city: item.value ?? item.label.split(',')[0].trim(), country });
          setCityOpen(false);
          setCityQuery('');
        }}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { gap: spacing.sm },
  locationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginLeft: 4 },
  locateButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 4 },
  locateText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 12 },
  pickerField: {
    minHeight: 59,
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
  emoji: { fontSize: 20 },
  value: { color: colors.ink, fontFamily: fonts.medium, fontSize: 15 },
  placeholder: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15 },
});
