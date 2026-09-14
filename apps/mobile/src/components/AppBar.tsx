import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp, NavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fetchUnreadCount, spacing } from '@musimaps/shared';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { fonts, shadow, type AppColors } from '../theme';
import { BrandMark } from './Brand';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Écart après la zone système, identique aux écrans principaux. */
export const APP_BAR_TOP_GAP = 10;
export const APP_BAR_HEIGHT = 56;
export const APP_BAR_ACTION_SIZE = 44;
/** Air sous la barre : les pastilles ne touchent jamais le bas du bandeau épinglé. */
export const APP_BAR_BOTTOM_GAP = spacing.md;

/** Hauteur totale du bandeau de la top bar, zone système incluse. */
export const appBarBandHeight = (insetTop: number) =>
  insetTop + APP_BAR_TOP_GAP + APP_BAR_HEIGHT + APP_BAR_BOTTOM_GAP;

/**
 * Topbar commune — l'équivalent mobile de la navbar web : logo Musimaps à
 * gauche, cloche de notifications (badge non-lus, synchro web ⇄ mobile) à
 * droite. Épurée (pas de pilule, pas de bascule de thème) pour ne pas
 * surcharger ; le thème se règle dans le profil. Utilisée par tous les
 * écrans principaux pour une cohérence totale.
 */
interface AppBarProps {
  /** Contenu non interactif, centré dans une zone protégée des deux actions. */
  centerContent?: ReactNode;
  navigation: Navigation | NavigationProp<RootStackParamList>;
  /** Navigation racine fournie par un écran ouvert hors des onglets. */
  rootNavigation?: NavigationProp<RootStackParamList>;
  /** Recherche repliée (zoom/fiche ouverte) : l'icône search remplace la cloche. */
  searchCollapsed?: boolean;
  onOpenSearch?: () => void;
  /** Fiche artiste ouverte : le logo est temporairement remplacé par un bouton retour. */
  backOverride?: boolean;
  onBack?: () => void;
  /** Action de page placée immédiatement avant la cloche. */
  beforeNotification?: ReactNode;
  /** Compteur fourni par l'écran lorsqu'il modifie lui-même les non-lus. */
  unreadCount?: number;
  /** Force la version du logo (blanche par-dessus une cover sombre). */
  brandTone?: 'auto' | 'light' | 'dark';
}

export function AppBar({
  centerContent,
  navigation,
  rootNavigation,
  searchCollapsed = false,
  onOpenSearch,
  backOverride = false,
  onBack,
  beforeNotification,
  unreadCount,
  brandTone,
}: AppBarProps) {
  const { colors, theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const [unread, setUnread] = useState(0);
  const displayedUnread = unreadCount ?? unread;

  // Anneau pulsé de l'icône search repliée (comme le bouton du web).
  const ringAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!searchCollapsed) {
      ringAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [searchCollapsed, ringAnim]);
  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const openHome = () => {
    if (rootNavigation) return rootNavigation.navigate('Main', { screen: 'Explore' });
    return (navigation as Navigation).navigate('Explore');
  };
  const openNotifications = () => {
    if (rootNavigation) return rootNavigation.navigate('Notifications');
    return (navigation as Navigation).navigate('Notifications');
  };

  // Badge de notifications rafraîchi à chaque focus de l'écran hôte.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void fetchUnreadCount().then((n) => {
        if (active) setUnread(n);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.bar}>
      {backOverride && onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.brandDeep} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Musimaps — accueil"
          hitSlop={8}
          onPress={openHome}
          style={styles.logoPress}
        >
          <BrandMark size={40} tone={brandTone} />
        </Pressable>
      )}

      {centerContent != null && (
        <View style={styles.centerContent} pointerEvents="none">
          {centerContent}
        </View>
      )}
      <View style={styles.actions}>
        {beforeNotification}
        {/* Recherche repliée : l'icône search remplace temporairement la cloche. */}
        {searchCollapsed && onOpenSearch ? (
          <View style={styles.searchCollapsedWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.searchCollapsedRing,
                { opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('globe.searchPlaceholder')}
              style={styles.searchCollapsedBtn}
              onPress={onOpenSearch}
            >
              <Ionicons name="search" size={22} color={colors.brandDeep} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('notif.title')}
            hitSlop={6}
            style={styles.iconButton}
            onPress={openNotifications}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {displayedUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{displayedUnread > 99 ? '99+' : displayedUnread}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors, theme: 'light' | 'dark') =>
  StyleSheet.create({
    bar: {
      minHeight: APP_BAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    logoPress: { flexShrink: 1 },
    centerContent: {
      position: 'absolute',
      left: 56,
      right: 56,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
    },
    backButton: {
      width: APP_BAR_ACTION_SIZE,
      height: APP_BAR_ACTION_SIZE,
      borderRadius: 22,
      backgroundColor: theme === 'dark' ? 'rgba(16,28,45,0.92)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // Cloche sur fond arrondi avec bordure, comme sur le web (cercle
    // translucide cohérent avec l'icône search repliée et le bouton retour).
    iconButton: {
      width: APP_BAR_ACTION_SIZE,
      height: APP_BAR_ACTION_SIZE,
      borderRadius: 22,
      backgroundColor: theme === 'dark' ? 'rgba(16,28,45,0.92)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    searchCollapsedWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    searchCollapsedRing: {
      position: 'absolute',
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1.5,
      borderColor: colors.brandDeep,
    },
    searchCollapsedBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme === 'dark' ? 'rgba(16,28,45,0.92)' : 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    badge: {
      position: 'absolute',
      top: 3,
      right: 3,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.brandDeep,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  });
