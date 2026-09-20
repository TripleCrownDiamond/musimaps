import { describe, expect, it } from 'vitest';
import { SEARCH_SHEET, searchSheetHeight } from './index';

describe('searchSheetHeight', () => {
  const phone = { windowHeight: 800, topInset: 24 };

  it('garde la hauteur de repos clavier fermé', () => {
    expect(searchSheetHeight({ ...phone, keyboardHeight: 0 })).toBe(800 * SEARCH_SHEET.heightRatio);
  });

  it('se pose sur le clavier en laissant une bande de carte visible', () => {
    const keyboardHeight = 340;
    const height = searchSheetHeight({ ...phone, keyboardHeight });
    const top = phone.windowHeight - keyboardHeight - height;
    expect(height).toBeGreaterThanOrEqual(SEARCH_SHEET.minKeyboardHeight);
    expect(top).toBeGreaterThanOrEqual(phone.topInset + phone.windowHeight * SEARCH_SHEET.mapPeekRatio);
  });

  it('garde le champ et quelques résultats avec un grand clavier', () => {
    expect(searchSheetHeight({ ...phone, keyboardHeight: 420 })).toBe(SEARCH_SHEET.minKeyboardHeight);
  });

  it('ne passe jamais sous la barre d’état sur un petit écran', () => {
    const small = { windowHeight: 600, topInset: 24, keyboardHeight: 350 };
    const height = searchSheetHeight(small);
    expect(small.windowHeight - small.keyboardHeight - height).toBeGreaterThanOrEqual(small.topInset);
  });
});
