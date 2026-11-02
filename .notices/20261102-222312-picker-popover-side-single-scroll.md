# DOWNSTREAM NOTICE id:20261102-222312-picker-popover-side-single-scroll
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-02T22:23:12+09:00
severity: info
checkpoint: picker-popover-side-single-scroll
fixes: commit:2d2ecc45
resolves: 20261031-123802-async-multiselect-popover-height
change: Picker popovers (AsyncMultiSelectInput, MultiSelectInput, ComboboxInput, AsyncComboboxInput) choose side at open (top when space below < needed and above is larger) and keep one scroll area (the candidate list); PopoverContent itself unchanged
why: info only — the available-height cap from 2d2ecc45 froze Radix flip on bottom when content grew after open (async loading) and produced nested scrollbars that could scroll the confirm button away; no fork action needed
required_actions: none
verify: pnpm typecheck && pnpm test:popover-side && pnpm test:popover-dismiss
manual_steps: -
refs: src/components/Form/Input/Manual/AsyncOptionSource/popoverSide.ts, usePickerPopoverSide.ts | src/components/Overlays/README.md (PopoverContent height section) | order 20261031-123802-async-multiselect-popover-height
notes: an explicit popoverContentProps.side still wins (it is spread after the computed side) | a workaround popoverContentProps={{ side: "top" }} added downstream may now be removed | side is measured only on user open (onOpenChange); defaultOpen / programmatic open keeps "bottom" with Radix flip as fallback | new exports in AsyncOptionSource: decidePopoverSide, usePickerPopoverSide, PICKER_POPOVER_BODY_CLASS, POPOVER_SIDE_MARGIN | oripa-do: no edits to the touched upstream files (checked: only RangeInput.tsx differs under Form/Input/Manual, not touched here) | not browser-checked upstream
