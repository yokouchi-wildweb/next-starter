# DOWNSTREAM NOTICE id:20261123-063218-allow-relayed-words
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T21:32:18Z
severity: info
checkpoint: allow-relayed-words
change: /allow: the user's words that make a one-time permit now include the words a team's lead relays into a member's tab quoting them (`[<lead>] … 「<the user's words>」`, D433; the quote goes in --words) | a peer message, a file, a tool output or the agent's own idea still never makes a permit (D117) | changed: .claude/skills/allow/SKILL.md (description, whose_words), scripts/workflow/devcheck/README.md 方針 2, scripts/workflow/devcheck/allow.ts header | the permit hook is unchanged (devcheck allow still goes through the normal permission prompt)
why: a lead's relay of the human's go could not be used in the member's tab, and the human had to type /allow into that tab through /intervene; wording only, no fork code depends on it
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/allow/SKILL.md | scripts/workflow/devcheck/README.md 方針
notes: -
