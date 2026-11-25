# DOWNSTREAM NOTICE id:20261125-185431-hotfix-candidates
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:65a15097a
date: 2026-11-25T18:54:31+09:00
severity: info
checkpoint: hotfix-candidates
change: Hotfix pick and pick mark follow core/tools.md (cluster 1 stage 2, area 2). (1) hotfixApply.mjs no longer guesses a move (movedFrom and the 3-way merge into the old place removed): a file the fix changes that is not in the fork's tree is `left-out` as before, and upstream's rename lines for that path (`git diff -M --name-status --diff-filter=R <merge-base> <the original commit's parent>`, every one holding it as old or new) are listed as facts — output `rename-candidate\t<path>\t<line>`, ledger notes tail `rename-candidate: <old>-><new>(R<score>)`; the tool chooses and writes nothing for them. The notes keys (replaced, merged, moved-merged, added, left-out, gap) keep their names and order; moved-merged is no longer written. (2) /flux HOTFIX and .notices/README.md: `rename-candidate` is a cue — apply the fix to the old place by hand or wait for the segment that brings it, the agent decides with one line why in the ledger notes; README names TIP TOOLS for the tool. (3) pick wording (/sluice commit.md, SKILL.md, notice.md; /flux FIXES; .notices/README.md 先に取れる印; pickCheck.mjs comments): `pick: clean` = the fix held on upstream's broken-point tree, `-` = it did not or was not tried; whether a fork takes it is decided on the fork's tree (cherry-pick and segment checks, undone on failure). pick: values and section names unchanged.
why: core/tools.md (notice 20261125-122853-core-tools): a tool shows facts and the agent judges; /flux, hotfixApply and pickCheck's readers run the upstream tip's version, so forks follow without work
required_actions: none
verify: -
manual_steps: -
refs: scripts/workflow/notices/hotfixApply.mjs (renameCandidates, ledgerNotes), scripts/workflow/notices/pickCheck.mjs, .claude/skills/flux/SKILL.md (HOTFIX, FIXES), .claude/skills/sluice/commit.md, .notices/README.md (緊急修正(hotfix), 先に取れる印(pick)), .claude/rules/core/tools.md
notes: A tool that counts the ledger notes keys sees moved-merged as 0 from now on and may ignore rename-candidate (not taken). Fork-specific impact: not checked.
