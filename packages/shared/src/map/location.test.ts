import { describe, expect, it } from 'vitest'
import type { Artist } from '../index'
import { artistMapLocation, artistsInExploration, cityExploration, explorationAfterArtistClose, mapLocationHeading, nearbyExploration, type MapLocation, type MapPlace } from './location'
import { clusterCameraTarget, nearestMapTarget, nextIndexWithinPlace, PIN_LAYOUT_ZOOM, renderedPosition, CAMERA } from './index'

const artist = (id: string, coordinates: [number, number]): Artist => ({
  id, coordinates, name: id, city: 'Lagos', district: 'Ikeja', country: 'Nigeria', genre: 'Afrobeats',
  flag: '🇳🇬', followers: '', bio: '', color: ['#000000', '#ffffff'], tracks: [], events: [],
})
const device: MapLocation = { coordinates: [2.352, 6.370], city: 'Godomey', country: 'Benin' }
const selected = artist('chosen', [3.34, 6.59])

describe('contexte de découverte', () => {
  it('distingue la destination musicale de la position de l’appareil', () => {
    const heading = mapLocationHeading(device, artistMapLocation(selected))
    expect(heading?.label).toBe('Ikeja, Lagos, Nigeria')
    expect(heading?.captionKey).toBe('globe.discovering')
    expect(device.city).toBe('Godomey')
  })
  it('permet de découvrir sans autorisation GPS', () => {
    expect(mapLocationHeading(null, artistMapLocation(selected))?.captionKey).toBe('globe.discovering')
  })
  it('réaffiche la position au recentrage explicite', () => {
    expect(mapLocationHeading(device, null)).toMatchObject({ captionKey: 'loc.here', label: 'Godomey, Benin' })
    expect(mapLocationHeading(null, null)).toBeNull()
  })
  it('conserve la zone de l’artiste, même s’il vient du catalogue de secours', () => {
    const neighbor = artist('neighbor', [3.35, 6.59])
    const remote = artist('remote', device.coordinates)
    expect(artistsInExploration([remote, neighbor], selected).map(a => a.id)).toEqual(['chosen', 'neighbor'])
    expect(artistsInExploration([selected, neighbor], selected).map(a => a.id)).toEqual(['chosen', 'neighbor'])
  })
})

describe('navigation après fermeture d’une fiche Découvrir', () => {
  const neighbor = artist('neighbor', [3.35, 6.59])
  const remote = artist('remote', device.coordinates)

  it('crée une navigation locale avec l’artiste découvert et ses voisins, sans le GPS', () => {
    const { place, index } = explorationAfterArtistClose([remote, neighbor, selected], selected, null)
    expect(place).toMatchObject({ kind: 'city', name: 'Lagos', code: 'NG', flag: '🇳🇬' })
    expect(place.artists.map(a => a.id)).toEqual(['chosen', 'neighbor'])
    expect(index).toBe(0)
    const next = nextIndexWithinPlace(place.artists, index, 1)
    expect(next).toBe(1)
    expect(nextIndexWithinPlace(place.artists, next, -1)).toBe(index)
  })

  it('conserve l’ordre du parcours et l’index après avoir rouvert une fiche', () => {
    const currentPlace: MapPlace = {
      kind: 'country', name: 'Nigeria', code: 'NG', flag: '🇳🇬', artists: [neighbor, selected],
    }
    const result = explorationAfterArtistClose([remote, selected, neighbor], selected, currentPlace)
    expect(result.place).toBe(currentPlace)
    expect(result.index).toBe(1)
    expect(explorationAfterArtistClose([selected, neighbor], neighbor, currentPlace)).toEqual({
      place: currentPlace, index: 0,
    })
  })

  it('remplace une ancienne zone qui ne contient pas l’artiste découvert', () => {
    const stalePlace: MapPlace = { kind: 'city', name: 'Godomey', code: 'BJ', flag: '🇧🇯', artists: [remote] }
    const { place, index } = explorationAfterArtistClose([remote, neighbor], selected, stalePlace)
    expect(place).not.toBe(stalePlace)
    expect(place.name).toBe('Lagos')
    expect(place.artists).toEqual([selected, neighbor])
    expect(index).toBe(0)
  })

  it('garde un artiste isolé navigable sans ajouter d’artiste éloigné', () => {
    const { place, index } = explorationAfterArtistClose([remote], selected, null)
    expect(place.artists).toEqual([selected])
    expect(nextIndexWithinPlace(place.artists, index, 1)).toBe(0)
    expect(nextIndexWithinPlace(place.artists, index, -1)).toBe(0)
  })
})

describe('découverte guidée', () => {
  const lagos: MapLocation = { coordinates: [3.34, 6.59], city: 'Lagos', countryCode: 'NG' }

  it('ouvre la zone autour de moi sur l’artiste le plus proche', () => {
    const far = artist('far', [3.6, 6.59])
    const close = artist('close', [3.345, 6.595])
    const abroad = artist('abroad', [2.35, 48.85])
    const place = nearbyExploration([far, abroad, close], lagos)
    expect(place?.artists.map(a => a.id)).toEqual(['close', 'far'])
    expect(place).toMatchObject({ kind: 'city', name: 'Lagos', code: 'NG', flag: '🇳🇬' })
  })

  it('ne crée pas de zone vide autour de moi', () => {
    expect(nearbyExploration([artist('abroad', [2.35, 48.85])], lagos)).toBeNull()
  })

  it('regroupe la ville choisie dans Découvrir', () => {
    const inLagos = artist('lagos', [3.38, 6.45])
    const inAbuja = { ...artist('abuja', [7.49, 9.07]), city: 'Abuja' }
    expect(cityExploration([inAbuja, inLagos], ' lagos ')).toMatchObject({
      kind: 'city', name: 'Lagos', code: 'NG', artists: [inLagos],
    })
    expect(cityExploration([inAbuja], 'Lagos')).toBeNull()
  })
})

describe('clic pays et clusters', () => {
  it('choisit le point le plus proche, indépendamment de l’ordre de dessin', () => {
    const benin = { id: 'BJ', coords: [2.35, 6.37] as [number, number] }
    const nigeria = { id: 'NG', coords: [3.39, 6.45] as [number, number] }
    for (const targets of [[benin, nigeria], [nigeria, benin]]) {
      expect(nearestMapTarget(targets, [2.35, 6.37], p => p.coords)?.id).toBe('BJ')
    }
    expect(nearestMapTarget([], [2.35, 6.37], () => [0, 0])).toBeUndefined()
  })
  it('atterrit sur un pin dessiné, pas sur le centre vide du pays', () => {
    const members = [selected, artist('neighbor', selected.coordinates)]
    const target = clusterCameraTarget(members, [8, 9], 8, 'country')
    expect(target.coordinates).toEqual(renderedPosition(members, selected.id, PIN_LAYOUT_ZOOM))
    expect(target.zoom).toBe(CAMERA.artist.zoom)
    expect(target.duration).toBe(CAMERA.country.duration)
  })
})
