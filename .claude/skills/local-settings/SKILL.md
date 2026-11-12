---
name: local-settings
description: Tidy this checkout's local Claude Code settings for the permission layer - show what vanishes and the new content of .claude/settings.local.json (the grant mark, Playwright enabled, the deny lines the user keeps), rewrite it after one yes with a backup, write the two full-permission keys of the personal settings only for the user who chooses that, and end by showing the settings in effect | When the user asks to set up or tidy the local settings or permissions, after a notice asks forks to run it once, or when checks keep asking for permission
argument-hint: "[full-permission | no-mark]"
---

role: rewrite `.claude/settings.local.json` of this checkout (and, only on the user's choice, two keys of `~/.claude/settings.json`) through `pnpm workflow local-settings plan|apply|show`, after one yes
source_of_truth: what is written, backups, exit codes = scripts/workflow/local-settings/README.md | the permission layer = scripts/workflow/devcheck/README.md (section `許可の層`) | the processing stays in the command
args: $ARGUMENTS
never: write either file yourself (Edit / Write / node) | touch managed settings or the team tools' per-launch settings | print env values | run apply before the yes

## STEPS
1. **now**: `pnpm workflow local-settings show` → keep its lines for step 6's comparison
2. **plan**: `pnpm workflow local-settings plan` (args `no-mark` or the user's `印なし` → add `--no-grant`; `full-permission` or `全部許可` → add `--bypass`) | exit 2 → tell its one line; STOP
3. **ask once** with the plan's output, short:
   ```
   手元の設定(<file>)を全部書き換えます（控えは .agent/ に残します）
   消える行: <n 行 — 主なもの | なし>
   新しい中身: 印 DEVCHECK_GRANT=on / Playwright の有効化 / deny <残す行 | なし>
   選べること:
   - 昔の deny の行（<rows>）: 残す（既定）/ 消す
   - 全部許可（個人設定に bypassPermissions と確認の省略の 2 項目、次の起動から・どのプロジェクトでも）: しない（既定）/ する
   - 印: 付ける（既定。止める 3 つ以外の決まった確かめを聞かずに通す）/ 付けない
   これでよければ yes
   ```
   - the 3 dangerous kinds (schema push, the production confirm, writes to the production env) are always stopped by the hook, whatever is chosen: say so in one line when the user asks about safety
   STOP: wait | a changed choice → run plan again with the matching flags (`--drop-deny=<row>` per row, `--bypass`, `--no-grant`) and ask again
4. **apply**: `pnpm workflow local-settings apply` with exactly the flags of the plan the user said yes to (quote each `--drop-deny='<row>'`) | exit 2 → its one line; STOP
5. **personal settings**: only with `--bypass` — tell that it takes effect from the next launch, for every project
6. **show**: `pnpm workflow local-settings show` and report once:
   ```
   手元の設定を整えました: <file>（控え: <backup | なし>）
   - 印: <on | なし> / Playwright: 有効 / deny: <行 | なし>
   - 個人設定: <2 項目を書いた（次の起動から）| 変えていない>
   効いている設定:
   - <scope>: <決めていること>
   ```
