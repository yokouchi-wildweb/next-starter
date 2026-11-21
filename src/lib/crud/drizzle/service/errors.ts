// src/lib/crud/drizzle/service/errors.ts
// PostgreSQL の制約違反を DomainError に変える処理と、書き込みを包む CRUD のミドルウェア

import { DomainError } from "@/lib/errors";

/**
 * エラーオブジェクトからPostgreSQLエラーコードを抽出する
 * Drizzleはエラーをラップするため、直接またはcause経由で確認
 */
export const extractPgErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;

  // 直接codeを持つ場合
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  // cause経由でcodeを持つ場合（Drizzleのラップ）
  if ("cause" in error && error.cause && typeof error.cause === "object") {
    const cause = error.cause as Record<string, unknown>;
    if ("code" in cause && typeof cause.code === "string") {
      return cause.code;
    }
  }

  return undefined;
};

/**
 * ユニーク制約違反かどうかを判定する
 */
export const isPgUniqueViolation = (error: unknown): boolean => {
  return extractPgErrorCode(error) === "23505";
};

/**
 * CRUD操作タイプ
 */
type CrudOperationType = "write" | "delete";

/**
 * 制約違反エラーを検出してDomainErrorに変換する
 * PostgreSQL エラーコード:
 * - 23503 = foreign_key_violation（RESTRICT違反）
 * - 23502 = not_null_violation（SET_NULL + NOT NULL制約違反）
 * - 23505 = unique_violation（ユニーク制約違反）
 *
 * @param error - キャッチしたエラー
 * @param operationType - 操作タイプ（write: INSERT/UPDATE, delete: DELETE）
 */
export const handleConstraintError = (
  error: unknown,
  operationType: CrudOperationType = "delete"
): never => {
  const pgCode = extractPgErrorCode(error);
  if (pgCode === "23503") {
    // 外部キー制約違反は操作タイプによってメッセージを分ける
    if (operationType === "write") {
      throw new DomainError(
        "参照先のレコードが存在しません",
        { status: 409 }
      );
    } else {
      throw new DomainError(
        "このレコードは他のデータから参照されているため削除できません",
        { status: 409 }
      );
    }
  }
  if (pgCode === "23502") {
    throw new DomainError(
      "削除するには関連レコードで空の値を許容する必要があります",
      { status: 409 }
    );
  }
  if (pgCode === "23505") {
    throw new DomainError("この値は既に使用されています", { status: 409 });
  }
  throw error;
};

/**
 * CRUDミドルウェアの型定義
 * 各ミドルウェアは関数をラップして共通処理を追加する
 */
type CrudMiddleware = <T>(fn: () => Promise<T>, operationType: CrudOperationType) => Promise<T>;

/**
 * 制約エラーハンドリングミドルウェア
 * PostgreSQLの制約違反エラーをDomainErrorに変換する
 */
const withConstraintHandling: CrudMiddleware = async <T>(
  fn: () => Promise<T>,
  operationType: CrudOperationType
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    // handleConstraintErrorは常にthrowするため、ここには到達しない
    throw handleConstraintError(error, operationType);
  }
};

/**
 * CRUDミドルウェア配列
 * 新しいミドルウェアはここに追加する
 */
const crudMiddlewares: CrudMiddleware[] = [
  withConstraintHandling,
  // 将来追加: withLogging, withRetry, etc.
];

/**
 * 全CRUDミドルウェアを適用するラッパー
 * create/update/upsert等の書き込み操作で使用する
 */
export const withCrudEnhancements = <T>(fn: () => Promise<T>): Promise<T> => {
  return crudMiddlewares.reduce<() => Promise<T>>(
    (wrapped, middleware) => () => middleware(wrapped, "write"),
    fn
  )();
};
