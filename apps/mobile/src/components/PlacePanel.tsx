import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapUi, type Artist } from '@musimaps/shared';
import { useI18n } from '../i18n';
import { fonts, shadow } from '../theme';

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

  const jump = (dir: number) => {
    if (count === 0) return;
    onJump((index + dir + count) % count);
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
          <Ionicons name="chevron-back" size={18} color="#ffffff" />
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
          <Ionicons name="chevron-forward" size={18} color="#ffffff" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('place.close')}
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
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
      borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'rgba(0,0,0,0.45)',
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
      backgroundColor: 'rgba(255,255,255,0.10)',
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
      color: '#ffffff',
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
      color: 'rgba(255,255,255,0.70)',
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
