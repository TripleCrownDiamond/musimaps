import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILE_GUTTER } from '@musimaps/shared';
import { APP_BAR_BOTTOM_GAP, APP_BAR_HEIGHT, APP_BAR_TOP_GAP, appBarBandHeight } from './AppBar';

type Props = {
  /** Couleur de fond de l'écran (d'ordinaire colors.background). */
  background: string;
  /**
   * Fond du bandeau du haut, par défaut `background`. Passer `transparent`
   * laisse le contenu passer dessous (boutons flottants sur la page).
   */
  topBarBackground?: string;
  /**
   * Rangée du bandeau du haut, toujours épinglée en haut de l'écran. Le
   * bandeau fournit la zone système, la gouttière et l'air sous la rangée :
   * l'écran ne passe que ses boutons.
   */
  topBar: ReactNode;
  /**
   * En-tête de profil, dans le flux du contenu (défile sous le bandeau du
   * haut). Sans cover, l'en-tête est une simple carte uniforme : avatar à
   * gauche, infos à droite, actions à côté du nom.
   */
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * En-tête de profil (compte, artiste, revendiqué), épinglé sur TOUS les
 * écrans : la top bar reste toujours en haut de l'écran, le contenu (et
 * l'en-tête) défilent dessous.
 *
 * La géométrie du bandeau (hauteur, marges) vit ici et nulle part ailleurs :
 * chaque écran la recalculait avec ses propres littéraux, et le profil
 * artiste collait ses boutons au bas du bandeau bleu.
 *
 * La cover a disparu des profils : l'en-tête optionnel est posé sur le fond
 * uniforme de l'écran, et un espaceur de la hauteur du bandeau évite que le
 * contenu passe sous la barre épinglée.
 */
export function ProfileHeader({
  background,
  topBarBackground = background,
  topBar,
  header,
  style,
  contentStyle,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const bandHeight = appBarBandHeight(insets.top);

  return (
    <View style={[{ flex: 1, backgroundColor: background }, style]}>
      {/* Top bar épinglée en haut de l'écran, toujours visible. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.stickyTopBar,
          { backgroundColor: topBarBackground, height: bandHeight, paddingTop: insets.top + APP_BAR_TOP_GAP },
        ]}
      >
        <View pointerEvents="box-none" style={styles.topBarRow}>
          {topBar}
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Espaceur : la barre épinglée recouvre le haut du flux. */}
        <View style={{ height: bandHeight }} />
        {header}
        <View style={contentStyle}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    paddingHorizontal: PROFILE_GUTTER,
    paddingBottom: APP_BAR_BOTTOM_GAP,
  },
  topBarRow: {
    height: APP_BAR_HEIGHT,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
});