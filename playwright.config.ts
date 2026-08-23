import { defineConfig, devices } from '@playwright/test'

/**
 * Parcours critiques du web, joués contre le serveur Vite.
 *
 * Ces tests couvrent ce qu'un testeur fait dans ses deux premières minutes :
 * la landing s'affiche, la navigation mène quelque part, l'inscription et la
 * connexion se rendent et valident leurs champs, le globe se monte. Ils ne
 * créent aucun compte et n'écrivent rien en base — un test qui inscrirait un
 * utilisateur polluerait la production.
 */
export default defineConfig({
  testDir: './e2e',
  // Un échec en CI est un vrai échec : on ne le masque pas par des essais.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Le serveur de dev compile à la demande : sous deux projets en parallèle il
  // rend des pages à moitié prêtes et les tests deviennent instables. On vise
  // donc l'aperçu du build — déterministe, et c'est l'artefact réellement livré
  // (balises de partage gravées comprises).
  use: {
    baseURL: 'http://localhost:4173',
    // Trace et capture uniquement sur échec : de quoi diagnostiquer sans
    // alourdir chaque exécution.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    // Le trafic de Musimaps est majoritairement mobile : la landing et le
    // globe doivent tenir sur un petit écran, pas seulement en 1280 px.
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // `test:e2e` suppose un `npm run build:web` déjà passé — c'est le cas dans
    // `npm run check`, où le build précède les tests.
    command: 'npm run preview --workspace @musimaps/web -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
