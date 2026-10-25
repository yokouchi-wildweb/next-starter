// src/lib/storage/server/purposes.ts
//
// 用途表（StoragePurposeMap）からの用途の引き当てと、用途表の形式検査。
// 未登録の用途は拒否する（fail-closed）。登録表 src/registry/storagePurposeRegistry.ts との結線は registry 側で行う。

import "server-only";

import { DomainError } from "@/lib/errors";

import { STRIP_IMAGE_TYPES } from "../metadata";
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
 * - metadata を指定するなら "strip" か "keep"。画像の型が contentTypes に無い用途には strip を書かない
 * - strip の用途（省略を含む）の contentTypes に、サーバーで描き直せない画像の型（image/heic など）を書かない
 * - user.avatar は keep にしない（D29: 常に strip。実行時も purposeSource が strip に固定する）
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
    problems.push(...listMetadataProblems(id, purpose));
  }
  return problems;
}

const STRIP_IMAGE_SET = new Set<string>(STRIP_IMAGE_TYPES);

/** keep にできない用途（D29。実行時の固定は features/core/storageObject の FIXED_STRIP_PURPOSES） */
const STRIP_ONLY_PURPOSE_IDS = ["user.avatar"];

function listMetadataProblems(id: string, purpose: StoragePurpose): string[] {
  const problems: string[] = [];
  const metadata: unknown = purpose.metadata;
  if (metadata !== undefined && metadata !== "strip" && metadata !== "keep") {
    problems.push(`${id}: metadata は "strip" か "keep" にしてください`);
    return problems;
  }
  const imageTypes = purpose.contentTypes.map((v) => v.trim().toLowerCase()).filter((v) => v.startsWith("image/"));
  if (metadata === "strip" && imageTypes.length === 0) {
    problems.push(`${id}: 画像の型が contentTypes に無い用途に metadata: "strip" は書けません`);
  }
  if ((metadata ?? "strip") === "strip") {
    const unprocessable = imageTypes.filter((v) => v !== "image/*" && !STRIP_IMAGE_SET.has(v));
    if (unprocessable.length > 0) {
      problems.push(
        `${id}: strip の用途（metadata 省略を含む）の contentTypes に、サーバーで描き直せない画像の型 ${unprocessable.join(", ")} があります（受けるなら metadata: "keep"）`,
      );
    }
  }
  if (metadata === "keep" && STRIP_ONLY_PURPOSE_IDS.includes(id)) {
    problems.push(`${id}: この用途は keep にできません（常に strip）`);
  }
  return problems;
}
