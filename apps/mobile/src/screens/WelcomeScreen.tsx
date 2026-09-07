import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import {
  LOCATION_PERMISSION_TIMEOUT_MS,
  resolveWithin,
} from '@musimaps/shared';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

/** L'utilisateur a atteint la carte au moins une fois : on ne le
 *  repasse plus par l'accueil ni la localisation au lancement suivant. */
export const ONBOARDED_KEY = 'musimaps.mobile.onboarded';
const LOCATION_KEY = 'musimaps.mobile.location';

interface ChosenLocation {
  city: string;
  district?: string;
  country?: string;
  countryCode?: string;
  locationLabel?: string;
  coordinates: [number, number];
}

/**
 * Écran de localisation après onboarding — aligné sur le globe web :
 * titre « Localisation », bouton principal « Autoriser » et secondaire
 * « Explorer le globe ». Pas de bouton « Continuer » : l'action part direct.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const [locating, setLocating] = useState(false);

  // Localisation déjà choisie (persistée) : on passe directement à la carte,
  // SANS re-centrer ni filtrer le globe (vue monde épurée, comme le web).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (onboarded !== 'true') return;
        if (cancelled) return;
        const savedRaw = await AsyncStorage.getItem(LOCATION_KEY).catch(() => null);
        let saved: ChosenLocation | null = null;
        try {
          saved = savedRaw ? (JSON.parse(savedRaw) as ChosenLocation) : null;
        } catch {
          saved = null;
        }
        navigation.replace('Main', {
          screen: 'Explore',
          params: {
            skipLocation: true,
            ...(saved?.coordinates ? saved : {}),
          },
        });
      } catch {
        /* stockage indisponible : on laisse l'écran s'afficher */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const goToMap = useCallback(
    (chosen?: ChosenLocation) => {
      void (async () => {
        await AsyncStorage.setItem(ONBOARDED_KEY, 'true').catch(() => {});
        if (chosen) {
          await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(chosen)).catch(() => {});
        }
        navigation.replace('Main', {
          screen: 'Explore',
          params: {
            // La décision de localisation est déjà prise ici (Welcome) :
            // Explorer ne doit pas re-demander l'autorisation.
            skipLocation: true,
            ...(chosen
              ? {
                  city: chosen.city,
                  district: chosen.district,
                  country: chosen.country,
                  countryCode: chosen.countryCode,
                  locationLabel: chosen.locationLabel,
                  coordinates: chosen.coordinates,
                }
              : {}),
          },
        });
      })();
    },
    [navigation],
  );

  const authorize = async () => {
    setLocating(true);
    try {
      // Sur Expo Web, expo-location ne relaie pas toujours la permission du
      // navigateur. L'écran Carte appelle ensuite navigator.geolocation et
      // affiche la carte sans attendre cette étape.
      if (Platform.OS === 'web') {
        goToMap();
        return;
      }
      const permission = await resolveWithin(
        Location.requestForegroundPermissionsAsync(),
        LOCATION_PERMISSION_TIMEOUT_MS,
      );
      if (!permission || permission.status !== 'granted') {
        // Refus : on laisse quand même accéder au globe sans localisation.
        goToMap();
        return;
      }
      // L'écran carte s'ouvre immédiatement après la permission. Explore
      // récupère ensuite le GPS et le géocodage avec ses propres délais : un
      // navigateur/émulateur lent ne peut plus bloquer l'onboarding.
      goToMap();
    } catch {
      goToMap();
    } finally {
      setLocating(false);
    }
  };

  const exploreGlobe = () => goToMap();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.copy}>
          <Text style={styles.title}>{t('welcome.title')}</Text>
          <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('welcome.yourLocation')}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          disabled={locating}
          onPress={() => void authorize()}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="navigate" size={20} color={colors.white} />
          )}
          <Text style={styles.primaryText}>{t('welcome.allow')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('welcome.exploreGlobe')}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          disabled={locating}
          onPress={exploreGlobe}
        >
          <Ionicons name="globe-outline" size={20} color={colors.brandDeep} />
          <Text style={styles.secondaryText}>{t('welcome.exploreGlobe')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, paddingHorizontal: 20, paddingBottom: 10 },
    copy: { marginTop: 86 },
    title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 26, lineHeight: 34, letterSpacing: -0.9 },
    subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 17, lineHeight: 27, marginTop: 9 },
    primaryBtn: {
      minHeight: 58,
      borderRadius: 29,
      backgroundColor: colors.brandDeep,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 30,
      marginTop: 44,
    },
    primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 17 },
    secondaryBtn: {
      minHeight: 54,
      borderRadius: 27,
      borderWidth: 1.5,
      borderColor: colors.brandDeep,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 30,
      marginTop: 12,
    },
    secondaryText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 16 },
    pressed: { opacity: 0.78 },
  });
