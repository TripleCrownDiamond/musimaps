import { defineConfig } from 'vitest/config'

/**
 * Tests unitaires du monorepo.
 *
 * Ils ne visent que `packages/shared` : c'est là que vit la logique produit
 * commune aux deux surfaces, et elle est pure — ni DOM, ni réseau, ni base.
 * Le web est couvert par Playwright (`npm run test:e2e`) ; les écrans mobiles
 * restent à couvrir.
 */
export default defineConfig({
  test: {
    include: ['packages/shared/src/**/*.test.ts'],
    environment: 'node',
    // Un test unitaire qui dépasse la seconde cache un appel réseau.
    testTimeout: 5_000,
  },
})
