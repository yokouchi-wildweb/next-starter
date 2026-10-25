// src/features/core/storageObject/services/server/purposeSource.ts
//
// 用途表の取得口。storageObjectService はここからだけ用途表を得る（登録表: src/registry/storagePurposeRegistry.ts）。
// 登録表の値に関わらず metadata: "strip" で扱う用途は、ここで strip に固定する（FORK ブロックの上書きでも外れない）。

import type { StoragePurposeMap } from "@/lib/storage";
import { storagePurposeRegistry } from "@/registry/storagePurposeRegistry";

/** 常に strip で扱う用途（アバターは公開され、位置情報を残す理由が無い。keep への上書きは upstream・fork とも不可） */
export const FIXED_STRIP_PURPOSES: readonly string[] = ["user.avatar"];

/** FIXED_STRIP_PURPOSES の用途を metadata: "strip" にした用途表を返す（元の表は変えない） */
export function withFixedStripPurposes(map: StoragePurposeMap): StoragePurposeMap {
  const fixed: Record<string, StoragePurposeMap[string]> = { ...map };
  for (const id of FIXED_STRIP_PURPOSES) {
    const purpose = fixed[id];
    if (purpose && purpose.metadata !== "strip") fixed[id] = { ...purpose, metadata: "strip" };
  }
  return fixed;
}

let purposes: StoragePurposeMap | null = null;

export function getStoragePurposes(): StoragePurposeMap {
  purposes ??= withFixedStripPurposes(storagePurposeRegistry);
  return purposes;
}
