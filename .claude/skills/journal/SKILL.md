---
name: journal
description: Write one dated record in docs/journal/, drafted from this session's history (incident triage, verification results, how a decision was reached, staged-work logs) and written only after approval | When something should be recorded as a dated record; content that does not fit a journal gets a proposal for its right place
argument-hint: "[記録するテーマ(省略でこのセッションの経緯から決める)]"
---

role: write one record in `docs/journal/`
topic: $ARGUMENTS

## FIRST
1. Read `docs/journal/README.md` | file name, owner, one record per file and the split with other docs live there → never copy them into this skill

## SCOPE
- topic empty: pick one event to record from this conversation's history | several candidates → list them; STOP: ask which one to write (one record per file)
- topic given: pick up only the history tied to that topic
- material: the conversation, this session's commits (`git log`), checked results (command output, counts, screen checks) | never add facts that are not in the conversation | unknown points → write `未確認` (unverified) or ask the user

## SORT (before writing)
sort the content against the README section `ほかの文書との分担` (split with other docs):
- history (what happened, what was checked, why it was decided so) → journal body
- standing rules / decision criteria → add a proposal to distill them into one line in `.claude/rules/project.md` (the body stays in the journal, with `ref: docs/journal/<file>`)
- feature spec / usage → add an update proposal for the README beside the code
- a lesson about an upstream core part (while running in a fork) → propose `/order <upstream repo>`
- the history fits in a commit body → no journal; say so and end
- writes outside the journal are proposals only | doing them needs a separate approval

## DRAFT
- file name: `<today YYYY-MM-DD>--<owner>--<slug>.md`
  - owner = last part of `git remote get-url origin` (without `.git`), lowercased
  - slug = short kebab-case English naming the content
  - same name exists → change the slug (never append to an existing file)
- body shape:
  - line 1 `# <date> <what this records>`
  - after a blank line `> owner: <owner>`
  - at the top: what this records, links to related commits or the README of the current spec
  - then headings fitting the content (e.g. `経緯` / `確認した手順と結果` / `検討した選択肢と見送った理由` / `残った課題`)
- body language: Japanese | dates are absolute (never `昨日` / `今週` = yesterday / this week)

## APPROVE AND WRITE
1. show the file path and the full body to the user; STOP: get approval | no Write before approval
2. after approval → Write | commit only when the user says so

reply: Japanese
