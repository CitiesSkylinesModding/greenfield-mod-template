// Reads the game's logs of an in-game test run: what each scenario logged and how it ended, and how
// the run itself ended. Pure functions over the logs' text, so they are tested on fixtures
// (scenario-log.test.ts); scripts/test-game.ts does the watching.

import { errorEntries, type LogEntry } from './game-log';

export interface ScenarioResult {
  readonly name: string;
  /**
   * The entries the scenario logged, from its start line to its finish line.
   */
  readonly entries: readonly LogEntry[];
  /**
   * Why the scenario failed, empty when it passed.
   */
  readonly failures: readonly string[];
}

export type RunVerdict = 'running' | 'finished' | 'died' | 'stuck' | 'timed out';

export interface RunState {
  /**
   * The entries of `Automation.log` since the launch.
   */
  readonly automation: readonly LogEntry[];
  /**
   * The entries of `TestScenarios.log` since the launch.
   */
  readonly scenarios: readonly LogEntry[];
  readonly gameAlive: boolean;
  readonly launchTime: Date;
  readonly now: Date;
}

export interface RunLimits {
  /**
   * Seconds the game may take to start the scenarios, from the launch.
   */
  readonly bootSeconds: number;
  /**
   * Seconds `TestScenarios.log` may stand still once the scenarios started: a scenario loading a
   * city logs nothing until the load ends.
   */
  readonly stallSeconds: number;
  /**
   * Seconds the whole run may take, from the launch.
   */
  readonly runSeconds: number;
}

const scenarioStartPattern = /^---\| START TEST SCENARIO: (?<name>.+?)\s*$/u;

const scenarioFinishPattern =
  /^---\| FINISH TEST SCENARIO \((?<outcome>Success|Failure), exceptions: \d+, errors: \d+\): (?<name>.+?)\s*$/u;

const testFinishPattern = /^---\| FINISH TEST \((?<outcome>Success|Failure), /u;

/**
 * Splits the entries of `TestScenarios.log` into its scenarios, and judges each one.
 * The game's own verdict is not enough: when the preparation of a scenario throws (a load that
 * failed, or errors logged before it started), the game logs the error, runs no test and still
 * reports the scenario a success. So a scenario passes only when the game reports it a success,
 * at least one of its tests finished, and nothing in it was logged at an error level.
 */
export function readScenarios(entries: readonly LogEntry[]): ScenarioResult[] {
  const scenarios: ScenarioResult[] = [];

  let current: { name: string; entries: LogEntry[] } | undefined;

  for (const entry of entries) {
    const startName = scenarioStartPattern.exec(entry.message)?.groups?.name;

    if (startName !== undefined) {
      if (current) {
        scenarios.push(judgeScenario(current.name, current.entries));
      }

      current = { name: startName, entries: [entry] };

      continue;
    }

    if (!current) {
      continue;
    }

    current.entries.push(entry);

    const finish = scenarioFinishPattern.exec(entry.message)?.groups;

    if (finish?.name === current.name) {
      scenarios.push(judgeScenario(current.name, current.entries, finish.outcome));

      current = undefined;
    }
  }

  if (current) {
    scenarios.push(judgeScenario(current.name, current.entries));
  }

  return scenarios;
}

/**
 * How the run stands: finished once the game logged the end of its scenarios, died when the game
 * is gone before that, stuck when a scenario logs nothing for too long, timed out past a deadline.
 */
export function classifyRun(state: RunState, limits: RunLimits): RunVerdict {
  const automationEntry = (message: string): LogEntry | undefined =>
    state.automation.find(entry => entry.message === message);

  const elapsedSeconds = (state.now.getTime() - state.launchTime.getTime()) / 1000;

  if (automationEntry('Finished test scenarios.')) {
    return 'finished';
  }

  if (!state.gameAlive) {
    return 'died';
  }

  const scenariosStart = automationEntry('Starting test scenarios.');

  if (!scenariosStart) {
    return elapsedSeconds >= limits.bootSeconds ? 'timed out' : 'running';
  }

  // From the start of the scenarios at the earliest: the game writes TestScenarios.log at boot,
  // then nothing until the first scenario, a frame after each of its own it skips.
  const lastActivity = Math.max(
    scenariosStart.time.getTime(),
    state.scenarios.at(-1)?.time.getTime() ?? 0
  );

  if ((state.now.getTime() - lastActivity) / 1000 >= limits.stallSeconds) {
    return 'stuck';
  }

  return elapsedSeconds >= limits.runSeconds ? 'timed out' : 'running';
}

function judgeScenario(
  name: string,
  entries: readonly LogEntry[],
  outcome?: string
): ScenarioResult {
  const failures: string[] = [];

  if (outcome === undefined) {
    failures.push('it did not finish');
  } else if (outcome !== 'Success') {
    failures.push('the game reported a failure');
  }

  const testOutcomes = entries.flatMap(entry => {
    const testOutcome = testFinishPattern.exec(entry.message)?.groups?.outcome;

    return testOutcome === undefined ? [] : [testOutcome];
  });

  if (outcome !== undefined && testOutcomes.length === 0) {
    failures.push('it ran no test: its preparation failed, see the errors above');
  }

  const failedTests = testOutcomes.filter(testOutcome => testOutcome !== 'Success').length;

  if (failedTests > 0) {
    failures.push(`${failedTests} of its ${testOutcomes.length} tests failed`);
  }

  if (errorEntries(entries).length > 0) {
    failures.push('it logged an error');
  }

  return { name, entries, failures };
}
