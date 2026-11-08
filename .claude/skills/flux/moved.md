# /flux attachment: porting moves / renames (`moved:`)

read when the condition of SKILL.md ATTACHED FILES hits | spec: `.notices/README.md` section `移動・改名(moved)`

why: when upstream moves by "create new + replace the old path with a shim" instead of `git mv`, git does not see a rename, and the fork's edits at the old path become conflicts with the shim or are overwritten by upstream's version | /flux ports them using the notice's `moved: <old> -> <new>; ...`

## STEPS
0. target pairs = the `moved:` of the segment's notices (both covers side and covered side) combined (the same pair merged into one)
1. **when planning** (SKILL.md step 2): for each target pair take `git diff --name-only <base> HEAD -- <old>` | not empty → put `fork が編集した移動元: <old> → <new>(ファイル数・規模)` in the work memo's script | none → `なし` | chat: under flux-stop's `fork の追従`, what (by role), how much, what kind of work, where it may affect
2. **before the merge** (SKILL.md step 5a): save the fork-side diff of each pair with edits: `git diff --binary <base> HEAD -- <old> > <scratch>/moved-<n>.patch`
3. **after the merge** (right after SKILL.md step 5b, before the out-of-segment check): take upstream's version for conflicts at the old path (`git checkout --theirs -- <old>`; deleted upstream → `git rm`)
   - rewrite the paths of the saved diff (`diff --git a/<old>... b/<old>...`, `--- a/`, `+++ b/` lines) to `<new>` (directories: replace the prefix) and apply it with `git apply --3way <書き換えた patch>`
   - rewrite only those header lines, never the content lines (context, `+`, `-` lines) | a moved file may keep a header comment naming the old path, and replacing across the whole patch changes that line too so it no longer applies | e.g. `sed -E '/^(diff --git |--- a\/|\+\+\+ b\/)/s#<old>#<new>#g'`
4. hunks that did not apply remain as conflict markers | resolve them in a form that reconciles upstream's change with the fork's intent | not obvious → stop as a stop condition
5. write the ported pairs, files and spots resolved by hand in the ledger `notes:`, and confirm by verify that the fork's edits are in on the new-path side (`git diff <merge 先> -- <new>` shows the fork's changes)

## EDGE CASES
- the old path of `moved:` is a directory and the fork added files under it: move the added files to the new directory by the same prefix replacement (they are in the diff as "new files", so the steps are the same)
  - the destination is upstream-owned (`_layout/` `_screen/` of upstream routes, etc.) → do not put them there as is; in the same segment make them a whole replacement (`<Name>.replace.tsx`) or move them out to a fork-owned place
  - processing / guards that must not turn into a copy come along → do not move them out; pass by order + temporary permit (SKILL.md REVIEW OF FORK EDITS IN UPSTREAM-OWNED PATHS; rewrite imports in the same segment too)
- the old path written in `moved:` does not exist at the merge-base (the fork was founded after the move, etc.): treat as no porting target
