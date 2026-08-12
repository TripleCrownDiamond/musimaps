/**
 * Champ de saisie — primitive du socle mobile.
 *
 * Reflète `components/ui/input.tsx` côté web : même hauteur perçue, même
 * rayon, même traitement de l'état d'erreur. Les écrans écrivaient chacun
 * leur `TextInput` avec bordures et couleurs en dur.
 */
import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { radii, spacing } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme';

export interface InputProps extends TextInputProps {
  /** Passe la bordure en rouge et signale l'erreur à l'accessibilité. */
  invalid?: boolean;
  /** Élément posé à gauche (icône). */
  leading?: React.ReactNode;
  /** Élément posé à droite (bouton œil, unité…). */
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { invalid = false, leading, trailing, containerStyle, style, ...props },
  ref,
) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: invalid ? colors.danger : colors.line,
        },
        containerStyle,
      ]}
    >
      {leading}
      <TextInput
        ref={ref}
        accessibilityState={{ disabled: props.editable === false }}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.ink }, style]}
        {...props}
      />
      {trailing}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
});
