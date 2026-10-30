// src/registry/storagePurposeRegistry.ts
//
// 業務ドメインのファイル用途(dc:generate が domain.json のメディア項目から AUTO の区画に書く。手で編集しない)。
// 一時の置き場: dc:generate の書き込みを外す出荷で消える。core と fork の用途は features/core/storageObject/purposes/、
// 合成は storageObject/services/server/purposeSource.ts。型と規則: src/lib/storage/README.md

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

export const storagePurposeRegistry = {
  // --- AUTO-GENERATED-START ---
  "sample.main_image": { visibility: "public", maxBytes: 104857600, contentTypes: ["image/*", "video/*"], metadata: "strip", upload: { allow: "authenticated" } },
  "sample.sub_image": { visibility: "public", maxBytes: 104857600, contentTypes: ["image/*", "video/*"], metadata: "strip", upload: { allow: "authenticated" } },
  "sampleImage.file": { visibility: "public", maxBytes: 10485760, contentTypes: ["image/*"], metadata: "strip", upload: { allow: "authenticated" } },
  // --- AUTO-GENERATED-END ---
} satisfies StoragePurposeMap;
