---
name: meditate
description: Meditate - the agent tidies its own auto-memory to the CLAUDE.md definition (handoff of in-progress work only) and the lines of the two personal files - restore the fixed block at the head of MEMORY.md, take the facts from pnpm workflow memory facts and context facts --personal, move what the facts decide in one approval per destination, ask the rest one at a time, write each destination before archiving | When the user asks the agent to meditate or tidy its memory, periodic cleanup, and the first tidy-up of a fork's accumulated memory
argument-hint: "[補足(任意): 一度に扱う件数など]"
---

role: a procedure for tidying memory, not a mode switch | keep the conversation's context, policy, tone and constraints
extra: $ARGUMENTS
judging: the table below decides mechanically | never change a decision by "looks useful" or "seems important" | a recommendation only where the facts give one

## PREMISES
- definition: CLAUDE.md DOCS `memory` (handoff of in-progress work only), `personal` (the two personal places), `durable_info` | canon of the head block: .claude/skills/meditate/header.md
- facts: only from `pnpm workflow memory facts` (one row per memo) | never count or list memos by hand | read a memo's body only to summarize it, check its end condition or draft the text to write
- target: the memory of this repo's main checkout, found by the command (shared with every worktree) | never touch another project's memory
- session: run from the main checkout's session only | `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir` (a worktree) → STOP: tell the user to run it from the main checkout's session
- personal places: free form, never checked (CLAUDE.md DOCS personal) | write them as the user wants, no imposed format | never offer to reformat a personal file
- personal lines: CLAUDE.local.md (this repo) and ~/.claude/CLAUDE.md (every repo), facts only from `pnpm workflow context facts --personal` (one row per line) | the wider rules of a personal line = CLAUDE.md, core, ancestors' lineage sections and this repo's own context
- marks: core/design.md priority (marked over unmarked, the nearer mark, unmarked → the wider side: core and CLAUDE.md → ancestors → this repo → personal) | a mark changes only how a line is read

## STEPS
1. HEADER: `pnpm workflow memory header` | not ok → `pnpm workflow memory header --apply` (writes inside the block only, adds it at the head when missing) | `broken` → STOP: show the user the marker lines to fix
2. FACTS: `pnpm workflow memory facts` | `none` → report "no memory" and stop | keep the rows as the source for every step below
3. CLASSIFY each memo by the TABLE (first match wins) → a batch per destination (A rows) or the one-by-one list (J rows)
4. BATCHES: one message per batch, rows numbered, the facts behind each row, the text to write for A5 / A6 (template below) | STOP: one approval per batch; the user may move rows out by number (a moved-out row joins the one-by-one list)
5. ONE BY ONE: one memo per message, (k/N) (template below) | STOP: the user's choice before the next
6. WRITE (only what was approved):
   - write the destination first, read it back, then `mv` the memo to `memory-archive/<YYYY-MM-DD>/` beside the memory directory | never `rm`
   - ~/.claude/CLAUDE.md: copy its current version into that archive folder before writing | it and CLAUDE.local.md take effect at once
   - shared files (behavior.md, README, card, docs/journal, service): write in the working tree only, never commit (commit only when told, naming the paths)
   - a parent-owned place in a fork (CLAUDE.md, a core file, a Tier1 card, an upstream README) → show the `/order <direct parent>` draft, file it after approval; the memo stays until it ships
   - fix MEMORY.md lines and `[[links]]` of moved memos | then `pnpm workflow memory facts` and `header` again: header ok, every index line has a file
7. PERSONAL LINES: `pnpm workflow context facts --personal` | no `file:` row → skip to 8 | classify each line by the P rows of the TABLE (first match wins)
   - then the same batches (step 4) and one by one (step 5)
   - write as step 6: copy the personal file into the archive folder before editing it | a raised line goes to behavior.md / project.md in the working tree, never committed
   - run the command again: every approved row is gone or carries its new mark
8. REPORT: counts per destination (before / after) for memos and personal lines, files written, uncommitted paths, /order drafts filed | STOP

## TABLE (from the facts row; first match wins)
- A1 archive (stale): refs n/n with n ≥ 1 all gone, and every gone item is an absolute path, a `~/` path or a commit (a relative path resolves from this repo only → J3)
- A2 archive (duplicate): `same` ≥ 1 | show the path:line
- A3 archive (done): `end` present and met | check git log, files or the user's earlier word, never the memo's own state text
- A4 keep: state, next, end and date all present and end not met
- A5 → the README beside that code, or its card: knowledge of code whose refs all sit in one folder of this repo
- A6 → docs/journal/\<YYYY-MM-DD\>--\<owner\>--\<slug\>.md: type project with no next / end, an event or decision with a date
- J1 feedback, user or no type → ask: everyone's work rule (.claude/rules/behavior.md) | mine, this repo (CLAUDE.local.md) | mine, every repo (~/.claude/CLAUDE.md) | drop | recommend only from facts: repo terms (paths, keys, commands) → this repo, none → every repo
  - the memo's rule contradicts a line of CLAUDE.md, core or this repo's context → the personal options carry the text with `(priority)` (yours wins for you; without it the wider line wins)
- J2 next present, end missing or not checkable → add a checkable end (show it) and keep | archive
- J3 the rest (refs partly gone or relative to another repo, several code places, business overview → .claude/rules/service/ in a tier that defines a business) → the destinations that fit, with the text

personal lines (P rows; first match wins; a row that matches none is not asked):
- P1 refs n/n with n ≥ 1 all gone → fix the path or drop the line (batch)
- P2 `same` names a repo file → drop, the repo already says it (batch)
- P3 mark `order:<id>:done` → drop the line, its order shipped (batch)
- PJ1 `base` ≥ 1, mark - → the wider line wins over yours now: drop | mark `(priority)` (yours wins for you) | raise to behavior.md (the repo should change) | /order <owner> (the wider rule is wrong) | recommend drop when the text agrees with the wider rule
- PJ2 mark priority, `base` names CLAUDE.md, a core file or an ancestor's section, no order → /order <owner> then add `(order: <id>)` (recommended) | keep marked | drop the mark
- PJ3 a line that reads as everyone's work rule (repo terms, no taste of one person) → raise to behavior.md / project.md | keep personal

## TEMPLATES
batch:
```
<束の名>(<件数> 件)→ <行き先>
1. <名前> — <要約 1 行> — <事実: same CLAUDE.md:12 / refs 0/3 など>
2. …
これで進めてよければ yes。外したい番号があれば番号だけ(外した物は 1 件ずつ聞きます)
```
one by one:
```
(k/N) <名前> <日付>
中身: <2 行の要約>
事実: <type・handoff・refs・same>
1. <選択肢>(推奨、事実があるときだけ)→ <どのファイルにどの文が書かれるか> / メモは控えへ
2. <選択肢> → …
```
one by one, a personal line:
```
(k/N) <CLAUDE.local.md か ~/.claude/CLAUDE.md>:<行>
行: <行の文>
事実: <key・mark・base・same>
1. <選択肢>(推奨、事実があるときだけ)→ <どのファイルにどの文が書かれるか、または消す>
2. <選択肢> → …
```

## RULES
- never rewrite memory or any file before its approval (step 1's block restore is the one mechanical write)
- never delete: archive by `mv`
