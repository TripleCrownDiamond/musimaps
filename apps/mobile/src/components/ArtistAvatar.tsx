import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text } from 'react-native';
import type { Artist } from '@musimaps/shared';
import { colors, fonts } from '../theme';

export function ArtistAvatar({
  artist,
  size = 56,
  rounded = true,
  gradient,
  initialsColor = colors.white,
  borderless = false,
}: {
  artist: Artist;
  size?: number;
  rounded?: boolean;
  /** Dégradé d'initiales (défaut : les couleurs de l'artiste). */
  gradient?: [string, string];
  /** Couleur des initiales (défaut : blanc). */
  initialsColor?: string;
  /** Supprime la bordure blanche (parité avec l'avatar du web). */
  borderless?: boolean;
}) {
  const borderRadius = rounded ? size / 2 : Math.min(26, size * 0.24);
  // Bordure PROPORTIONNELLE au diamètre. Elle valait 3 px quelle que soit la
  // taille : sur un pin de carte dézoomé (9 à 14 px), 3 px de chaque côté
  // mangeaient la moitié du disque — le pin ne se lisait plus comme un rond
  // mais comme un anneau blanc épais et déformé.
  const borderWidth = borderless ? 0 : Math.max(1, Math.min(3, Math.round(size * 0.085)));
  const borderColor = borderless ? 'transparent' : colors.white;

  // Photo HD (Wikipedia / Wikidata) quand elle existe — sinon dégradé + initiales.
  if (artist.image) {
    return (
      <Image
        source={{ uri: artist.image }}
        style={{
          width: size,
          height: size,
          borderRadius,
          borderWidth,
          borderColor,
          backgroundColor: colors.surfaceMuted,
        }}
      />
    );
  }

  const initials = artist.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <LinearGradient
      colors={gradient ?? artist.color}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius,
          borderWidth,
          borderColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.3, color: initialsColor }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    // Pas de borderWidth ici : il est calculé selon la taille et passé en
    // style inline. Le laisser à 3 px faisait un socle que l'inline devait
    // systématiquement écraser.
    borderColor: colors.white,
  },
  initials: { fontFamily: fonts.displayBlack, letterSpacing: -1 },
});
