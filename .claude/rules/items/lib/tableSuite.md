---
paths:
  - "src/lib/tableSuite/**"
---
# lib/tableSuite
what: table UI library: DataTable (read-only), RecordSelectionTable / RecordSelectionList (selection + bulk actions), EditableGridTable (inline edit), PlainTable (the plain table parts Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption), with column sort, row reorder, unsaved guard and infinite footer
  - closed lib: one entry @/lib/tableSuite, shelf @/components as peers
use: always
change: none → /order <direct parent> (admin bulk actions = items in each domain's plugs/adminBulkActions/)
rules:
using:
- admin_bulk_actions: admin list bulk actions = receptacle items <domain>/plugs/adminBulkActions/<name>.tsx (BulkActionItem, @/lib/crud bulk*Action creators), never hand-written bulkActions in a Table | generic bulk buttons only for side-effect-free columns, recorded ops → upstream service + API + creator | item access = show / hide only (authz is the API)
- messaging_bulk_send: a bulk send from an admin list = definitionBulkAction (fixed text from a definition) or bulkMessageAction (text the admin writes) as that list's adminBulkActions item → src/domains/core/messaging/components/README.md Usage
- selection_hook: selection outside a table uses useRecordSelection + BulkActionBar, never a hand-built Set
- sort_by_caller: tables only show sort state and report changes; the caller sorts, and a paginated list sorts on the server through the URL, never sortItems on one page | SortState → search orderBy = toOrderBySpec from @/lib/crud
- reorder_key: reorderable needs a getKey returning a stable record id
- reorder_scope: cross-page or large-volume ordering → a searchForSorting screen / @/lib/sortableList (reorderable cannot cross page boundaries)
- batch_save_guard: a screen that keeps edits or order locally and saves later calls useUnsavedGuard itself (the table holds no unsaved state)
- full_width_index: fullWidthRows afterIndex is recomputed by the caller whenever items change
- page_scroll_infinite: a table scrolled by the page (maxHeight="none") is wrapped in InfiniteScrollList instead of infiniteFooter
editing:
- guard_entry: the lib reads @/lib/unsavedGuard through its entry only
- no_crud: tableSuite never imports @/lib/crud, values and types (crud reads tableSuite, never the reverse) | a CRUD-shaped helper goes to crud
- popup_attr: an editor with a popup sets { [POPUP_ATTR]: cellKey } on the popup root
- editor_inputs: an editor's inputs come from the @/components/Input units
- editor_type_public: a new editorType is a public type change of tableSuite (type, renderEditor case, README list)
read: pick and use a table (PlainTable included) → Usage | props, sort helpers → API | bulk actions receptacle → Extension | column options → src/lib/tableSuite/EditableGridTable/README.md API | add an editorType → src/lib/tableSuite/EditableGridTable/README.md Extension | cell internals → src/lib/tableSuite/EditableGridTable/README.md Internals
