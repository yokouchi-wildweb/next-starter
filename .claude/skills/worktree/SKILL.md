---
name: worktree
description: Create a worktree, re-sync its env files, or remove it, through pnpm workflow worktree | Only when the user explicitly asks for a worktree (never propose or run it on your own, even when parallel work would benefit); the skill holds only the judgment and the order of steps, the processing stays in the command
argument-hint: "[new <やること or ブランチ名> | sync [path] | remove <path>]"
---

role: create / re-sync env / remove a worktree with `pnpm workflow worktree new|sync|remove`
source_of_truth: command spec and caveats = scripts/workflow/worktree/README.md | never add git steps here (processing lives only in the command)
args: $ARGUMENTS

## COMMON
- never run `git worktree add` / `git worktree remove` directly → always `pnpm workflow worktree` (else env copy, install and safety checks are skipped)
- never use `claude --worktree`, EnterWorktree or subagent worktree isolation: they skip the include copy (env, next-env.d.ts) and `pnpm install`, and their place is not `<project>.wt-<slug>`, the path the team tools look for
- this session stays where it started: its hooks, `$CLAUDE_PROJECT_DIR` and loaded rules keep pointing at that checkout, so work done after a `cd` would run under another checkout's rules and hooks → the work there is done by a session opened in it (NEW step 4)

## NEW (create)
1. branch name:
   - user named one → use it as is
   - none → name it `<area>/<short English description>` from the request and go on (the report gives the name)
2. base: none given → HEAD of the place it runs in | a request that should branch from main → `git fetch origin main`, then `--from origin/main` (the local main may lag and the tools never move it)
3. run `pnpm workflow worktree new <branch> [--from <base>]`
4. report:
   - created path and branch, the files copied
   - next move: a session there = `/reinforce --cwd=<path>` | the request was to work there → open it now and say in one line where it opened | else name the command only
   - the DB is shared with the main checkout (schema-changing work → add one line: `db:push` also hits the main checkout's development DB)

## SYNC (re-copy env)
1. run `pnpm workflow worktree sync <path>` (no `--force`)
2. the output says files were left unchanged because their content differs (`内容が違うため未変更`) → name the files, ask whether to overwrite; STOP: rerun with `--force` only after the user agrees

## REMOVE (clean up)
1. check the branch is merged into main (`git branch --merged main` etc.) | not merged → say so in the report and go on (remove keeps the branch and its commits)
2. run `pnpm workflow worktree remove <path>` | stops on uncommitted changes → show them; STOP: ask the user (never commit or discard on your own) | removed and merged → `git branch -d` (it refuses an unmerged branch)
