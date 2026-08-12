/**
 * Champ mot de passe avec bascule d'affichage.
 *
 * Le couple `TextInput` + bouton œil était recopié dans Login, Signup et
 * ResetPassword (deux fois) — à chaque fois avec ses propres styles de
 * bordure et son propre `eyeButton`.
 */
import { useState } from 'react';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { Input, type InputProps } from './Input';

type PasswordInputProps = Omit<InputProps, 'secureTextEntry' | 'trailing'>;

export function PasswordInput(props: PasswordInputProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          hitSlop={8}
          onPress={() => setVisible((v) => !v)}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={23}
            color={colors.inkSoft}
          />
        </Pressable>
      }
    />
  );
}
