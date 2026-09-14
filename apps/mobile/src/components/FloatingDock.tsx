import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { DockPill, type DockItem, type DockTab, DOCK_BOTTOM_PAD } from './DockPill';

/**
 * Dock de navigation flottant : un conteneur overlay sur l'écran (le contenu
 * continue de défiler dessous) qui centre le pilulier via les coordonnées du
 * LAYOUT (alignItems/justifyContent) plutôt que des longueurs absolues —
 * la résolution des marges par le flexbox est déterministe, contrairement à
 * `left` + `width` en absolu où Yoga décale le pilulier.
 */
export function FloatingDock({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { dockHidden } = useApp();

  if (dockHidden) return null;

  const items: DockItem[] = state.routes.map((route, index) => ({
    key: route.name as DockTab,
    label: (descriptors[route.key].options.title as string | undefined) ?? route.name,
    focused: state.index === index,
  }));

  const onNavigate = (item: DockItem) => {
    const route = state.routes.find((r) => r.name === item.key);
    if (!route) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const onLongPress = (item: DockItem) => {
    const route = state.routes.find((r) => r.name === item.key);
    if (!route) return;
    navigation.emit({ type: 'tabLongPress', target: route.key });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.wrap, { paddingBottom: insets.bottom + DOCK_BOTTOM_PAD }]}
    >
      <DockPill items={items} onNavigate={onNavigate} onLongPress={onLongPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});