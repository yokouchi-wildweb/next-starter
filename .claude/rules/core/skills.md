---
paths:
  - ".claude/skills/**"
---
# SKILLS (agent skills)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies to skill files too | this file holds only what differs for skills

scope: .claude/skills/\<name\>/SKILL.md + attached instruction .md beside it | out: scripts (*.mjs) and their output text, agents/*.yaml, README.md (a doc, behavior.md language)
nature: skill files are agent context, not docs → English, compressed, the same form as CLAUDE.md (behavior.md language_for_comments_and_docs does not apply) | applies to every skill, disable-model-invocation ones included
environment: context files (CLAUDE.md, rules, hook text) never branch on the environment | a skill that needs one states it in its description `requires:` (below)

## FRONTMATTER
description: `<what> | <when> [| requires: key=value,...]` | English, items separated by ` | ` | at least what + when | requires = last item, only when the skill has a condition | never `<` `>` (escaped in the listing)
- length: description + when_to_use ≤ 1536 chars (the listing cuts there) | keep it short: the listing is in context every turn
when_to_use: optional | trigger phrasings and examples (the user's words may be Japanese inside quotes in the body, never here) | English
argument-hint: free (shown to the user, not checked)

## BODY
form: key: value lines + numbered steps | each step one action | stop points explicit (`STOP: <what to wait for>`) | no narrative preamble ("this is a note, not a mode") → one `role:` line
human_text: Japanese report / question templates shown to the user stay Japanese, only inside fenced blocks | everything else English
limits: a line over ~400 chars → split into sub-bullets

## ATTACHED (.md beside SKILL.md)
agent_read: instructions the skill opens on demand = the body form above
templates: text written into fork files (e.g. project.template.md) = FORMAT_RULE English
human_templates: Japanese only inside fenced blocks (as human_text)

## REQUIRES (upstream vocabulary)
> one line per key=value | upstream skills use only these (check error) | a fork-added key is a warning | a new key = an upstream line here first
- AGENT_TERMINAL=tmux: the agent session runs inside tmux and the AGENT_TERMINAL switch reads tmux

## CHECK
test: pnpm check skills (gate ship) | upstream skill breaks the form → error | fork-added skill → warning | base unreadable in a fork → exit 2 (unverified, never a pass) | ref: scripts/workflow/skills/README.md
pending: scripts/workflow/skills/pending.txt = skills not yet rewritten (reported as pending, not failed) | a rewrite removes its line | upstream-owned, empties over time
mechanical_proxy: English = no CJK outside fenced blocks and inline code
