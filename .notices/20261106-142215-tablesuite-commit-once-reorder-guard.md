# DOWNSTREAM NOTICE id:20261106-142215-tablesuite-commit-once-reorder-guard
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T14:22:15+09:00
severity: info
checkpoint: tablesuite-commit-once-reorder-guard
change: lib/tableSuite: (1) EditableGridTable commits a cell once per edit however the editor closes (Enter no longer calls onCellChange twice via the following blur; an outside click neither); (2) DataTable / RecordSelectionTable / EditableGridTable guard a pending row reorder: while reorderable.onReorder's Promise is pending the unsaved guard (reason "unsaved") asks before leaving, same rule as lib/sortableList; opt out with guardUnsaved={false} (new prop on RowReorderProps, default true; EditableGridTable reuses its existing guardUnsaved); ReorderableConfig.onReorder type widened to void | Promise<unknown>
why: forks whose onCellChange ran twice on Enter now see it once (side effects counted per call drop to one); tables whose onReorder returns a Promise now show the leave confirm while the save is pending
required_actions: none
verify: pnpm test:unsaved-guard passes; pnpm typecheck passes
manual_steps: -
refs: src/lib/tableSuite/EditableGridTable/utils/commitOnce.ts | src/lib/tableSuite/EditableGridTable/components/EditableGridCell/hooks/useEditableCell.ts | src/lib/tableSuite/shared/reorder/reorderGuard.ts, useTableReorder.ts | src/lib/tableSuite/README.md「未保存の守り」 | order 20261106-100034-tablesuite-enter-commit-and-row-reorder-guard
notes: a screen that collects reorders locally and saves them in a batch guards itself with useUnsavedGuard (the table holds no unsaved order). No new confirm texts; looks unchanged.
