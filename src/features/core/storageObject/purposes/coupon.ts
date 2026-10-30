// src/features/core/storageObject/purposes/coupon.ts
// coupon のファイル用途（core の domain.json は dc:generate の対象外なのでここに書く）。用途 ID は改名できない（ref とオブジェクトのパスに入るため）。型と規則: src/lib/storage/README.md

import "server-only";

import { STORAGE_CONFIG } from "@/config/app/storage.config";
import type { StoragePurposeMap } from "@/lib/storage";

export const purposes = {
  "coupon.image_url": {
    visibility: "public",
    maxBytes: STORAGE_CONFIG.defaultMaxBytesByPreset.images,
    contentTypes: ["image/*"],
    upload: { allow: { roleCategories: ["admin"] } },
    metadata: "strip",
  },
} satisfies StoragePurposeMap;
