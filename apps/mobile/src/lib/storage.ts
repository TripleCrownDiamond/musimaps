/**
 * Adaptateur de stockage mobile — `AsyncStorage` dans l'interface attendue
 * par `@musimaps/shared`. Déjà asynchrone : il n'y a rien à envelopper, on
 * se contente de protéger les accès.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@musimaps/shared';

export const nativeStorage: Storage = {
  async get(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      /* stockage plein ou indisponible */
    }
  },
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* silencieux */
    }
  },
};
