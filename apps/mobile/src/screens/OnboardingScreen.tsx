import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ONBOARDING_ARTWORK, onboardingArtwork, onboardingTitleParts, onboardingTokens, radii, spacing, type OnboardingArtworkId } from '@musimaps/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../components/Brand';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fetchCmsOnboarding, type CmsOnboardingSlide } from '../lib/onboarding';
import type { RootStackParamList } from '../navigation/types';
import { fonts, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export const ONBOARDING_SEEN_KEY = 'musimaps.mobile.onboarding-seen';

// Static requires bundle the artwork on native and in the Expo Web preview.
const ARTWORK: Record<OnboardingArtworkId, ImageSourcePropType> = {
  globe: require('@musimaps/shared/assets/onboarding/globe.png'),
  search: require('@musimaps/shared/assets/onboarding/search.png'),
  favorites: require('@musimaps/shared/assets/onboarding/favorites.png'),
  rewards: require('@musimaps/shared/assets/onboarding/rewards.png'),
};

interface SlideView {
  artwork: OnboardingArtworkId;
  image?: string;
  chip: string;
  title: string;
  accent: string;
  text: string;
}

function Artwork({ slide }: { slide: SlideView }) {
  const [failedUri, setFailedUri] = useState<string>();
  const remote = slide.image && slide.image !== failedUri;
  return <Image source={remote ? { uri: slide.image! } : ARTWORK[slide.artwork]}
    onError={() => setFailedUri(slide.image)} resizeMode="contain"
    style={{ width: '100%', height: '100%' }} accessible={false}
    importantForAccessibility="no" fadeDuration={0} />;
}

/**
 * Onboarding : aperçu des fonctions (globe, recherche, favoris, gamification)
 * avant l'autorisation de localisation. S'affiche uniquement au premier
 * lancement. Illustrations embarquées, textes et remplacements d'images
 * pilotés par le CMS, avec repli i18n et images locales hors ligne.
 */
export function OnboardingScreen({ navigation }: Props) {
  const { colors, theme } = useAppTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const interactedRef = useRef(false);
  const finishingRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [cmsSlides, setCmsSlides] = useState<CmsOnboardingSlide[] | null>(null);

  useEffect(() => {
    let alive = true;
    setCmsSlides(null);
    fetchCmsOnboarding(lang)
      .then((slides) => {
        if (alive && !interactedRef.current) setCmsSlides(slides);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  const slides: SlideView[] = useMemo(() => {
    const source: CmsOnboardingSlide[] =
      cmsSlides && cmsSlides.length > 0
        ? cmsSlides
        : ONBOARDING_ARTWORK.map((item) => ({ icon: item.icon, chip: t(item.chip), title: t(item.title), text: t(item.text) }));
    return source.map((slide, i) => {
      const artwork = onboardingArtwork(slide.icon, i);
      const title = slide.title || t(artwork.title);
      const parts = onboardingTitleParts(title, t(artwork.accent));
      return {
        artwork: artwork.id, image: slide.image,
        chip: slide.chip || t(artwork.chip), title: parts.lead, accent: parts.accent,
        text: slide.text || t(artwork.text),
      };
    });
  }, [cmsSlides, t]);

  const isLast = index === slides.length - 1;
  const compact = height <= onboardingTokens.compactHeight;
  const styles = createStyles(colors, theme, compact);
  const artworkSize = Math.min(width - spacing.lg * 2,
    height * (compact ? onboardingTokens.compactArtworkHeightRatio : onboardingTokens.artworkHeightRatio));

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: indexRef.current * width, animated: false });
  }, [width]);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    indexRef.current = next;
    setIndex(next);
  };

  // Suit le défilement en continu (fiable sur web ET natif) pour synchroniser
  // les dots même si onMomentumScrollEnd ne se déclenche pas.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    indexRef.current = next;
    setIndex((current) => (next === current ? current : next));
  };

  const goTo = (next: number) => {
    interactedRef.current = true;
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    const target = clamped * width;
    // Natif : le ScrollView défile via scrollTo. Suffisant, et sans risque.
    scrollRef.current?.scrollTo({ x: target, animated: true });

    // Contournement react-native-web UNIQUEMENT — et c'est tout l'enjeu de ce
    // garde : sur le web 0.21, la ref EST le nœud DOM mais son `scrollTo`
    // patché ne défile pas, il faut forcer `scrollLeft`.
    //
    // Ce bloc s'exécutait AUSSI en natif, où `getScrollableNode()` passe par
    // `findNodeHandle` — déprécié, et qui lève sous la Nouvelle Architecture
    // (activée par défaut depuis le SDK 57). L'exception remontait d'un
    // `onPress` sans capture : en build de production, l'app se fermait.
    // Le swipe, lui, n'appelle jamais ce chemin — d'où un plantage au seul
    // bouton « suivant ».
    if (Platform.OS === 'web') {
      type ScrollableLike = { scrollLeft?: number; getScrollableNode?: () => ScrollableLike | null };
      const raw = scrollRef.current as unknown as ScrollableLike | null;
      const scrollNode =
        raw && typeof raw.scrollLeft === 'number'
          ? raw
          : (raw?.getScrollableNode?.() ?? null);
      if (scrollNode && typeof scrollNode.scrollLeft === 'number') {
        scrollNode.scrollLeft = target;
      }
    }
    setIndex(clamped);
    indexRef.current = clamped;
  };

  const finish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
    navigation.replace('Welcome');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {/* Icône Musimaps seule — blanche en sombre / bleue en clair,
            même rendu que le globe et l'AppBar. */}
        <BrandMark size={42} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('onb.skipAria')} onPress={finish} style={styles.skipButton}>
          <Text style={styles.skip}>{t('onb.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={onScroll}
        onScrollBeginDrag={() => { interactedRef.current = true; }}
        scrollEventThrottle={16}
      >
        {slides.map((slide, slideIndex) => (
          <ScrollView key={slideIndex} style={{ width }} contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
            aria-hidden={slideIndex !== index}
            accessibilityElementsHidden={slideIndex !== index}
            importantForAccessibility={slideIndex === index ? 'auto' : 'no-hide-descendants'}
          >
              <View style={[styles.illustration, { width: artworkSize }]}>
                <Artwork slide={slide} />
              </View>
              <View style={styles.editorial}>
              <View style={styles.chip}>
                <View style={styles.chipDot} />
                <Text style={styles.chipText}>{slide.chip}</Text>
              </View>
              <View style={styles.copy}>
                <Text accessibilityRole="header" style={styles.title}>
                  {slide.title}{slide.accent ? '\n' : ''}<Text style={styles.titleAccent}>{slide.accent}</Text>
                </Text>
                <Text style={styles.text}>{slide.text}</Text>
              </View>
            </View>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {slides.map((_, dotIndex) => (
            <Pressable
              key={dotIndex}
              accessibilityRole="button"
              accessibilityLabel={t('onb.stepAria', { current: dotIndex + 1, total: slides.length })}
              accessibilityState={{ selected: dotIndex === index }}
              onPress={() => goTo(dotIndex)}
              style={styles.dotTarget}
            ><View style={[styles.dot, dotIndex === index && styles.dotActive]} /></Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}
          onPress={() => (isLast ? finish() : goTo(index + 1))}
        >
          <Text style={styles.nextText}>{isLast ? t('onb.start') : t('onb.next')}</Text>
          <Ionicons name={isLast ? 'sparkles' : 'arrow-forward'} size={21} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors, theme: 'light' | 'dark', compact: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xs,
    },

    skip: {
      color: colors.inkSoft,
      fontFamily: fonts.bold,
      fontSize: 15,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    skipButton: { minHeight: 44, justifyContent: 'center' },
    pager: { flex: 1 },
    page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    illustration: { aspectRatio: 1, maxWidth: 480 },
    editorial: { width: '100%', maxWidth: 480, alignItems: 'center', paddingTop: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      zIndex: 1,
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.line,
    },
    chipDot: { width: spacing.sm, height: spacing.sm, borderRadius: radii.full, backgroundColor: colors.brandPrimary },
    chipText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    copy: { marginTop: -spacing.lg, paddingTop: compact ? spacing['2xl'] : spacing['3xl'], paddingHorizontal: spacing.lg, paddingBottom: compact ? spacing.lg : spacing.xl, width: '100%', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii['3xl'], borderWidth: 1, borderColor: colors.line },
    title: {
      color: colors.ink,
      fontFamily: fonts.displayBlack,
      fontSize: compact ? 26 : 28,
      lineHeight: compact ? 30 : 32,
      letterSpacing: -1.1,
      textAlign: 'center',
    },
    titleAccent: { color: onboardingTokens.titleAccent[theme] },
    text: {
      color: colors.inkSoft,
      fontFamily: fonts.body,
      fontSize: compact ? 14 : 15,
      lineHeight: compact ? 20 : 22,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    footer: { paddingHorizontal: spacing.xl, width: '100%', maxWidth: 520, alignSelf: 'center' },
    dots: { flexDirection: 'row', justifyContent: 'center' },
    dotTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    dot: { width: spacing.sm, height: spacing.sm, borderRadius: radii.full, backgroundColor: colors.muted },
    dotActive: { width: spacing['2xl'], backgroundColor: colors.brandPrimary },
    next: {
      minHeight: 56,
      padding: spacing.md,
      borderRadius: radii.full,
      backgroundColor: colors.brandPrimary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    nextPressed: { opacity: 0.8 },
    nextText: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  });
