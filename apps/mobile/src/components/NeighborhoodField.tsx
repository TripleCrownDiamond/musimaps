import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { searchNeighborhoods, type NeighborhoodSuggestion, radii, spacing } from '@musimaps/shared';
import { SearchablePicker, type PickerItem } from './SearchablePicker';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, type AppColors } from '../theme';

/** Champ quartier avec suggestions Mapbox, cohérent avec la recherche de ville. */
export function NeighborhoodField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string, suggestion?: NeighborhoodSuggestion) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PickerItem[]>([]);
  const [suggestions, setSuggestions] = useState<NeighborhoodSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchNeighborhoods(q).then((results) => {
        if (cancelled) return;
        setSuggestions(results);
        setItems(results.map((result, index) => ({
          key: `${result.lng},${result.lat},${result.name},${index}`,
          label: result.name,
          sublabel: [result.city, result.country].filter(Boolean).join(', ') || undefined,
          value: result.name,
        })));
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.field}
        onPress={() => {
          setQuery(value);
          setOpen(true);
        }}
      >
        <View style={styles.copy}>
          <Ionicons name="navigate-outline" size={18} color={colors.inkSoft} />
          <Text numberOfLines={1} style={value ? styles.value : styles.placeholder}>
            {value || t('join.districtPlaceholder')}
          </Text>
        </View>
        <Ionicons name="search-outline" size={20} color={colors.inkSoft} />
      </Pressable>
      <SearchablePicker
        visible={open}
        onClose={() => setOpen(false)}
        title={t('join.district')}
        placeholder={t('location.searchNeighborhood')}
        query={query}
        onQueryChange={setQuery}
        items={items}
        loading={loading}
        emptyText={query.trim().length < 2 ? t('location.typeMin2') : t('location.noNeighborhood')}
        onSelect={(item) => {
          const selected = suggestions.find((result, index) => `${result.lng},${result.lat},${result.name},${index}` === item.key);
          onChange(item.value ?? item.label, selected);
          setOpen(false);
          setQuery('');
        }}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: { gap: spacing.xs },
  field: {
    minHeight: 59,
    borderRadius: radii['2xl'],
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  value: { color: colors.ink, fontFamily: fonts.body, fontSize: 16 },
  placeholder: { color: colors.muted, fontFamily: fonts.body, fontSize: 16 },
});
