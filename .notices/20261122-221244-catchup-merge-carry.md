# DOWNSTREAM NOTICE id:20261122-221244-catchup-merge-carry
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-22T13:12:44Z
severity: info
checkpoint: catchup-merge-carry
change: pnpm workflow notices catchUp (the /ship lay-again before push) carries what a work merge commit itself added or deleted onto the rebuilt merge: files absent from both parents of the original merge are taken from it, files present in both and absent from it are removed, then the rebuilt merge is amended (same author and message; line 「catchUp: 合流 <orig> が足した変更を載せ直した: <files>」) | files the merge rewrote to differ from both parents (merge-made content, conflict resolutions) are not carried; when the rebuilt merge differs there it prints 「catchUp: 合流 <orig> が書き換えた <files> は運べない(作り直した合流の中身を確かめる)」 | new export mergeOwnChanges in scripts/workflow/notices/catchUp.mjs; editTodo takes an optional third argument (the line added after each kept merge)
why: rebase --rebase-merges rebuilds a work merge with merge -C and dropped the merge commit's own additions without a word — a segment notice added in the merge vanished from the tip and incoming read the line as one tail segment
required_actions: none
verify: pnpm test scripts/workflow/notices/catchUp.test.mjs
manual_steps: -
refs: scripts/workflow/notices/catchUp.mjs (header, runCarry, mergeOwnChanges) | scripts/workflow/notices/catchUp.test.mjs | .claude/skills/ship/SKILL.md CATCH UP
notes: your own /ship runs your tree's catchUp.mjs, so the carry works after you take this segment | a 「運べない」 line means: check that file in the rebuilt merge before pushing (git rerere replays solved conflicts; anything else is fixed by hand in a new commit)
