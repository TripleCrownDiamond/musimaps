/**
 * Parcours critiques — ce qu'un testeur rencontre dans ses deux premières
 * minutes. Un échec ici doit bloquer une mise en production.
 *
 * Règle de ces tests : **aucune écriture**. Ils ne créent pas de compte, ne
 * sauvent pas de favori, n'envoient aucun formulaire — la base visée est la
 * production. Ce qui exige un compte relève des tests unitaires.
 */
import { expect, test } from '@playwright/test'

/** Erreurs console à ignorer : bruit d'environnement, pas régressions. */
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  // Le globe exige un jeton Mapbox, absent d'un poste de test.
  /mapbox/i,
  // Ressources tierces (polices, images CMS) hors de notre contrôle.
  /Failed to load resource/i,
]

test.describe('Landing', () => {
  test('se charge et affiche la marque', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Musimaps/i)
    await expect(page.locator('body')).toContainText(/Musimaps/i)
  })

  test('ne remonte aucune erreur console inattendue', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return
      errors.push(text)
    })
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
    // Pas de `networkidle` : le websocket HMR de Vite et les tuiles de carte
    // gardent des connexions ouvertes, la page n'atteint jamais l'inactivité.
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    expect(errors).toEqual([])
  })

  test('expose les balises Open Graph nécessaires au partage', async ({ page }) => {
    // Régression surveillée : elles étaient posées en JavaScript, donc
    // invisibles aux robots sociaux. Servi depuis le build, le document les
    // porte dès la réponse HTTP — sans attendre le moindre script.
    await page.goto('/')
    for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
      const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content')
      expect(content, `${prop} doit être renseignée`).toBeTruthy()
    }
    const image = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(image, 'og:image doit être une URL absolue').toMatch(/^https?:\/\//)
  })

  test('ne déborde pas horizontalement', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow, 'la page ne doit pas défiler latéralement').toBe(false)
  })
})

test.describe('Navigation publique', () => {
  for (const path of ['/artistes', '/login', '/signup', '/forgot-password']) {
    test(`${path} se rend sans écran vide`, async ({ page }) => {
      await page.goto(path)
      // Les routes sont chargées en `lazy()` : la navbar apparaît avant le
      // contenu. Une lecture unique de `innerText` observerait cet
      // entre-deux — on interroge donc jusqu'à ce que le contenu soit monté.
      await expect
        .poll(async () => (await page.locator('main').innerText()).trim().length, {
          message: `${path} n’affiche jamais de contenu`,
          timeout: 15_000,
        })
        .toBeGreaterThan(40)
    })
  }

  test('une URL inconnue renvoie vers la landing', async ({ page }) => {
    await page.goto('/cette-page-nexiste-pas')
    await expect(page).toHaveURL(/\/$|\/#/)
  })

  test('la version anglaise vit sur /en', async ({ page }) => {
    await page.goto('/en')
    await expect(page).toHaveURL(/\/en/)
    const locale = await page.locator('meta[property="og:locale"]').getAttribute('content')
    expect(locale).toBeTruthy()
  })
})

test.describe('Connexion', () => {
  test('le formulaire est présent et utilisable', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('refuse une adresse invalide sans appeler le serveur', async ({ page }) => {
    await page.goto('/login')
    let authCalled = false
    await page.route('**/auth/v1/**', (route) => {
      authCalled = true
      return route.abort()
    })
    await page.locator('input[type="email"]').fill('pas-une-adresse')
    await page.locator('input[type="password"]').fill('motdepasse123')
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(1000)
    expect(authCalled, 'une adresse invalide ne doit pas partir au serveur').toBe(false)
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Inscription', () => {
  test('le formulaire se rend avec ses champs', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('n’envoie rien tant que les champs sont vides', async ({ page }) => {
    await page.goto('/signup')
    let signUpCalled = false
    await page.route('**/auth/v1/signup**', (route) => {
      signUpCalled = true
      return route.abort()
    })
    const submit = page.locator('button[type="submit"]').first()
    if (await submit.isVisible()) await submit.click()
    await page.waitForTimeout(1000)
    expect(signUpCalled, 'un formulaire vide ne doit pas créer de compte').toBe(false)
  })
})

test.describe('Globe', () => {
  test('se monte sans planter, même sans jeton Mapbox', async ({ page }) => {
    const crashes: string[] = []
    page.on('pageerror', (err) => crashes.push(err.message))
    await page.goto('/globe')
    await page.waitForTimeout(2500)
    // Un jeton manquant doit produire un message, jamais un écran blanc.
    await expect(page.locator('body')).not.toBeEmpty()
    expect(crashes, 'le globe ne doit pas lever d’exception non capturée').toEqual([])
  })
})
