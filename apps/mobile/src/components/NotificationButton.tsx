import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchUnreadCount } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, shadow } from '../theme';

/** Cloche compacte pour les en-têtes secondaires (retour à gauche). */
export function NotificationButton({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => StyleSheet.create({
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
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
  }), [colors]);
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void fetchUnreadCount().then((count) => {
        if (active) setUnread(count);
      });
      return () => { active = false; };
    }, []),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('notif.title')}
      hitSlop={6}
      style={styles.button}
      onPress={onPress}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.ink} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
