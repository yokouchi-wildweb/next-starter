// src/features/core/storageObject/services/server/policy.ts
//
// 用途の規則（allow AND check）の判定。ロールの規則は汎用 API と同じ evaluateApiAccessRule で評価する。
// 暗黙に通る道（admin・system の素通し）は無い。

import type { SessionUser } from "@/features/core/auth/entities/session";
import { evaluateApiAccessRule } from "@/features/core/auth/services/server/apiAccess";
import type {
  StorageActor,
  StorageObjectRule,
  StorageObjectView,
  StoragePurpose,
} from "@/lib/storage";

import type { StorageObject } from "../../entities/model";

/** granted = 許可 / unauthenticated = ログインが要る / denied = 拒否 */
export type StoragePolicyDecision = "granted" | "unauthenticated" | "denied";

/** SessionUser → 判定関数に渡す最小限の利用者 */
export function toStorageActor(user: SessionUser): StorageActor {
  return { userId: user.userId, role: user.role, status: user.status };
}

export function toStorageObjectView(row: StorageObject): StorageObjectView {
  return {
    id: row.id,
    purpose: row.purpose,
    status: row.status,
    ownerUserId: row.ownerUserId,
    scopeId: row.scopeId,
    recordType: row.recordType,
    recordId: row.recordId,
  };
}

/** アップロード権の発行条件（purpose.upload）を判定する */
export async function decideUpload(
  purpose: StoragePurpose,
  user: SessionUser,
  scopeId: string | null,
): Promise<StoragePolicyDecision> {
  const decision = evaluateApiAccessRule(purpose.upload.allow, user);
  if (decision === "unauthenticated") return "unauthenticated";
  if (decision !== "granted") return "denied";
  if (!purpose.upload.check) return "granted";
  return (await purpose.upload.check({ actor: toStorageActor(user), scopeId })) ? "granted" : "denied";
}

/** 既存ファイルへの操作（purpose.read / purpose.delete）を判定する。規則が無ければ拒否 */
export async function decideObject(
  rule: StorageObjectRule | undefined,
  user: SessionUser | null,
  row: StorageObject,
): Promise<StoragePolicyDecision> {
  if (!rule) return "denied";
  const decision = evaluateApiAccessRule(rule.allow, user);
  if (decision === "unauthenticated") return "unauthenticated";
  if (decision !== "granted") return "denied";
  if (!rule.check) return "granted";
  const allowed = await rule.check({
    actor: user ? toStorageActor(user) : null,
    object: toStorageObjectView(row),
  });
  return allowed ? "granted" : "denied";
}
