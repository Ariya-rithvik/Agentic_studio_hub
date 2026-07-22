// Shot-builder registry. The generic storyboard runner looks up shot.type here
// and calls the builder with (THREE, ctx, params). Add new shot types (crusher,
// flotation, smelter, ...) by registering builders — the storyboard stays data.
import { buildMorph } from './morph.mjs';
import { buildCrusher } from './crusher.mjs';

export const SHOTS = {
  ore_to_wire: (THREE, ctx, params) => buildMorph(THREE, ctx, params),
  crusher: (THREE, ctx, params) => buildCrusher(THREE, ctx, params)
};
