import type { ModRegistrar } from 'cs2/modding';
import { HelloWorld } from './mods/hello-world';

const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.append('Menu', HelloWorld);
};

// noinspection JSUnusedGlobalSymbols
export const hasCSS = true;

// oxlint-disable-next-line import/no-default-export - the game mod loader requires a default export
export default register;
