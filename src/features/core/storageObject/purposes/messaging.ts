// src/features/core/storageObject/purposes/messaging.ts
// messaging のファイル用途（お知らせの画像。core の domain.json は pnpm generate domain の対象外なのでここに書く）。
// 用途 ID "notification.image" は前のお知らせ(notification のドメイン、S2 で消した)の名前のまま。改名できない（ref とオブジェクトのパスに入るため。
// 前のお知らせの画像の ref もこの ID を持つ）。型と規則: src/lib/storage/README.md

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
