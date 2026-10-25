// src/registry/storagePurposeRegistry.ts
//
// ファイル用途の登録表（唯一の入口）。未登録の用途はアップロード・読み取りとも拒否される（fail-closed）。
// - CORE: src/registry/storagePurposes/core.ts（手書き）
// - AUTO: dc:generate が domain.json のメディア項目から書き込む（このブロックは手で編集しない）
// - FORK: fork が手書きで足す（dc:generate は触らない。AUTO と同じ ID を書くと生成器は上書きせず警告する）
// 型と規則: src/lib/storage/README.md / 生成の導出: src/features/README.md「ファイルの保存（storage）」

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

import { CORE_STORAGE_PURPOSES } from "./storagePurposes/core";

export const storagePurposeRegistry = {
  ...CORE_STORAGE_PURPOSES,
  // --- AUTO-GENERATED-START ---
  "sample.main_image": { visibility: "public", maxBytes: 104857600, contentTypes: ["image/*", "video/*"], metadata: "strip", upload: { allow: "authenticated" } },
  "sample.sub_image": { visibility: "public", maxBytes: 104857600, contentTypes: ["image/*", "video/*"], metadata: "strip", upload: { allow: "authenticated" } },
  "sample.gallery_images": { visibility: "public", maxBytes: 10485760, contentTypes: ["image/*", "video/*"], metadata: "strip", upload: { allow: "authenticated" } },
  // --- AUTO-GENERATED-END ---
  // --- FORK (手書き) ---
} satisfies StoragePurposeMap;
