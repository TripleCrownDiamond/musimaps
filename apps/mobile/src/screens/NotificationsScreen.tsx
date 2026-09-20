import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  notificationDestination,
  notificationIcon,
  radii,
  spacing,
  type AppNotification,
} from '@musimaps/shared';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';
import { AppBar, APP_BAR_ACTION_SIZE, APP_BAR_TOP_GAP } from '../components/AppBar';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, lang } = useI18n();
  const { showToast } = useApp();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

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
    if (markingAll || !items?.some((n) => !n.read)) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
    } finally {
      setMarkingAll(false);
    }
  };

  const openOne = async (item: AppNotification) => {
    if (!item.read) {
      await markNotificationRead(item.id);
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? null);
    }
    const destination = notificationDestination(item);
    switch (destination.kind) {
      case 'artist':
        navigation.navigate('ArtistProfile', { artistId: destination.artistId });
        break;
      case 'nearby':
        navigation.navigate('Main', {
          screen: 'Explore',
          params: { discoverNearby: true, searchKey: Date.now() },
        });
        break;
      case 'achievement':
        navigation.navigate('BadgeDetail', { badgeId: destination.badgeId });
        break;
      case 'achievements':
        navigation.navigate('Badges');
        break;
      case 'globe':
        navigation.navigate('Main', { screen: 'Explore' });
        break;
    }
  };

  // Retrait immédiat de la ligne, rétabli si la base refuse la suppression.
  const removeOne = async (item: AppNotification) => {
    const previous = items;
    setItems((prev) => prev?.filter((n) => n.id !== item.id) ?? null);
    if (!(await deleteNotification(item.id))) {
      setItems(previous);
      showToast(t('notif.deleteError'), 'alert-circle', 'error');
    }
  };

  const deleteAll = async () => {
    if (deletingAll) return;
    setDeletingAll(true);
    try {
      if (await deleteAllNotifications()) setItems([]);
      else showToast(t('notif.deleteError'), 'alert-circle', 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const confirmDeleteAll = () => {
    if (!items?.length || deletingAll) return;
    Alert.alert(t('notif.deleteAllTitle'), t('notif.deleteAllText'), [
      { text: t('notif.cancel'), style: 'cancel' },
      { text: t('notif.deleteConfirm'), style: 'destructive', onPress: () => void deleteAll() },
    ]);
  };

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={[styles.appBarWrap, { paddingTop: insets.top + APP_BAR_TOP_GAP }]}>
        <AppBar
          navigation={navigation}
          rootNavigation={navigation}
          backOverride
          onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Profile' })}
          unreadCount={unread}
          beforeNotification={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('notif.markAll')}
              accessibilityState={{ disabled: unread === 0 || markingAll, busy: markingAll }}
              disabled={unread === 0 || markingAll}
              style={[styles.markAll, (unread === 0 || markingAll) && styles.markAllDisabled]}
              onPress={() => void markAll()}
            >
              <Ionicons name="checkmark-done" size={18} color={unread === 0 ? colors.muted : colors.brandPrimary} />
              <Text style={[styles.markAllText, unread === 0 && styles.markAllTextDisabled]}>
                {t('notif.markAll')}
              </Text>
            </Pressable>
          }
        />
      </View>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.headerTitle}>{t('notif.title')}</Text>
        {items && items.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('notif.deleteAll')}
            accessibilityState={{ disabled: deletingAll, busy: deletingAll }}
            disabled={deletingAll}
            hitSlop={6}
            style={[styles.deleteAll, deletingAll && styles.markAllDisabled]}
            onPress={confirmDeleteAll}
          >
            {deletingAll ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            )}
            <Text style={styles.deleteAllText}>{t('notif.deleteAll')}</Text>
          </Pressable>
        ) : null}
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
                <Text style={styles.cardTime}>{formatNotificationTime(item.created_at, lang)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notif.delete')}
                hitSlop={8}
                style={styles.deleteOne}
                onPress={() => void removeOne(item)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.inkSoft} />
              </Pressable>
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
    appBarWrap: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    headerTitle: { flexShrink: 1, color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 22, letterSpacing: -0.7 },
    markAll: { minHeight: APP_BAR_ACTION_SIZE, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.full, backgroundColor: colors.brandSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    markAllDisabled: { opacity: 0.45 },
    markAllText: { color: colors.brandPrimary, fontFamily: fonts.bold, fontSize: 12 },
    markAllTextDisabled: { color: colors.muted },
    deleteAll: { minHeight: APP_BAR_ACTION_SIZE, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, paddingHorizontal: spacing.md },
    deleteAllText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: radii.full,
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
    deleteOne: { width: 36, height: 36, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  });
