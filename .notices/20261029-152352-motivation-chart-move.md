# DOWNSTREAM NOTICE id:20261029-152352-motivation-chart-move
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-29T15:23:52+09:00
severity: info
checkpoint: motivation-chart-move
moved: src/components/AppFrames/Admin/Elements/DeveloperMotivationChart.tsx -> src/features/core/admin/dashboard/components/parts/DeveloperMotivationChart.tsx
change: DeveloperMotivationChart (the gauge used only by the admin dashboard's AdditionalMetricsSection) moved out of `src/components/AppFrames/` into the dashboard's own parts folder, contents unchanged except the path comment. It is also exported from `parts/index.ts`; AdditionalMetricsSection imports `../parts/DeveloperMotivationChart`. No shim is left at the old path. The other Admin/Elements parts (ListTop, SearchBox, SortSelect, SecTitle, SelectFilter, ItemNavigator, AdminHeaderPortal) stay where they are for now.
why: `AppFrames/` is being dismantled; a part used by one feature belongs to that feature, and this one does not depend on the naming of the shared components shelves that the other parts wait for.
required_actions:
1. Merge upstream up to this checkpoint. If the fork edited the chart, /flux re-applies the edit at the new path (moved:).
2. If a fork-owned file imports the old path (find: `git grep -n "AppFrames/Admin/Elements/DeveloperMotivationChart" -- src`), change it to `@/features/core/admin/dashboard/components/parts/DeveloperMotivationChart` (or `.../components/parts`).
verify: `pnpm typecheck` | `git grep -n "AppFrames/Admin/Elements/DeveloperMotivationChart" -- src` returns nothing | the admin dashboard renders as before
manual_steps: -
refs: src/features/core/admin/dashboard/components/parts/DeveloperMotivationChart.tsx, src/features/core/admin/dashboard/components/parts/index.ts, src/features/core/admin/dashboard/components/sections/AdditionalMetricsSection.tsx, src/app/admin/_layout/README.md, council report 20261019-213253-shared-folders-placement-ownership §2
notes: No DB change, no db:push. | The move stays inside existing dashboard UI (no new core-domain UI). | Forks whose only import is the upstream AdditionalMetricsSection need nothing beyond the merge.
