// src/domains/core/messaging/plugs/userOverlays/inboxUnread.tsx
// 点 userOverlays(利用者の枠に重ねる部品、宣言 src/app/(user)/_layout/extensionPoints.ts)の項目: 受け取り箱の未読の案内。
// messaging が閉じれば門番が外す(枠は名前ごと一覧から消えた前提で描く、D25)


import { InboxUnreadModal } from "../../components/InboxUnreadModal";
import type { FramePart } from "@/app/_layout/points";

export const part: FramePart = InboxUnreadModal;
