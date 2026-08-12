import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { radii, spacing, waitlistPositionFor } from '@musimaps/shared';
import { Share, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { fonts } from '../theme';
import { Button, Card, Section } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmation'>;

const SHARE_URL = 'https://musimaps.app';

export function ConfirmationScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { email, profile } = route.params;
  const isArtist = profile === 'artiste';
  const position = waitlistPositionFor(email);

  const explore = () =>
    navigation.navigate('Main', {
      screen: 'Explore',
      params: { skipLocation: true },
    });

  const continueAccount = () => {
    if (user) navigation.navigate('Dashboard');
    else navigation.navigate('Signup', { role: isArtist ? 'artist' : 'melomane', email });
  };

  const share = async () => {
    await Share.share({
      title: 'Musimaps',
      message: `${t('confirm.shareTitle')} — ${SHARE_URL}`,
      url: SHARE_URL,
    }).catch(() => undefined);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.badge,
            { backgroundColor: isArtist ? colors.brandSoft : colors.surfaceMuted },
          ]}
        >
          <Ionicons
            name={isArtist ? 'mic' : 'headset'}
            size={17}
            color={colors.brandPrimary}
          />
          <Text style={[styles.badgeText, { color: colors.brandPrimary }]}>
            {isArtist ? t('confirm.badgeArtist') : t('confirm.badgeMelomane')}
          </Text>
        </View>

        <View
          style={[
            styles.check,
            { backgroundColor: isArtist ? colors.brandSoft : colors.brandSecondary },
          ]}
        >
          <Ionicons name="checkmark-circle" size={58} color={colors.brandPrimary} />
        </View>

        <View style={styles.heroCopy}>
          <Text style={[styles.title, { color: colors.ink }]}>
            {isArtist ? t('confirm.headingArtist') : t('confirm.headingMelomane')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
            {isArtist ? t('confirm.descArtist') : t('confirm.descMelomane')}
          </Text>
        </View>

        <Card style={styles.summary}>
          <Text style={[styles.eyebrow, { color: colors.inkSoft }]}>
            {t('confirm.savedFor')}
          </Text>
          <Text selectable style={[styles.email, { color: colors.ink }]}>
            {email}
          </Text>
          <Text style={[styles.position, { color: colors.inkSoft }]}>
            {t('confirm.positionPrefix')} <Text style={{ color: colors.ink }}>{position}</Text>{' '}
            {t('confirm.positionSuffix')}
          </Text>
          {isArtist ? (
            <View style={[styles.tip, { backgroundColor: colors.brandSoft }]}>
              <Text style={[styles.tipText, { color: colors.brandPrimary }]}>
                {t('confirm.tipArtist')}
              </Text>
            </View>
          ) : null}

          {!loading ? (
            <>
              <Text style={[styles.ctaText, { color: colors.ink }]}>
                {user
                  ? t('confirm.alreadyAccount')
                  : isArtist
                    ? t('confirm.ctaArtist')
                    : t('confirm.ctaMelomane')}
              </Text>
              <Button
                block
                size="lg"
                label={
                  user
                    ? t('confirm.viewProfile')
                    : isArtist
                      ? t('confirm.createArtist')
                      : t('confirm.createMelomane')
                }
                onPress={continueAccount}
              />
            </>
          ) : null}
          <Button block size="lg" variant="outline" label={t('confirm.explore')} onPress={explore} />
        </Card>

        <Section title={isArtist ? t('confirm.stepsArtist') : t('confirm.meanwhile')}>
          <Pressable accessibilityRole="button" onPress={explore}>
            <Card style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name="earth" size={25} color={colors.brandPrimary} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: colors.ink }]}>
                  {isArtist ? t('confirm.card1ArtistTitle') : t('confirm.exploreTitle')}
                </Text>
                <Text style={[styles.actionText, { color: colors.inkSoft }]}>
                  {isArtist ? t('confirm.card1ArtistText') : t('confirm.card1MelomaneText')}
                </Text>
              </View>
            </Card>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              isArtist
                ? continueAccount()
                : navigation.navigate('ArtistJoin')
            }
          >
            <Card style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name="person" size={25} color={colors.brandPrimary} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: colors.ink }]}>
                  {isArtist ? t('confirm.card2ArtistTitle') : t('confirm.card2MelomaneTitle')}
                </Text>
                <Text style={[styles.actionText, { color: colors.inkSoft }]}>
                  {isArtist ? t('confirm.card2ArtistText') : t('confirm.card2MelomaneText')}
                </Text>
              </View>
            </Card>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => void share()}>
            <Card style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name="share-social" size={25} color={colors.brandPrimary} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: colors.ink }]}>
                  {t('confirm.shareTitle')}
                </Text>
                <Text style={[styles.actionText, { color: colors.inkSoft }]}>
                  {isArtist ? t('confirm.shareArtistText') : t('confirm.shareText')}
                </Text>
              </View>
            </Card>
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing['2xl'], gap: spacing['2xl'] },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 },
  check: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { alignItems: 'center', gap: spacing.md },
  title: { fontFamily: fonts.displayBlack, fontSize: 34, letterSpacing: -1, textAlign: 'center' },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  summary: { alignItems: 'center' },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 },
  email: { fontFamily: fonts.medium, fontSize: 17, textAlign: 'center' },
  position: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  tip: { alignSelf: 'stretch', borderRadius: radii['2xl'], padding: spacing.md },
  tipText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  ctaText: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  actionCard: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: radii['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: spacing.xs },
  actionTitle: { fontFamily: fonts.display, fontSize: 17 },
  actionText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
