/**
 * Fond de la zone système (heure, batterie, réseau) pour les écrans à fond
 * uni qui défilent : le contenu ne passe plus sous les icônes.
 *
 * Il remplace une bande posée sur TOUS les écrans depuis `App.tsx`. Peinte
 * dans la couleur de fond par-dessus la carte, la cover du profil ou un
 * bandeau bleu, elle dessinait une bande blanche en haut de chaque écran.
 * Ici elle prend la couleur de l'écran qui la porte : invisible au repos.
 */
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';

export function StatusBarScrim({ color }: { color?: string }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  if (insets.top <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.scrim, { height: insets.top, backgroundColor: color ?? colors.background }]}
    />
  );
}

// Pas d'`elevation` : sur Android elle projette une ombre, un trait gris sous
// l'heure. Rendu après le contenu défilant, le masque passe déjà au-dessus.
const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});
