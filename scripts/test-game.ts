// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- a CLI script runs on Bun, not in the game.

// Runs the mod's in-game test scenarios, unattended:
//   mise test:game [--keep-open] [<game options>]
// Launches the game with the mod's scenario category as its test filter, which makes the game run
// those scenarios five seconds after its main menu, watches the logs until the run ends, prints
// each scenario's result and lines, stops the game (unless --keep-open), and sets the exit code.
// Needs the game closed and a Debug build deployed (`mise build`): only a Debug build carries the
// scenarios.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { requireEnvironment } from './environment';
import {
  BOOT_SECONDS,
  gameLeftRunning,
  isGameProcessRunning,
  isGameOrReaperRunning,
  launchGame,
  LOAD_SECONDS,
  readLog,
  secondsSince,
  stopGame,
  userDataPath,
  waitUntil
} from './game';
import { errorEntries, type LogEntry } from './game-log';
import {
  classifyRun,
  readScenarios,
  type RunLimits,
  type RunVerdict,
  type ScenarioResult
} from './scenario-log';

const MOD_NAME = 'Greenfield';

/**
 * `ScenarioRegistry.ScenarioCategory` (1 << 20), in Greenfield/Scenarios/ScenarioRegistry.cs.
 */
const SCENARIO_CATEGORY = 1_048_576;

// A scenario that loads a city logs nothing for as long as the load takes.
const limits: RunLimits = {
  bootSeconds: BOOT_SECONDS,
  stallSeconds: LOAD_SECONDS + 60,
  runSeconds: 1800
};

const logsPath = path.join(userDataPath, 'Logs');
const automationLogPath = path.join(logsPath, 'Automation.log');
const scenariosLogPath = path.join(logsPath, 'TestScenarios.log');
const modLogPath = path.join(logsPath, `${MOD_NAME}.log`);

/**
 * How a run ends when the script is asked to stop: Ctrl+C, or a SIGTERM from whatever runs it.
 */
type Verdict = RunVerdict | 'interrupted';

// The watch ends at its next check, and the game is stopped as at the end of any run.
let interrupted = false;

function interrupt(): void {
  interrupted = true;
}

process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);

try {
  process.exitCode = (await testGame(process.argv.slice(2))) ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);

  process.exitCode = 1;
}

async function testGame(args: readonly string[]): Promise<boolean> {
  // Every other argument is a game option: mise drops a `--` that would have parted them.
  const keepOpen = args.includes('--keep-open');
  const gameOptions = args.filter(arg => arg != '--keep-open');

  if (await isGameOrReaperRunning()) {
    throw new Error(
      'Close the game first, from the unity eval or with `mise game stop`: `mise test:game` ' +
        'launches it itself.'
    );
  }

  await checkDeployedBuild();

  const launchTime = new Date();

  // A launch that fails stops what it started itself.
  await launchGame([`--categoryFilter=${SCENARIO_CATEGORY}`, ...gameOptions]);

  let verdict: Verdict | undefined;

  try {
    verdict = await watchRun(launchTime);
  } finally {
    // Whatever ended the watch, a crash of this script included, the game does not outlive it
    // unless asked to.
    if (keepOpen) {
      const leftRunning = await gameLeftRunning();

      if (leftRunning) {
        console.log(`\n${leftRunning}`);
      }
    } else {
      await stopGame(0);
    }
  }

  console.log(`\nRun: ${verdict}, ${secondsSince(launchTime)} s after the launch.`);

  return report(verdict, launchTime);
}

/**
 * Checks that the deployed mod is a Debug build, the one carrying the scenarios, and warns when the
 * sources changed after it was built.
 */
async function checkDeployedBuild(): Promise<void> {
  const assemblyPath = path.join(
    requireEnvironment('CSII_LOCALMODSPATH'),
    MOD_NAME,
    `${MOD_NAME}.dll`
  );

  const assembly = Bun.file(assemblyPath);

  if (!(await assembly.exists())) {
    throw new Error(`The mod is not deployed (${assemblyPath}): run \`mise build\`.`);
  }

  // The Release build compiles no scenario: its assembly does not hold the registry's name.
  const assemblyText = await assembly.text();

  if (!assemblyText.includes('ScenarioRegistry')) {
    throw new Error(
      'The deployed mod is a Release build, which carries no scenario: run `mise build`, a Debug ' +
        'build.'
    );
  }

  const projectPath = path.join(import.meta.dir, '..', MOD_NAME);
  // One glob per pattern: Bun's glob matches nothing when a braced alternative holds a `/`.
  const sources = await Promise.all(
    ['**/*.cs', '*.csproj', 'Locales/*.json'].map(pattern =>
      Array.fromAsync(new Bun.Glob(pattern).scan(projectPath))
    )
  );

  const changedSource = sources
    .flat()
    .find(
      source =>
        !/^(?:bin|obj)[/\\]/u.test(source) &&
        Bun.file(path.join(projectPath, source)).lastModified > assembly.lastModified
    );

  if (changedSource) {
    console.warn(
      `Warning: ${changedSource} changed after the deployed build: run \`mise build\` to test it.`
    );
  }
}

/**
 * Watches the logs and the game until the run ends, printing each scenario as it starts.
 */
async function watchRun(launchTime: Date): Promise<Verdict> {
  let started = 0;
  let verdict: Verdict = 'running';

  // The deadlines are the run's own, which classifyRun applies: this one is a backstop.
  await waitUntil(async () => {
    if (interrupted) {
      verdict = 'interrupted';

      return true;
    }

    const scenarioEntries = await readLog(scenariosLogPath, launchTime);
    const scenarios = readScenarios(scenarioEntries);

    for (const scenario of scenarios.slice(started)) {
      console.log(`Started: ${scenario.name}`);
    }

    started = scenarios.length;

    verdict = classifyRun(
      {
        automation: await readLog(automationLogPath, launchTime),
        scenarios: scenarioEntries,
        gameAlive: await isGameProcessRunning(),
        launchTime,
        now: new Date()
      },
      limits
    );

    return verdict != 'running';
  }, limits.runSeconds * 2);

  return verdict == 'running' ? 'timed out' : verdict;
}

/**
 * Prints the results of the run, and returns true when it passed.
 */
async function report(verdict: Verdict, launchTime: Date): Promise<boolean> {
  const scenarios = readScenarios(await readLog(scenariosLogPath, launchTime));
  const failures: string[] = [];

  for (const scenario of scenarios) {
    printScenario(scenario);
  }

  if (verdict != 'finished') {
    failures.push(`the run ended: ${verdict}`);
  }

  if (verdict == 'died') {
    console.log(
      `\nCrash dumps: ${path.join(userDataPath, '.cache', 'backtrace', 'crashpad', 'reports')}`
    );
  }

  if (verdict == 'finished' && scenarios.length == 0) {
    failures.push(
      `no scenario ran: none may be written yet; otherwise the category in scripts/test-game.ts ` +
        `must be ScenarioRegistry.cs one, and ${modLogPath} must show the registry adding the ` +
        `scenarios`
    );
  }

  const failedScenarios = scenarios.filter(scenario => scenario.failures.length > 0).length;

  if (failedScenarios > 0) {
    failures.push(`${failedScenarios} of ${scenarios.length} scenarios failed`);
  }

  let modErrorCount = 0;

  for (const [logPath, errors] of await readModErrors(launchTime)) {
    console.log(`\nErrors in ${logPath}:`);

    for (const entry of errors) {
      printEntry(entry);
    }

    modErrorCount += errors.length;
  }

  if (modErrorCount > 0) {
    failures.push(`the mod logged ${modErrorCount} errors`);
  }

  console.log(
    failures.length == 0
      ? `\nPASSED: ${scenarios.length} scenarios.`
      : `\nFAILED: ${failures.join('; ')}.`
  );

  return failures.length == 0;
}

/**
 * The errors of the mod since the launch, by log: every error in its own log, and the errors in the
 * game's other logs that name it.
 * The game logs an exception a system throws in SceneFlow.log, where only the stack trace names the
 * mod, and a scenario dismisses the errors logged before it (ModTestScenario), so one thrown at the
 * main menu fails no scenario.
 * TestScenarios.log is left out: each scenario is judged on its own errors.
 */
async function readModErrors(launchTime: Date): Promise<Map<string, LogEntry[]>> {
  const logNames = await readdir(logsPath);

  const logPaths = logNames
    .filter(name => name.endsWith('.log'))
    .map(name => path.join(logsPath, name))
    .filter(logPath => logPath != scenariosLogPath);

  const errorsByLog = await Promise.all(
    logPaths.map(async logPath => {
      const errors = errorEntries(await readLog(logPath, launchTime)).filter(
        entry => logPath == modLogPath || entry.message.includes(`${MOD_NAME}.`)
      );

      return [logPath, errors] as const;
    })
  );

  return new Map(errorsByLog.filter(([, errors]) => errors.length > 0));
}

function printScenario(scenario: ScenarioResult): void {
  console.log(`\n${scenario.name}`);

  for (const entry of scenario.entries) {
    // The memory figures the game logs after every scenario.
    if (!entry.message.startsWith('[Metrics]')) {
      printEntry(entry);
    }
  }

  if (scenario.failures.length > 0) {
    console.log(`  => FAILED: ${scenario.failures.join('; ')}.`);
  }
}

function printEntry(entry: LogEntry): void {
  const level = entry.level == 'INFO' ? '' : `[${entry.level}] `;

  console.log(`  ${level}${entry.message.replaceAll('\n', '\n    ')}`);
}
