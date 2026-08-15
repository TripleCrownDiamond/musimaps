import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapOverlays, mapUi, nextIndexWithinPlace, type Artist } from '@musimaps/shared';
import { useI18n } from '../i18n';
import { fonts, shadow } from '../theme';

/**
 * Le verre sombre est le même dans les deux thèmes : cette barre se lit par
 * rapport à la carte, pas par rapport à l'interface. On prend donc le jeu
 * clair — `glass*` y est identique au jeu sombre.
 */
const glass = mapOverlays.light;

export interface PlacePanelData {
  kind: 'country' | 'city';
  name: string;
  code: string;
  flag: string;
  artists: Artist[];
}

interface PlacePanelProps {
  place: PlacePanelData;
  /** Index de l'artiste courant dans la nav « jump ». */
  index: number;
  onJump: (index: number) => void;
  onSelect: (artist: Artist) => void;
  onClose: () => void;
}

/**
 * Mini-barre « lieu » mobile — même design que le web : un petit pill
 * translucide au-dessus des contrôles bas (vue globe + rotation) avec les
 * flèches pour sauter d'artiste en artiste dans le lieu. Le pin se déplace
 * sur la carte, sans quitter le globe. Pas de stats ni de carrousel.
 */
export function PlacePanel({ place, index, onJump, onSelect, onClose }: PlacePanelProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(), []);
  const artists = place.artists;
  const count = artists.length;
  const current = artists[index] ?? artists[0];

  // SECONDE garde : la navigation ne peut pas sortir de la zone. Même si un
  // artiste mal géolocalisé échappait au filtre du cluster, la flèche le saute
  // au lieu d'y voler — l'utilisateur ne se retrouve jamais téléporté à
  // 3 500 km au milieu d'un parcours dans un même lieu.
  const jump = (dir: 1 | -1) => {
    if (count === 0) return;
    onJump(nextIndexWithinPlace(artists, index, dir));
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 170 + insets.bottom }]}>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('place.prev')}
          hitSlop={8}
          onPress={() => jump(-1)}
          style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={18} color={glass.pinInkInverse} />
        </Pressable>

        {/* Artiste COURANT en principal, lieu et position en secondaire —
            même hiérarchie que le web. Le panneau n'affichait que le lieu :
            on naviguait à l'aveugle sans savoir sur quel artiste on était. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${current?.name ?? place.name} — ${place.name}, ${index + 1}/${count}`}
          onPress={() => current && onSelect(current)}
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.name} numberOfLines={1}>
            {current?.name ?? place.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.flag}>{place.flag}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {place.name} · {t('place.position', { index: index + 1, count })}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('place.next')}
          hitSlop={8}
          onPress={() => jump(1)}
          style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-forward" size={18} color={glass.pinInkInverse} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('place.close')}
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={15} color={glass.glassInkSoft} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 40,
      alignItems: 'center',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: glass.glassBorder,
      backgroundColor: glass.glassSurface,
      paddingVertical: 6,
      paddingHorizontal: 8,
      maxWidth: '100%',
      ...shadow,
    },
    arrow: {
      width: mapUi.placeControlSize,
      height: mapUi.placeControlSize,
      borderRadius: mapUi.placeControlSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glass.glassControl,
    },
    copyBtn: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 1,
      paddingHorizontal: 12,
      paddingVertical: 4,
      minWidth: 0,
      flexShrink: 1,
    },
    flag: { fontSize: 12 },
    name: {
      fontFamily: fonts.bold,
      fontSize: 14,
      lineHeight: 18,
      color: glass.pinInkInverse,
      maxWidth: mapUi.pinLabelWidth,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: mapUi.pinLabelWidth,
    },
    meta: {
      fontFamily: fonts.medium,
      fontSize: 11,
      color: glass.glassInkSoft,
      flexShrink: 1,
    },
    closeBtn: {
      width: mapUi.placeControlSize,
      height: mapUi.placeControlSize,
      borderRadius: mapUi.placeControlSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 2,
    },
  });
}
