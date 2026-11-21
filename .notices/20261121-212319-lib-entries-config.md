# DOWNSTREAM NOTICE id:20261121-212319-lib-entries-config
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-21T21:23:19+09:00
severity: info
checkpoint: lib-entries-config
change: (1) core/lib.md: new key entry_names holds the four lib entry names and what each holds (`.` = client and server alike, no "use client" | `./server` = DB, admin SDK, secrets, node APIs | `./client` = pulls a browser SDK on import | `./node` = read by programs outside Next (scripts, eslint-rules, servers), never reaches React / Next); closed_lib_package's "entry keys only . ./server ./client ./node" now points there ("entry keys → entry_names"). (2) core/lib.md closed_lib_env sub-line: a public value read on the client = the literal `process.env.NEXT_PUBLIC_X` in the override (Next inlines only that form), beside the server-only call-time function. (3) core/ownership.md config and CLAUDE.md CORE_FILES config: src/config/ = values, or a zero-arg function that only returns env (process.env.X joined with ?? / ||), matching the override files line shipped in k6's shelf work
why: the rule text catches up with the lib entry checks (k6) and the config override wording the shelf already shipped; the meaning of each entry name and of the config line is now written where forks read it
required_actions: none
verify: -
manual_steps: -
refs: .claude/rules/core/lib.md entry_names, closed_lib_package, closed_lib_env | .claude/rules/core/ownership.md config | CLAUDE.md CORE_FILES config | 20261121-201855-k6-lib-entries-declare
notes: no key renamed or removed (entry_names is new; closed_lib_package keeps its key, its entry list moved into entry_names). A fork line (provisional rule, (priority) line) that cites "closed_lib_package" for the entry names may point at entry_names instead
