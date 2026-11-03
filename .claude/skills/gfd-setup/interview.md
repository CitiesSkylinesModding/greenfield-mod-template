# The interview: steps 1 and 4 to 11

The questions before `mise init`, each answer one of its flags, then the summary and init itself.
Steps 2 and 3 are in [`SKILL.md`](SKILL.md); talk as its How to talk section says.
`mise init` deletes this file with the rest of the template-only material: steps 12 to 14 go on from `SKILL.md`.

## 1. Describe the mod

Ask what they are building, in a few sentences: what it changes in the game, whether it has a UI of its own, and whether it computes geometry or simulation maths.
Ask too whether this is their first mod on the template, whether they want volunteers to translate it, and which systems they and any contributors build on.
The description sets your recommendation at every later step, and the short description of step 10 starts from it.

Read it against this table, and say in a line what it leads you to recommend:

| Part                    | Recommend keeping it when                                               |
| ----------------------- | ----------------------------------------------------------------------- |
| Sample slice            | This is their first mod on the template, to see how the layers connect. |
| UI tests                | The mod has a UI of its own: a panel, a button, an overlay.             |
| In-game test layer      | The mod runs ECS systems over a live city, reading or changing it.      |
| Crowdin                 | They want volunteers to translate the mod.                              |
| Linux setup script      | They, or a contributor, build on Linux.                                 |
| float64 test pass       | The mod computes geometry, pathfinding or simulation maths in `float`.  |

**Done when** you hold the description and a recommendation for each part.

Then run steps 2 and 3 of `SKILL.md`, and come back for step 4.

## 4. Identity

One screen, four answers, each with your proposal from the description:

- **Mod ID** (`--id`): PascalCase letters and digits, a valid C# identifier, ex. `CityPulse`. It names the folders, the C# project and namespace, the settings file, the log and the locale keys, and is hard to change later.
- **Display name** (`--name`): what players see, ex. `City Pulse`.
- **Author** (`--author`): written into `mod.json`; propose `git config user.name`.
- **Short prefix** (`--prefix`): 2 to 8 lowercase letters and digits, the prefix of the UI's CSS classes and of the skill names (`<prefix>-release`). Propose the ID's word initials (`HallOfFame` gives `hof`), or its first three letters for a one-word ID, as init derives it.

**Done when** all four are set.

## 5. Fast path

Offer to take every default from here and jump to the summary, listing what that means: CalVer versioning, the `MIT` licence, each part as step 1 recommends, the skills and rules where this agent loads them (step 9), the short description from step 1, no forum or GitHub link yet, and a fresh git history.
Every choice stays editable at the summary.

**Done when** the user chose the fast path (go to step 11) or the full walk (go to step 6).

## 6. Versioning

- **CalVer** (default): `<year>.<feature>.<patch>`, starting at `<year>.0.0`; a release in a new year resets to `<year>.0.0`.
- **SemVer** (`--versioning semver`): `<major>.<minor>.<patch>`, starting at `1.0.0`.

Both tag releases `v<version>`, and neither takes a pre-release suffix: the game parses the version as a `System.Version`.
The choice sets the release skill's bump rules.

**Done when** a scheme is chosen.

## 7. Licence

Ask the question of `SKILL.md`'s Licence section. The text is written at step 11, after init.

**Done when** an SPDX ID, or none, is chosen.

## 8. Optional parts

One screen per part, in this order, each saying what the part is, what keeping it costs, and your recommendation from step 1. Pruning a part removes every file, task, package and line of it; the template's first commit keeps a copy (step 11).

1. **Sample slice** (`--no-sample-slice`): the entity counter, a mods-menu button opening a vanilla panel that shows the city's entity count and the simulation date. It touches every layer once: a setting, a Burst-compiled system, a UI system and its binding, the panel, a key binding, the 12 locales, a Debug entry point, and a test on each test layer. The template README lists its files, for deleting it later.
2. **UI tests** (`--no-ui-tests`): bun tests rendering the mod's React components against the game's real UI bundle, with mocked bindings, without launching the game.
3. **In-game test layer** (`--no-game-tests`): scenarios the game's own test framework runs in a live city, through the `cs2-dev` `test` tool, which launches the game unattended and reports each one. A run takes minutes, and needs a Debug build.
4. **Crowdin** (`--no-crowdin`): `mise l10n:push` and `mise l10n:pull`, syncing the locale files with a Crowdin project where volunteers translate. Ask for the numeric project ID (`--crowdin-project-id`), or leave it for later in `mise.toml`'s `CROWDIN_PROJECT_ID`; the token stays out of the repository, in the environment or `mise.local.toml`. Without Crowdin, the translate skill translates the locales itself.
5. **Linux setup script** (`--no-linux-setup`): `mise setup:linux`, installing the modding toolchain on Linux, where the game's own installer cannot run.
6. **float64 test pass** (`--no-float64`): runs the off-engine C# tests a second time in the precision the game's managed code computes `float` in, which catches bugs that only show in game, such as a stored value compared with the same expression computed again. It adds seconds to each test run.
7. **C# formatter** (`--formatter dotnet-format` for the alternative):
   - jb cleanupcode (default): the full house style, the engine Rider uses; slow, and with no read-only check.
   - `dotnet format`: faster, with a read-only `mise check:cs` in the pre-commit hook; it leaves line wrapping alone, so less of the style is applied, and its settings differ from jb's in a few places, the preprocessor directives at the first column among them.

**Done when** each part above has an answer.

## 9. Where skills and rules live

The skills (`skills/`) and the code-style rules (`rules/`) live under one agent directory, `--agent-dir`.
Propose the one the agent running this wizard loads: `.claude` for Claude Code (the default: nothing moves), `.agents` for Codex.
Warn that Claude Code loads skills only from `.claude/`: a mod someone works on with Claude Code keeps `.claude`.
Only Claude Code loads the rules by itself; for another directory, offer a line in `AGENTS.md` pointing at them, written at step 11.

**Done when** a directory is chosen, and the `AGENTS.md` line taken or declined where it is not `.claude`.

## 10. Publish configuration

The Paradox Mods page the mod is published on:

- **Short description** (`--description`): one line, shown on Paradox Mods and at the top of the README. Propose it from step 1.
- **Forum link** (`--forum-link`): the mod's thread on the Paradox forums, where players report bugs. Nudge: one can be created now, or added later in `Properties/PublishConfiguration.xml`.
- **GitHub URL** (`--github-url`): the repository's page, linked from the mod page. Nudge the same way.

**Done when** the description is set, and each link is given or left for later.

## 11. Summary and init

Show every answer in one table, with the flag each becomes, then the two links' nudges where one is left empty.

Add the git history, defaulting to a fresh one:

- **Fresh** (default): the mod's history starts with one commit holding the template unmodified, then the mod's.
- **Kept**: the template's history stays under the mod's, its `origin` renamed to `template`.

Where the repository has no `.git` (a downloaded archive), the history is fresh.

Ask the user to confirm, or name what to change. A fresh history over a clone deletes the template's `.git`: say so in the confirmation.

On their yes:

1. **Commit the template unmodified**, so the mod's history keeps a copy of every part it prunes. In a clone, note the template commit first, `git rev-parse HEAD`, kept for `--template-commit`. Init refuses a tree with uncommitted changes: where `git status --porcelain` lists any, commit them, with the user's go-ahead, rather than stash them: a fresh history deletes the stash with `.git`. HEAD is then the user's commit, which the template lacks, so pass the noted one as `--template-commit` whatever the history.
   - Kept history: the clone's HEAD is that commit, or its parent where the user's changes were committed. `git remote rename origin template`.
   - Fresh history over a clone: delete `.git`; then `git init`, `git add --all`, `git commit -m "chore: start from Greenfield Mod Template"`.
   - An archive: the template commit is the latest, `git ls-remote https://github.com/CitiesSkylinesModding/greenfield-mod-template HEAD`; tell the user, and use theirs where they downloaded an older one. Where that command fails (offline, the repository unreachable), ask the user for the commit, from the repository's page. Then `git init`, `git add --all`, `git commit -m "chore: start from Greenfield Mod Template"`.
2. **Run init** with the flags, quoting every value holding a space, `--template-commit <sha>` included for a fresh history, an archive, or a kept history with the user's commit on top:

   ```
   mise init --id CityPulse --name "City Pulse" --author "Jane Doe" --description "Shows what the city is doing." --no-float64
   ```

   Init checks everything before it writes: on a failure it wrote nothing, and its message names the flag or the step to fix. Do what its last lines ask, if anything (`bun install`, `mise fix:oxfmt`).
3. **Write the licence** chosen at step 7, as `SKILL.md`'s Licence section says.
4. **Point `AGENTS.md` at the rules**, where step 9 took that line: under its Guidelines, `- Follow the code-style rules in <agent dir>/rules/ for every file you write or edit.`

Init renamed this skill's folder after the mod's prefix and moved it under the chosen agent directory; `SKILL.md` goes on there.

**Done when** init reported success and the licence is written, then go to step 12 of `SKILL.md`.
