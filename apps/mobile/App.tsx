import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { configureRuntime } from '@musimaps/shared';
import { AppProvider } from './src/context/AppContext';
import { AuthProvider } from './src/context/AuthContext';
import { BrandProvider } from './src/context/BrandContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { DEFAULT_BRAND, fetchCmsBrand, type BrandContent } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { AchievementToast } from './src/components/AchievementToast';
import { Toast } from './src/components/Toast';
import { LanguageProvider, useI18n } from './src/i18n';
import { ArtistJoinScreen } from './src/screens/ArtistJoinScreen';
import { BadgesScreen } from './src/screens/BadgesScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ProfileEditScreen } from './src/screens/ProfileEditScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { StartScreen } from './src/screens/StartScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { supabase } from './src/lib/supabase';
import { nativeStorage } from './src/lib/storage';
import { dockStyle, fonts } from './src/theme';

// Injecte le client Supabase et le stockage dans le socle partagé, AVANT
// tout rendu : les modules de `@musimaps/shared` les lisent à l'exécution.
configureRuntime({
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
  supabase,
  storage: nativeStorage,
  // Deep link : le lien de l'email rouvre l'app sur l'écran de réinitialisation.
  resetPasswordUrl: 'musimaps://reset-password',
});

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

// Deep links : le lien de réinitialisation envoyé par email (musimaps://reset-password#access_token=…)
// ouvre directement l'écran de réinitialisation. Le screen lit lui-même le token dans l'URL initiale.
// NB : on retire le fragment (#...) pour le matching React Navigation — sur mobile, extractPathFromURL
// ne coupe que sur '?', donc un fragment resterait dans le path et le lien ne matcherait pas.
// L'écran ResetPassword relit l'URL complète (avec token) via Linking.getInitialURL().
const linking = {
  prefixes: ['musimaps://', 'https://musimaps.app', ...(__DEV__ ? ['http://localhost:8090'] : [])],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      ForgotPassword: 'forgot-password',
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

function MainTabs() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.bold,
          fontSize: 10,
          marginTop: 2,
        },
        // Dock de navigation flottant : un pilulier ancré en bas (au-dessus
        // de la barre d'accueil iOS), comme la navbar de la landing web.
        tabBarStyle: dockStyle(colors, insets.bottom + 22),
        tabBarItemStyle: {
          borderRadius: 28,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Explore: focused ? 'map' : 'map-outline',
            Search: focused ? 'search' : 'search-outline',
            Saved: focused ? 'heart' : 'heart-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return (
            <View style={[styles.tabIcon, focused && { backgroundColor: colors.brand }]}>
              <Ionicons name={icons[route.name]} size={size - 1} color={focused ? colors.black : color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="Explore" component={ExploreScreen} options={{ title: t('tab.explore') }} />
      <Tabs.Screen name="Search" component={SearchScreen} options={{ title: t('tab.search') }} />
      <Tabs.Screen name="Saved" component={SavedScreen} options={{ title: t('tab.saved') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab.profile') }} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  const { colors, theme } = useAppTheme();
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

  return (
    <AppProvider>
      <AuthProvider>
        <LanguageProvider>
          <NavigationContainer theme={navigationTheme} linking={linking}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <RootStack.Navigator
            initialRouteName="Start"
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
            <RootStack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="ArtistJoin" component={ArtistJoinScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Badges" component={BadgesScreen} />
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Signup" component={SignupScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="Dashboard" component={DashboardScreen} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} />
          </RootStack.Navigator>
        </NavigationContainer>
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
});
