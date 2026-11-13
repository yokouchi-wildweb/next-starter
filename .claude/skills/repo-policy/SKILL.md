---
name: repo-policy
description: Change what this repo lets the agent do - show the agent.* policy keys of repo.json (normal kinds auto, manual or off, the whole switch, the dangerous three off or manual and their entry commands), show the change as current to new, take one yes, write it with pnpm workflow repo-json set and show the result | When the user asks to allow, stop or change a kind the agent may run, or a message points to /repo-policy
argument-hint: "[key value]"
---

role: change the agent.* keys of repo.json through `pnpm workflow repo-json set`, after one yes
source_of_truth: keys, values, defaults = scripts/workflow/devcheck/README.md (section `方針`) | the file form = scripts/workflow/repo-json/README.md | the processing stays in the command
args: $ARGUMENTS
never: edit repo.json yourself (the hook stops Edit / Write and shell writes) | write `repo_id` or `tier` (those belong to /fork-init and `pnpm workflow repo-json migrate`) | set a dangerous kind to `auto` (read as off) | change a key the user did not ask for

## STEPS
1. **now**: `pnpm workflow repo-json show` and `pnpm workflow devcheck plan` (its `方針` line = the values in effect, defaults included)
2. **what changes**: from the args or the user's words, the keys and values (`agent.<kind>`: server · browser · login · db_write · db_delete · env_add · test · check · peer = auto | manual | off; `agent.enabled` = true | false; `agent.db_push` · `agent.env_production` · `agent.deploy` = off | manual; `agent.<danger>.entry` / `agent.deploy.db_entry` = a command) | unclear → ask which key; STOP
3. **ask once**:
   ```
   repo.json の方針を変えます:
   - <鍵>: <今の値(既定なら「既定 <値>」)> → <新しい値>
   これでよければ yes
   ```
   - a dangerous kind to `manual`: add one line — the agent still never runs it without a one-time permit for that run
   STOP: wait for yes | a changed request → show again
4. **write**: `pnpm workflow repo-json set <鍵> <値>` per key, in the order shown | exit 2 → tell its one line; STOP
5. **report** once:
   ```
   repo.json の方針を変えました:
   - <鍵>: <今> → <新>
   今の方針: <devcheck plan の 方針 の行>
   ```
