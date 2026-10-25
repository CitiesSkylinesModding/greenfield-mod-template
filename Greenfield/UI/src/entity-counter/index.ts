import type { ModRegistrar } from 'cs2/modding';
import { EntityCounterButton } from './entity-counter-button';
import { EntityCounterPanel } from './entity-counter-panel';

export const register: ModRegistrar = moduleRegistry => {
  // Appending here is what makes the game show its mods menu button, see the cs2-modding-ui skill.
  moduleRegistry.append('UniversalModMenu', EntityCounterButton);

  // The free overlay of the game screen, where the panel stays mounted, and its key binding
  // subscribed, for the whole game.
  moduleRegistry.append('Game', EntityCounterPanel);
};
