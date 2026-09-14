import { useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PROFILE_MEDIA, profileCoverHeight, profileInitials, radii } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme';

function useMediaFailed(image?: string | null) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return [failed, () => setFailed(true)] as const;
}

export function AccountCover({ image, children, height }: { image?: string | null; children?: ReactNode; height?: number }) {
  const [failed, fail] = useMediaFailed(image);
  const [measured, setMeasured] = useState<number | null>(null);
  const resolved = height ?? measured ?? PROFILE_MEDIA.coverMaxHeight;
  return (
    // Yoga can shrink width when aspectRatio and maxHeight are combined.
    // Keep the parent's full width and derive only height from that measurement.
    <View testID="account-cover" onLayout={({ nativeEvent }) => setMeasured(profileCoverHeight(nativeEvent.layout.width))} style={[styles.cover, { height: resolved }]}>
      <LinearGradient colors={PROFILE_MEDIA.fallbackCoverColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {image && !failed && <Image key={image} source={{ uri: image }} onError={fail} resizeMode="cover" style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

export function AccountAvatar({ name, image, variant = 'profile' }: {
  name: string; image?: string | null; variant?: keyof typeof PROFILE_MEDIA.avatarSize
}) {
  const { colors } = useAppTheme();
  const [failed, fail] = useMediaFailed(image);
  const size = PROFILE_MEDIA.avatarSize[variant];
  return (
    <View testID="account-avatar" style={[styles.avatar, { width: size, height: size, borderColor: colors.surface }]}>
      <LinearGradient colors={PROFILE_MEDIA.fallbackAvatarColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {image && !failed ? <Image key={image} source={{ uri: image }} accessibilityLabel={name} onError={fail} resizeMode="cover" style={StyleSheet.absoluteFill} />
        : <Text accessibilityLabel={name} style={{ fontFamily: fonts.bold, color: PROFILE_MEDIA.avatarTextColor, fontSize: size * PROFILE_MEDIA.initialsScale }}>{profileInitials(name)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', overflow: 'hidden' },
  avatar: { borderRadius: radii.full, borderWidth: PROFILE_MEDIA.avatarBorder, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
