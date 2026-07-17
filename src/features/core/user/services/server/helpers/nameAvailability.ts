// src/features/core/user/services/server/helpers/nameAvailability.ts

import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { normalizeUserNameForComparison } from "@/features/core/user/utils/userName";
import type { DbExecutor, DbTransaction } from "@/lib/crud/drizzle/types";
import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";

export type UserNameAvailabilityParams = {
  /** 自分自身を重複判定から除外する (更新・復元時に指定) */
  excludeUserId?: string;
  executor?: DbExecutor;
};

/**
 * 表示名が使用中かを判定する (USER_NAME_CONFIG.unique の設定に従う)。
 * - ソフトデリート済みユーザーとデモユーザーは名前を占有しない
 * - 候補は大文字小文字を無視して引き、caseInsensitive: false のときは JS 側で厳密比較に絞り込む
 *   (どちらのモードでも users_name_norm_idx の同一 expression index が効くようにするため)
 */
export async function isUserNameTaken(
  name: string,
  { excludeUserId, executor = db }: UserNameAvailabilityParams = {},
): Promise<boolean> {
  const folded = name.trim().toLowerCase();

  if (!folded) {
    return false;
  }

  const rows = await executor
    .select({ id: UserTable.id, name: UserTable.name })
    .from(UserTable)
    .where(
      and(
        isNull(UserTable.deletedAt),
        eq(UserTable.isDemo, false),
        sql`lower(btrim(${UserTable.name})) = ${folded}`,
        ...(excludeUserId ? [ne(UserTable.id, excludeUserId)] : []),
      ),
    )
    .limit(50);

  if (USER_NAME_CONFIG.unique.caseInsensitive) {
    return rows.length > 0;
  }

  const exact = name.trim();
  return rows.some((row) => (row.name ?? "").trim() === exact);
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
