import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts } from '../theme';
import { ONBOARDING_SEEN_KEY } from './OnboardingScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Start'>;

/**
 * Écran d’entrée Figma reconstruit avec de vrais composants natifs.
 * Les contrôles restent accessibles et s’adaptent à toutes les hauteurs d’écran.
 */
export function StartScreen({ navigation }: Props) {
  const { t } = useI18n();
  // Pas de logo sur l'écran d'accueil/auth — une illustration 3D du globe
  // pose le ton (comme l'onboarding), le reste est épuré et natif.
  const startFlow = async () => {
    const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY).catch(() => null);
    navigation.navigate(seen === 'true' ? 'Welcome' : 'Onboarding');
  };

  return (
    <View style={styles.root}>
      {/* Image de fond en cover absolu — rendu fiable sur web ET natif. */}
      <Image
        source={require('../../assets/welcome-background.jpg')}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, styles.backgroundImage]}
        accessibilityIgnoresInvertColors
      />
      <StatusBar style="light" />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.94)', '#000000']}
        locations={[0, 0.38, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Dégradé sombre vers le haut : garantit la lisibilité du logo blanc. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
        style={styles.topFade}
      />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        {/* Logo horizontal centré en haut (au-dessus du dégradé sombre).
            logo-dark.png = logo blanc, pour fond sombre. */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/brand/logo-dark.png')}
            resizeMode="contain"
            style={styles.logo}
            accessibilityLabel="Musimaps"
          />
        </View>
        <View style={styles.content}>
          <Text style={styles.tagline}>{t('start.tagline')}</Text>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('start.exploreAria')}
              style={({ pressed }) => [styles.button, styles.exploreButton, pressed && styles.pressed]}
              onPress={startFlow}
            >
              <Text style={styles.exploreText}>{t('start.explore')}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('start.signupAria')}
              style={({ pressed }) => [styles.button, styles.signupButton, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.signupText}>{t('start.signup')}</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>
            {t('start.legalPrefix')} <Text style={styles.legalLink}>{t('start.legalTerms')}</Text>{' '}
            {t('start.legalAnd')} <Text style={styles.legalLink}>{t('start.legalPrivacy')}</Text>
            {t('start.legalSuffix')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    zIndex: 2,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 230,
    zIndex: 1,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: 18,
    zIndex: 2,
  },
  logo: {
    width: 210,
    height: 45,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tagline: {
    marginTop: 22,
    color: '#FFFFFF',
    fontFamily: fonts.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actions: {
    gap: 12,
    marginTop: 34,
  },
  button: {
    width: '100%',
    height: 64,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreButton: {
    backgroundColor: '#A8FF35',
  },
  signupButton: {
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.78,
  },
  exploreText: {
    color: '#111111',
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  signupText: {
    color: '#111111',
    fontFamily: fonts.medium,
    fontSize: 18,
  },
  legal: {
    minHeight: 46,
    marginTop: 19,
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  legalLink: {
    color: '#A8FF35',
  },
});
