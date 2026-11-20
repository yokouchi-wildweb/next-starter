# patterns (merge patterns: the framework's named ways to take in upstream)
role: the one definition of the 4 merge patterns (name, when it applies, what to do, the one line in plans and reports) | read by /flux at BUILDING SEGMENTS and in every segment plan | a tool that runs /flux unattended automates the same patterns and reports the same line; it never redefines them | a change to a pattern = this file, shipped with a notice

## COMMON
- a pattern is named in the plan where it applies, one line per case in the form of LINES below | /flux run by a person: the plan shows it and takes the usual approval (a pattern never skips an approval here)
- an unattended run: a case that meets every condition goes on without asking and is reported once, one line per case, at the next report point (a stop report first when there is one); a case that misses a condition is asked as before
- records: the fork's ledger and commits keep plain facts (what was aligned, which check was deferred and why, which fix cleared it); never the pattern name
- the conditions below are all required (AND) | `mechanical` = a tool can check it | `reading` = needs the reader's judgment

## BACKPORT (a check fails on an upstream mistake whose fix comes later on this line)
applies (mechanical): a check of this segment fails | the cause is in upstream files (the fork's own files are not involved) | a later segment of the same line carries the fix (its notice `fixes:` names this segment's notice or commit, or a later commit edits the same lines)
do:
1. try the fix commit on this segment (cherry-pick in a scratch state) | no conflict → take it ahead and pass the real check
2. conflict → drop the try, close the failed check as deferred (the record names the fix it waits for) and go on | the fork writes nothing into upstream files | the same deferral applies to the check after merging several segments
3. when the fix's segment is taken in: run the same check again | passes → the deferral becomes a real pass | fails → stop and ask
- never wait (no parking the segment until the fix arrives: later segments would never join in order)
- stop and ask instead: a deferral is still open and the run would end, or ship to main, before the fix's segment (never ship with a broken check carried)

## REFINE (align the fork's own way of doing something to upstream's new mechanism, invisibly)
applies (mechanical): every file it changes is fork-owned | it touches no DB schema, no message definitions, no feature switch, no route
applies (reading): no visible change (screens, texts, API answers stay the same) | there is exactly one upstream form to align to
do: align to that upstream form in the segment's fork follow-up | a moved upstream file keeps the copy mark's original path, only the move applied
- found by the one doing the segment's work: raised as one line to whoever decides; a case that fails a condition goes to the human as a normal follow-up choice

## HANDOFF (a finding for upstream that the fork need not act on)
applies (mechanical): kind bug or notice_mismatch | evidence attached (file:line, command output) | no temporary permit is needed for it | no later segment fixes it already | no open order to upstream says the same
applies (reading): the fork's behavior does not change by it | it is not the fork's own preference
do: file the order to the upstream's inbox (/order <upstream>) and go on | an event that is also a Backport case is one case (one key): when a later fix exists, file nothing
- the order's text and its from: name no tool or role of the sender (the inbox is generic)
- reported at the next segment report point, not when filed

## REJOIN (upstream history split into lines that merge again, two or more with checkpoints)
applies (mechanical, incoming.mjs): within one repo's own notices (all the split's rows have the same owner, no grandparent rows), lines from one fork point, two or more carrying a checkpoint, meet in one merge commit on upstream's first-parent line
do: only lines with something left count (a line the fork already took in whole is not a line here; one left = the usual order) | take the line with the most checkpoints first, one segment per checkpoint (targets on that line)
- every other line left is not split into segments: its notices ride in one segment whose target is the merge commit (merging it brings those lines whole) | segments after the merge go on as before
- counted over the whole merge: the checkpoints a fork already took in (its ledger, its tree) count for their line too — a fork that took part of the longer line goes on with that line | the same number: upstream's first-parent line first | three or more lines (an octopus, or merges that overlap: what an earlier merge ordered stays) are decided the same way (D378)
- not decided (marked `rejoin: undecided` with the reason, order left as history gives it; stop and ask) only when a notice on one line names a notice on another (`fixes:` / `covers:` / `uses:` / `skip_checkpoint:`), so the order is bound (a fix shipped beside the point it fixes goes the Backport way)
- incoming.mjs --json: each segment of a decided split has `pattern: "Rejoin"`, the joining segment also `rejoinMerge: <merge sha>`; an undecided one `rejoin: { undecided, why, merge }`

## LINES (the one line per case, in plans and reports)
```
Backport パターン: <check> を <修正の区間> の直しで先取り | 見送り（<修正の区間> で本物の検査） — 区間 <n>
Refine パターン: <何を> を上流の <仕組み> に揃えた — 区間 <n>
Handoff パターン: <依頼の題> — 区間 <n>（依頼 <order id>）
Rejoin パターン: 多い側の線（区切り <k> 個）を先に 1 つずつ、少ない側（<j> 個）は合流 <merge> で — 区間 <n>-<m>
```
