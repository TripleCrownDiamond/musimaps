import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fetchUnreadCount } from '../lib/notifications';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { fonts, shadow, type AppColors } from '../theme';
import { BrandMark } from './Brand';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Topbar commune — l'équivalent mobile de la navbar web : logo Musimaps à
 * gauche, cloche de notifications (badge non-lus, synchro web ⇄ mobile) à
 * droite. Épurée (pas de pilule, pas de bascule de thème) pour ne pas
 * surcharger ; le thème se règle dans le profil. Utilisée par tous les
 * écrans principaux pour une cohérence totale.
 */
interface AppBarProps {
  navigation: Navigation;
  /** Recherche repliée (zoom/fiche ouverte) : l'icône search remplace la cloche. */
  searchCollapsed?: boolean;
  onOpenSearch?: () => void;
  /** Fiche artiste ouverte : le logo est temporairement remplacé par un bouton retour. */
  backOverride?: boolean;
  onBack?: () => void;
}

export function AppBar({
  navigation,
  searchCollapsed = false,
  onOpenSearch,
  backOverride = false,
  onBack,
}: AppBarProps) {
  const { colors, theme } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const [unread, setUnread] = useState(0);

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
          onPress={() => navigation.navigate('Explore')}
          style={styles.logoPress}
        >
          <BrandMark size={40} />
        </Pressable>
      )}

      <View style={styles.actions}>
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
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
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
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    logoPress: { flexShrink: 1 },
    backButton: {
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
    actions: { flexDirection: 'row', alignItems: 'center' },
    // Cloche sur fond arrondi avec bordure, comme sur le web (cercle
    // translucide cohérent avec l'icône search repliée et le bouton retour).
    iconButton: {
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
