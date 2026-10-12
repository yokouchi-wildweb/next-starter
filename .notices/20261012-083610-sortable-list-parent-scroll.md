# DOWNSTREAM NOTICE id:20261012-083610-sortable-list-parent-scroll
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-12T08:36:10Z
severity: info
change: SortableList (@/lib/sortableList) gained `scroll?: "self" | "parent"` (default "self" = byte-for-byte previous behavior). `scroll="parent"` renders WITHOUT its own scroll container: no overflow-y-auto, no maxHeight, no useVirtualizer (hook stays mounted with `enabled:false`); all rows render in normal flow (`flex flex-col gap-2`) so the nearest scrollable ancestor (Modal body / TabbedModal / page section) is the single scroll region. `maxHeight` is ignored in parent mode. showHeader / isItemDisabled / disabled / rowClassName / itemHeight / itemPaddingX|Y / DnD semantics identical in both modes. New exported type `SortableListScrollMode`. New README src/lib/sortableList/README.md (section "親スクロールに追従させる (scroll=\"parent\")"); demo page /demo/sortable-list shows both modes.
why: A short editable SortableList inside a scrolling Modal/TabbedModal produced nested double scrollbars (Modal body + list, default maxHeight 70vh). `maxHeight="none"` only worked by accident of virtualizer behavior. Flow layout is the correct mode for tens-of-rows in-form lists; virtualization only pays off for long lists.
required_actions:
1. Nothing mandatory — existing usages (AdminXxxSort pages, modals passing maxHeight, tableSuite reorderable) are unchanged.
2. Optional: where a SortableList sits inside a scrolling Modal/TabbedModal/section and double scrollbars appear, add `scroll="parent"` to that `<SortableList>` and drop any `maxHeight="none"` workaround. Keep `"self"` (default) for large-count dedicated sort screens.
verify: `npx tsc --noEmit` green; open /demo/sortable-list — the second list (scroll="parent") shows a single scrollbar on its outer card and drag-reorder still fires onReorder; existing admin sort pages render as before.
manual_steps: -
refs: src/lib/sortableList/SortableList.tsx, src/lib/sortableList/types.ts (SortableListScrollMode, SortableListProps.scroll), src/lib/sortableList/README.md, src/lib/tableSuite/README.md (使い分け row), src/app/(user)/demo/sortable-list/_components/SampleSortableList.tsx
notes: Shipped for upstream-request 20261012-173020-sortable-list-parent-scroll-mode (oripa-do). dnd-kit default autoScroll scans scrollable ancestors, so edge-drag scrolling of the Modal body works in parent mode without extra wiring. No new deps.
