/**
 * Anciens logos et choix du logo par thème.
 *
 * Le risque couvert ici : qu'un ancien logo cyan resurgisse sur le site ou
 * dans l'admin après une modification faite d'un seul côté.
 */
import { describe, expect, it } from 'vitest'
import { isLegacyBrandUrl, resolveBrandLogo, stripLegacyBrandUrls } from './brand'

const LEGACY = 'https://cdn.example.com/cms/brand-navbar-light.png'
const CURRENT = 'https://cdn.example.com/cms/1787000000000-logo.png'

describe('isLegacyBrandUrl', () => {
  it('reconnaît un ancien fichier quel que soit son hôte', () => {
    expect(isLegacyBrandUrl(LEGACY)).toBe(true)
    expect(isLegacyBrandUrl('/cms/brand-footer-dark.png')).toBe(true)
  })

  it('laisse passer une URL courante et une chaîne vide', () => {
    expect(isLegacyBrandUrl(CURRENT)).toBe(false)
    expect(isLegacyBrandUrl('')).toBe(false)
  })
})

describe('stripLegacyBrandUrls', () => {
  it('vide les champs pointant vers un ancien logo, garde les autres', () => {
    const cleaned = stripLegacyBrandUrls({
      navbarLogoLight: LEGACY,
      navbarLogoDark: CURRENT,
      footerLogoLight: '',
      navbarLogoHeight: 32,
    })
    expect(cleaned.navbarLogoLight).toBe('')
    expect(cleaned.navbarLogoDark).toBe(CURRENT)
    expect(cleaned.footerLogoLight).toBe('')
  })

  it('ne touche pas aux valeurs non textuelles', () => {
    // Les hauteurs de logo sont des nombres : elles doivent traverser intactes.
    expect(stripLegacyBrandUrls({ navbarLogoHeight: 32 }).navbarLogoHeight).toBe(32)
  })

  it('ne modifie pas l’objet d’origine', () => {
    const original = { navbarLogoLight: LEGACY }
    stripLegacyBrandUrls(original)
    expect(original.navbarLogoLight).toBe(LEGACY)
  })

  it('est idempotente', () => {
    const once = stripLegacyBrandUrls({ navbarLogoLight: LEGACY })
    expect(stripLegacyBrandUrls(once)).toEqual(once)
  })
})

describe('resolveBrandLogo', () => {
  it('choisit le logo du thème demandé', () => {
    expect(resolveBrandLogo('light.png', 'dark.png', 'light')).toBe('light.png')
    expect(resolveBrandLogo('light.png', 'dark.png', 'dark')).toBe('dark.png')
  })

  it('un seul logo renseigné sert les deux thèmes', () => {
    expect(resolveBrandLogo('light.png', '', 'dark')).toBe('light.png')
    expect(resolveBrandLogo('', 'dark.png', 'light')).toBe('dark.png')
  })

  it('retourne null quand rien n’est exploitable — l’appelant prend le logo embarqué', () => {
    expect(resolveBrandLogo('', '', 'light')).toBeNull()
    expect(resolveBrandLogo(LEGACY, LEGACY, 'light')).toBeNull()
  })

  it('ignore un ancien logo au profit de l’autre thème', () => {
    expect(resolveBrandLogo(LEGACY, CURRENT, 'light')).toBe(CURRENT)
  })
})
