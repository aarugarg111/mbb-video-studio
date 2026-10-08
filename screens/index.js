import * as home from './home.js';

export const SCREENS = {
  [home.name]: home
};

/* The shape src/recipe.js validates against: screen name -> its target names. */
export function catalogue() {
  const out = {};
  for (const [key, mod] of Object.entries(SCREENS)) {
    out[key] = Object.keys(mod.targets);
  }
  return out;
}
