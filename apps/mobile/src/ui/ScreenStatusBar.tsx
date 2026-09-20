/**
 * Couleur des icônes de la barre d'état imposée par un écran, tant qu'il est
 * affiché.
 *
 * `App.tsx` règle ces icônes sur le thème de l'app. Un écran dont le haut
 * est sombre quel que soit le thème (cover de profil, bandeau bleu) les
 * repasse en clair. Les `StatusBar` s'empilent : démonté au départ de
 * l'écran, celui-ci rend la main au réglage global.
 */
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

export function ScreenStatusBar({ style }: { style: 'light' | 'dark' }) {
  const focused = useIsFocused();
  return focused ? <StatusBar style={style} /> : null;
}
