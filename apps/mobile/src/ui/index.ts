/**
 * Socle de primitives d'UI mobile.
 *
 * Le web dispose de 17 primitives (`components/ui/`, shadcn) qui lisent les
 * tokens par leurs classes Tailwind. Le mobile n'en avait aucune : chaque
 * écran réécrivait ses boutons et ses champs en `StyleSheet`, d'où 91
 * couleurs en dur et 38 rayons distincts dans l'app.
 *
 * Ces composants reflètent leurs équivalents web — mêmes noms de variantes,
 * même hiérarchie visuelle — et lisent `colors`, `radii` et `spacing` des
 * tokens partagés. Voir docs/AUDIT-DESIGN.md.
 */
export { Button, type ButtonSize, type ButtonVariant } from './Button';
export { Input, type InputProps } from './Input';
export { Card, Field, Section } from './Card';
