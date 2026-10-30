// src/features/core/storageObject/purposes/purchaseRequest.ts
// purchaseRequest のファイル用途。用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md

import "server-only";

import { isOwnPendingPurchaseRequest } from "@/features/core/purchaseRequest/services/server/isOwnPendingPurchaseRequest";
import { getRoleCategory } from "@/features/core/user/constants";
import type { StorageActor, StoragePurposeMap } from "@/lib/storage";

const MiB = 1024 * 1024;

const isAdmin = (actor: StorageActor | null) => actor !== null && getRoleCategory(actor.role) === "admin";

export const purposes = {
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
} satisfies StoragePurposeMap;
