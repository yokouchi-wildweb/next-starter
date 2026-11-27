---
name: coffee-break
description: Compact this session - the one way to compact (plain sessions and sessions run by a team tool alike): pnpm workflow agent-terminal compactPlan gives the extra steps, the handoff file and the default next step, write the handoff, then compactSelf; after the compact the hook reads the handoff back | When the user asks to compact or take a coffee break, the user accepts a compact you proposed at a step boundary, or the tool running this session types /coffee-break
argument-hint: "[補足(任意): 続けるか待つか・残したいこと]"
---

role: compact this session in one go | the processing stays in `pnpm workflow agent-terminal compactPlan|compactSelf` | ref: scripts/workflow/agent-terminal/README.md
extra: $ARGUMENTS
when: only on the user's words, the user's ok to your proposal, or the cue typed by the tool running this session | never on your own judgment: at a long step boundary propose it in one line and wait
no_other_work: this turn does only the steps below

## STEPS
1. run `pnpm workflow agent-terminal compactPlan`
2. each `prepare:` line → do it as written (none → skip) | `context: ignored` → tell the user that line, go on
3. write the handoff with Write to the `handoff:` path (overwrite; `handoff: none` → skip this step), English, terse:
   - state: where the work stands | decisions: what the user agreed (absolute dates) | next: the next step and its end condition | files: the files in progress
   - only what nothing reloaded after the compact carries (CLAUDE.md, rules and files on disk come back by themselves)
4. run the `next:` line: `--then` = the `then:` value, another only when the user (or `extra`) says it for this compact | the quoted line = what to re-read first
   - continue = re-read and go on | wait = the user said to wait now — never because a question or an approval is pending: that stays continue
   - after continue: ask again what you were waiting on (a team's lead: its await too)
5. follow its output: queued or handed to the tool → end the turn now | it prints a line for the user → show that `/compact …` line and end the turn

## RULES
- never write the handoff elsewhere (memory, the repo, ~/.claude) | the hook reads it back once after the compact and deletes it
- approval rules are unchanged by the compact
