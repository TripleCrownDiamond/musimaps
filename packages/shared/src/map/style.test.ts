import { describe, expect, it } from 'vitest';
import { applyBrandStyle, type MapStyleDocument } from './style';

describe('applyBrandStyle', () => {
  it('drops the default camera embedded in Mapbox styles', () => {
    // light-v11 / dark-v11 ship with New York at zoom 11.
    const style: MapStyleDocument = {
      center: [-74, 40.73],
      zoom: 11,
      bearing: 0,
      pitch: 0,
      layers: [{ id: 'water', type: 'fill' }],
    };
    const branded = applyBrandStyle(style, 'light');
    expect(branded).not.toHaveProperty('center');
    expect(branded).not.toHaveProperty('zoom');
    expect(branded).not.toHaveProperty('bearing');
    expect(branded).not.toHaveProperty('pitch');
    expect(branded.layers).toHaveLength(1);
  });
});
