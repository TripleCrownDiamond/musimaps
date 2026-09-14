import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureRuntime } from '@musimaps/shared';
import { AppProvider } from './src/context/AppContext';
import { AuthProvider } from './src/context/AuthContext';
import { BrandProvider } from './src/context/BrandContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { DEFAULT_BRAND, fetchCmsBrand, type BrandContent } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { AchievementToast } from './src/components/AchievementToast';
import { FloatingDock } from './src/components/FloatingDock';
import { Toast } from './src/components/Toast';
import { UpdateGate } from './src/components/UpdateGate';
import { LanguageProvider, useI18n } from './src/i18n';
import { ArtistJoinScreen } from './src/screens/ArtistJoinScreen';
import { BadgesScreen } from './src/screens/BadgesScreen';
import { ClaimedProfileScreen } from './src/screens/ClaimedProfileScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { OnboardingScreen, ONBOARDING_SEEN_KEY } from './src/screens/OnboardingScreen';
import { ProfileEditScreen } from './src/screens/ProfileEditScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ConfirmationScreen } from './src/screens/ConfirmationScreen';
import { ArtistProfileScreen } from './src/screens/ArtistProfileScreen';
import { StartScreen } from './src/screens/StartScreen';
import { WelcomeScreen, ONBOARDED_KEY } from './src/screens/WelcomeScreen';
import { supabase } from './src/lib/supabase';
import { nativeStorage } from './src/lib/storage';
import { MAPBOX_TOKEN } from './src/lib/mapbox';

// Injecte le client Supabase et le stockage dans le socle partagé, AVANT
// tout rendu : les modules de `@musimaps/shared` les lisent à l'exécution.
configureRuntime({
  mapboxToken: MAPBOX_TOKEN,
  supabase,
  storage: nativeStorage,
  // Deep link : le lien de l'email rouvre l'app sur l'écran de réinitialisation.
  resetPasswordUrl: 'musimaps://reset-password',
  signUpConfirmationUrl: 'musimaps://login',
});

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

// Deep links : le lien de réinitialisation envoyé par email (musimaps://reset-password#access_token=…)
// ouvre directement l'écran de réinitialisation. Le screen lit lui-même le token dans l'URL initiale.
// NB : on retire le fragment (#...) pour le matching React Navigation — sur mobile, extractPathFromURL
// ne coupe que sur '?', donc un fragment resterait dans le path et le lien ne matcherait pas.
// L'écran ResetPassword relit l'URL complète (avec token) via Linking.getInitialURL().
const linking = {
  prefixes: ['musimaps://', 'https://musimaps.com', ...(__DEV__ ? ['http://localhost:8090'] : [])],
  config: {
    screens: {
      Onboarding: 'onboarding',
      ResetPassword: 'reset-password',
      ForgotPassword: 'forgot-password',
      Login: 'login',
    },
  },
  getInitialURL: async () => {
    const url = await Linking.getInitialURL();
    return url ? url.split('#')[0] : null;
  },
  subscribe: (listener: (url: string) => void) => {
    const sub = Linking.addEventListener('url', ({ url }) => listener(url.split('#')[0]));
    return () => sub.remove();
  },
};

SplashScreen.preventAutoHideAsync().catch(() => {});

// Bande fixe au-dessus de la zone système (hauteur = insets.top), sous les
// icônes de la barre d'état (batterie, réseau…) : noire en sombre sous des
// icônes blanches, couleur de fond en clair sous des icônes sombres. Réservée
// d'abord au thème sombre, elle manquait en clair : le contenu défilait sous
// l'heure (formulaires) et la cover noire du profil rendait les icônes
// sombres illisibles.
const STATUS_BAND_COLOR = '#000000';

function StatusBarBand() {
  const { theme, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (insets.top <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.statusBand,
        {
          height: insets.top,
          elevation: 999,
          zIndex: 999,
          backgroundColor: theme === 'dark' ? STATUS_BAND_COLOR : colors.background,
        },
      ]}
    />
  );
}

function MainTabs() {
  const { t } = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      // Dock de navigation flottant : un pilulier overlay centré par flexbox
      // (le contenu défile dessous) — cf. components/FloatingDock.
      tabBar={(props) => <FloatingDock {...props} />}
    >
      <Tabs.Screen name="Explore" component={ExploreScreen} options={{ title: t('tab.explore') }} />
      <Tabs.Screen name="Discover" component={DiscoverScreen} options={{ title: t('tab.discover') }} />
      <Tabs.Screen name="Saved" component={SavedScreen} options={{ title: t('tab.saved') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab.profile') }} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  const { colors, theme } = useAppTheme();
  /**
   * Route de départ déduite de l'avancement réel.
   *
   * `initialRouteName` valait « Start » en dur : l'écran d'accueil réapparaissait
   * à CHAQUE lancement, même pour quelqu'un qui avait déjà tout franchi. Le
   * WelcomeScreen rattrapait ensuite le coup par un `replace` — d'où un
   * clignotement Start → Welcome → carte à chaque ouverture.
   *
   * `null` tant que le stockage n'a pas répondu : afficher un écran pour le
   * remplacer aussitôt est exactement ce qu'on cherche à supprimer.
   */
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [onboarded, seen] = await AsyncStorage.multiGet([
          ONBOARDED_KEY,
          ONBOARDING_SEEN_KEY,
        ]);
        if (cancelled) return;
        if (onboarded[1] === 'true') return setInitialRoute('Main');
        setInitialRoute(seen[1] === 'true' ? 'Welcome' : 'Start');
      } catch {
        // Stockage indisponible : on repart du parcours complet.
        if (!cancelled) setInitialRoute('Start');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.brand,
    },
  };

  // Rien tant que la route de départ est inconnue : monter le navigateur
  // puis le rediriger produirait le clignotement qu'on supprime.
  if (!initialRoute) return null;

  return (
    <AppProvider>
      <AuthProvider>
        <LanguageProvider>
          <NavigationContainer theme={navigationTheme} linking={linking}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <StatusBarBand />
          <RootStack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <RootStack.Screen name="Start" component={StartScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="Welcome" component={WelcomeScreen} />
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="Dashboard" component={DashboardScreen} />
            <RootStack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="ArtistJoin" component={ArtistJoinScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Badges" component={BadgesScreen} />
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Signup" component={SignupScreen} />
            <RootStack.Screen name="Confirmation" component={ConfirmationScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="ClaimedProfile" component={ClaimedProfileScreen} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} />
          </RootStack.Navigator>
        </NavigationContainer>
        {/* Au-dessus de la navigation : une mise à jour imposée doit
            couvrir tout l'écran, quel que soit l'écran affiché. */}
        <UpdateGate />
        <AchievementToast />
        <Toast />
        </LanguageProvider>
      </AuthProvider>
    </AppProvider>
  );
}

// Sur le bundle web (react-native-web), les ScrollView affichent une barre
// de défilement système même avec showsVerticalScrollIndicator={false}.
// On la masque globalement côté web pour rester fidèle au rendu natif.
function hideWebScrollbars() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = `
    ::-webkit-scrollbar { width: 0; height: 0; display: none; }
    * { scrollbar-width: none; -ms-overflow-style: none; }
    *::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(style);
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CabinetGrotesk_Extrabold: require('./assets/fonts/CabinetGrotesk-Extrabold.ttf'),
    CabinetGrotesk_Black: require('./assets/fonts/CabinetGrotesk-Black.ttf'),
    Satoshi_Regular: require('./assets/fonts/Satoshi-Regular.ttf'),
    Satoshi_Medium: require('./assets/fonts/Satoshi-Medium.ttf'),
    Satoshi_Bold: require('./assets/fonts/Satoshi-Bold.ttf'),
  });
  const [brand, setBrand] = useState<BrandContent>(DEFAULT_BRAND);
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  useEffect(() => {
    hideWebScrollbars();
  }, []);
  const fontsReady = fontsLoaded || Boolean(fontError);
  // On ne cache le splash que quand les polices ET le brand CMS sont prêts
  // (le brand se charge en quelques ms pendant l'affichage du splash natif).
  const appIsReady = (fontsReady && brandLoaded) || splashTimedOut;

  // Garde-fou : on ne bloque jamais l'app plus de 2,5 s sur le splash natif.
  useEffect(() => {
    const fallback = setTimeout(() => setSplashTimedOut(true), 2500);
    return () => clearTimeout(fallback);
  }, []);

  // Charge l'identité visuelle (logos) du CMS pendant que le splash natif
  // est affiché : le premier écran montre déjà le bon logo, sans flash.
  useEffect(() => {
    let cancelled = false;
    void fetchCmsBrand().then((next) => {
      if (cancelled) return;
      setBrand(next);
      setBrandLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (appIsReady) SplashScreen.hideAsync().catch(() => {});
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BrandProvider brand={brand}>
          <AppNavigator />
        </BrandProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 40, height: 32, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statusBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: STATUS_BAND_COLOR,
  },
});
