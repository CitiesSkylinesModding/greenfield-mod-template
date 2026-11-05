# Maintaining the template

A mod inherits every file of this repository but `template/`, the update skill and the template's `LICENSE`.
`mise init` ([`init.ts`](init.ts)) turns a copy into a mod by applying [`manifest.ts`](manifest.ts): the placeholder names it renames, the optional parts it can prune, and the template-only material it deletes.
The manifest is the contract between the template and every mod made from it: a change the manifest does not know about either ships template material into mods or leaves a pruned part half there.

## Changing what a mod inherits

- **A part grows or shrinks.** Declare every file, mise task, package and locale key of an optional part in its manifest entry, and every line elsewhere that names it as an edit: AGENTS.md, the skills, `mise.toml`, `lefthook.yml`, the csproj, the shared C# and TypeScript. Add the names it leaves nowhere once pruned to its `traces`.
- **A new optional part.** Give it a manifest entry with the `flag` `--no-<id>`, the switch init derives from its ID, a line in the mod README that `modReadme` writes when it is kept, and a screen in the wizard's [`interview.md`](../.claude/skills/gfd-setup/interview.md) step 8.
- **Text a part's edit targets changes.** Each edit's `find` matches exactly once or init fails and writes nothing, so `mise test:template` names the declaration to update. A text two parts both edit takes one edit per combination of the two, each gated by `when`.
- **A name the mod takes.** Write it with a placeholder (`Greenfield`, `greenfield`, the `gfd-` prefix), so the rename reaches it. A name in any other case needs a placeholder of its own in `manifest.ts` and `init.ts`. The template's own name, `Greenfield Mod Template` or `greenfield-mod-template`, starts with a placeholder but the rename keeps it (`TEMPLATE_NAME_TAIL`): write it in full wherever it names the template.
- **Neutral beats declared.** Where a shared file only needs an example (a test fixture, a filter in a skill, a counterexample in a rule), pick one every variant keeps rather than declaring an edit for it.
- **Template-only material.** Anything that exists only to build or maintain the template goes under `template/` or in `templateOnly`.
- **The setup wizard.** Its `SKILL.md` survives init until the first run ends, so it names no optional part but through a declared edit or a branch on `.template.json`'s `parts`; its `interview.md`, which init deletes, may name them all.
- **The licence.** The template's own `LICENSE` is template-only; the setup wizard writes the mod's.
- **`.template.json`.** The update skill reads it from mods made long ago: add fields, keep the existing ones meaning what they meant.

## Dependency updates

A dependency sweep reaches the default branch as one commit: squash its branch's batches before merging, and list in the body every version moved, tool adopted and ledger entry changed.
The update skill replays template commits into a mod one at a time, so one sweep is one step for a mod to translate and verify, and the intermediate states a sweep passes through never reach it.
The ledger, [`dependency-updates.md`](../docs/agents/dependency-updates.md), ships to every mod: give it only the entries a mod's own sweep acts on, and leave a trial on template-only material to the commit body.

## Verifying

- `mise test:template`: init on temporary copies, every part pruned alone and all together, asserting each declaration fully applied, no placeholder left, every relative Markdown link resolving. Run it after every change above; `mise test` and the pre-push hook run it too.
- `mise template:self-test`: init on an everything-kept copy (jb) and an everything-pruned one (dotnet format), then each builds, checks, builds its UI into a temporary Mods folder, and runs its tests, the float64 widener-output check included. It needs the game and its toolchain installed, and takes minutes: run it after declaring or changing a part, after a change to the build or test tooling, and before every template release. A failed variant keeps its copy and prints its path.

## The README

The template README explains each departure from the official CS2 template. When a change adds, removes or reverses one, update its rationale there in the same change.
