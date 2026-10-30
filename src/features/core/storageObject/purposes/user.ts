// src/features/core/storageObject/purposes/user.ts
// user のファイル用途。用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

const MiB = 1024 * 1024;

export const purposes = {
  // keep にできない（purposeSource.ts の FIXED_STRIP_PURPOSES）
  "user.avatar": {
    visibility: "public",
    maxBytes: 5 * MiB,
    contentTypes: ["image/*"],
    upload: { allow: "authenticated" },
    maxPending: 5,
    metadata: "strip",
  },
} satisfies StoragePurposeMap;
