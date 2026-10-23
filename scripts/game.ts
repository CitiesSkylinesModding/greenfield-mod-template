// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- a CLI script runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- polling the game waits out each check before the next one.

// Drives the game process, on Linux (Steam and Proton) and on Windows:
//
//   bun scripts/game.ts restart [--load <save> | --new [<map>]] [<game options>]
//     Stops the game if it runs, launches it through Steam, and returns at the main menu, or once
//     the save or a new city on the map (Archipelago by default) loaded. A save is named as in the
//     game's list, a map by its guid or as in the user's maps.
//   bun scripts/game.ts stop
//     Stops the game.
//   bun scripts/game.ts wait-load
//     Returns once the city or the map the game is loading has loaded.
//
// To stop the game cleanly, quit it from the unity eval first, `UnityEngine.Application.Quit()`:
// `stop` and `restart` wait a minute for a game that quits, then kill it, which skips the game's
// own shutdown (its settings and the mods' are saved then).
// Game options, every argument of `restart` that is not one of its own, go through `runOnce.txt`,
// which the game appends to its command line at launch: options of the game's own
// (`--uiDeveloperMode`), not Unity's or Burst's, read before it.

import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { BunFile } from 'bun';
import { type LogEntry, parseLog } from './game-log';

const steamAppId = 949_230;

/**
 * The guid of Archipelago, a map of the base game.
 */
const archipelagoGuid = 'bf8036b291428535b986c757fda3e627';

/**
 * Seconds a game asked to quit gets before it is killed.
 */
const quitGraceSeconds = 60;

/**
 * Seconds a game asked to end, then ended by force, and Steam's reaper for it, take to go.
 */
const killSeconds = 30;

/**
 * Launches tried, and seconds each waits for the game's process.
 */
const launchAttempts = 3;
const launchSeconds = 60;

/**
 * Milliseconds between two checks of the game or of its logs.
 */
const pollMilliseconds = 3000;

/**
 * Seconds a boot may take: a slow day loads the prefabs for over six minutes.
 */
export const bootSeconds = 600;

/**
 * Seconds a city or a map may take to load.
 */
export const loadSeconds = 300;

/**
 * Seconds the loading screen stays up after the game logged the end of a load.
 */
const loadingScreenSeconds = 20;

const isWindows = process.platform === 'win32';

export const userDataPath = requireEnvironment('CSII_USERDATAPATH');

const sceneFlowLogPath = path.join(userDataPath, 'Logs', 'SceneFlow.log');

if (import.meta.main) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);

    process.exitCode = 1;
  }
}

/**
 * The PIDs of the game, and on Linux of Steam's reaper for it, empty when the game is stopped.
 */
export async function gamePids(): Promise<number[]> {
  const pids = await gameProcessPids();

  if (isWindows) {
    return pids;
  }

  // Steam ignores a launch while its reaper for the app lives, which outlives Cities2.exe by many
  // seconds: only the reaper's exit means the game is stopped.
  const reapers = await run(['pgrep', '-ax', 'reaper']);

  return [
    ...pids,
    ...reapers
      .split('\n')
      .filter(line => line.includes(`AppId=${steamAppId}`))
      .map(line => Number(line.split(' ')[0]))
  ];
}

/**
 * Whether the game is not stopped yet for Steam, which ignores a launch while the reaper lives.
 */
export async function isGameOrReaperRunning(): Promise<boolean> {
  const pids = await gamePids();

  return pids.length > 0;
}

/**
 * Stops the game: waits `graceSeconds` for a game asked to quit, then kills it.
 */
export async function stopGame(graceSeconds = quitGraceSeconds): Promise<void> {
  if (!(await isGameOrReaperRunning())) {
    return;
  }

  if (isWindows) {
    // Without /F, taskkill asks the window to close, which the game takes as a quit.
    await run(['taskkill', '/IM', 'Cities2.exe']);
  }

  if (await waitUntil(async () => !(await isGameOrReaperRunning()), graceSeconds)) {
    return;
  }

  console.log('game: killing it');

  // A process too hung to end on a request is ended by force.
  for (const force of [false, true]) {
    await killGame(force);

    if (await waitUntil(async () => !(await isGameOrReaperRunning()), killSeconds)) {
      return;
    }
  }

  const pids = await gamePids();

  throw new Error(
    `The game is still running after it was killed (PIDs ${pids.join(', ')}): kill them by ` +
      `hand, or restart the machine if they will not die.`
  );
}

/**
 * Launches the stopped game through Steam, with game options written to `runOnce.txt`, and
 * returns once its process runs.
 */
export async function launchGame(gameOptions: readonly string[]): Promise<void> {
  const url = `steam://rungameid/${steamAppId}`;
  const runOncePath = path.join(userDataPath, 'runOnce.txt');

  let launched = false;

  try {
    for (let attempt = 1; attempt <= launchAttempts && !launched; attempt++) {
      // What a failed launch left, a reaper for one, makes Steam ignore the next.
      await stopGame(0);
      await Bun.write(runOncePath, ['--noSplash', ...gameOptions].join(' '));

      // On Linux, through the user's service manager and never from this shell: a Steam started
      // here inherits the shell's environment, tokens included, and the game's crash dumps upload
      // it to Colossal Order's Backtrace.
      await run(
        isWindows
          ? ['cmd', '/c', 'start', url]
          : ['systemd-run', '--user', '--collect', '--quiet', 'steam', url]
      );

      // The game's process itself: a launch starts and ends a first reaper before the game's.
      launched = await waitUntil(isGameProcessRunning, launchSeconds);

      if (launched) {
        // The game ignores an option it does not know, a mistyped one of this script's included.
        const withOptions =
          gameOptions.length > 0 ? `, with game options ${gameOptions.join(' ')}` : '';

        console.log(`game: launched (attempt ${attempt})${withOptions}`);
      }
    }
  } finally {
    if (!launched) {
      // The options are for this launch only: the next one, the user's own maybe, must not read
      // them, even when the game will not die.
      await rm(runOncePath, { force: true });
      await stopGame(0);
    }
  }

  if (!launched) {
    throw new Error(
      `The game did not start after ${launchAttempts} launches through Steam: Steam may be ` +
        `closed, signed out, updating the game, or showing a dialog. Check Steam, then retry.`
    );
  }
}

/**
 * Waits for the main menu of the game launched at `launchTime`.
 */
async function waitForMainMenu(launchTime: Date): Promise<void> {
  const reached = await waitForSceneFlow(
    entries => entries.some(entry => entry.message === 'MainMenu reached'),
    launchTime,
    bootSeconds
  );

  if (!reached) {
    throw new Error(`No main menu after ${bootSeconds} s, see ${sceneFlowLogPath}.`);
  }
}

/**
 * Waits until the city or the map the game is loading, or the next one it loads, has loaded.
 * With `launchTime`, reads only the log of the game launched then, and fails when that game falls
 * back to the main menu, which it does when a load it was launched with fails.
 */
async function waitForLoad(launchTime?: Date): Promise<void> {
  let fellBack = false;
  let completedAt: Date | undefined;

  await waitForSceneFlow(
    entries => {
      const loadStart = entries.findLastIndex(entry => entry.message.startsWith('Loading mode '));
      const loadEntry = entries[loadStart];

      fellBack =
        launchTime !== undefined && entries.some(entry => entry.message === 'MainMenu reached');

      completedAt =
        loadEntry && /^Loading mode (?:Game|Editor) /u.test(loadEntry.message)
          ? entries.slice(loadStart).find(entry => entry.message === 'Loading completed')?.time
          : undefined;

      return completedAt !== undefined;
    },
    launchTime ?? new Date(0),
    loadSeconds + (launchTime ? bootSeconds : 0),
    () => fellBack
  );

  if (fellBack) {
    throw new Error(`The game did not load it and went to the main menu, see ${sceneFlowLogPath}.`);
  }

  if (!completedAt) {
    throw new Error(`Nothing loaded within the time allowed, see ${sceneFlowLogPath}.`);
  }

  await Bun.sleep(Math.max(0, completedAt.getTime() + loadingScreenSeconds * 1000 - Date.now()));
}

/**
 * Reads the guid of a save from the save itself, by its name in the game's list: the guid changes
 * each time the save is written.
 */
function findSaveGuid(name: string): Promise<string> {
  return readAssetGuid('Saves', name, 'SaveGameMetadata');
}

/**
 * Reads the guid of one of the user's maps, by its name.
 */
function findMapGuid(name: string): Promise<string> {
  return readAssetGuid('Maps', name, 'MapMetadata');
}

export async function waitUntil(
  condition: () => Promise<boolean>,
  seconds: number
): Promise<boolean> {
  const deadline = Date.now() + seconds * 1000;

  while (Date.now() < deadline) {
    if (await condition()) {
      return true;
    }

    await Bun.sleep(pollMilliseconds);
  }

  return condition();
}

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

/**
 * What to do about a game left running, undefined when the game is stopped.
 */
export async function gameLeftRunning(): Promise<string | undefined> {
  const pids = await gameProcessPids();

  return pids.length > 0
    ? `The game is left running (PIDs ${pids.join(', ')}): \`mise game stop\` stops it.`
    : undefined;
}

/**
 * The entries of a game log stamped at or after `since`, none when the game has not written it.
 */
export async function readLog(logPath: string, since: Date): Promise<LogEntry[]> {
  const log = Bun.file(logPath);

  return (await log.exists()) ? parseLog(await log.text(), since) : [];
}

async function main(args: readonly string[]): Promise<void> {
  const [command, ...options] = args;

  switch (command ?? '') {
    case 'restart': {
      const { startGuid, gameOptions } = await readRestartOptions(options);

      await stopGame();

      const launchTime = new Date();

      await launchGame(startGuid ? [`--startGame=${startGuid}`, ...gameOptions] : gameOptions);

      try {
        await (startGuid ? waitForLoad(launchTime) : waitForMainMenu(launchTime));
      } catch (error) {
        throw await withGameState(error);
      }

      console.log(
        `game: ${startGuid ? 'loaded' : 'main menu'}, ${secondsSince(launchTime)} s after the launch`
      );

      return;
    }
    case 'stop': {
      await stopGame();

      console.log('game: stopped');

      return;
    }
    case 'wait-load': {
      // A load the stopped game logged last would pass for this one.
      if (!(await isGameProcessRunning())) {
        throw new Error('The game is not running.');
      }

      try {
        await waitForLoad();
      } catch (error) {
        throw await withGameState(error);
      }

      console.log('game: loaded');

      return;
    }
    default: {
      throw new Error(
        'Usage: bun scripts/game.ts restart [--load <save> | --new [<map>]] [<game options>]\n' +
          '       bun scripts/game.ts stop\n' +
          '       bun scripts/game.ts wait-load'
      );
    }
  }
}

/**
 * The error of a wait that gave up, with what to do about the game it leaves: a hung game stays
 * up, for a look with the unity eval before it is stopped.
 */
async function withGameState(error: unknown): Promise<Error> {
  const message = error instanceof Error ? error.message : String(error);
  const leftRunning = await gameLeftRunning();

  return new Error(leftRunning ? `${message}\n${leftRunning}` : message);
}

/**
 * Reads `restart`'s options: the guid of what to start the game with, and the game options, every
 * other argument (mise drops a `--` that would have parted them). The game's `--startGame` loads
 * a save or starts a new city on a map as soon as it booted, which no main menu trigger races.
 */
async function readRestartOptions(
  options: readonly string[]
): Promise<{ startGuid: string | undefined; gameOptions: string[] }> {
  const gameOptions: string[] = [];

  let startGuid: string | undefined;

  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    const next = options[index + 1];
    // The game takes `-option` as it takes `--option`: a name never starts with a dash.
    const name = next?.startsWith('-') ? undefined : next;

    if (option === '--load') {
      if (!name) {
        throw new Error('--load takes the name of a save.');
      }

      startGuid = await findSaveGuid(name);
      index++;
    } else if (option === '--new') {
      if (name) {
        startGuid = /^[\da-f]{32}$/u.test(name) ? name : await findMapGuid(name);
        index++;
      } else {
        startGuid = archipelagoGuid;
      }
    } else if (option) {
      gameOptions.push(option);
    }
  }

  return { startGuid, gameOptions };
}

/**
 * Waits for the entries of `SceneFlow.log` stamped at or after `since` to satisfy `done`, for at
 * most `seconds`; gives up early when the game is gone, or when `abort` says so.
 */
async function waitForSceneFlow(
  done: (entries: readonly LogEntry[]) => boolean,
  since: Date,
  seconds: number,
  abort: () => boolean = () => false
): Promise<boolean> {
  let finished = false;

  await waitUntil(async () => {
    finished = done(await readLog(sceneFlowLogPath, since));

    if (!finished && !abort() && !(await isGameProcessRunning())) {
      throw new Error(`The game stopped, see ${sceneFlowLogPath}.`);
    }

    return finished || abort();
  }, seconds);

  return finished;
}

/**
 * Reads the guid of a user asset from its `.cok` archive, the zip the game writes it in, which
 * holds the guid as a `<name>.<type>.cid` entry. Reads only the archive's directory and that
 * entry: a save weighs tens of megabytes.
 */
async function readAssetGuid(folder: string, name: string, type: string): Promise<string> {
  // The assets lie in a folder per Steam user.
  const root = path.join(userDataPath, folder);
  const users = await readdir(root).catch((): string[] => []);
  const candidates = users.map(user => Bun.file(path.join(root, user, `${name}.cok`)));
  const found = await Promise.all(candidates.map(candidate => candidate.exists()));
  const archive = candidates.find((_candidate, index) => found[index]);

  if (!archive) {
    throw new Error(`No ${folder.toLowerCase().slice(0, -1)} named "${name}" in ${root}.`);
  }

  const entry = await readStoredZipEntry(archive, `${name}.${type}.cid`);

  return new TextDecoder().decode(entry).trim();
}

// oxlint-disable no-magic-numbers -- the offsets of the zip format's records, as its specification
// numbers them.

/**
 * Reads an entry of a zip archive that stores it uncompressed, as the game's archives do.
 */
async function readStoredZipEntry(archive: BunFile, entryName: string): Promise<Uint8Array> {
  const { size } = archive;
  // PK\x05\x06, little-endian.
  const endOfDirectorySignature = 101_010_256;

  // The end of central directory record: 22 bytes, then a comment of up to 64 KiB.
  const tailStart = Math.max(0, size - 22 - 65_535);
  const tail = new DataView(await archive.slice(tailStart, size).arrayBuffer());

  let end = tail.byteLength - 22;

  while (end >= 0 && tail.getUint32(end, true) !== endOfDirectorySignature) {
    end--;
  }

  if (end < 0) {
    throw new Error(`${archive.name} is not a zip archive.`);
  }

  const directoryOffset = tail.getUint32(end + 16, true);
  const directorySize = tail.getUint32(end + 12, true);
  const directory = new DataView(
    await archive.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer()
  );

  let offset = 0;

  while (offset + 46 <= directory.byteLength) {
    const nameLength = directory.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(
      new Uint8Array(directory.buffer, offset + 46, nameLength)
    );

    if (name === entryName) {
      break;
    }

    offset +=
      46 +
      nameLength +
      directory.getUint16(offset + 30, true) +
      directory.getUint16(offset + 32, true);
  }

  if (offset + 46 > directory.byteLength) {
    throw new Error(`${archive.name} holds no ${entryName}.`);
  }

  if (directory.getUint16(offset + 10, true) !== 0) {
    throw new Error(`${archive.name} compresses ${entryName}, which this reader does not read.`);
  }

  const entrySize = directory.getUint32(offset + 20, true);
  const headerOffset = directory.getUint32(offset + 42, true);
  const header = new DataView(await archive.slice(headerOffset, headerOffset + 30).arrayBuffer());
  const dataStart = headerOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);

  return new Uint8Array(await archive.slice(dataStart, dataStart + entrySize).arrayBuffer());
}

// oxlint-enable no-magic-numbers

/**
 * The PIDs of Cities2.exe.
 */
async function gameProcessPids(): Promise<number[]> {
  if (isWindows) {
    const csv = await run(['tasklist', '/FI', 'IMAGENAME eq Cities2.exe', '/FO', 'CSV', '/NH']);

    return [...csv.matchAll(/^"Cities2\.exe","(?<pid>\d+)"/gmu)].map(match =>
      Number(match.groups?.pid)
    );
  }

  // By exact process name: a pattern over command lines also matches any shell whose command line
  // holds it, the agent's own tool call included.
  const pids = await run(['pgrep', '-x', 'Cities2.exe']);

  return pids.split('\n').filter(Boolean).map(Number);
}

/**
 * Whether the game's own process runs: Steam's reaper outlives a crash by many seconds.
 */
export async function isGameProcessRunning(): Promise<boolean> {
  const pids = await gameProcessPids();

  return pids.length > 0;
}

/**
 * Asks the game's processes to end, or ends them by force.
 */
async function killGame(force: boolean): Promise<void> {
  for (const pid of await gamePids()) {
    if (isWindows) {
      await run(['taskkill', ...(force ? ['/F'] : []), '/PID', String(pid)]);
    } else {
      try {
        process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
      } catch {
        // The process ended since it was listed.
      }
    }
  }
}

/**
 * Runs a command and returns its standard output, whatever its exit code.
 */
async function run(command: readonly string[]): Promise<string> {
  const child = Bun.spawn([...command], { stdout: 'pipe', stderr: 'ignore' });
  const output = await new Response(child.stdout).text();

  await child.exited;

  return output;
}

export function secondsSince(time: Date): number {
  return Math.round((Date.now() - time.getTime()) / 1000);
}
