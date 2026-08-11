import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Explore: {
    artistId?: string;
    city?: string;
    coordinates?: [longitude: number, latitude: number];
    searchKey?: number;
    /** La localisation a déjà été tranchée (écran Welcome) : ne pas re-demander. */
    skipLocation?: boolean;
  } | undefined;
  Search: undefined;
  Saved: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Start: undefined;
  Onboarding: undefined;
  Welcome: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ProfileEdit: { fromStart?: boolean } | undefined;
  ArtistJoin: {
    /** Pré-remplissage depuis Musibrainz (artiste sans localisation). */
    artistName?: string;
    genre?: string;
    bio?: string;
  } | undefined;
  Badges: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  Dashboard: undefined;
  Notifications: undefined;
};
