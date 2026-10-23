---
name: tmt-game-cycle
description: Restart the game on a fresh build and drive it to a city, then read what it did. Use after a build to see a change in the running game, to restart the game, load a save or start a new city, stop the game, diagnose a crash, a hang or a mod that did not load, or capture screenshots.
---

# The game cycle

One **cycle** takes a change from a build to a city in the running game.
[`scripts/game.ts`](../../../scripts/game.ts) drives the game's process on Linux (Steam and Proton) and on Windows, behind `mise game`; its Windows branch is untested on a real Windows machine.

## A cycle

1. If the game runs, quit it from the unity eval: `UnityEngine.Application.Quit(); "quit"`.
   A clean quit saves the game's settings and the mods'; `mise game stop` and `mise game restart` give a quitting game a minute, then kill it.
2. `mise build`: the running game holds the mod's DLL open, so a C# build waits for step 1. A change to the UI alone deploys with `mise build:ui`, the game open.
3. Start the game:
   - `mise game restart` returns at the main menu;
   - `mise game restart --load <save>` loads a save, named as in the game's list;
   - `mise game restart --new [<map>]` starts a new city, on Archipelago by default, or on a map given by guid or by its name in the user's maps.

   A load goes through the game's `--startGame` option, so it starts as soon as the game booted. Every other argument of `restart` is a game option (mise drops a `--`), written to `runOnce.txt`, which the game reads into its command line at launch: options of the game's own, `--uiDeveloperMode` for one, not Unity's or Burst's.
4. Confirm the local build is the one running: `Logs/Modding.log` loads the mod from `Mods/ToveruxModTemplate/`, not from a subscribed copy under `.cache/Mods/pdx_mods/`. When it names `pdx_mods`, disable the subscription in the playset and start again from step 1.

Start the game only through `mise game` (or `mise test:game`): on Linux it launches Steam through `systemd-run --user`, because a Steam started from an agent's shell inherits that shell's environment, tokens included, and the game's crash dumps upload it to Colossal Order's Backtrace.

Another save, once the game is up: the gameface `menu.loadGame` trigger, `engine.trigger("menu.loadGame", {saveId: "User/<guid>", cityName: "<name>", options: {}, gameMode: "NormalMode"}, false)`, sent once the menu lists the saves, some 30 s after the main menu (sent earlier, it throws a `NullReferenceException`); then `mise game wait-load`. A load started with `GameManager.instance.Load` from the unity eval holds the main thread the load needs, and the game must be killed.

The game autosaves every five minutes: load throwaway saves, and say so when an autosave of a real city holds a test build.

## When a step fails

`mise game` hands a game it could not bring up back to you: a boot or a load that timed out leaves the game running and says so, for a look with the unity eval (where is the main thread, what did the logs say last) before `mise game stop`.
A launch that never starts the game stops what it started and deletes `runOnce.txt`; Steam is then closed, signed out, updating the game or showing a dialog.

## Diagnostics

In the game's user data folder, `$CSII_USERDATAPATH`:

- `Logs/ToveruxModTemplate.log`: the mod's own log.
- `Logs/Modding.log`: which mods loaded, from where.
- `Logs/SceneFlow.log`: the boot and each load (`Loading mode Game with purpose LoadGame`, `Loading completed`, `MainMenu reached`).
- `Logs/TestScenarios.log` and `Logs/Automation.log`: the in-game scenarios (see the `tmt-game-testing` skill).
- `Player.log`, at the folder's root: the engine's output, exceptions included; `Player-prev.log` holds the previous run's. Every log is written afresh at each launch.
- `.cache/backtrace/crashpad/reports/`: a dump for each death, and a `Simulated Exception` dump each time the main thread blocked over 5 s (a hang report, not a crash; a debugger suspend window that long sets one off too). Crashpad prunes them within the hour: list the folder before a test, and read each new dump at once, with `minidump-stackwalk --brief` where it is installed.

## Captures

- The whole frame: the unity `screenshot` tool. The UI alone: the gameface `game_screenshot` tool.
- Before a series of captures in a city, freeze the camera from the unity eval, `Game.CameraController.TryGet(out var c); c.inputEnabled = false`, and set it back afterwards: edge scrolling and the camera keys move the view otherwise.
- Reach one of the mod's UI elements by its prefixed class, `[class*="tmt-<class>_"]` with the class as its stylesheet names it, through the gameface `game_query` tool.

agents-plugins plans an unattended restart reference in `cs2-modding` ("Restarting the game and waiting on it, unattended", in its `docs/ROADMAP.md`); once it ships, this skill gives way to it.
