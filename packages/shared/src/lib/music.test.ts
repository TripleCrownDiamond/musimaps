/**
 * Pertinence de la recherche de titres.
 *
 * Ces deux fonctions décident si un artiste retrouve ses morceaux ou reste
 * avec un onglet « Musiques » vide. Chaque cas ci-dessous vient d'un artiste
 * réellement présent sur la carte : ce sont des régressions constatées, pas
 * des hypothèses.
 */
import { describe, expect, it } from 'vitest'
import { appleMusicSearchUrl, matchesArtist, normalize } from './music'

describe('normalize', () => {
  it('retire les accents', () => {
    expect(normalize('Léon Achard')).toBe('leon achard')
    expect(normalize('Maître Gims')).toBe('maitre gims')
  })

  it('développe les ligatures que NFD ne décompose pas', () => {
    // Le piège : `Œ` n'est pas une lettre accentuée, NFD le laisse intact et
    // le filtre [^a-z0-9] le supprimait — « le 3eme il » ne matchait rien.
    expect(normalize('Le 3ème Œil')).toBe('le 3eme oeil')
    expect(normalize('Le 3ème Oeil')).toBe('le 3eme oeil')
    expect(normalize('Sœur')).toBe('soeur')
  })

  it('traite les autres lettres non décomposables', () => {
    expect(normalize('Blåhaj Æther')).toBe('blahaj aether')
    expect(normalize('Straße')).toBe('strasse')
    expect(normalize('Łukasz')).toBe('lukasz')
  })

  it('réduit la ponctuation à des espaces simples', () => {
    expect(normalize('  A$AP   Rocky!! ')).toBe('a ap rocky')
  })
})

describe('matchesArtist', () => {
  it('accepte le nom exact, à la casse et aux accents près', () => {
    expect(matchesArtist('Booba', 'Booba')).toBe(true)
    expect(matchesArtist('BOOBA', 'booba')).toBe(true)
    expect(matchesArtist('Le 3ème Oeil', 'Le 3ème Œil')).toBe(true)
  })

  it('accepte un artiste crédité parmi les participants', () => {
    expect(matchesArtist('Booba feat. Siboy', 'Booba')).toBe(true)
    expect(matchesArtist('La Fouine & Booba', 'Booba')).toBe(true)
    expect(matchesArtist('Booba x Siboy', 'Siboy')).toBe(true)
  })

  it('ne découpe pas un nom sur un séparateur collé', () => {
    // Le « x » de XXXTentacion n'est pas un séparateur de collaboration.
    expect(matchesArtist('XXXTentacion', 'Tentacion')).toBe(false)
  })

  it('découpe une énumération complète', () => {
    // Cas réel iTunes pour Le 3ème Œil.
    const credit = 'Shurik’n, Le 3ème Oeil & Sista Micky'
    expect(matchesArtist(credit, 'Le 3ème Œil')).toBe(true)
    expect(matchesArtist(credit, 'Sista Micky')).toBe(true)
  })

  it('ne coupe pas sur une virgule hors énumération', () => {
    // « Tyler, The Creator » ne doit pas être lu comme deux participants :
    // sans énumération (« & », « feat. »), la virgule n'est pas un séparateur.
    expect(matchesArtist('Tyler, The Creator', 'Sista Micky')).toBe(false)
    expect(matchesArtist('Tyler, The Creator', 'The Creator')).toBe(false)
  })

  it('⚠️ règle du premier mot — connue pour être large', () => {
    // Un nom de carte en UN SEUL mot accepte tout crédit qui commence par ce
    // mot. C'est ce qui rattrape « Booba » sur un crédit « Booba - Live », mais
    // cela capte aussi des artistes distincts. Test de caractérisation : il
    // fige le comportement actuel, il ne le valide pas. Resserrer cette règle
    // demande de mesurer combien d'artistes de la carte en dépendent.
    expect(matchesArtist('Tyler, The Creator', 'Tyler')).toBe(true)
    expect(matchesArtist('Jo Maka', 'Jo')).toBe(true)
  })

  it('accepte les collectifs connus d’un artiste', () => {
    expect(matchesArtist('Bakel City Gang', 'Booba')).toBe(true)
    expect(matchesArtist('92i', 'Booba')).toBe(true)
  })

  it('accepte un crédit plus court que le nom de la carte', () => {
    // « Sade Adu » sur la carte, « Sade » chez iTunes : sans cette règle
    // l'artiste n'avait aucun titre alors que 50 résultats existaient.
    expect(matchesArtist('Sade', 'Sade Adu')).toBe(true)
  })

  it('refuse un crédit trop court pour être discriminant', () => {
    // « Jo » ne doit pas capter les titres de « Jo Maka » ou « Jo le Balafré ».
    expect(matchesArtist('Jo', 'Jo Maka')).toBe(false)
    expect(matchesArtist('Al', 'Al Green')).toBe(false)
  })

  it('refuse un crédit à plus d’un mot d’écart', () => {
    expect(matchesArtist('Sade', 'Sade Adu Helen Folasade')).toBe(false)
  })

  it('refuse un homonyme proche mais différent', () => {
    // Cas réels : « Gary Barber » vs « Gary Baker », « Aeshis » vs « Aegis ».
    expect(matchesArtist('Gary Baker', 'Gary Barber')).toBe(false)
    expect(matchesArtist('Aegis', 'Aeshis')).toBe(false)
    expect(matchesArtist('Nina Simone', 'Niasony')).toBe(false)
  })

  it('refuse les reprises et hommages désambiguïsés', () => {
    expect(matchesArtist('Booba (tribute)', 'Booba')).toBe(false)
    expect(matchesArtist('Booba (karaoke)', 'Booba')).toBe(false)
    expect(matchesArtist('Booba (toon)', 'Booba')).toBe(false)
  })

  it('refuse un nom vide des deux côtés', () => {
    expect(matchesArtist('', 'Booba')).toBe(false)
    expect(matchesArtist('Booba', '')).toBe(false)
    expect(matchesArtist('!!!', 'Booba')).toBe(false)
  })
})

describe('appleMusicSearchUrl', () => {
  it('encode artiste et titre dans la requête', () => {
    expect(appleMusicSearchUrl('Booba', 'Comme les autres')).toBe(
      'https://music.apple.com/search?term=Booba%20Comme%20les%20autres',
    )
  })

  it('échappe les caractères réservés', () => {
    const url = appleMusicSearchUrl('AC/DC', 'T.N.T & more')
    expect(url).toContain('AC%2FDC')
    expect(url).toContain('%26')
    expect(() => new URL(url)).not.toThrow()
  })
})
