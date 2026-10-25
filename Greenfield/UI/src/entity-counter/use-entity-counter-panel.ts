import { createSingletonHook } from '../utils';

/**
 * Whether the entity counter panel is open, shared by the mods menu button, which lives in a tree
 * of its own, and the panel.
 */
export const useIsEntityCounterPanelOpen = createSingletonHook(false);
