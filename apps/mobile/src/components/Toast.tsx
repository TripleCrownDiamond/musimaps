import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { fonts, shadow, type AppColors } from '../theme';

/**
 * Toast générique : message court en haut de l'écran (suivre, like,
 * réservation…). Se ferme automatiquement après 2,5 s. Le badge de
 * gamification (AchievementToast) est prioritaire s'il est affiché.
 */
export function Toast() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Le badge de gamification reste prioritaire : pas de doublon empilé.
  const { toast, lastEarnedBadge } = useApp();
  const isError = toast?.tone === 'error';
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const styles = createStyles(colors);

  useEffect(() => {
    if (!toast) return;
    progress.setValue(0);
    opacity.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 8, tension: 90 }).start();
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start();
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast, opacity, progress]);

  if (!toast || lastEarnedBadge) return null;

  return (    <Animated.View
        pointerEvents="none"
        style={[styles.wrap, { top: insets.top + 12, opacity }]}
      >
      <Animated.View
        style={[
          styles.card,
          isError && styles.cardError,
          { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] },
        ]}
      >
        {toast.icon && (
          <View style={[styles.medal, isError && styles.medalError]}>
            <Ionicons name={toast.icon as never} size={20} color={colors.black} />
          </View>
        )}
        <Text style={styles.label}>{toast.message}</Text>
        <Ionicons
          name={(toast.icon ?? (isError ? 'alert-circle' : 'checkmark-circle')) as never}
          size={22}
          color={isError ? colors.danger : colors.brandDeep}
        />
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 60,
      elevation: 24,
      alignItems: 'center',
    },
    card: {
      width: '100%',
      minHeight: 56,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brand,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 16,
      paddingVertical: 10,
      ...shadow,
    },
    cardError: {
      borderColor: colors.danger,
    },
    medal: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    medalError: {
      backgroundColor: colors.danger,
    },
    label: {
      flex: 1,
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 14,
      lineHeight: 19,
    },
  });
