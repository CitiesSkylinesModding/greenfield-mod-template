import type { ModRegistrar } from 'cs2/modding';
import { register as registerEntityCounter } from './entity-counter';
import { iconsole } from './iconsole';
import { logError } from './utils';

/**
 * The features registering on the game's UI, each on its own: one that throws is reported and
 * skipped, and the others still register.
 */
const registrars: readonly ModRegistrar[] = [registerEntityCounter];

const register: ModRegistrar = moduleRegistry => {
  // The game calls every mod's registrar in one loop with no try/catch, so a throw here would also
  // keep every mod after this one from registering.
  let failed = false;

  for (const registrar of registrars) {
    try {
      registrar(moduleRegistry);
    } catch (error) {
      failed = true;

      logError(error, true);
    }
  }

  if (!failed) {
    iconsole.info(`Greenfield: Registered all modules.`);
  }
};

// noinspection JSUnusedGlobalSymbols
export const hasCSS = true;

// oxlint-disable-next-line import/no-default-export - the game mod loader requires a default export
export default register;
