---
name: repo-config
description: Change this repo's settings in repo.json - show the whole file by group (identity repo_id and tier shown only, agent = what the agent may run with the defaults in effect, its entries commands, vercel = the plan), show each change as current to new with what it acts on, take one yes, write it with pnpm workflow repo-json set or unset and show the result | When the user asks to allow, stop or change a kind the agent may run, an entry command or the Vercel plan, or a message points to /repo-config
argument-hint: "[key value]"
---

role: change the keys of repo.json through `pnpm workflow repo-json set|unset`, after one yes
source_of_truth: the file form, keys and groups = scripts/workflow/repo-json/README.md | agent keys, values, defaults = scripts/workflow/devcheck/README.md (section `方針`) | the processing stays in the commands
args: $ARGUMENTS
tool: repo.json is written by `pnpm workflow repo-json set|unset` (it checks the form; settings.json permissions.deny stops Edit / Write of repo.json) | `repo_id`, `tier`: shown only by default (/fork-init and `pnpm workflow repo-json migrate` set them)
never: change a key the user did not ask for (their decision) | a dangerous kind as `auto` is read as off: offer `manual`

## STEPS
1. **now**: `pnpm workflow repo-json show` and `pnpm workflow devcheck plan` (its `方針` line = the agent values in effect, defaults included) | show exit 2 (a flat repo.json, an unknown key) → tell its lines; `pnpm workflow repo-json migrate` puts the form right, then go on
2. **show by group** (only the groups the request touches, or all when the user asked to see the settings):
   - identity: `repo_id`, `tier` (shown only)
   - agent: the kinds server · browser · login · db_write · db_delete · env_add · peer (auto | manual | off), `agent.enabled` (true | false), the dangerous `agent.db_push` · `agent.env_production` · `agent.deploy` and `agent.intervene` (off | manual) — a key not written shows `既定 <値>` from the `方針` line
   - agent.entries: `db_push` · `env_production` · `deploy` · `deploy_db` (the command a dangerous kind runs; not written = the upstream default)
   - vercel: `plan` (hobby | pro; only a repo that deploys to Vercel)
3. **what changes**: from the args or the user's words, the keys (dot paths) and values | a key to remove → `unset` | unclear → ask which key; STOP
4. **ask once**, each key with its effect (shown as `<効き先>`):
   ```
   repo.json を変えます:
   - <鍵>: <今の値(書いていなければ「既定 <値>」/「なし」)> → <新しい値> — <効き先>
   これでよければ yes
   ```
   - effect: `agent.<kind>` = whether /devcheck, /allow and the guard run that kind by themselves, after a one-time permit, or never | `agent.entries.<kind>` = the command `pnpm workflow devcheck danger <switch>` prints for that kind | `vercel.plan` = the cron limits of `pnpm generate cron` (run after the write)
   - a dangerous kind to `manual`: add one line — the agent still never runs it without a one-time permit for that run
   STOP: wait for yes | a changed request → show again
5. **write**: `pnpm workflow repo-json set <鍵> <値>` (or `unset <鍵>`) per key, in the order shown | exit 2 → tell its one line; STOP
   - `vercel.plan` changed → `pnpm generate cron` (vercel.json crons rebuilt for the plan; include it in what you report)
6. **report** once:
   ```
   repo.json を変えました:
   - <鍵>: <今> → <新>
   今の方針: <devcheck plan の 方針 の行>(agent を変えた時)
   ```
