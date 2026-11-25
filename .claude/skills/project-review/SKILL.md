---
name: project-review
description: Review this repo's own context (project.md, behavior.md, own rules) - not code - against the wider rules (CLAUDE.md, core, ancestors' lineage sections) - take the facts from pnpm workflow context facts, clear what the facts decide in one approval per destination, ask the rest one line at a time, write only what was approved | When the user asks to review or tidy the project's own rules or context, after taking in a notice that asks for it, and periodic cleanup
argument-hint: "[補足(任意): 見るファイル・一度に扱う件数など]"
---

role: a procedure for tidying this repo's own context, not a code review and not a mode switch | keep the conversation's context, policy, tone and constraints
extra: $ARGUMENTS
judging: the table below is the default (first match) and the cue | a row you judge another way → say why in one line | a recommendation only where the facts give one

## PREMISES
- definitions: core/design.md priority (the mark, which side wins: marked over unmarked, the nearer mark, unmarked → the wider side) and places (what goes where) | CLAUDE.md DOCS durable_info
- facts: `pnpm workflow context facts` (one row per line; the default, it lists exactly) | read a line's neighbors only to summarize it or draft the text to write
- target: the files the command prints (this repo's own and self files under .claude/rules, its own lineage section, the lines below the fork marker; Tier1: its rules outside core and items) | personal files belong to /meditate
- marks: a mark changes only how a line is read, never checks, ownership, settings or permissions | a marked line against CLAUDE.md, core or an ancestor's section is an open contract gap: offer /order <its owner> and `(order: <id>)`
- writes: the working tree only, never committed (commit only when told, naming the paths) | a parent-owned or contract place is the parent's (CLAUDE.md fork_ownership) → an /order draft

## STEPS
1. FACTS: `pnpm workflow context facts` | exit 2 → STOP: show its one line (the owner cannot be decided) | no `file:` row → report "nothing to review" and stop | keep the rows as the source for every step below
2. CLASSIFY each line by the TABLE (first match wins) → a batch per destination (A rows) or the one-by-one list (J rows) | a row that matches nothing is not shown
3. BATCHES: one message per batch, rows numbered, the facts behind each row, the text to write or drop (template below) | STOP: one approval per batch; the user may move rows out by number (a moved-out row joins the one-by-one list)
4. ONE BY ONE: one line per message, (k/N) (template below) | STOP: the user's choice before the next
5. WRITE (only what was approved):
   - edit the line in place, move it to its destination file, or drop it | a moved line is written at the destination first, then removed here
   - A4: show the `/repo-config` change for the kind the line names and run /repo-config's steps (its own yes) before dropping the line
   - /order: show the draft (`/order <owner>`: CLAUDE.md, core or a Tier1 card → next-starter; a middle tier's section → that repo), file it after approval, then add `(order: <id>)` to the line
   - then `pnpm workflow context facts` again: every approved row is gone or carries its new mark
6. REPORT: counts per destination (before / after), files changed (uncommitted), /order filed with ids, rows left as they are | STOP

## TABLE (from the facts row; first match wins)
- A1 dead refs: refs n/n with n ≥ 1 all gone, none a relative path of another repo → fix the path (show the new one) or drop the line
- A2 restates the wider rules: `same` names CLAUDE.md, a core file or a card → drop (never restate core)
- A3 shipped order: mark `order:<id>:done` → drop the provisional line (its order shipped; the wider rules now hold it)
- A4 permission by hand: words has `perm`, the line is not a pointer to repo.json / /repo-config / devcheck → move it to repo.json agent.* through /repo-config, drop the line
- J1 same key as a wider rule, no mark (`base` ≥ 1, mark -) → the wider rule already wins, so the line does nothing or misleads | options: drop | mark `(priority)` (this repo means to differ) | /order <owner> (the wider rule is wrong) | rename the key (a different meaning) | recommend drop when the text agrees with the wider rule
- J2 marked against a wider rule (mark priority, `base` ≥ 1) → options: /order <owner> then add `(order: <id>)` (recommended) | keep marked | drop the mark
- J3 unknown order: mark `order:<id>:unknown` → options: fix the id | drop the line
- J4 misplaced (read the line): env branches or switch values in behavior.md → config or repo.json | one person's taste → CLAUDE.local.md (/meditate) | a rule only for one item → its card | usage or mechanism → its README | business overview → .claude/rules/service/ (a tier that defines a business) | an overview line in behavior.md → project.md | options = the destinations that fit, with the text
- not asked: `order:<id>:open` (a provisional rule waiting for its order), and every row that matches none of the above

## TEMPLATES
batch:
```
<束の名>(<件数> 件)→ <行き先>
1. <path:line> — <行の要約 1 行> — <事実: refs 0/2 / same CLAUDE.md:12 など> — <消す / 直した文>
2. …
これで進めてよければ yes。外したい番号があれば番号だけ(外した物は 1 件ずつ聞きます)
```
one by one:
```
(k/N) <path:line>
行: <行の文>
事実: <key・mark・base・same・words>
1. <選択肢>(推奨、事実があるときだけ)→ <どのファイルにどの文が書かれるか、または消す>
2. <選択肢> → …
```

## RULES
- never change a file before its approval
- a parent-owned or contract place is the parent's (CLAUDE.md fork_ownership): /order it
- never commit unless told
