// src/features/core/storageObject/services/server/purposeSource.ts
//
// 用途表の取得口。storageObjectService はここからだけ用途表を得る（項目: ../../purposes/、業務ドメインは src/registry/storagePurposeRegistry.ts の AUTO の区画）。
// 登録表の値に関わらず metadata: "strip" で扱う用途は、ここで strip に固定する（FORK ブロックの上書きでも外れない）。

import type { StoragePurposeMap } from "@/lib/storage";
import { purposes as purposeItems } from "@/features/core/storageObject/extensions/purposes";
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

/** 用途表を合成する: 項目(core・fork)+ 業務ドメインの AUTO の区画。同じ用途 ID は例外(黙って上書きしない) */
export function mergeStoragePurposes(maps: readonly StoragePurposeMap[]): StoragePurposeMap {
  const merged: Record<string, StoragePurposeMap[string]> = {};
  for (const map of maps) {
    for (const [id, purpose] of Object.entries(map)) {
      if (id in merged) throw new Error(`ファイル用途 "${id}" が複数あります`);
      merged[id] = purpose;
    }
  }
  return merged;
}

/** 全用途(FIXED_STRIP の固定をかける前) */
export const allStoragePurposes = (): StoragePurposeMap => mergeStoragePurposes([...purposeItems, storagePurposeRegistry]);

let purposes: StoragePurposeMap | null = null;

export function getStoragePurposes(): StoragePurposeMap {
  purposes ??= withFixedStripPurposes(allStoragePurposes());
  return purposes;
}
