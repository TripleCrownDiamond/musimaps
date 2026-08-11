import { createContext, useContext, type PropsWithChildren } from 'react';
import { DEFAULT_BRAND, type BrandContent } from '../lib/brand';

/**
 * Contexte de l'identité visuelle pilotée par le CMS. Le provider est un
 * simple pass-through : c'est App.tsx qui charge le brand pendant le splash
 * natif et le fournit ici, pour éviter un flash de logo au premier écran.
 */
const BrandContext = createContext<BrandContent>(DEFAULT_BRAND);

export function BrandProvider({
  brand,
  children,
}: PropsWithChildren<{ brand: BrandContent }>) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
