# DOWNSTREAM NOTICE id:20261110-134545-rule-merge-admin-children
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T13:45:45+09:00
severity: breaking
checkpoint: config-rule-merge-admin
change: feature-gate rules userTag, adminChatRooms and adminNotificationTemplates are deleted (decisions D64, D104, D119) | /admin/chat-rooms is now a path of chatRoom, /admin/notification-templates a path of notification (no child switches) | user tags are an always-open base: core/userTag is in no rule (admin pages /admin/user-tags, API /api/userTag, the tag field of the admin user create / edit forms and the bulk tag action are always on; useGate("userTag") and the bulk item's feature: "userTag" are gone) | upstream behavior change: /admin/notification-templates was closed by default (adminNotificationTemplates false) and now opens with notification
why: a switches.config.ts naming userTag / adminChatRooms / adminNotificationTemplates throws at load (unknown feature name) | fork code calling gate.enabled / useGate().enabled with those names fails pnpm typecheck (FeatureName) | a fork that closed only the chat admin gets it open again
required_actions:
1. Merge upstream up to this checkpoint.
2. Delete userTag / adminChatRooms / adminNotificationTemplates keys from src/config/featureGate/switches.config.ts if present.
3. [判断] chat admin only closed today (old enableChatRoomAdmin false): oripa-do uses chat (inquiry) but not its admin (no Firestore composite index) → keep it closed with an own rule src/featureGate/rules/chatRoomAdminOff.ts: `import type { FeatureGateRule } from "@/featureGate"; export const rule: FeatureGateRule = { pathPatterns: ["/admin/chat-rooms"], defaultEnabled: false };` (a fork rule overlapping an upstream path is reported only, the closed one wins), then `pnpm generate extensions`. boardgame-site does not use chat → close it all: `pnpm ops features set chatRoom off`. TriQ, next-vnx, 88-base: chat admin was open → nothing.
4. [判断] tags closed today (old enableUserTag false): TriQ → tags are always on now; the form field shows only when tags exist. To hide the admin pages too, add an own rule like step 3 with pathPatterns ["/admin/user-tags", "/api/userTag"] and defaultEnabled: false. Others had tags open → nothing.
5. Notification templates: all five had them open → nothing (a fork that wants them closed adds an own rule for /admin/notification-templates like step 3).
6. Fork code: `git grep -n '"userTag"\|adminChatRooms\|adminNotificationTemplates' -- src scripts e2e` → drop the gate checks for userTag, use "chatRoom" / "notification" for the other two.
7. `pnpm generate extensions`, `pnpm generate routes`, `pnpm typecheck`, `FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`.
verify: pnpm ops features list has no userTag / adminChatRooms / adminNotificationTemplates and chatRoom lists /admin/chat-rooms | oripa-do: /admin/chat-rooms is 404 and the user chat works | boardgame-site: chatRoom 閉
manual_steps: -
refs: src/featureGate/README.md (closing an upstream page), src/featureGate/rules/chatRoom.ts, src/featureGate/rules/notification.ts, council 20261023-175358-config-redesign decisions D64 D104 D115 D119 L1.43, legate:l1 order 45
notes: fork state at writing (old app-features): enableChatRoomAdmin false in oripa-do and boardgame-site; enableUserTag false in TriQ; enableNotificationTemplates true in all five. | Which rules Tier1 closes by default (chatRoom, notification among them) is a later notice (D115). | The notification rule will be reshaped when the contact council moves notifications into messaging.
