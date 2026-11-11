---
name: fork-init
description: Run a new project's fork setup to the end with one approval, in a repo just cloned from upstream (next-starter etc.) - GitHub repo creation, remote reshuffle, pnpm install, rewriting the fork's own files (project.md, ledger, package name, src/business/business.ts, vercel.json, .env.development), initial commit and push | Right after cloning upstream for a new project
argument-hint: "<name> [github-owner]  例: 88-base yokouchi-wildweb"
disable-model-invocation: true
---

role: run a new project's fork setup **inside a repo just cloned from upstream**
source_of_truth: `docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md` | **read that doc first** | this skill carries out its step 2 (remote reshuffle on) to step 4 (initial commit and push) as the executor | doc and skill disagree → the doc wins; report the disagreement to the user

## PRINCIPLES
- **one approval only, at the plan** | after approval run to the end without confirmations: GitHub repo creation, remote changes, file rewrites, commit, push | this approval includes the explicit commit and push instruction
- **never fill by guessing** | project name, GitHub owner, the service's one-line description, Tier, backends: whatever args and conversation cannot fix → ask all of it in one question
- **keep upstream's history** | shallow clone (`git rev-parse --is-shallow-repository` is true) → propose `git fetch --unshallow` and resolve it first

## PRE-CHECK (before presenting the plan)
1. check `git remote -v` | expected: origin points to upstream (the fork source), no `upstream` remote yet
   - an `upstream` remote already exists, or `.claude/rules/project.md` has its own `fork_id:` (a name other than the fork source's) and `.notices/applied/<that name>.md` exists → already initialized; say so and end (never break it by rerunning)
   - no origin → ask the user for the fork source URL; STOP: wait for it
2. take `<name>` and `[github-owner]` from `$ARGUMENTS` | owner omitted → `gh api user --jq .login`
3. check login with `gh auth status` | not logged in → ask for `! gh auth login`; STOP: wait (the browser code entry = the terminal's one-time code)
4. check the repo with `gh repo view <owner>/<name>` | exists → skip creation; not empty (`isEmpty` false) → STOP: confirm it is safe as the push target
5. fix the following from the conversation | missing ones → one question for all (asked once step 6's overlap check is done):
   - the service's one-line description (Japanese OK; written in English into project.md)
   - the fork's name (`fork_id:`): default = `<name>` lowercased (present it after the overlap check of step 6)
   - Tier: default "fork source's Tier + 1, no downstream"
   - whether it plans downstream forks (`downstream:`; default `none`; has / plans → `yes`; may change later)
   - backends: set up Firebase / Neon now, or start unconfigured (default: unconfigured)
   - planned domain, direction (none → `TBD` is fine)
   - Vercel plan: hobby / pro (default: hobby; hobby makes every cron once a day; can be regenerated later)
6. fix the fork's name (`fork_id:`): default = the new repo name `<name>` lowercased (confirmed in the question of 5) | form = lowercase, digits, hyphens (`FORK_ID_PATTERN` of `src/lib/forkOwnership/forkIds.mjs`) | never derived from the origin URL | same name as any of these → STOP: ask for another name (D30 K3):
   - the fork source's `fork_id:` in `.claude/rules/project.md`, ledger names in `.notices/applied/`, section headings of `src/lib/CATALOG.md` (ancestors' names)
   - names in `~/.team/fleet.conf` (compared case-insensitively), inbox folder names in `~/.team/orders/` (skip each when missing)
   - name decided → call `node .claude/skills/order/mailbox.mjs name-check <名前>` | an overlap reported → STOP: confirm another name with the human
   - then ask the question of 5; STOP: wait for the answers
7. fork source version = full sha of the current HEAD (`git rev-parse HEAD`; written to `upstream:` of the ledger's first line)

## PLAN (get the approval)
present the following as bullets; STOP: one approval:
- the repo to create (`<owner>/<name>` private) / or that creation is skipped
- remotes: origin = new repo, upstream = current origin
- the fork's name (`fork_id:`, result of the overlap check) and what gets the same name (project.md line, ledger, CATALOG section)
- list of files to rewrite (same items as the doc's step 4 checklist; README is not touched)
- the Vercel plan of `vercel.json` (hobby / pro)
- initial commit subject: `chore: <name> フォーク初期設定`
- push target: `origin main`
- tmux launch setup on this machine (result of `pnpm workflow tmux-launch setup --check`): not set → run `pnpm workflow tmux-launch setup` after approval (one line in `~/.bashrc` or `~/.zshrc`, a block in `~/.tmux.conf`) | already set → nothing

## EXECUTE (after approval, no confirmations)
1. `gh repo create <owner>/<name> --private --description "<name>: <一言説明>"` (exists → skip; exists with an empty description → set it with `gh repo edit --description`; README is shared by every repo, so this field carries the project name on GitHub)
2. `git remote rename origin upstream` → `git remote add origin git@github.com:<owner>/<name>.git`
3. `pnpm install` (only when `node_modules` is missing)
4. rewrite the fork's own files (in the doc's step 4 order):
   a. `.claude/rules/project.md`: copy `project.template.md` in this folder (shipped with this skill), fill `<...>` with what the pre-check got, replace the file | never add or remove sections (undecided sections = `TBD`) | delete the leading comment block | English, bullets
   b. align the name (same value):
      - `fork_id: <名前>` in the TIER section of `.claude/rules/project.md`, and the next line `downstream: <yes|none>` (template line; answer of pre-check 5; missing → `pnpm workflow ownership check` unverified = exit 2, `/ship` stops too)
      - ledger `.notices/applied/<名前>.md` = header `# APPLIED LEDGER fork:<origin url>` + one line `- id:fork-init | date:<ISO8601> | commit:- | upstream:<full sha of the fork source version> | notes:fork start` (`pnpm workflow ownership check` walks the Tier1 version from here; missing → exit 2)
      - an empty section `## <名前>` at the end of `src/lib/CATALOG.md` (add one line here when you add your own lib)
   c. `package.json`: `name` → `<name>`
   d. `src/business/business.ts` (the fork's business identity, read as `@/business`; shape: src/lib/business/README.md):
      - `pnpm ops business from-example` (source own, copies the example values)
      - then `serviceName` / `serviceNameShort` / `description` / `descriptionShort` / `mail.defaultFromName` based on `<name>`
      - `domain` / `url` / `mail.defaultFrom`: fixed → set them; undecided → placeholders without upstream's name (`example.com` etc.)
   e. `vercel.json`: generate with `pnpm generate cron -- --plan <hobby|pro>`, confirm `pnpm check cron` passes (every task of `src/app/api/cron/*/task.ts` becomes an entry; never edit by hand)
   f. `README.md`: **never touch** (shared by every repo; own info = project.md and the GitHub description field)
   g. `.env.development`: generate with `pnpm ops setup env` (a copy of `.env.example` with `APP_BASE_URL` / `AUTH_JWT_SECRET` / `ENCRYPTION_KEY` set automatically; exists → nothing) | confirm with `git status` it is gitignored, **never include it in the commit**
5. no `pnpm typecheck` needed (config files only) | confirm with `git status --short` that only the intended files changed
6. commit: subject `chore: <name> フォーク初期設定` + blank line + body (fork source, rewritten items, backends unconfigured if so) + the Co-Authored-By trailer the environment specifies
7. `git push -u origin main`
8. tmux launch setup (the doc's step 4 section `tmux で開く設定`): only when the plan found it unset → run `pnpm workflow tmux-launch setup` | exit 2 (no tmux) → do not stop, carry it to the report with how to install it (`! sudo apt install tmux` / `! brew install tmux`) and to run `pnpm workflow tmux-launch setup` after installing

## REPORT (Japanese)
- created repo URL, remote layout, commit sha
- **never show** the values generated into `.env.development` (say only that they are in the file)
- the user's next moves:
  - (tmux launch setup installed now or already) open a new terminal and type `claude` again in the new repo's directory (opens inside tmux; the agent checks startup with `pnpm workflow dev-tab run`, so the human need not type `pnpm dev`)
  - register the env var `CRON_SECRET` before deploying to Vercel (unregistered → every scheduled task stops with 401; state it as a required next task)
  - tmux launch setup not installed → add how to install it
- path for connecting backends later: the doc's step 3 section `機能別に必要なバックエンド` and `Neon_Firebaseなど各種バックエンドサービスの設定方法.md`

language: reply Japanese | `project.md` and the ledger English
