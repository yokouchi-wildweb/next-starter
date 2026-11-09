# DOWNSTREAM NOTICE id:20261109-135810-config-district-chat-attachment
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T13:58:10+09:00
severity: action-required
checkpoint: config-district-chat-attachment
moved: src/config/app/chat-attachment.config.ts -> src/config/features/chatRoom.config.ts
change: the chat attachment content types moved from src/config/app/chat-attachment.config.ts (deleted) to their owner src/features/core/chatRoom/config.ts (defaults, type ChatRoomOverride, composed chatRoomConfig) with the empty override src/config/features/chatRoom.config.ts. Old name -> new key: CHAT_ATTACHMENT_CONTENT_TYPES -> chatRoomConfig.attachmentContentTypes. Values unchanged.
why: a fork that changed the allowed content types in the old file loses them (the file is gone), and a fork file importing @/config/app/chat-attachment.config fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. If the merge keeps a fork version of src/config/app/chat-attachment.config.ts (modify/delete conflict), copy its values first (`git show HEAD:src/config/app/chat-attachment.config.ts`), then delete the file.
2. Write changed values into src/config/features/chatRoom.config.ts as literals: `export default { attachmentContentTypes: { file: ["application/pdf"] } } satisfies ChatRoomOverride;` (only the kinds the fork changed; each array replaces the default). [判断] oripa-do, 88-base, TriQ, boardgame-site, next-vnx: no change from upstream in the old file (read-only check against each merge-base) → nothing to write.
3. Rewrite fork imports: `git grep -nE "config/app/chat-attachment\.config|CHAT_ATTACHMENT_CONTENT_TYPES" -- src scripts` → read `chatRoomConfig` from `@/features/chatRoom/config` and use `.attachmentContentTypes` (no re-export of the old name).
verify: the git grep in step 3 finds nothing | pnpm check config-overrides passes | pnpm typecheck | pnpm lint | pnpm test src/features/core/chatRoom src/features/core/storageObject
manual_steps: -
refs: src/features/core/chatRoom/config.ts, src/config/features/chatRoom.config.ts, src/config/README.md, order 20261109-131131-config-district-chat-attachment (council 20261101-233830 D95)
notes: adminConsole.enableChatRoomAdmin (a switch) is not moved here.
