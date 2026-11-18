---
name: fork-init
description: Set up a repo just cloned from upstream as a new fork with one approval - ask everything once, create the GitHub repo, write the answers file, show pnpm workflow fork-init plan, run apply (it writes and commits the fork's own files and pushes), then /local-settings and the tmux launch setup | Right after cloning upstream for a new project
argument-hint: "<name> [github-owner]  例: 88-base yokouchi-wildweb"
disable-model-invocation: true
---

role: the conversation and the entry of the fork setup | the processing is the command `pnpm workflow fork-init plan|apply` (what it writes, the answers file, idempotence: scripts/workflow/fork-init/README.md) | steps outside the repo (GitHub, Vercel, external services): `docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md`
rules: one approval only, at the plan (it includes the commit and push instruction) | never fill an answer by guessing: ask all of them in one question | keep upstream's history (shallow → propose `git fetch --unshallow` first) | rerunning is safe: the command skips the steps already done

## 1. PRE-CHECK
1. `git remote -v`: origin = the fork source and no `upstream` remote yet → a fresh clone | an `upstream` remote exists → a rerun: go on, the plan will show which steps are done | no origin → ask for the fork source URL; STOP: wait
2. `git rev-parse --is-shallow-repository` true → propose `git fetch --unshallow`; STOP: wait
3. `<name>` and `[github-owner]` from `$ARGUMENTS` | owner omitted → `gh api user --jq .login`
4. `gh auth status` | not logged in → ask for `! gh auth login`; STOP: wait
5. `gh repo view <owner>/<name>` | exists and not empty (`isEmpty` false) → STOP: confirm it is safe as the push target

## 2. ASK (one question for everything the arguments and the conversation do not fix)
- `repo_id`: default `<name>` lowercased (lowercase, digits, hyphens)
- `tier`: `leaf` (default) | `middle` (has or plans downstream forks; may change later)
- the service's one-line description (Japanese OK; written in English into project.md)
- the agent policy: keep repo.json's `agent.*` as the fork source has them (default) or name the kinds to change (`pnpm workflow repo-json show` lists them)
- features to open or close (default: as the fork source; `pnpm ops features list`)
- business identity values: service name (default `<name>`), short name, description, domain / url / sender (undecided → left as the example values, changed later in src/business/business.ts)
- Vercel plan: `hobby` (default; every cron runs once a day) | `pro`
STOP: wait for the answers

## 3. PLAN (one approval)
1. write the answers to `.agent/fork-init.answers.json` (untracked; shape: scripts/workflow/fork-init/README.md `API`) | origin = `git@github.com:<owner>/<name>.git`
2. `pnpm workflow fork-init plan --answers=.agent/fork-init.answers.json`
   - exit 1 → show its reasons (e.g. the name clashes with an ancestor or an inbox), ask again for those answers only, rewrite the file, rerun the plan
3. `pnpm workflow tmux-launch setup --check` (set or not)
4. present as bullets: the repo to create (`<owner>/<name>` private, or skipped as it exists) | the plan's lines as printed | the tmux launch setup (installed after the run when unset) | then `/local-settings` for this checkout's permissions
STOP: one approval

## 4. EXECUTE (after approval, no confirmations)
1. `gh repo create <owner>/<name> --private --description "<name>: <一言説明>"` (exists → skip; an empty description → `gh repo edit --description`; README is shared by every repo, so this field carries the project name on GitHub)
2. `pnpm install` only when `node_modules` is missing
3. `pnpm workflow fork-init apply --answers=.agent/fork-init.answers.json`
   - a step fails → show its output, fix the cause (or ask), rerun the same command: it continues from the remaining steps
4. `/local-settings` (it shows its own plan and takes its own yes)
5. the tmux launch setup, only when the check found it unset: `pnpm workflow tmux-launch setup` | exit 2 (no tmux) → do not stop; carry how to install it to the report

## 5. REPORT (Japanese)
- the repo URL, the remotes, the commit sha the command made
- never show the values in `.env.development` (say only that they are in the file)
- next moves for the user:
  - open a new terminal and type `claude` again in the new repo (it opens inside tmux; the agent starts the dev server itself)
  - register `CRON_SECRET` before deploying to Vercel (unset → every scheduled task stops with 401): a required next task
  - project.md has TBD lines (phase, direction, backend_status, domains, maker): fill them when decided
  - tmux not installed → `! sudo apt install tmux` / `! brew install tmux`, then `pnpm workflow tmux-launch setup`
- backends later: `docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md` section `機能別に必要なバックエンド` and `docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md`

language: reply Japanese | the answers file and project.md English
