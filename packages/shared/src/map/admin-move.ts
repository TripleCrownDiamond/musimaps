/**
 * Repositionnement d'un pin par un administrateur.
 *
 * Fichier volontairement AUTONOME : aucun import de valeur venant d'un autre
 * module — même raison que `geo-consistency.ts`. Les scripts Node le chargent
 * directement (`scripts/map-admin-move.test.mjs`) et testent donc exactement
 * le code que la carte exécute, pas une copie qui dériverait.
 */

/**
 * Précision retenue quand un administrateur repositionne un pin : 3 décimales,
 * soit environ **110 m**.
 *
 * Ce n'est pas une contrainte technique, c'est la règle de vie privée. Les
 * coordonnées sont des géocodages de VILLE (voir docs/DECISIONS-PRODUIT.md) ;
 * enregistrer les six décimales que renvoie la carte inventerait une précision
 * d'adresse que la donnée n'a pas — et, pour les artistes dont la coordonnée
 * serait réellement fine, exposerait leur domicile.
 *
 * Un déplacement admin corrige une localisation grossièrement fausse (un pin
 * déclaré à Kano posé au Japon) ; il ne règle pas une position au mètre.
 */
export const ADMIN_COORD_DECIMALS = 3;

/**
 * Nouvelle coordonnée BRUTE d'un artiste qu'on vient de faire glisser.
 *
 * ⚠️ Le piège que cette fonction existe pour éviter : la position AFFICHÉE
 * d'un pin n'est pas sa coordonnée stockée. `declump` l'écarte en spirale de
 * son groupe, jusqu'à `MAX_OFFSET_KM`. Enregistrer directement le point de
 * dépôt téléporterait donc l'artiste du décalage de spirale à chaque
 * sauvegarde — et comme ce décalage dépend du groupe ET du zoom, il dériverait
 * un peu plus à chaque fois, sans que personne ne comprenne pourquoi.
 *
 * On applique donc le DÉPLACEMENT (dépôt − position affichée de départ) à la
 * coordonnée brute. L'admin voit le pin bouger d'un cran, l'artiste bouge
 * exactement du même cran.
 */
export function movedCoordinates(
  raw: [number, number],
  renderedFrom: [number, number],
  droppedAt: [number, number],
): [number, number] {
  const factor = 10 ** ADMIN_COORD_DECIMALS;
  const round = (value: number) => Math.round(value * factor) / factor;
  const lng = raw[0] + (droppedAt[0] - renderedFrom[0]);
  const lat = raw[1] + (droppedAt[1] - renderedFrom[1]);
  // Mercator ne montre rien au-delà de ±85°, et la longitude s'enroule.
  return [round(((lng + 540) % 360) - 180), round(Math.min(85, Math.max(-85, lat)))];
}
