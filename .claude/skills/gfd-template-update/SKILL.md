---
name: gfd-template-update
description: Bring the template's later improvements into a mod made from it, one template commit at a time. Use when the user wants to update a mod from the template, or to know what the template changed since a mod was made or where the mod departs from it.
argument-hint: '<path to the mod>'
---

# Update a mod from the template

Runs in the template repository, on the checkout of a mod `mise init` made from it, at the path the user gives.
The mod renamed, pruned and moved the template's files, so there is no merge: each template commit since the mod's is read, translated into the mod's names and places, and applied where it still fits, the user deciding each one.
Talk as the setup wizard does: one improvement per message, in plain words, with your recommendation.

## 1. Read the mod

`<mod>/.template.json` holds what this skill needs:

- `templateCommit`: the last template commit the mod has.
- `parts`: each optional part, `true` where the mod kept it.
- `names`: each template name (the ID, the camelCase ID, the prefix) and the mod's for it.
- `skills` and `rules`: where the mod keeps them, `.claude/skills` and `.claude/rules` in the template.

Without that file, the mod was not made by `mise init`: stop, and tell the user.

The mod's tree must be clean (`git -C <mod> status --porcelain`), so each improvement lands in a commit of its own: settle what is there with the user first.
Ask whether to commit each improvement once applied; invoking this skill and that yes are the go-ahead `AGENTS.md`'s commit boundary asks for.

**Done when** you hold the four fields, the mod's tree is clean, and the user answered on commits.

## 2. List the template's commits

Bring this repository's default branch up to date (`git pull --rebase`), then list the commits since the mod's:

```
git log --reverse --no-merges --format='%H %s' <templateCommit>..HEAD
```

Where git does not know `templateCommit` (`git cat-file -e <templateCommit>^{commit}` fails), fetch the full history (`git fetch --unshallow`); where it still does not, stop and tell the user.

Sort each commit from its file list (`git show --stat <sha>`); one whose list leaves the sort open, a shared file among its files, applies, and step 3 reads its diff:

- **Template-only**: it touches only what no mod has. That is `template/`, this skill, the setup wizard (`.claude/skills/gfd-setup`), `LICENSE`, the template's `README.md` (each mod has its own), and `AGENTS.md`'s template-maintenance section. A change to what `template/init.ts` writes into a mod (the README skeleton, `.template.json`, `AGENTS.md`'s Template origin) is the exception: it applies, by hand (step 3).
- **Pruned**: it touches only parts the mod pruned. The manifest at that commit (`git show <sha>:template/manifest.ts`) declares each part's files and edits.
- **Applies**: anything else, in whole or in part.

Show the list, one line per commit with its sort, the template-only and pruned ones grouped at the end.

**Done when** every commit since `templateCommit` is sorted.

## 3. Walk each improvement

One commit that applies per message, oldest first.
Say what it improves and what it would change in the mod, and which of its files or lines are left out (template-only, a pruned part); recommend applying or skipping it, and wait for the user: apply, skip, or apply with changes they name.

To apply one:

1. Write its diff, the template-only files left out: `git diff --binary --output=<patch> <sha>^ <sha> -- . ':!template' ':!.claude/skills/gfd-setup' ':!.claude/skills/gfd-template-update' ':!README.md' ':!LICENSE'`, `<patch>` the absolute path of a temporary file: `git -C <mod>` reads a relative one from the mod, and a shell redirect writes UTF-16 in Windows PowerShell 5.1.
2. Translate it into the mod, in the paths and the text alike:
   - Each `names` key becomes its value: the ID, the camelCase ID, and the prefix where it starts a name (`gfd-`). The template's own name and slug, `Greenfield Mod Template` and `greenfield-mod-template`, stay as they are.
   - `.claude/skills` and `.claude/rules` become `skills` and `rules`, where those differ.
   - A hunk on a pruned part's file goes, and so does a hunk on a line of a shared file (`AGENTS.md`, `mise.toml`, `lefthook.yml`, a skill) that the manifest's edit for a pruned part, or one of its `templateOnly` edits, removes, and a hunk inside `AGENTS.md`'s template-maintenance section, which the mod holds as its Template origin.
3. `git -C <mod> apply --reject <patch>`. A three-way merge cannot work here: the patch names the template's blobs, which the mod lacks or holds only under the template names. A hunk that does not fit, because the mod changed the same lines, is left in a `.rej` file beside its file: resolve each with the user, the mod's own change kept unless they say otherwise, then delete the `.rej` files.
4. A change the diff cannot carry is applied by hand, where the user wants it:
   - A new optional part in the manifest: offer the part itself, its files and edits as the manifest declares them.
   - A change to `template/init.ts` in what init writes (the README skeleton, `.template.json`, `AGENTS.md`'s Template origin, the mod's fields): write the same in the mod.
5. Verify in the mod: `mise check` and `mise test`, plus `mise build`, the game closed, where the commit touched C# or the build. Where it touched C#, `mise fix:cs` last, right before the commit, as `AGENTS.md` asks.
6. Commit, where the user said to: the template commit's own type and summary, its body naming it (`From Greenfield Mod Template <sha>.`), and `templateCommit` in `.template.json` set to `<sha>` in the same commit.

**Done when** each commit that applies is applied or skipped, and each applied one verified.

## 4. Close

Set `templateCommit` in `.template.json` to the HEAD whose commits step 2 listed, skipped and template-only ones included, and commit it where the user said to (`chore: record Greenfield Mod Template <sha>`), so the next update starts after it.

Summarize in bullets: what was applied, what was skipped and why, and what the user chose to apply by hand later.

**Done when** `templateCommit` names the template's HEAD and the summary is given.

## Where the mod departs from the template

To list what the mod changed in the template's files (a hunk step 3 cannot fit, or the user asks), rebuild the template as `mise init` would have written the mod: a clone of this repository checked out at `templateCommit`, `mise init` run there with the mod's ID and prefix from `names`, its `--agent-dir`, `--versioning semver` unless the mod's version opens with the year, its `--crowdin-project-id` where it kept Crowdin, a `--no-<part>` for each part `.template.json`'s `parts` marks false (`--formatter dotnet-format` for `jb`), and `--name`, `--author` and `--description` of any value, then `bun install` and `mise fix:oxfmt`.
`diff -rq <clone> <mod>`, `.git`, `node_modules` and build output excluded, lists every template file the mod changed; files only the mod holds are its own.
