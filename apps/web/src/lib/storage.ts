/**
 * Adaptateur de stockage web — enveloppe `localStorage` dans l'interface
 * asynchrone attendue par `@musimaps/shared`.
 *
 * Les accès sont protégés : en navigation privée ou avec les cookies tiers
 * bloqués, `localStorage` peut lever à la lecture comme à l'écriture. Un
 * échec ne doit jamais faire tomber un écran.
 */
import type { Storage } from '@musimaps/shared'

export const webStorage: Storage = {
  async get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* quota atteint ou stockage refusé */
    }
  },
  async remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* silencieux */
    }
  },
}
