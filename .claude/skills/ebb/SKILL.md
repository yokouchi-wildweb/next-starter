---
name: ebb
description: Tidy auto-memory mechanically to the CLAUDE.md definition (handoff of in-progress work only) - collect only facts per memo (type, duplicate, references, end condition, date), apply the decision table, then delete / move / keep with the user's approval per decision | Periodic cleanup, and the first tidy-up of a fork's accumulated memory
argument-hint: "[補足(任意): 一度に扱う件数など]"
disable-model-invocation: true
---

role: a note on how to tidy memory, not a mode switch | keep the conversation's context, policy, tone and constraints as they are; treat what follows as a skeleton
extra: $ARGUMENTS
judging: apply the decision table below mechanically | never change a decision by "looks useful" or "seems important" | what the table does not decide → user decision, no recommendation (give one only when asked)

## PREMISES
- definition source: CLAUDE.md head ROLE / PER_PROJECT and DOCS `memory` / `durable_info` | memory = handoff of in-progress work only | no durable rules, knowledge or environment facts
- target: the working directory's memory only = `memory/` of the entry in `ls ~/.claude/projects/` matching the working directory path (non-alphanumerics become `-`) | index = `MEMORY.md`

## 1. COLLECT FACTS (per memo, no judgment)
- **type**: frontmatter `metadata.type` (old form: top-level `type`) | none → "no type"
- **duplicate**: grep the body's proper terms (paths, function names, rule names, command names) in CLAUDE.md, .claude/rules/, .claude/skills/, READMEs, docs/ | note lines saying the same thing as `path:line` | none → "no duplicate"
- **references**: do the files, directories and commits in the body still exist (all / some missing / all missing / no references)
- **end condition**: written in the body? | written → check whether it is met with git log, files, code | the memo's state text may be stale → check the real thing, not the text
- **date**: `metadata.modified`, else the file mtime
- more than 30 memos → split this fact collection among subagents (same as /recon stage 1 | report one row per memo with the 5 items above)

## 2. DECISION TABLE (top to bottom, first match wins)
1. references all missing → **delete (stale)**
2. duplicate found → **delete (duplicate)** | attach the duplicate's location
3. type project and end condition met → **delete (done)**
4. type project and no end condition → **user decision** (add a condition and keep / delete)
5. type project and end condition not met → **keep**
6. anything else (feedback / user / reference / no type = by definition not memory) → **user decision** (move / delete)
   - move-target candidates, mechanically from the type: feedback, user → behavior.md | reference → project.md | a trap of specific code → the README beside that code
   - in a fork, a candidate owned upstream (CLAUDE.md, upstream code or README) → do not move, make it a `/order <upstream repo>` candidate

## 3. PRESENT AND APPROVE
- show counts and the list per decision | one row per memo: name, decision, the facts behind it
- "delete" and "keep": STOP: approval per decision, in one batch each
- "user decision": one memo at a time, with a summary of its content and the collected facts; STOP: let the user choose
- decided "move": show the text to write first; STOP: get approval | form follows CLAUDE.md FORMAT_RULE and the target file

## 4. EXECUTE
- deleted memos → `mv` to `memory-archive/<YYYY-MM-DD>/` beside the memory directory (never auto-loaded) | never `rm`
- fix the `[[links]]` to deleted memos and their index lines | last, match the index against the real files and fix files missing from the index and index lines without a file (no judgment needed, so within the approval already given)

## 5. REPORT
- counts per decision (before / after), where things moved, `/order <upstream repo>` candidates, uncommitted repo changes; STOP | commit only when told (name the paths, only your changes)

## RULES
- never touch other projects' memory
- never rewrite memory or the repo before approval
