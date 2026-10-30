// src/features/sampleImage/services/server/storagePurposes.ts
// dc:generate が domain.json のメディア項目から生成する。手で直さない（手で持つなら domain.json の generate を false）。
// 型と規則: src/lib/storage/README.md

import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

export const purposes = {
  "sampleImage.file": { visibility: "public", maxBytes: 10485760, contentTypes: ["image/*"], metadata: "strip", upload: { allow: "authenticated" } },
} satisfies StoragePurposeMap;
