import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { fonts, shadow, type AppColors } from '../theme';

export interface PickerItem {
  key: string;
  label: string;
  /** Valeur à enregistrer (ex. la ville seule, sans le pays affiché). */
  value?: string;
  sublabel?: string;
  emoji?: string;
}

/**
 * Sélecteur à recherche (bottom-sheet) — pays, ville… Le parent fournit la
 * requête (query/onQueryChange), les éléments filtrés (items) et l'état de
 * chargement (loading). Réutilisé par l'inscription et l'édition de profil.
 */
export function SearchablePicker({
  visible,
  onClose,
  title,
  placeholder,
  query,
  onQueryChange,
  items,
  loading = false,
  emptyText,
  onSelect,
  closeAria,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  query: string;
  onQueryChange: (q: string) => void;
  items: PickerItem[];
  loading?: boolean;
  emptyText: string;
  onSelect: (item: PickerItem) => void;
  closeAria?: string;
}) {
  const { colors, theme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accent = theme === 'dark' ? colors.brand : colors.brandDeep;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalRoot}
      >
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable
              accessibilityLabel={closeAria ?? 'Fermer'}
              style={styles.back}
              onPress={onClose}
            >
              <Ionicons name="chevron-back" size={28} color={colors.ink} />
            </Pressable>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <View style={styles.backSpacer} />
          </View>

          <View
            style={[
              styles.inputWrap,
              query.length > 0 && { borderWidth: 1.5, borderColor: accent },
            ]}
          >
            <Ionicons name="search-outline" size={24} color={colors.ink} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={onQueryChange}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              underlineColorAndroid="transparent"
              style={styles.input}
            />
            {query.length > 0 && (
              <Pressable accessibilityLabel="Effacer" onPress={() => onQueryChange('')}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.list}
            contentContainerStyle={items.length === 0 ? styles.listEmpty : undefined}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelect(item)}>
                {item.emoji ? (
                  <Text style={styles.emoji}>{item.emoji}</Text>
                ) : (
                  <Ionicons name="navigate-outline" size={22} color={colors.inkSoft} />
                )}
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.rowLabel}>
                    {item.label}
                  </Text>
                  {item.sublabel ? (
                    <Text numberOfLines={1} style={styles.rowSublabel}>
                      {item.sublabel}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator color={accent} style={styles.loader} />
              ) : (
                <Text style={styles.empty}>{emptyText}</Text>
              )
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'flex-end' },
    dismiss: { flex: 1 },
    sheet: {
      height: '72%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      paddingHorizontal: 20,
      paddingBottom: 18,
      ...shadow,
    },
    handle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: '#BAC5D2',
      alignSelf: 'center',
      marginTop: 9,
      marginBottom: 8,
    },
    header: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    back: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    backSpacer: { width: 54 },
    title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 22, flex: 1, textAlign: 'center', paddingHorizontal: 8 },
    inputWrap: {
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.surface,
      marginTop: 16,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    input: { flex: 1, color: colors.ink, fontFamily: fonts.body, fontSize: 17, borderWidth: 0, outlineWidth: 0 },
    list: { marginTop: 10 },
    listEmpty: { flexGrow: 1, justifyContent: 'center' },
    row: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      paddingHorizontal: 4,
    },
    emoji: { fontSize: 22, color: colors.ink },
    rowCopy: { flex: 1 },
    rowLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: 16 },
    rowSublabel: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
    empty: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 14, textAlign: 'center', marginTop: 24 },
    loader: { marginTop: 24 },
  });
