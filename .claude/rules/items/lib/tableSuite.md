---
paths:
  - "src/lib/tableSuite/**"
---
# lib/tableSuite
what: table UI library: DataTable (read-only), RecordSelectionTable / RecordSelectionList (selection + bulk actions), EditableGridTable (inline edit), with column sort, row reorder, unsaved guard and infinite footer; entry @/lib/tableSuite only
use: always
change: none → /order <direct parent> (admin bulk actions = items of each domain's adminBulkActions)
rules:
using:
- admin_bulk_actions: admin list bulk actions = receptacle items <domain>/adminBulkActions/<name>.tsx (BulkActionItem, @/lib/crud/components bulk*Action creators), never hand-written bulkActions in a Table | generic bulk buttons only for side-effect-free columns, recorded ops → upstream service + API + creator | item access = show / hide only (authz is the API)
- selection_hook: selection outside a table uses useRecordSelection + BulkActionBar, never a hand-built Set
- sort_by_caller: tables only show sort state and report changes; the caller sorts, and a paginated list sorts on the server through the URL, never sortItems on one page
- reorder_key: reorderable needs a getKey returning a stable record id
- reorder_scope: cross-page or large-volume ordering → a searchForSorting screen / @/lib/sortableList (reorderable cannot cross page boundaries)
- batch_save_guard: a screen that keeps edits or order locally and saves later calls useUnsavedGuard itself (the table holds no unsaved state)
- full_width_index: fullWidthRows afterIndex is recomputed by the caller whenever items change
- page_scroll_infinite: a table scrolled by the page (maxHeight="none") is wrapped in InfiniteScrollList instead of infiniteFooter
editing:
- guard_entry: the lib reads @/lib/unsavedGuard through its entry only
- popup_attr: an editor with a popup sets { [POPUP_ATTR]: cellKey } on the popup root
- editor_inputs: an editor's inputs come from @/components/Form/Input/Manual wrappers
- editor_type_public: a new editorType is a public type change of tableSuite (type, renderEditor case, README list)
read: pick and use a table → Usage | props, sort helpers → API | bulk actions receptacle → Extension | column options → src/lib/tableSuite/EditableGridTable/README.md API | add an editorType → src/lib/tableSuite/EditableGridTable/README.md Extension | cell internals → src/lib/tableSuite/EditableGridTable/README.md Internals
