# DOWNSTREAM NOTICE id:20261124-023031-bulk-action-target
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T02:30:31Z
severity: action-required
checkpoint: bulk-action-target
fixes: 20261123-033619-bulk-user-ops
pick: clean
resolves: 20261124-112423-bank-transfer-bulk-receptacle
change: an admin bulk action item (point adminBulkActions, core/admin) may name the list it works on with `domain?: string` (the list's domain folder name; omitted = the plugging domain, as before): new type AdminBulkActionItemOf<Row> in @/domains/core/admin/types/adminBulkAction (AdminBulkActionItem = AdminBulkActionItemOf<any>); every domain's <Domain>AdminBulkActionItem (bankTransferReview, messaging, user, generated domains) is built from it; useDomainAdminBulkActions(domain) keeps items whose (item.domain ?? plugging domain) is that domain
why: items are collected from every domain's plugs/adminBulkActions/, but the reader kept only items plugged by the list's own domain, so a fork could not add a bulk action to an upstream domain's list from its own domain (oripa-do's bulkDecision for bankTransferReview), and the bulk-user-ops examples (fork items for the user list in the fork's own domain) never showed
required_actions:
1. Fork items meant for another domain's list: `git grep -n -E "export const bulkAction" -- 'src/domains/*/plugs/adminBulkActions/**' ':!src/domains/core'` → add `domain: "<the list's domain folder name>"` to each item whose list is not its own domain's (e.g. `{ ...bulkUserStatusAction<User, AdminBulkActionAccess>({ key: "userStatus", lists: ["general"] }), domain: "user" }`)
2. A fork item kept inside an upstream domain under a temporary permit (oripa-do: src/domains/core/bankTransferReview/adminBulkActions/bulkDecision.tsx): move it to your own domain's plugs (oripa-do: src/domains/bankTransferReviewBulk/plugs/adminBulkActions/bulkDecision.tsx) with `domain: "bankTransferReview"` (type BankTransferReviewAdminBulkActionItem), delete the old file, pnpm generate extensions, drop the permit line from .fork-ownership/<repo_id>.permits.txt
3. A fork's own hand-written item type built from BulkActionItem<Row, AdminBulkActionAccess> → AdminBulkActionItemOf<Row> (find: `git grep -n "BulkActionItem<" -- src ':!src/domains/core' ':!src/lib'`); generated domains: pnpm generate domain -- <Domain> --only components
verify: pnpm typecheck | pnpm check extensions | pnpm workflow ownership check (no permit left for the upstream domain's bulk action) | the item shows in the target list
manual_steps: -
refs: src/domains/core/admin/types/adminBulkAction.ts | src/domains/core/admin/hooks/useDomainAdminBulkActions.ts | src/lib/tableSuite/README.md (一括操作の受け口) | .claude/rules/items/lib/tableSuite.md admin_bulk_actions | src/domains/core/user/README.md / src/domains/core/wallet/README.md (bulk-user-ops examples) | order 20261124-112423-bank-transfer-bulk-receptacle
notes: closing: the plugging domain closed → the gate drops its items; the target domain closed → its list is gone | items stay in the plugging side's own folder (D26); nothing moves upstream (oripa-do's bulkDecision is its own business, with its own service / API in bankTransferReviewBulk) | card key admin_bulk_actions gains a sub-line, no key renamed
