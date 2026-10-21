// src/features/core/pairedDevice/services/server/kinds.ts
//
// kind 定義（pairedDeviceKindRegistry）の解決、scope の検証、管理権限の判定。

import { and, eq, or, sql, type SQL } from "drizzle-orm";

import type { SessionUser } from "@/features/core/auth/entities/session";
import {
  PAIRED_DEVICE_SCOPE_MAX_BYTES,
  type DevicePairingFlow,
  type PairedDeviceErrorReason,
} from "@/features/core/pairedDevice/constants";
import { PairedDeviceTable } from "@/features/core/pairedDevice/entities/drizzle";
import type {
  PairedDeviceKindDefinition,
  PairedDeviceManageableScopes,
} from "@/features/core/pairedDevice/types/kind";
import { isValidScopePattern, scopeContains } from "@/features/core/pairedDevice/utils/scopeContains";
import { getRoleCategory } from "@/features/core/user/constants";
import { DomainError } from "@/lib/errors";
import { pairedDeviceKindRegistry } from "@/registry/pairedDeviceKindRegistry";
import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";

/**
 * 理由（reason）付きの DomainError。API はこれを { message, reason } で返す。
 */
export class PairedDeviceError extends DomainError {
  readonly reason: PairedDeviceErrorReason;

  constructor(reason: PairedDeviceErrorReason, message: string, status: number) {
    super(message, { status });
    this.name = "PairedDeviceError";
    this.reason = reason;
  }
}

export function isPairedDeviceError(error: unknown): error is PairedDeviceError {
  return error instanceof PairedDeviceError;
}

/** 機能が無効なら 404 を投げる（feature-gate の外から呼ばれた場合の保険） */
export function assertPairedDeviceEnabled(): void {
  if (!PAIRED_DEVICE_CONFIG.enabled) {
    throw new PairedDeviceError("disabled", "この機能は無効です", 404);
  }
}

const registry = pairedDeviceKindRegistry as Record<string, PairedDeviceKindDefinition | undefined>;

/** 登録済みの kind 定義。未登録は null */
export function getPairedDeviceKind(kind: string): PairedDeviceKindDefinition | null {
  return Object.prototype.hasOwnProperty.call(registry, kind) ? (registry[kind] ?? null) : null;
}

/** 既定で許可するペアリング方式 */
const DEFAULT_PAIRING_FLOWS: readonly DevicePairingFlow[] = ["admin_issued"];

/** kind が許可するペアリング方式（未登録の kind は空） */
export function getAllowedPairingFlows(kind: string): readonly DevicePairingFlow[] {
  const definition = getPairedDeviceKind(kind);
  if (!definition) return [];
  return definition.pairingFlows ?? DEFAULT_PAIRING_FLOWS;
}

/** kind がそのペアリング方式を許可していなければ flow_not_allowed（403）を投げる */
export function assertPairingFlowAllowed(kind: string, flow: DevicePairingFlow): void {
  if (!getAllowedPairingFlows(kind).includes(flow)) {
    throw new PairedDeviceError(
      "flow_not_allowed",
      "この種類の端末では、このペアリング方式は使えません",
      403,
    );
  }
}

/**
 * kind の verify フックを実行する。未定義なら true。false・例外は false（fail-closed）。
 * 認証のたびのほか、ペアリング完了（トークン発行）の直前にも呼ぶ
 */
export async function runDeviceVerify(
  definition: PairedDeviceKindDefinition,
  ctx: { deviceId: string; kind: string; scope: unknown; ip: string | null; userAgent: string | null },
): Promise<boolean> {
  if (!definition.verify) return true;
  try {
    return (await definition.verify(ctx)) === true;
  } catch (error) {
    console.warn("[pairedDevice] verify hook threw:", error);
    return false;
  }
}

/** 登録済みの kind 名の一覧 */
export function listPairedDeviceKinds(): string[] {
  return Object.keys(registry);
}

/**
 * scope を kind の scopeSchema で検証し、検証後の値を返す。
 * kind 未登録・形の不一致・サイズ超過は invalid_scope（400）。
 */
export function parseDeviceScope(kind: string, scope: unknown): unknown {
  const definition = getPairedDeviceKind(kind);
  if (!definition) {
    throw new PairedDeviceError("invalid_scope", `未登録の端末の種類です: ${kind}`, 400);
  }
  const result = definition.scopeSchema.safeParse(scope ?? {});
  if (!result.success) {
    throw new PairedDeviceError("invalid_scope", "端末の scope が不正です", 400);
  }
  const serialized = JSON.stringify(result.data ?? {});
  if (serialized.length > PAIRED_DEVICE_SCOPE_MAX_BYTES) {
    throw new PairedDeviceError("invalid_scope", "端末の scope が大きすぎます", 400);
  }
  // scope は JSONB に保存し、認証のたびに保存した値を scopeSchema で検証し直す。
  // transform で Date を作る等、JSON に往復すると通らなくなる scopeSchema だと、
  // 登録はできても端末が一度も認証できない。登録の時点で往復後の値を検証して止める
  const stored: unknown = JSON.parse(serialized);
  if (!definition.scopeSchema.safeParse(stored).success) {
    throw new PairedDeviceError(
      "invalid_scope",
      "端末の scope が保存後に scopeSchema に合いません（JSON に往復できる形にしてください）",
      400,
    );
  }
  return stored;
}

/** 認証時用。kind 未登録・形の不一致なら null（例外を投げない） */
export function safeParseDeviceScope(
  kind: string,
  scope: unknown,
): { definition: PairedDeviceKindDefinition; scope: unknown } | null {
  const definition = getPairedDeviceKind(kind);
  if (!definition) return null;
  const result = definition.scopeSchema.safeParse(scope ?? {});
  return result.success ? { definition, scope: result.data } : null;
}

const isAdminCategory = (user: SessionUser): boolean => getRoleCategory(user.role) === "admin";

/** このユーザーが管理できる、kind の端末の範囲 */
export async function resolveManageableScopes(
  user: SessionUser,
  kind: string,
): Promise<PairedDeviceManageableScopes> {
  // admin は kind が registry から外れた端末（残骸）も一覧・失効できるよう、定義より先に判定する
  if (isAdminCategory(user)) return "all";
  const definition = getPairedDeviceKind(kind);
  if (!definition?.manageableScopes) return [];
  return sanitizeManageableScopes(kind, await definition.manageableScopes(user));
}

/**
 * manageableScopes の戻り値を検証する。一覧の SQL（@>）と 1 件ごとの判定（scopeContains）は
 * 必ずこの検証済みの値を使う（両者の判定がずれると、一覧にだけ他の範囲の端末が出る）。
 * 不正なパターンは捨てて警告する（fail-closed: 捨てた分は管理できない側に倒れる）。
 */
function sanitizeManageableScopes(kind: string, raw: unknown): PairedDeviceManageableScopes {
  if (raw === "all") return "all";
  if (!Array.isArray(raw)) {
    console.warn(`[pairedDevice] manageableScopes of "${kind}" must return "all" or an array`);
    return [];
  }
  const valid = raw.filter(isValidScopePattern);
  if (valid.length !== raw.length) {
    console.warn(
      `[pairedDevice] manageableScopes of "${kind}" returned invalid patterns (empty object, undefined or non-JSON values); they were ignored`,
    );
  }
  return valid;
}

/** このユーザーが kind / scope の端末を管理できるか */
export async function canManagePairedDevice(
  user: SessionUser,
  kind: string,
  scope: unknown,
): Promise<boolean> {
  const scopes = await resolveManageableScopes(user, kind);
  if (scopes === "all") return true;
  return scopes.some((pattern) => scopeContains(scope, pattern));
}

/** 管理できなければ forbidden（403）を投げる */
export async function assertCanManagePairedDevice(
  user: SessionUser,
  kind: string,
  scope: unknown,
): Promise<void> {
  if (!(await canManagePairedDevice(user, kind, scope))) {
    throw new PairedDeviceError("forbidden", "この端末を管理する権限がありません", 403);
  }
}

/**
 * このユーザーが管理できる端末だけに絞る WHERE 句。
 * kind を指定しないときは登録済みのすべての kind を対象にする。管理できる端末が無ければ常に偽。
 */
export async function buildManageableDevicesWhere(
  user: SessionUser,
  kind?: string,
): Promise<SQL> {
  // admin は全件（kind が registry から外れた端末を含む）
  if (isAdminCategory(user)) {
    return kind ? eq(PairedDeviceTable.kind, kind) : sql`true`;
  }
  const kinds = kind ? [kind] : listPairedDeviceKinds();
  const clauses: SQL[] = [];
  for (const k of kinds) {
    const scopes = await resolveManageableScopes(user, k);
    if (scopes === "all") {
      clauses.push(eq(PairedDeviceTable.kind, k));
      continue;
    }
    for (const pattern of scopes) {
      clauses.push(
        and(
          eq(PairedDeviceTable.kind, k),
          sql`${PairedDeviceTable.scope} @> ${JSON.stringify(pattern)}::jsonb`,
        ) as SQL,
      );
    }
  }
  if (clauses.length === 0) return sql`false`;
  return (clauses.length === 1 ? clauses[0] : or(...clauses)) as SQL;
}
