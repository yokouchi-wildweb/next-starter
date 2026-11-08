---
name: route-map
description: Show and explain the route map (the guard chain of every page = page → Screen → loader access → guard.ts), drawn by pnpm check routes -- show; the skill only turns the request into arguments and explains the result | When asked about page guards, ranges or exposure: admin pages by guard, the list of public pages, pages switched off, a diagram
argument-hint: "[見たいもの(例: admin を guard ごとに / 公開ページを表で / /mypage 配下を図で)]"
---

role: draw the route map filtered with `pnpm check routes -- show`, then explain the result
source_of_truth: map shape, how to read it, option spec = `src/lib/screens/README.md` §13 and `pnpm check routes -- show --help`
request: $ARGUMENTS

## RULES
- the CLI draws the map | never open `src/app/route-map.jsonl` yourself to count or sort it (correctness lives in the CLI and its tests)
- never fix the map | it is generated; changes go to the pages, loaders, guard.ts (whether to change is the human's call)
- without `--file` the output is rebuilt from src/app (uncommitted changes show too)

## 1. REQUEST → ARGUMENTS
intent → argument:
- everything / a list → (none; many rows → `--view=table`)
- under some URL → `<URL prefix>` (e.g. `/mypage`)
- by guard / by range / the structure → `--view=tree`, a diagram → `--view=mermaid`
- the admin range → `--scope='admin/(protected)'` (that range only = add `--nearest`)
- the login-required range → `--scope='(user)/(protected)'`
- visible to anyone / public → `--access=public`
- visible with login only → `--access=authenticated`
- admins only / role X → `--access=category:admin` / `--access=role:<role>`
- left to the domain's permissions → `--access=registry` (one domain → `--access=registry:<domain>`)
- reachable even when suspended, banned or in similar states → `--access=statuses`
- switched off / 404 pages → `--state=gated-off`
- as a table / a diagram / a tree → `--view=table` / `--view=mermaid` / `--view=tree`
combining: the same option repeated = OR | different options = AND
- values with `(` `)` `@` (ranges, URLs) → quote with `'…'` in the shell
- vague request → default `--view=table` | range names unknown → first `pnpm check routes -- show --view=tree` to see the ranges (scope=)
- mermaid over every page is large → narrow by range or URL prefix first | show the result as is in a ```mermaid code block

## 2. RUN
run `pnpm check routes -- show <args>` once (another view → run again with other args)
- exit 2 = wrong arguments | read the printed explanation and fix them
- exit 1 = some page's chain cannot be read (✗ rows) | no map can be drawn → show those rows as is, say where to fix (the row's file) and that `pnpm generate routes` verifies it (rule: README §13 `生成失敗`)
- a `! 地図が古い` row = the committed map differs from src/app | the output uses the current src/app | to commit → tell them to rebuild with `pnpm generate routes`

## 3. EXPLAIN
never just paste the output | answer the request, then list any of the following that apply (none → `気になる点なし`, nothing of note):
- **unexpected public pages**: access=public with page dir (table column) outside `(user)/(public)`, `(marketing)`, `(user)/(auth)`, `(user)/(legal)` (e.g. demo; for entrances like admin/login, setup, add one remark on whether it is intended) | whether public is fine = the human's call
- **switched-off pages**: gated-off (404 by a feature-gate rule) | restoring the flag publishes them at once → also check the chain is right
- **registry**: admin screens left to the domain's serviceRegistry access | its breadth is decided by that domain's domainEntry.ts
- **statuses**: allowStatuses pages that also admit users in states normally rejected
- range (scope) × loader access: parent and child are AND, so a broadly written loader is never wider than its range | a loader narrower than its range (e.g. role:admin inside the admin range) narrows only that page
reply: Japanese, short | count pages from the CLI output rows, never guess
