// src/features/core/user/services/server/helpers/nameAvailability.ts

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { normalizeUserNameForComparison } from "@/features/core/user/utils/userName";
import type { DbExecutor, DbTransaction } from "@/lib/crud/drizzle/types";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { RESERVED_USER_NAME_PROVIDERS } from "@/registry/reservedUserNamesRegistry";

export type UserNameAvailabilityParams = {
  /** 自分自身を重複判定から除外する (更新・復元時に指定) */
  excludeUserId?: string;
  executor?: DbExecutor;
};

/**
 * 予約名プロバイダ (reservedUserNamesRegistry) を順に照会し、予約済みの正規化名を返す。
 * 既に予約と判明した名前は後続プロバイダに渡さない。上流はレジストリ空 = 常に空集合。
 */
async function filterReservedUserNames(
  normalizedNames: string[],
  ctx: { executor?: DbExecutor },
): Promise<Set<string>> {
  const reserved = new Set<string>();
  let pending = normalizedNames;

  for (const provider of RESERVED_USER_NAME_PROVIDERS) {
    if (pending.length === 0) break;
    const hits = await provider.filterReserved(pending, ctx);
    for (const hit of hits) {
      reserved.add(hit);
    }
    pending = pending.filter((name) => !reserved.has(name));
  }

  return reserved;
}

/**
 * 複数の表示名が使用中かを一括判定し、使用中だった入力文字列の Set を返す。
 * - users スキャン: ソフトデリート済みとデモユーザーは名前を占有しない。
 *   候補は大文字小文字を無視して引き (users_name_norm_idx が両モードで効く)、
 *   厳密判定は normalizeUserNameForComparison による JS 側比較で行う
 * - users で空きだった名前は予約名プロバイダ (reservedUserNamesRegistry) にも照会する
 */
export async function isUserNamesTaken(
  names: string[],
  { excludeUserId, executor = db }: UserNameAvailabilityParams = {},
): Promise<Set<string>> {
  const taken = new Set<string>();

  const candidates = names
    .map((original) => ({
      original,
      folded: original.trim().toLowerCase(),
      normalized: normalizeUserNameForComparison(original),
    }))
    .filter((candidate) => candidate.folded !== "");

  if (candidates.length === 0) {
    return taken;
  }

  const rows = await executor
    .select({ name: UserTable.name })
    .from(UserTable)
    .where(
      and(
        isNull(UserTable.deletedAt),
        eq(UserTable.isDemo, false),
        inArray(
          sql`lower(btrim(${UserTable.name}))`,
          [...new Set(candidates.map((candidate) => candidate.folded))],
        ),
        ...(excludeUserId ? [ne(UserTable.id, excludeUserId)] : []),
      ),
    );

  const takenNorms = new Set(
    rows.map((row) => normalizeUserNameForComparison(row.name ?? "")),
  );

  for (const candidate of candidates) {
    if (takenNorms.has(candidate.normalized)) {
      taken.add(candidate.original);
    }
  }

  // users で空きだった名前だけ予約名プロバイダに照会
  const remaining = candidates.filter((candidate) => !taken.has(candidate.original));
  if (remaining.length > 0) {
    const reserved = await filterReservedUserNames(
      remaining.map((candidate) => candidate.normalized),
      { executor },
    );
    for (const candidate of remaining) {
      if (reserved.has(candidate.normalized)) {
        taken.add(candidate.original);
      }
    }
  }

  return taken;
}

/**
 * 表示名が使用中かを判定する (isUserNamesTaken の単発版。判定条件は同一)。
 */
export async function isUserNameTaken(
  name: string,
  params: UserNameAvailabilityParams = {},
): Promise<boolean> {
  return (await isUserNamesTaken([name], params)).has(name);
}

/**
 * 表示名が使用可能であることを検証する。使用中なら DomainError(409)。
 * unique.enabled が false、または name が空のときは何もしない。
 */
export async function assertUserNameAvailable(
  name: string | null | undefined,
  params: UserNameAvailabilityParams = {},
): Promise<void> {
  if (!USER_NAME_CONFIG.unique.enabled || !name || !name.trim()) {
    return;
  }

  if (await isUserNameTaken(name, params)) {
    throw new DomainError("この表示名は既に使用されています", { status: 409 });
  }
}

/**
 * 表示名の可用性チェックと書き込みを同一トランザクションで直列化して実行する。
 *
 * check→write 間に同名の同時書き込みが滑り込む TOCTOU レースを、正規化名をキーにした
 * pg_advisory_xact_lock で排除する (ロックはトランザクション終了時に自動解放)。
 * unique.enabled が false、または name が空 (name を変更しない書き込み) のときは
 * トランザクションを張らず write() をそのまま実行するため、既存挙動への影響はない。
 *
 * write に渡る tx は base.create / base.update / base.restore の第3引数にそのまま渡せる。
 */
export async function withUserNameGuard<T>(
  { name, excludeUserId }: { name: string | null | undefined; excludeUserId?: string },
  write: (tx?: DbTransaction) => Promise<T>,
): Promise<T> {
  if (!USER_NAME_CONFIG.unique.enabled || !name || !name.trim()) {
    return write();
  }

  return db.transaction(async (tx) => {
    const lockKey = normalizeUserNameForComparison(name);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

    if (await isUserNameTaken(name, { excludeUserId, executor: tx })) {
      throw new DomainError("この表示名は既に使用されています", { status: 409 });
    }

    return write(tx);
  });
}

/**
 * 衝突しない表示名をサフィックス付与 ("名前_2", "名前_3", …) で探す。
 * maxLength を超える場合はベース名を切り詰めて収める。
 * 復元 (restore) や既存重複の一括解消 (nameDedup) で使用する。
 * `reserved` には同一処理内で既に割り当て済みの正規化名を渡す (DB 未反映分との衝突回避)。
 */
export async function findAvailableSuffixedUserName(
  baseName: string,
  {
    executor = db,
    reserved,
  }: { executor?: DbExecutor; reserved?: Set<string> } = {},
): Promise<string> {
  const trimmed = baseName.trim();

  for (let n = 2; n < 1000; n++) {
    const suffix = `_${n}`;
    const budget = USER_NAME_CONFIG.maxLength - suffix.length;
    const candidate = `${[...trimmed].slice(0, Math.max(budget, 1)).join("")}${suffix}`;
    const normalized = normalizeUserNameForComparison(candidate);

    if (reserved?.has(normalized)) {
      continue;
    }

    if (!(await isUserNameTaken(candidate, { executor }))) {
      reserved?.add(normalized);
      return candidate;
    }
  }

  throw new DomainError("代替の表示名を割り当てられませんでした", { status: 500 });
}
