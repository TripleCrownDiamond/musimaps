import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { DOCK_SIDE_PAD, fonts } from '../theme';
import type { MainTabParamList } from '../navigation/types';

export type DockTab = keyof MainTabParamList;

export const TAB_ICONS: Record<DockTab, { focused: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  Explore: { focused: 'map', idle: 'map-outline' },
  Discover: { focused: 'compass', idle: 'compass-outline' },
  Saved: { focused: 'heart', idle: 'heart-outline' },
  Profile: { focused: 'person', idle: 'person-outline' },
};

export type DockItem = {
  key: DockTab;
  label: string;
  focused: boolean;
};

/** Marge basse du dock flottant au-dessus du bord de l'écran. */
export const DOCK_BOTTOM_PAD = 22;
/** Hauteur du pilulier (dp). */
export const DOCK_PILL_HEIGHT = 72;

/**
 * Pilulier du dock (contour arrondi, tab actif surligné). Partagé entre le
 * dock des onglets (FloatingDock) et les écrans empilés (profil artiste) qui
 * le gardent visible.
 */
export function DockPill({ items, onNavigate, onLongPress }: {
  items: DockItem[];
  onNavigate: (item: DockItem) => void;
  onLongPress?: (item: DockItem) => void;
}) {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const pillWidth = Math.min(screenWidth - 2 * DOCK_SIDE_PAD, 396);
  return (
    <View
      style={[
        styles.pill,
        {
          width: pillWidth,
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          shadowColor: '#111111',
        },
      ]}
    >
      {items.map((item) => {
        const icons = TAB_ICONS[item.key];
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={item.focused ? { selected: true } : {}}
            style={styles.item}
            onPress={() => onNavigate(item)}
            onLongPress={() => onLongPress?.(item)}
          >
            <View style={[styles.tabIcon, item.focused && { backgroundColor: colors.brand, borderRadius: 17 }]}>
              <Ionicons
                name={item.focused ? icons.focused : icons.idle}
                size={23}
                color={item.focused ? colors.black : colors.muted}
              />
            </View>
            <Text style={[styles.label, { color: item.focused ? colors.brandDeep : colors.muted }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    height: DOCK_PILL_HEIGHT,
    borderRadius: 36,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
    paddingVertical: 7,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    gap: 2,
    paddingBottom: 1,
  },
  tabIcon: {
    width: 40,
    height: 32,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    marginTop: 2,
    maxWidth: '95%',
  },
});