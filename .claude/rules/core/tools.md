---
paths:
  - "scripts/**"
  - "src/domains/**/scripts/**"
  - ".notices/*.mjs"
  - ".claude/{skills,agents,scripts,hooks}/**"
  - ".claude/settings.json"
---
# tools
> **ROLE**: loaded when building or fixing a tool (scripts, skills, hooks, settings; ~/.team/_bin through CLAUDE.md TOOLS making) | holds how tools are built
> Tier1-owned: forks never edit (gap → /order next-starter) | a tool's placement and code rules → core/scripts.md, a skill's format → core/skills.md

before_building: ask 4 questions, build only when all are yes
- one answer (choosing, ordering or allowing = no) | the same step done by hand several times (it may happen, one incident's repeat, a future crowd = no)
- no state of its own (no marker file, no saved copy: it reads git and the records each run) | never restricts (stops only before production, a push or a human's decision) and the work can still be done by hand when it breaks
- one no → do not build it: write the step in one line in a role text or a procedure and do it by hand
judgment_tools: a tool asked to judge is split into show (a table of facts) + the agent decides + do (a named operation) | build only show and do
existing_tools: the same place fixed by rewriting conditions 3 times, a fix that brings the next bug, or a judgment whose answer differs by scene (by fork) → remove the judgment, keep a table of facts | "if it vanished tomorrow" is a few commands and one judgment → remove the tool
never_build: a judging tool, an approval stage, a private ledger
growth: moving work into a tool goes through before_building only | a judgment stays in the role text (the agent)
targets: before_building applies to programs (scripts commands, hooks, ~/.team/_bin commands) | skills, role texts and procedures are where the LLM judges: never ask "one answer" there
- for them: build after the same thing was asked several times, never restrict, and never fix a judgment scene into detailed branches: write the cues and the tools it may use, leave the judgment to the reader
naming_tools: naming a tool as the default step is good (a push → /sluice, a generated file → its generator, repo.json → its command) | bad: forbidding every other way, or a tool that must let you through before you can go on
- a tool that does not fit or broke → the agent leaves one line why and makes the same result by hand; the tool checks and records the result | a tool may stop only before production, a push or a human's decision
tool_design: a tool does the work, then checks and records the result | it never restricts what the agent may do | it may stop only before production, a push or a human's decision | an ordinary step is never made "only the tool writes it" or "go through the tool"
