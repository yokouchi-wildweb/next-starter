# DOWNSTREAM NOTICE id:20261024-182027-form-a11y-describedby-labels
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:20:27+09:00
severity: info
checkpoint: form-a11y-describedby-labels
change: Form a11y fixes, markup only. (1) ControlledField / ConfiguredField now render their input through the new internal src/components/Form/Field/FieldControl.tsx: aria-describedby points only at what is actually rendered (the `description` text, which now carries the matching id via FieldDescription, and the error message unless hideError). Before, _shadcn FormControl always pointed at a description id that no element had, and the visible description was never linked. (2) BooleanCheckboxInput falls back to useId() when neither id nor name is given, so its `label` prop is associated with the checkbox. (3) SelectPopover links each radio and its label with htmlFor / id. (4) Form README: hidden-label switches / checkboxes take `aria-label`; do not use _shadcn FormControl directly.
why: Forks inherit these components; any local fix for the dangling aria-describedby or the unassociated checkbox label (boardgame-site reported them) is no longer needed.
required_actions:
1. Merge upstream up to this checkpoint. If the fork patched src/components/_shadcn/form.tsx, ControlledField.tsx, ConfiguredField.tsx, BooleanCheckboxInput.tsx or SelectPopover.tsx for these issues (find: `git diff upstream/main -- src/components/_shadcn/form.tsx src/components/Form src/components/Overlays/Popover/SelectPopover.tsx`), take upstream on conflict and drop the local patch.
2. Fork code that renders _shadcn `FormControl` directly (find: `grep -rn "FormControl" src --include=*.tsx | grep -v _shadcn`) may switch to `FieldControl` from src/components/Form/Field/FieldControl.tsx for correct aria-describedby. Optional.
verify: `pnpm typecheck` | on a form field with `description`, the input's aria-describedby references an element that exists (DevTools) | a BooleanCheckboxInput with `label` toggles when the label text is clicked | SelectPopover selection works as before
manual_steps: -
refs: src/components/Form/Field/FieldControl.tsx | src/components/Form/Field/Controlled/ControlledField.tsx | src/components/Form/Field/Configured/ConfiguredField.tsx | src/components/Form/Input/Manual/BooleanCheckboxInput.tsx | src/components/Overlays/Popover/SelectPopover.tsx | src/components/Form/README.md | order 20261019-122328-fork-extension-points-bundle item (15)
notes: No DB change, no db:push. | src/components/_shadcn/form.tsx itself is unchanged (vendor file). | No visual change intended; the description text now has an id attribute.
