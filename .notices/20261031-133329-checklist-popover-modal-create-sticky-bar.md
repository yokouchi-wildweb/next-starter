# DOWNSTREAM NOTICE id:20261031-133329-checklist-popover-modal-create-sticky-bar
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-31T13:33:29+09:00
severity: info
checkpoint: checklist-popover-modal-create-sticky-bar
resolves: 20261031-130306-popover-modal-sticky-bulk-bar, 20261031-131311-checklist-popover-direct-create
change: opt-in `modal` and `onCreateOption` on ChecklistPopover / BelongsToManyFieldButton / BulkBelongsToManyFieldButton, opt-in `bulkActionsSticky` on RecordSelectionTable; ChecklistPopover onConfirm may return false to stay open
why: no follow-up needed; informs forks of the new options and closes the two orders
required_actions: none
verify: pnpm typecheck passes
manual_steps: -
refs: src/components/Overlays/README.md (ChecklistPopover) | src/lib/crud/components/Buttons/README.md | src/lib/tableSuite/README.md
notes: all new props default off; existing callers keep their behavior. The onConfirm return type is widened to void | boolean | Promise<void | boolean>. With onCreateOption set, the buttons keep the popover open and the selection on a failed confirm. Not verified in a browser upstream: check modal + sticky inside a scrollable Modal on first use. bulkActionsSticky pins to the very edge of the scroll container, so it does not suit page scrolling under a fixed header.
