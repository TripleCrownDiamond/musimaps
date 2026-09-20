import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILE_GUTTER } from '@musimaps/shared';
import { ScreenStatusBar } from '../ui/ScreenStatusBar';
import { StatusBarScrim } from '../ui/StatusBarScrim';
import { APP_BAR_BOTTOM_GAP, APP_BAR_HEIGHT, APP_BAR_TOP_GAP, appBarBandHeight } from './AppBar';

type Props = {
  /** Hauteur totale du header (cover + photo). Toujours pleine. */
  headerHeight: number;
  /** Couleur de fond de l'écran (d'ordinaire colors.background). */
  background: string;
  /**
   * Fond du bandeau du haut, par défaut `background`. Passer `transparent`
   * laisse la cover passer dessous (boutons flottants sur la photo).
   */
  topBarBackground?: string;
  /**
   * Rangée du bandeau du haut, toujours épinglée en haut de l'écran. Le
   * bandeau fournit la zone système, la gouttière et l'air sous la rangée :
   * l'écran ne passe que ses boutons.
   */
  topBar: ReactNode;
  /** Cover pleine largeur sous le bandeau du haut (défile avec le contenu). */
  cover: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * En-tête de profil (compte, artiste, revendiqué), épinglé sur TOUS les
 * écrans : la top bar reste toujours en haut de l'écran, la cover (et le
 * contenu) défilent dessous.
 *
 * La géométrie du bandeau (hauteur, marges) vit ici et nulle part ailleurs :
 * chaque écran la recalculait avec ses propres littéraux, et le profil
 * artiste collait ses boutons au bas du bandeau bleu.
 *
 * La cover garde TOUJOURS sa hauteur normale (`headerHeight`) ; la photo de
 * profil, ancrée à son bord inférieur, défile avec elle et n'est jamais
 * coupée (moitié sur la cover, moitié dehors).
 */
export function ProfileHeader({
  headerHeight,
  background,
  topBarBackground = background,
  topBar,
  cover,
  style,
  contentStyle,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const collapsedHeight = appBarBandHeight(insets.top);
  const overCover = topBarBackground === 'transparent';
  /**
   * La cover a quitté la zone système. Le bandeau bleu épinglé qui prenait le
   * relais au défilement a disparu : seules les pastilles surélevées (logo,
   * retour, cloche) restent fixes, lisibles sur la cover comme sur le blanc.
   */
  const [coverPassed, setCoverPassed] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const passed = e.nativeEvent.contentOffset.y > headerHeight - insets.top;
    setCoverPassed((current) => (current === passed ? current : passed));
  };

  return (
    <View style={[{ flex: 1, backgroundColor: background }, style]}>
      {/* Icônes système blanches tant que la cover sombre est dessous ; ensuite
          elles reprennent la couleur du thème, au-dessus du fond de page. */}
      {overCover && !coverPassed && <ScreenStatusBar style="light" />}
      {/* Top bar épinglée en haut de l'écran, toujours visible. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.stickyTopBar,
          { backgroundColor: topBarBackground, height: collapsedHeight, paddingTop: insets.top + APP_BAR_TOP_GAP },
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
        scrollEventThrottle={60}
        onScroll={onScroll}
      >
        {/* Header dans le flux : hauteur pleine constante, défile sous la barre.
            Sans overflow hidden : la photo de profil peut déborder à moitié
            par-dessous la cover (moitié sur la cover, moitié dehors). */}
        <View style={{ height: headerHeight }}>
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {cover}
          </View>
        </View>

        <View style={contentStyle}>{children}</View>
      </ScrollView>
      {/* Le contenu ne défile pas sous l'heure une fois la cover passée. */}
      {overCover && coverPassed && <StatusBarScrim color={background} />}
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
