import { StyleSheet, Text, View } from 'react-native';
import { fonts, type AppColors } from '../theme';

/**
 * Graphiques légers pour mobile — construits en Views pures (pas de SVG
 * requis), cohérents avec le design system : lime #A8FF35 / bleu #2F52E0.
 */

export interface ChartDatum {
  label: string;
  value: number;
  sub?: string;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace('.', ',')} k`;
  return String(n);
}

/** -------------------------------------------------------------
 * HBarList — barres horizontales (ex. top pays, top artistes).
 * ------------------------------------------------------------- */
export function HBarList({
  data,
  colors,
  format = compact,
  max,
}: {
  data: ChartDatum[];
  colors: AppColors;
  format?: (v: number) => string;
  max?: number;
}) {
  const peak = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.hList}>
      {data.map((d, i) => {
        const isMax = d.value === peak && peak > 1;
        const width = Math.max(1, Math.round((d.value / peak) * 100));
        return (
          <View key={`${d.label}-${i}`}>
            <View style={styles.hLabelRow}>
              <Text numberOfLines={1} style={[styles.hLabel, { color: colors.ink }]}>
                {d.label}
              </Text>
              <Text style={[styles.hValue, { color: colors.inkSoft }]}>
                {format(d.value)}
                {d.sub ? ` · ${d.sub}` : ''}
              </Text>
            </View>
            <View style={[styles.hTrack, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[
                  styles.hFill,
                  {
                    width: `${width}%`,
                    backgroundColor: isMax ? colors.brand : colors.brandDeep,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** -------------------------------------------------------------
 * BarChart — histogramme vertical (ex. vues des 14 derniers jours).
 * ------------------------------------------------------------- */
export function BarChart({
  data,
  colors,
  height = 120,
}: {
  data: ChartDatum[];
  colors: AppColors;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={[styles.barRow, { height }]}>
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 6 : 2, Math.round((d.value / max) * 100));
        const isMax = d.value === max && max > 1;
        return (
          <View key={`${d.label}-${i}`} style={styles.barCol}>
            <View style={styles.barSlot}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${h}%`,
                    backgroundColor: isMax ? colors.brand : colors.brandDeep,
                    opacity: d.value > 0 ? 1 : 0.3,
                  },
                ]}
              />
            </View>
            <Text numberOfLines={1} style={[styles.barLabel, { color: colors.inkSoft }]}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** -------------------------------------------------------------
 * SegmentedBar — répartition empilée (alternative au donut).
 * ------------------------------------------------------------- */
export function SegmentedBar({
  segments,
  colors,
}: {
  segments: { label: string; value: number; color: string }[];
  colors: AppColors;
}) {
  const total = Math.max(segments.reduce((s, x) => s + x.value, 0), 1);
  return (
    <View>
      <View style={[styles.segTrack, { backgroundColor: colors.surfaceMuted }]}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <View
              key={s.label}
              style={{ flex: s.value / total, backgroundColor: s.color }}
            />
          ))}
      </View>
      <View style={styles.segLegend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.segItem}>
            <View style={[styles.segDot, { backgroundColor: s.color }]} />
            <Text numberOfLines={1} style={[styles.segText, { color: colors.inkSoft }]}>
              {s.label}
            </Text>
            <Text style={[styles.segValue, { color: colors.ink }]}>{compact(s.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** -------------------------------------------------------------
 * ChartCard — conteneur de carte cohérent pour les graphiques.
 * ------------------------------------------------------------- */
export function ChartCard({
  title,
  subtitle,
  colors,
  children,
}: {
  title: string;
  subtitle?: string;
  colors: AppColors;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Text style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.cardSub, { color: colors.inkSoft }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15 },
  cardSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  cardBody: { marginTop: 14 },
  hList: { gap: 12 },
  hLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 },
  hLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13 },
  hValue: { fontFamily: fonts.medium, fontSize: 12 },
  hTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  hFill: { height: '100%', borderRadius: 4 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barSlot: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 3, minHeight: 2 },
  barLabel: { fontFamily: fonts.body, fontSize: 9, maxWidth: '100%' },
  segTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  segLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  segItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 90 },
  segDot: { width: 9, height: 9, borderRadius: 5 },
  segText: { flex: 1, fontFamily: fonts.body, fontSize: 12 },
  segValue: { fontFamily: fonts.bold, fontSize: 12 },
});
