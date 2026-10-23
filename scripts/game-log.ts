// Reads the game's logs: each file under `Logs/` in its user data folder, and `Player.log`.
// Pure functions over the logs' text, tested in game-log.test.ts.

/**
 * One entry of a game log: `[2026-10-23 12:37:22,040] [INFO]  message`, the lines after it that
 * carry no stamp of their own belonging to its message.
 */
export interface LogEntry {
  readonly time: Date;
  readonly level: string;
  readonly message: string;
}

/**
 * The levels at and above `ERROR`.
 */
const errorLevels: ReadonlySet<string> = new Set(['ERROR', 'CRITICAL', 'FATAL', 'EMERGENCY']);

const entryPattern =
  /^\[(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hours>\d{2}):(?<minutes>\d{2}):(?<seconds>\d{2}),(?<milliseconds>\d{3})\] \[(?<level>[A-Z]+)\] {1,2}(?<message>.*)$/u;

/**
 * Parses a game log into its entries, keeping those stamped at or after `since`: the game writes
 * each log afresh at launch, so a file read before the game rewrote it holds the previous run's.
 * The stamps are in local time, the game's under Proton too.
 */
export function parseLog(text: string, since = new Date(0)): LogEntry[] {
  const entries: Array<{ time: Date; level: string; message: string }> = [];

  for (const line of text.split(/\r?\n/u)) {
    const groups = entryPattern.exec(line)?.groups;

    if (groups) {
      entries.push({
        time: new Date(
          Number(groups.year),
          Number(groups.month) - 1,
          Number(groups.day),
          Number(groups.hours),
          Number(groups.minutes),
          Number(groups.seconds),
          Number(groups.milliseconds)
        ),
        level: groups.level ?? '',
        message: groups.message ?? ''
      });
    } else if (line && entries.length > 0) {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- length checked above.
      entries.at(-1)!.message += `\n${line}`;
    }
  }

  return entries.filter(entry => entry.time >= since);
}

/**
 * The entries at an error level, one of which fails the run wherever it is logged.
 */
export function errorEntries(entries: readonly LogEntry[]): LogEntry[] {
  return entries.filter(entry => errorLevels.has(entry.level));
}
