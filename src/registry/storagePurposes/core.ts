// src/registry/storagePurposes/core.ts
//
// core ドメインのファイル用途（手書き）。判定関数と features の import を、
// dc:generate が書き換える storagePurposeRegistry.ts の AUTO ブロックから切り離すためにここへ置く。
// core の domain.json（notification / coupon）は dc:generate の対象外なので、その用途もここに書く。
// 用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md
// metadata（画像のメタデータの扱い）は画像を受け付ける用途に明示する。user.avatar は keep にしても strip で扱われる
// （features/core/storageObject の purposeSource.ts）。

import "server-only";

import { STORAGE_CONFIG } from "@/config/app/storage.config";
import {
  FILE_MAX_SIZE,
  IMAGE_MAX_SIZE,
  VIDEO_MAX_SIZE,
} from "@/features/core/chatRoom/constants/chat";
import { isChatParticipant } from "@/features/core/chatRoom/services/server/isChatParticipant";
import { isOwnPendingPurchaseRequest } from "@/features/core/purchaseRequest/services/server/isOwnPendingPurchaseRequest";
import { getRoleCategory } from "@/features/core/user/constants";
import type { StorageActor, StoragePurpose, StoragePurposeMap } from "@/lib/storage";

const MiB = 1024 * 1024;

const ADMIN = { roleCategories: ["admin"] };

const isAdmin = (actor: StorageActor | null) => actor !== null && getRoleCategory(actor.role) === "admin";

/** チャットの「その他ファイル」は種別を絞らない（表示は配信規則で attachment になる） */
const ANY_FILE_TYPES = ["application/*", "text/*", "image/*", "video/*", "audio/*", "font/*", "model/*"];

/** チャット添付の共通規則: 現参加者だけが上げられ、読める。削除は管理者のみ。業務行には紐付けない */
const chatAttachment = {
  visibility: "private",
  upload: { allow: "authenticated", check: ({ actor, scopeId }) => isChatParticipant(scopeId, actor) },
  read: { allow: "authenticated", check: ({ actor, object }) => isChatParticipant(object.scopeId, actor) },
  delete: { allow: ADMIN },
  maxPending: 10,
  attach: false,
} satisfies Omit<StoragePurpose, "maxBytes" | "contentTypes">;

export const CORE_STORAGE_PURPOSES = {
  "user.avatar": {
    visibility: "public",
    maxBytes: 5 * MiB,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
    maxPending: 5,
    metadata: "strip",
  },
  "chatRoom.image": { ...chatAttachment, maxBytes: IMAGE_MAX_SIZE, contentTypes: ["image/*"], metadata: "strip" },
  "chatRoom.video": { ...chatAttachment, maxBytes: VIDEO_MAX_SIZE, contentTypes: ["video/*"] },
  // 「ファイルとして送る」は原本のまま渡す用途（.heic・.svg も送れる）
  "chatRoom.file": { ...chatAttachment, maxBytes: FILE_MAX_SIZE, contentTypes: ANY_FILE_TYPES, metadata: "keep" },
  "purchaseRequest.bankProof": {
    visibility: "private",
    maxBytes: 10 * MiB,
    contentTypes: ["image/*"],
    upload: {
      allow: "authenticated",
      check: ({ actor, scopeId }) => isOwnPendingPurchaseRequest(scopeId, actor),
    },
    read: {
      allow: "authenticated",
      check: ({ actor, object }) => object.ownerUserId === actor?.userId || isAdmin(actor),
    },
    maxPending: 3,
    // 振込明細は管理者が照合する非公開の原本として受け取ったまま保存する
    metadata: "keep",
  },
  "notification.image": {
    visibility: "public",
    maxBytes: STORAGE_CONFIG.defaultMaxBytesByPreset.images,
    contentTypes: ["image/*"],
    upload: { allow: ADMIN },
    metadata: "strip",
  },
  "coupon.image_url": {
    visibility: "public",
    maxBytes: STORAGE_CONFIG.defaultMaxBytesByPreset.images,
    contentTypes: ["image/*"],
    upload: { allow: ADMIN },
    metadata: "strip",
  },
  "demo.media": {
    visibility: "public",
    maxBytes: 200 * MiB,
    contentTypes: ["image/*", "video/*", "audio/*"],
    upload: { allow: ADMIN },
  },
} satisfies StoragePurposeMap;
