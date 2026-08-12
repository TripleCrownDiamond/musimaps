import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightPalette, spacing } from '@musimaps/shared';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { Button } from '../ui';
import { fonts } from '../theme';
import { ONBOARDING_SEEN_KEY } from './OnboardingScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Start'>;

/**
 * Valeurs du voile posé SUR la photo de fond.
 *
 * Elles ne viennent pas des tokens de thème, et c'est volontaire : cet écran
 * est toujours sombre, quel que soit le thème de l'app. Un blanc de texte
 * posé sur une photo se règle par rapport à la photo, pas par rapport au
 * fond de l'interface. Les nommer évite qu'on les prenne pour un oubli.
 */
const ON_MEDIA = {
  /** Fond de sécurité sous la photo, le temps de son chargement. */
  backdrop: '#000000',
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.88)',
  /** Dégradé bas : laisse voir la photo en haut, assombrit sous les boutons. */
  scrimBottom: ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.94)', '#000000'] as const,
  /** Dégradé haut : garantit la lisibilité du logo blanc. */
  scrimTop: ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)'] as const,
};

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
        colors={ON_MEDIA.scrimBottom}
        locations={[0, 0.38, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Dégradé sombre vers le haut : garantit la lisibilité du logo blanc. */}
      <LinearGradient
        pointerEvents="none"
        colors={ON_MEDIA.scrimTop}
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

          {/* Hiérarchie alignée sur la landing web : action principale en
              BLEU, action secondaire en lime. Le mobile faisait l'inverse
              (« Explorer » en lime, « S'inscrire » en blanc). */}
          <View style={styles.actions}>
            <Button
              block
              size="lg"
              label={t('start.explore')}
              accessibilityLabel={t('start.exploreAria')}
              onPress={startFlow}
              style={styles.heroButton}
            />
            <Button
              block
              size="lg"
              variant="brand"
              label={t('start.signup')}
              accessibilityLabel={t('start.signupAria')}
              onPress={() => navigation.navigate('Signup')}
              style={styles.heroButton}
            />
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
    backgroundColor: ON_MEDIA.backdrop,
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
    color: ON_MEDIA.text,
    fontFamily: fonts.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actions: {
    gap: spacing.md,
    marginTop: 34,
  },
  /** Les boutons du héros sont plus hauts que la taille `lg` du socle. */
  heroButton: { height: 64 },
  legal: {
    minHeight: 46,
    marginTop: 19,
    color: ON_MEDIA.textSoft,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  legalLink: {
    color: lightPalette.brandSecondary,
  },
});
