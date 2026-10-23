// oxlint-disable import/no-nodejs-modules -- the scripts run on Bun, not in the game.

// Reads the environment the CSII Modding Toolchain sets (`CSII_*`).

import process from 'node:process';

export function requireEnvironment(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} environment variable is not set, ensure the CSII Modding Toolchain is installed ` +
        `correctly (on Linux, \`mise setup:linux\`).`
    );
  }

  return value;
}
