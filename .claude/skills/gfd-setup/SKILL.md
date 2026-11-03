---
name: gfd-setup
description: Set up a new mod from this template, one step at a time, from a fresh copy to a built, tested and committed mod. Use when the user starts a mod from the template or asks to set it up, or ran `mise init` by hand and wants the rest done.
---

# Set up a mod

A wizard of 14 steps, run in order, that walks a newcomer from a copy of the template to their own mod: built, tested, and in its first commit.
`mise init` does every file change; the wizard only collects its flags, checks the machine, and runs what comes after it.

## How to talk

The user may be new to modding, to this stack, or to agents.

- One step per message: say in a sentence or two what the step decides and why it matters, show the default and your recommendation, the recommendation's reason in a clause, then wait for the answer.
- Plain, concise words. Name a tool once, with what it is for.
- Give everything the user must do as an exact command in a code block, or as bullets they follow in order, saying which OS a command is for.
- Run the checks and commands yourself; ask the user only for what needs them: an install, closing the game, a decision.
- Keep every answer: step 11 shows them all in one summary.

## Where to start

Init already ran when `.template.json` exists at the repository's root, from `mise init` run by hand or at step 11 here: skip the interview, and run steps 2 and 3, then the Licence section where `LICENSE` is missing, then 12 to 14.
Otherwise, read [`interview.md`](interview.md) now and run the steps from step 1: it holds steps 1 and 4 to 11, this file steps 2, 3 and 12 to 14.

## 2. Plugins

The mod's `AGENTS.md` assumes three plugins of the `csmodding` marketplace: `cs2-modding` (how the game works and how mods change it), `coherent-gameface` (the game's UI engine, and the `game_*` tools driving it), and `unity-devtools` (the `unity` tools reaching into the running game).
Check your own skills and tools for them.

When one is missing, stop: give the user the install commands for the agent they run, then a look at `/mcp`, where the plugins' servers must show as connected; where one does not, `/reload-plugins`, or a restart of the session (Codex: always). Then go on.

```
/plugin marketplace add CitiesSkylinesModding/agents-plugins
/plugin install cs2-modding@csmodding
/plugin install coherent-gameface@csmodding
/plugin install unity-devtools@csmodding
```

```
codex plugin marketplace add CitiesSkylinesModding/agents-plugins
codex plugin add cs2-modding@csmodding
codex plugin add coherent-gameface@csmodding
codex plugin add unity-devtools@csmodding
```

The `cantrips` plugin is optional: an agent workflow (grill an idea, write a spec, split it into tickets, implement, review, commit) that `docs/agents/cantrips-loop.md` already configures for this repository.
When its skills are missing, suggest it once, with `/plugin marketplace add toverux/cantrips` then `/plugin install cantrips@cantrips` (Codex: `codex plugin marketplace add toverux/cantrips` then `codex plugin add cantrips@cantrips`), and go on whatever the answer.

**Done when** the three csmodding plugins are loaded in this session, and cantrips is loaded or was suggested.

## 3. Environment

Check each item yourself, in order, and give the user the fix for what fails.

- **mise**, which installs the pinned tools and runs every task: `mise --version`. Missing: [install it](https://mise.jdx.dev/getting-started.html) (Windows: `winget install jdx.mise`; Linux: `curl https://mise.run | sh`) and activate it in the shell.
- **The pinned tools** of `mise.toml`'s `[tools]`, bun and the .NET SDK among them: `mise trust`, then `mise install`, then `mise ls --current` lists each as installed.
- **The packages**: `bun install`. A `Blocked … postinstall` line names a package `package.json` does not trust to run scripts, which the mod does not need: leave it so.
- **git**, with an identity for the commits: `git --version`, `git config user.name`, `git config user.email`.
- **The game and its modding toolchain**, which the build and the tests need. Load the `cs2-mod-project` skill first: it owns the toolchain, its install on both systems, and the build failures of step 12. The template's csproj already carries the Linux edits that skill describes. The check: the toolchain's `CSII_*` variables, `CSII_TOOLPATH`, `CSII_INSTALLATIONPATH`, `CSII_MANAGEDPATH` and `CSII_LOCALMODSPATH` among them, visible to your shell (`printenv CSII_TOOLPATH`; on Windows, `$env:CSII_TOOLPATH` in PowerShell).
  - On Windows, the game installs the toolchain from its Options, Modding tab. Its variables reach only programs started afterwards: restart the terminal and the agent session once it finishes.
  - On Linux, where that installer cannot run, offer `mise setup:linux`, with the game installed through Steam, launched once, and closed. It prints how to load the variables into a shell; restart the agent session from such a shell.
  - Where the setup fails, follow the `cs2-mod-project` skill's install steps for the system.

A missing toolchain blocks step 12 alone: the interview can go on while it installs.

**Done when** each item passes, or the toolchain alone is still installing and the user knows it must be done by step 12.

## Licence

`mise init` deletes the template's own `LICENSE`, so the mod's is written after it, at step 11.

The question: which licence the mod's code takes, by its SPDX ID.
Recommend `MIT`, the usual choice for mods: anyone may reuse the code, with the copyright line kept.
Name a few others in a line: `MIT-0` (MIT without even the copyright line), `Apache-2.0` (MIT plus an explicit patent grant), `MPL-2.0` (changes to the mod's own files stay open), `GPL-3.0-or-later` (whole derived works stay open), or none (all rights reserved, no `LICENSE` file).

Writing it: download the SPDX text, then fill the copyright line's placeholders, where the text opens with one (MIT's `<year> <copyright holders>`), with the current year and the author; leave the rest as it is.

```
curl -fsSL https://raw.githubusercontent.com/spdx/license-list-data/main/text/<SPDX ID>.txt -o LICENSE
```

In Windows PowerShell, write `curl.exe`: there `curl` names `Invoke-WebRequest`, which takes none of these options.

## 12. First run

The first build and test run come before the first commit, so whatever they need fixed lands in it.
`.template.json` says which parts the mod kept; the C# formatter is `dotnet format` where `parts.jb` is `false`.

1. Ask the user to close the game: the build deploys over the mod's DLL, which a running game holds open.
2. `mise build`: builds the mod in Debug and deploys it, the C# and the UI, to the game's local Mods folder.
3. `mise fix:cs`: formats the renamed C# in the house style. Required with `dotnet format`, which reformats the template's code to its own settings (the preprocessor directives move to the first column), else its pre-commit check refuses it; with jb it is the slow one, minutes, and `AGENTS.md` asks for it before every commit touching C#.
4. `mise check`, and `mise check:cs` too with `dotnet format`. A formatting failure is fixed by `mise fix`, then the check runs again.
   Every `dotnet format` run warns that warnings were encountered while loading the workspace: the .NET 10 test project referencing the `net48` mod, which is expected.
5. `mise test`: every off-engine test layer the mod kept.
6. Offer a first look in the game, through the `cs2-dev` tools, with the `unity-driving` and `gameface-driving` skills loaded before the first `unity` or `game_*` tool call: `restart` with `mod` set to the mod ID and a new city, and confirm `Logs/Modding.log` loaded the mod from the local Mods folder, which its `Registered UI Module` line names.

A failure is fixed before the next item, explained to the user in a sentence: a build, post-processing or deploy failure, or a mod missing from the game, through the `cs2-mod-project` skill.

**Done when** the build, the formatter, the checks and the tests passed, and the user took or declined the game cycle.

## 13. Delete the wizard

The mod needs this skill no longer.
Read step 14 below first, so it stays in your context, then:

- Delete this skill's folder, `.claude/skills/gfd-setup/`, which init renamed after the mod's prefix and moved under `.template.json`'s `skills` path.
- In `README.md`, delete the note between `<!-- setup-note:start -->` and `<!-- setup-note:end -->`, the two markers and the blank line above them included: it tells someone who ran `mise init` by hand to do what this wizard did.

**Done when** the folder and the note are gone, and `mise check:oxfmt` passes.

## 14. First commit

The repository's history already starts with the template unmodified, so an agent can later get back a part the mod pruned: `AGENTS.md`'s Template origin section says how.
This commit turns it into the mod.

1. `bunx lefthook install`, so the git hooks check this commit and every later one.
2. Show the user `git status --short` and the commit message, `feat: start <display name> from Greenfield Mod Template`, and ask whether to commit.
3. On their yes, `git add --all`, then `git commit -m "<message>"`. A hook that fails is fixed, and the commit tried again.

Close with what comes next, in bullets:

- Create the mod's own repository and push to it: `git remote add origin <url>`, then `git push -u origin HEAD`.
- The `cs2-modding-setup` skill, which sets up what an agent reads and drives the game with: a decompile of the game, a readable copy of its UI bundle, and the debug launch options and ports `AGENTS.md`'s end-to-end contract relies on. Offer to run it now.
- The commands of `README.md`'s Commands section, for everyday work.
- Later template improvements: the template's update skill brings them in, run from a clone of the template; the template's README says how.

**Done when** the user declined the commit, or the commit holds the mod and `git status` is clean.
