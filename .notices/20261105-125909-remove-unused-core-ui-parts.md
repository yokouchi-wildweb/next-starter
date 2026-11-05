# DOWNSTREAM NOTICE id:20261105-125909-remove-unused-core-ui-parts
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:ui/infinite-list-retry | commit:- (this commit)
date: 2026-11-05T12:59:09+09:00
severity: info
checkpoint: remove-unused-core-ui-parts
change: Removed six core UI files that no repo uses: notification CreateNotificationForm / EditNotificationForm and the two parts only they used (NotificationForm, NotificationFields), user ActionMenuCard / UserInfoTable. Their two rows in eslint-rules/core-ui-guards.allow.mjs are gone too. The notification CRUD hooks (useCreateNotification / useUpdateNotification) stay.
why: Deleting files forks may extend ships a notice (CLAUDE.md DOWNSTREAM_NOTICES). Users were counted in 88-base, triq, boardgame-site, next-vnx, oripa-do and pandora (main): 0 outside the files themselves, so no fork code needs to change.
required_actions: none
verify: pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen | pnpm test:core-ui-guards
manual_steps: -
refs: shelf council D123, order 20261105-122328-core-ui-remove-unused-parts
notes: Deleted paths (no move target): src/features/core/notification/components/common/CreateNotificationForm.tsx, src/features/core/notification/components/common/EditNotificationForm.tsx, src/features/core/notification/components/common/NotificationForm.tsx, src/features/core/notification/components/common/NotificationFields.tsx, src/features/core/user/components/common/ActionMenuCard.tsx, src/features/core/user/components/common/UserInfoTable.tsx. If your fork imports one of them after all (`git grep -n -e CreateNotificationForm -e EditNotificationForm -e "common/NotificationForm" -e NotificationFields -e ActionMenuCard -e UserInfoTable -- src`), copy the file from upstream history into your route's _components/ (or your own domain) and import it from there; a merge conflict on a file you edited = keep the deletion and move your copy the same way.
