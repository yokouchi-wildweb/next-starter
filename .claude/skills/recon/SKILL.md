---
name: recon
description: Run a wide code investigation in two stages (subagents go wide and shallow, then you read only the needed spots yourself) | Investigations that cross many files: impact analysis, checking conventions, groundwork for a larger change
argument-hint: "[調査テーマ(任意)]"
---

role: a note on how to investigate, not a mode switch | keep the conversation's context, policy, tone and constraints as they are; treat what follows as a skeleton
topic: $ARGUMENTS | none given → pick it naturally from the conversation

## IDEA
- delegation (subagents) is strong at wide and shallow, weak at detail and accuracy | reading yourself is strong at narrow and deep, and costs context | splitting into two stages cancels each side's weakness

## STAGE 1: WIDE AND SHALLOW (delegate)
1. split the topic into independent axes (e.g. write path / read path / config / tests / docs) | one agent per axis, launch independent ones in parallel | axis hints: CLAUDE.md CODE_PLACEMENT and the ARCHITECTURE layers
2. agent type: fresh read-only (Explore) by default | fork only for an axis whose premise is the conversation's context itself
3. every prompt holds: goal / what is already known / search range / exclusions (generated files etc.) / completeness instruction / report form
4. completeness instruction, explicit: "list every spot that may apply even at low confidence; no limit on the count; tag confidence high / medium / low"
5. report form: one row per item `path:line | one-line gist | confidence | why to read it` | code quotes: minimal is enough
6. an axis with more than a few dozen candidates → have it report counts and categories instead of every item, decide a narrowing policy, then relaunch

## MERGE
- dedupe the reports, sort into must-read / candidate / excluded | keep the reason for each exclusion | a stage-1 miss stays fixed in stage 2 → sort generously

## STAGE 2: NARROW AND DEEP (read yourself)
1. read the must-read items yourself | a new reference found while reading → follow it
2. something feels off → reinvestigate only that axis | a follow-up to the same agent by SendMessage keeps more context than launching a new one

## REPORT
- summarize: file map, impact range, open points, next proposal; STOP | whether to go on to implementation follows the conversation's commitments (usually wait for approval)

## RULES
- never edit files during the investigation
- never start the dev server
