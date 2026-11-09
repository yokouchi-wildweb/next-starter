// src/features/core/storageObject/purposes/notification.ts
// notification のファイル用途（core の domain.json は pnpm generate domain の対象外なのでここに書く）。用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md

import "server-only";

import { storageObjectConfig } from "@/features/storageObject/config";
import type { StoragePurposeMap } from "@/lib/storage";

export const purposes = {
  "notification.image": {
    visibility: "public",
    maxBytes: storageObjectConfig.defaultMaxBytesByPreset.images,
    contentTypes: ["image/*"],
    upload: { allow: { roleCategories: ["admin"] } },
    metadata: "strip",
  },
} satisfies StoragePurposeMap;
