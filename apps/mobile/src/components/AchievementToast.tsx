import { badgeIcon } from '../badgeIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { fonts, shadow, type AppColors } from '../theme';

/**
 * Toast de récompense : apparaît en haut de l'écran quand un badge
 * est débloqué (gamification). Se ferme automatiquement après 3 s.
 */
export function AchievementToast() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { lastEarnedBadge, clearLastEarnedBadge } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const styles = createStyles(colors);

  useEffect(() => {
    if (!lastEarnedBadge) return;
    progress.setValue(0);
    opacity.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 7, tension: 70 }).start();
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => clearLastEarnedBadge());
    }, 3000);
    return () => clearTimeout(timer);
  }, [lastEarnedBadge, clearLastEarnedBadge, opacity, progress]);

  if (!lastEarnedBadge) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 12, opacity }]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [
              {
                translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] }),
              },
            ],
          },
        ]}
      >
        <View style={styles.medal}>
          <Ionicons name={badgeIcon(lastEarnedBadge.icon)} size={22} color={colors.black} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Badge débloqué · +{lastEarnedBadge.points} pts</Text>
          <Text style={styles.label}>{lastEarnedBadge.label}</Text>
          <Text style={styles.desc} numberOfLines={1}>{lastEarnedBadge.description}</Text>
        </View>
        <Ionicons name="trophy" size={24} color={colors.brandDeep} />
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
      minHeight: 84,
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brand,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: 15,
      paddingVertical: 12,
      ...shadow,
    },
    medal: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1 },
    eyebrow: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
    label: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 19, letterSpacing: -0.6, marginTop: 1 },
    desc: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginTop: 1 },
  });
