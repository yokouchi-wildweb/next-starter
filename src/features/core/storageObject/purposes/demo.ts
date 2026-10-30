// src/features/core/storageObject/purposes/demo.ts
// デモページのファイル用途（持ち主のドメインが無い、D61 U5 の除外）。用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

const MiB = 1024 * 1024;

export const purposes = {
  "demo.media": {
    visibility: "public",
    maxBytes: 200 * MiB,
    contentTypes: ["image/*", "video/*", "audio/*"],
    upload: { allow: { roleCategories: ["admin"] } },
  },
} satisfies StoragePurposeMap;
