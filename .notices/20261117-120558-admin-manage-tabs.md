# DOWNSTREAM NOTICE id:20261117-120558-admin-manage-tabs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-17T12:05:58+09:00
severity: info
checkpoint: admin-manage-tabs
change: New receptacle adminManageTabs in the user domain = a contract addition: forks gain a place they may write. Item = src/features/core/user/adminManageTabs/<name>.tsx (or a folder <name>/ with index) with `export const tab: UserAdminManageTabItem` = { key, label (ReactNode), order?, feature? (FeatureName), Content: ComponentType<{ user: User; onClose: () => void }> } (type from @/features/core/user/types); pnpm generate extensions writes extensions/adminManageTabs.ts. AdminUserManageModal (opened from the admin user list) shows the items after its 6 upstream tabs (summary / auth / status / role / delete / history), sorted by order then key; an item whose feature is closed is hidden; an item whose key equals an upstream tab value is not shown and logs a warning (upstream tabs cannot be replaced or removed). Upstream ships no item: with no item the modal is unchanged (output recorded before the change is compared in tests).
why: The modal is opened by upstream screens and a fork cannot change where it opens, so adding one tab meant copying the whole modal. One item now adds the tab and the fork keeps the upstream modal. Using it is optional.
required_actions: none
verify: pnpm typecheck passes (no item is required; the modal's props are unchanged).
manual_steps: -
refs: src/features/core/user/README.md (管理のユーザー管理モーダルのタブ（受け口 adminManageTabs）), src/features/core/user/adminManageTabs/README.md, scripts/structure/extensions/README.md
notes:
- Intake (src/lib/forkOwnership/intake.txt) gains `add src/features/core/user/adminManageTabs/*.{ts,tsx}` and `add src/features/core/user/adminManageTabs/*/**`; pnpm workflow ownership check accepts fork files there. Do not edit README.md in that folder (upstream-owned).
- Optional replacement, how to find candidates: copies of AdminUserManageModal made only to add a tab (`git grep -n -E "copied-from:.*AdminUserManageModal|<TabbedModal" -- src ':!src/features/core'`, e.g. an analytics-exclusion tab) → one adminManageTabs item holding the tab's content component, then point the caller back to the upstream modal and drop the copy. The item key must differ from the 6 upstream values.
- Content receives the user row and onClose (closes the modal); data and mutations stay in the fork's own hooks, authorization stays in its API (the tab only shows or hides by feature).
- No DB change.
