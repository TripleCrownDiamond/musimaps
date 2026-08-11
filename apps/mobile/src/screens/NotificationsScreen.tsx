import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationIcon,
  type AppNotification,
} from '../lib/notifications';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

function timeAgo(iso: string, lang: 'fr' | 'en'): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (seconds < 60) return rtf.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR');
}

export function NotificationsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  const load = useCallback(async () => {
    const rows = await fetchNotifications();
    setItems(rows);
  }, []);

  // Rafraîchit à chaque focus + toutes les 60 s (notifs web ⇄ mobile en direct).
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 60000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const markAll = async () => {
    if (!items?.some((n) => !n.read)) return;
    await markAllNotificationsRead();
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
  };

  const openOne = async (item: AppNotification) => {
    if (!item.read) {
      await markNotificationRead(item.id);
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? null);
    }
  };

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Pressable accessibilityLabel={t('common.back')} style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={27} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('notif.title')}</Text>
        <Pressable style={[styles.markAll, unread === 0 && styles.markAllDisabled]} onPress={() => void markAll()}>
          <Text style={[styles.markAllText, unread === 0 && styles.markAllTextDisabled]}>
            {t('notif.markAll')}
          </Text>
        </Pressable>
      </View>

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDeep} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={30} color={colors.brandDeep} />
          </View>
          <Text style={styles.emptyTitle}>{t('notif.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('notif.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, !item.read && styles.cardUnread]} onPress={() => void openOne(item)}>
              <Text style={styles.cardIcon}>{notificationIcon(item.type)}</Text>
              <View style={styles.cardCopy}>
                <Text style={styles.cardMessage}>
                  {item.message ??
                    (item.artist_name ? `${item.artist_name}${item.city ? ` · ${item.city}` : ''}` : '')}
                </Text>
                <Text style={styles.cardTime}>{timeAgo(item.created_at, lang)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, gap: 12 },
    back: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 22, letterSpacing: -0.7, flex: 1 },
    markAll: { borderRadius: 18, backgroundColor: colors.brandSoft, paddingHorizontal: 13, paddingVertical: 8 },
    markAllDisabled: { opacity: 0.45 },
    markAllText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 12 },
    markAllTextDisabled: { color: colors.muted },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, marginTop: 6 },
    emptyText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    listContent: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 10, gap: 10 },
    card: {
      minHeight: 74,
      borderRadius: 20,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    cardUnread: { borderWidth: 1, borderColor: colors.brandDeep },
    cardIcon: { fontSize: 20 },
    cardCopy: { flex: 1 },
    cardMessage: { color: colors.ink, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
    cardTime: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandDeep },
  });
