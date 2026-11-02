# DOWNSTREAM NOTICE id:20261103-085005-checklist-popover-create-focus
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-03T08:50:05+09:00
severity: info
checkpoint: checklist-popover-create-focus
resolves: 20261031-143223-checklist-popover-autofocus
change: ChecklistPopover create-option Input no longer uses autoFocus; focus moves to it by ref in an effect when the user opens the create form (same behavior, not flagged by jsx-a11y/no-autofocus)
why: info only — forks with jsx-a11y recommended saw a jsx-a11y/no-autofocus warning on ChecklistPopover.tsx; nothing to do downstream
required_actions: none
verify: pnpm typecheck && pnpm test:popover-dismiss && npx eslint --rule '{"jsx-a11y/no-autofocus":"warn"}' src/components/Overlays/Popover/ChecklistPopover.tsx (no warning)
manual_steps: -
refs: src/components/Overlays/Popover/ChecklistPopover.tsx | src/components/Overlays/README.md (ChecklistPopover 新規追加) | commit 15f3381e | order 20261031-143223-checklist-popover-autofocus
notes: callers without onCreateOption are unchanged | other bare autoFocus remain upstream (AsyncComboboxInput, AsyncMultiSelectInput, AsyncPickerModal, adminCommand palette and renderers) and still warn under jsx-a11y; not part of this order | not browser-checked upstream
