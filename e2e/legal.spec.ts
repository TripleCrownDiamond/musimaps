import { expect, test } from '@playwright/test'

// Only synthetic responses: no writes to the live CMS or any user account.
const legal = {
  publisherName: 'Éditeur de test Musimaps', publisherAddress: 'Adresse de test', registrationNumber: '',
  contactEmail: 'contact@example.invalid', updatedOn: '2026-09-09',
  privacy: { fr: 'Confidentialité de test.\n\n<script>window.injected = true</script>', en: 'Test privacy policy.' },
  terms: { fr: 'Conditions de test.', en: 'Test terms of use.' },
  deletion: { fr: 'Conservation de test.', en: 'Test retention details.' },
}

for (const language of ['fr', 'en'] as const) {
  const prefix = language === 'en' ? '/en' : ''
  test.describe(`Legal pages ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((theme) => localStorage.setItem('musimaps.theme', theme), language === 'fr' ? 'light' : 'dark')
      await page.route('**/rest/v1/**', (route) => {
        const resource = new URL(route.request().url()).pathname.split('/').pop()
        const rows = resource === 'site_content_public'
          ? [{ key: 'settings', content: { legal }, content_en: { legal: { publisherName: 'WRONG EN IDENTITY' } } }]
          : []
        return route.fulfill({ json: rows })
      })
      await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, json: { message: 'No session in this test' } }))
    })

    for (const [path, document] of [['/confidentialite', 'privacy'], ['/cgu', 'terms'], ['/supprimer-compte', 'deletion']] as const) {
      test(`${path} keeps its URL and displays the published translation`, async ({ page }) => {
        await page.goto(`${prefix}${path}`)
        await expect(page.getByTestId('legal-document')).toContainText(legal[document][language].split('\n')[0])
        await expect(page).toHaveURL(new RegExp(`${prefix}${path}$`))
        await expect(page.locator('main')).toContainText(legal.publisherName)
        await expect(page.locator('main')).not.toContainText('WRONG EN IDENTITY')
        expect(await page.evaluate(() => 'injected' in window)).toBe(false)
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false)
        if (document === 'deletion') {
          await page.getByRole('link', { name: /Accéder à la suppression|Go to account deletion/ }).click()
          await expect(page).toHaveURL(new RegExp(`${prefix}/login$`))
          expect(await page.evaluate(() => history.state.usr.from)).toBe(`${prefix}/profil#delete-account`)
        }
      })
    }

    test('missing document is explicit and does not redirect home', async ({ page }) => {
      await page.route('**/rest/v1/site_content_public*', (route) => route.fulfill({ json: [] }))
      await page.goto(`${prefix}/confidentialite`)
      await expect(page.getByRole('status')).toContainText(language === 'fr' ? 'pas encore été publié' : 'not been published yet')
      await expect(page).toHaveURL(new RegExp(`${prefix}/confidentialite$`))
    })
  })
}
