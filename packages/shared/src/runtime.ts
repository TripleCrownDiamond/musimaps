/**
 * Socle d'exécution partagé — le seul endroit où le code commun touche à
 * quelque chose de spécifique à une plateforme.
 *
 * `packages/shared` reste du TypeScript pur : il ne connaît ni `localStorage`
 * (web) ni `AsyncStorage` (mobile), ni la façon dont chaque app lit ses
 * variables d'environnement. Chaque app injecte ce qu'il faut au démarrage :
 *
 *   // apps/web/src/main.tsx
 *   configureRuntime({ supabase, storage: webStorage })
 *
 *   // apps/mobile/App.tsx
 *   configureRuntime({ supabase, storage: nativeStorage })
 *
 * Voir docs/REGLES-EVOLUTION.md.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Stockage clé/valeur persistant. Volontairement **asynchrone** : c'est le
 * plus petit dénominateur commun entre `localStorage` (synchrone) et
 * `AsyncStorage` (asynchrone). Le web enveloppe simplement ses appels.
 */
export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Stockage de repli : en mémoire, le temps de la session. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    async get(k) {
      return map.get(k) ?? null;
    },
    async set(k, v) {
      map.set(k, v);
    },
    async remove(k) {
      map.delete(k);
    },
  };
}

let client: SupabaseClient | null = null;
let storage: Storage = memoryStorage();
let resetPasswordUrl = '';
let configured = false;

export interface RuntimeConfig {
  /** Client Supabase, ou `null` si les clés ne sont pas fournies. */
  supabase: SupabaseClient | null;
  storage: Storage;
  /**
   * Cible du lien de réinitialisation de mot de passe. Réellement
   * spécifique à la plateforme : une URL HTTP côté web
   * (`https://…/reset-password`), un deep link côté mobile
   * (`musimaps://reset-password`).
   */
  resetPasswordUrl?: string;
}

/** À appeler UNE fois au démarrage de chaque app, avant tout rendu. */
export function configureRuntime(config: RuntimeConfig): void {
  client = config.supabase;
  storage = config.storage;
  resetPasswordUrl = config.resetPasswordUrl ?? '';
  configured = true;
}

/** Cible du lien de réinitialisation, injectée par l'app. */
export function getResetPasswordUrl(): string {
  return resetPasswordUrl;
}

/** Le client Supabase, ou `null` si l'app n'est pas configurée. */
export function getSupabase(): SupabaseClient | null {
  return client;
}

/**
 * Vrai si un client Supabase est disponible.
 *
 * Note : côté web `hasSupabase` était une fonction, côté mobile une
 * constante booléenne. C'est une fonction ici — une constante serait figée
 * à l'import, avant `configureRuntime`.
 */
export function hasSupabase(): boolean {
  return client !== null;
}

/** Le stockage injecté. Repli en mémoire si `configureRuntime` n'a pas été appelé. */
export function getStorage(): Storage {
  return storage;
}

/** Utile en test / diagnostic. */
export function isRuntimeConfigured(): boolean {
  return configured;
}

/**
 * Lit une valeur JSON typée, avec repli silencieux : un stockage indisponible
 * ou une valeur corrompue ne doit jamais faire planter un écran.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await storage.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Écrit une valeur JSON, en ignorant l'échec (stockage plein ou refusé). */
export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await storage.set(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : la donnée vit en mémoire pour la session */
  }
}
