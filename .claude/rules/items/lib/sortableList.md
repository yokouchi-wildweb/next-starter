---
paths:
  - "src/lib/sortableList/**"
---
# lib/sortableList
what: a drag-and-drop reorder list (dnd-kit + virtualization) for sort-focused screens (generated AdminXxxSort) and edit lists in modals; entry @/lib/sortableList (SortableList, ReorderResult)
use: always
change: none → /order <direct parent>
rules:
using:
- sl_table_first: adding reorder to an existing table → tableSuite `reorderable`; this list is for screens whose main job is sorting
- sl_items_owner: the caller owns the order of `items` (optimistic update, roll back on failure)
- sl_scroll_mode: a few dozen rows inside a scrolling modal or section → scroll="parent"; large lists → "self"; never maxHeight="none"
- sl_local_batch: a screen that keeps reorders locally and saves later calls useUnsavedGuard itself (the list guards only a pending onReorder Promise)
editing:
- sl_no_local_order: the list keeps no unsaved order of its own (the caller saves on each drop)
read: basic use, scroll modes → Usage | props → API | unsaved guard → Internals
