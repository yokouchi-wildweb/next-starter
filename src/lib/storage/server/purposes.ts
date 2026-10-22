// src/lib/storage/server/purposes.ts
//
// 用途表（StoragePurposeMap）からの用途の引き当てと、用途表の形式検査。
// 未登録の用途は拒否する（fail-closed）。登録表 src/registry/storagePurposeRegistry.ts との結線は registry 側で行う。

import "server-only";

import { DomainError } from "@/lib/errors";

import { isValidStoragePurposeId } from "../ref";
import type { StoragePurpose, StoragePurposeMap } from "../policy/types";

export class StoragePurposeNotFoundError extends DomainError {
  readonly purposeId: string;

  constructor(purposeId: string) {
    super(`登録されていないアップロード用途です: ${purposeId}`, { status: 400 });
    this.name = "StoragePurposeNotFoundError";
    this.purposeId = purposeId;
  }
}

/** 用途を引く。未登録・ID の形式違いは null */
export function findStoragePurpose(map: StoragePurposeMap, purposeId: string): StoragePurpose | null {
  if (!isValidStoragePurposeId(purposeId)) return null;
  if (!Object.prototype.hasOwnProperty.call(map, purposeId)) return null;
  return map[purposeId] ?? null;
}

/** 用途を引く。未登録なら StoragePurposeNotFoundError（400） */
export function resolveStoragePurpose(map: StoragePurposeMap, purposeId: string): StoragePurpose {
  const purpose = findStoragePurpose(map, purposeId);
  if (!purpose) throw new StoragePurposeNotFoundError(purposeId);
  return purpose;
}

/**
 * 用途表の形式の問題を列挙する（空配列 = 問題なし）。test:storage-purposes などの検査から使う。
 * - ID が `<domain>.<field>` の形式
 * - maxBytes が 1 以上の整数、contentTypes が 1 件以上
 * - private の用途に read がある
 * - maxPending を指定するなら 1 以上の整数
 */
export function listStoragePurposeProblems(map: StoragePurposeMap): string[] {
  const problems: string[] = [];
  for (const [id, purpose] of Object.entries(map)) {
    if (!isValidStoragePurposeId(id)) problems.push(`${id}: 用途 ID の形式が不正です`);
    if (!Number.isInteger(purpose.maxBytes) || purpose.maxBytes < 1) {
      problems.push(`${id}: maxBytes は 1 以上の整数にしてください`);
    }
    if (purpose.contentTypes.length === 0) problems.push(`${id}: contentTypes が空です`);
    if (purpose.visibility === "private" && !purpose.read) {
      problems.push(`${id}: private の用途には read が必要です`);
    }
    if (
      purpose.maxPending !== undefined &&
      (!Number.isInteger(purpose.maxPending) || purpose.maxPending < 1)
    ) {
      problems.push(`${id}: maxPending は 1 以上の整数にしてください`);
    }
  }
  return problems;
}
