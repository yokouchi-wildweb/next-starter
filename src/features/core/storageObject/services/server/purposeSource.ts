// src/features/core/storageObject/services/server/purposeSource.ts
//
// 用途表の取得口。storageObjectService とルートはここからだけ用途表を得る。
// 用途の登録表（src/registry/storagePurposeRegistry.ts）ができるまでは空で、すべての用途が未登録（400）になる。

import type { StoragePurposeMap } from "@/lib/storage";

const EMPTY_PURPOSES: StoragePurposeMap = Object.freeze({});

export function getStoragePurposes(): StoragePurposeMap {
  return EMPTY_PURPOSES;
}
