// src/features/core/storageObject/purposes/chatRoom.ts
// chatRoom のファイル用途。用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md

import "server-only";

import {
  FILE_MAX_SIZE,
  IMAGE_MAX_SIZE,
  VIDEO_MAX_SIZE,
} from "@/features/core/chatRoom/constants/chat";
import { isChatParticipant } from "@/features/core/chatRoom/services/server/isChatParticipant";
import type { StoragePurpose, StoragePurposeMap } from "@/lib/storage";

const ADMIN = { roleCategories: ["admin"] };

/** チャットの「その他ファイル」は種別を絞らない（表示は配信規則で attachment になる） */
const ANY_FILE_TYPES = ["application/*", "text/*", "image/*", "video/*", "audio/*", "font/*", "model/*"];

/** チャット添付の共通規則: 現参加者だけが上げられ、読める。削除は管理者のみ。業務行に紐付けない */
const chatAttachment = {
  visibility: "private",
  upload: { allow: "authenticated", check: ({ actor, scopeId }) => isChatParticipant(scopeId, actor) },
  read: { allow: "authenticated", check: ({ actor, object }) => isChatParticipant(object.scopeId, actor) },
  delete: { allow: ADMIN },
  maxPending: 10,
  attach: false,
} satisfies Omit<StoragePurpose, "maxBytes" | "contentTypes">;

export const purposes = {
  "chatRoom.image": { ...chatAttachment, maxBytes: IMAGE_MAX_SIZE, contentTypes: ["image/*"], metadata: "strip" },
  "chatRoom.video": { ...chatAttachment, maxBytes: VIDEO_MAX_SIZE, contentTypes: ["video/*"] },
  // 「ファイルとして送る」は原本のまま渡す用途（.heic・.svg も送れる）
  "chatRoom.file": { ...chatAttachment, maxBytes: FILE_MAX_SIZE, contentTypes: ANY_FILE_TYPES, metadata: "keep" },
} satisfies StoragePurposeMap;
