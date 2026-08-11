import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Bell,
  Bookmark,
  Camera,
  Compass,
  Disc3,
  Earth,
  Flame,
  Gem,
  Globe,
  Headphones,
  Heart,
  Layers,
  MapPin,
  Mic2,
  Music,
  Music2,
  Navigation,
  Palette,
  PartyPopper,
  Plane,
  Radio,
  Search,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Users,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../components/Brand';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fetchCmsOnboarding, type CmsOnboardingSlide } from '../lib/onboarding';
import type { RootStackParamList } from '../navigation/types';
import { fonts, shadow, type AppColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export const ONBOARDING_SEEN_KEY = 'musimaps.mobile.onboarding-seen';

/**
 * Icônes lucide disponibles dans l'onboarding — mêmes noms que la grille de
 * l'admin web (lucide-react). Inconnue → repli Sparkles.
 */
const ICONS: Record<string, LucideIcon> = {
  Bell,
  Bookmark,
  Camera,
  Compass,
  Disc3,
  Earth,
  Flame,
  Gem,
  Globe,
  Headphones,
  Heart,
  Layers,
  MapPin,
  Mic2,
  Music,
  Music2,
  Navigation,
  Palette,
  PartyPopper,
  Plane,
  Radio,
  Search,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Users,
  Zap,
};

/** Icônes par défaut des 4 slides (si le CMS n'a rien publié). */
const DEFAULT_ICONS = ['Globe', 'Search', 'Heart', 'Trophy'];

interface SlideView {
  icon: LucideIcon;
  chip: string;
  title: string;
  text: string;
}

/**
 * Onboarding : aperçu des fonctions (globe, recherche, favoris, gamification)
 * avant l'autorisation de localisation. S'affiche uniquement au premier
 * lancement. Le contenu (icônes + textes) est piloté par l'admin web (clé
 * 'onboarding'), avec repli sur les textes i18n locaux si rien n'est publié.
 */
export function OnboardingScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [cmsSlides, setCmsSlides] = useState<CmsOnboardingSlide[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCmsOnboarding(lang)
      .then((slides) => {
        if (alive) setCmsSlides(slides);
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
        : [
            { icon: 'Globe', chip: t('onb.1.chip'), title: t('onb.1.title'), text: t('onb.1.text') },
            { icon: 'Search', chip: t('onb.2.chip'), title: t('onb.2.title'), text: t('onb.2.text') },
            { icon: 'Heart', chip: t('onb.3.chip'), title: t('onb.3.title'), text: t('onb.3.text') },
            { icon: 'Trophy', chip: t('onb.4.chip'), title: t('onb.4.title'), text: t('onb.4.text') },
          ];
    return source.map((slide, i) => ({
      icon: ICONS[slide.icon] ?? ICONS[DEFAULT_ICONS[i] ?? 'Sparkles'] ?? Sparkles,
      chip: slide.chip,
      title: slide.title,
      text: slide.text,
    }));
  }, [cmsSlides, t]);

  const isLast = index === slides.length - 1;
  const styles = createStyles(colors);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  // Suit le défilement en continu (fiable sur web ET natif) pour synchroniser
  // les dots même si onMomentumScrollEnd ne se déclenche pas.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex((current) => (next === current ? current : next));
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    const target = clamped * width;
    // Natif : le ScrollView défile via scrollTo.
    scrollRef.current?.scrollTo({ x: target, animated: true });
    // react-native-web 0.21 : la ref EST le nœud DOM mais son scrollTo patché
    // ne scrolle pas (branche dépréciée). On force scrollLeft directement.
    type ScrollableLike = { scrollLeft?: number; getScrollableNode?: () => ScrollableLike | null };
    const raw = scrollRef.current as unknown as ScrollableLike | null;
    const scrollNode =
      raw && typeof raw.scrollLeft === 'number'
        ? raw
        : (raw?.getScrollableNode?.() ?? null);
    if (scrollNode && typeof scrollNode.scrollLeft === 'number') {
      scrollNode.scrollLeft = target;
    }
    setIndex(clamped);
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true').catch(() => {});
    navigation.replace('Welcome');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {/* Icône Musimaps seule — blanche en sombre / bleue en clair,
            même rendu que le globe et l'AppBar. */}
        <BrandMark size={42} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('onb.skipAria')} onPress={finish}>
          <Text style={styles.skip}>{t('onb.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide, slideIndex) => (
          <View key={slideIndex} style={[styles.page, { width }]}>
            <View style={styles.center}>
              <View style={styles.iconTile}>
                <slide.icon size={56} color="#111111" strokeWidth={1.6} />
              </View>
              <View style={styles.chip}>
                <View style={styles.chipDot} />
                <Text style={styles.chipText}>{slide.chip}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.text}>{slide.text}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {slides.map((_, dotIndex) => (
            <Pressable
              key={dotIndex}
              accessibilityRole="button"
              accessibilityLabel={`Aller à la slide ${dotIndex + 1}`}
              hitSlop={10}
              onPress={() => goTo(dotIndex)}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
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

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingBottom: 4,
    },

    skip: {
      color: colors.inkSoft,
      fontFamily: fonts.bold,
      fontSize: 15,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    page: { flex: 1, paddingHorizontal: 26 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 72,
    },
    iconTile: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 28,
      borderRadius: 20,
      backgroundColor: colors.surface,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: colors.line,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandDeep },
    chipText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    copy: { marginTop: 22, alignItems: 'center' },
    title: {
      color: colors.ink,
      fontFamily: fonts.displayBlack,
      fontSize: 27,
      lineHeight: 33,
      letterSpacing: -1.1,
      textAlign: 'center',
    },
    text: {
      color: colors.inkSoft,
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
      marginTop: 12,
    },
    footer: { paddingHorizontal: 22, gap: 18 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
    dotActive: { width: 26, backgroundColor: colors.brandDeep },
    next: {
      minHeight: 62,
      borderRadius: 31,
      backgroundColor: colors.brandDeep,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    nextPressed: { opacity: 0.8 },
    nextText: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  });
