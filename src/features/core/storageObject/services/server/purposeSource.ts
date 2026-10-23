// src/features/core/storageObject/services/server/purposeSource.ts
//
// 用途表の取得口。storageObjectService はここからだけ用途表を得る（登録表: src/registry/storagePurposeRegistry.ts）。

import type { StoragePurposeMap } from "@/lib/storage";
import { storagePurposeRegistry } from "@/registry/storagePurposeRegistry";

export function getStoragePurposes(): StoragePurposeMap {
  return storagePurposeRegistry;
}
