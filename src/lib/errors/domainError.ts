// src/lib/errors/domainError.ts

/** DomainError の生成オプション */
export type DomainErrorOptions = {
  /** 推奨する HTTP ステータスコード（既定 400） */
  status?: number;
  /**
   * 機械可読なエラー分類（例: "coupon_expired"）。指定するとルートの応答 body に `code` として載る。
   * クライアントは message の文言ではなくこの値で分岐する
   */
  code?: string;
  /** 分類に付く補足情報（JSON にできる値）。指定するとルートの応答 body に `details` として載る */
  details?: unknown;
};

/**
 * ドメインサービスでクライアントに通知したいエラーを表す共通例外。
 * ステータスコードを持たせることで API レイヤーで適切なレスポンスに変換できます。
 */
export class DomainError extends Error {
  /**
   * 推奨する HTTP ステータスコード。
   */
  readonly status: number;
  /** 機械可読なエラー分類（未指定なら undefined） */
  readonly code?: string;
  /** 分類に付く補足情報（未指定なら undefined） */
  readonly details?: unknown;

  constructor(message: string, options: DomainErrorOptions = {}) {
    super(message);
    this.name = "DomainError";
    this.status = options.status ?? 400;
    this.code = options.code;
    this.details = options.details;
  }
}

/**
 * エラーが DomainError かどうかを判定するユーティリティ。
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * DomainError を API 応答の body にする（message に加え、指定があれば code / details）。
 * ルートの Factory が共通で使う（応答の形を 1 か所に揃える）。
 */
export function toDomainErrorBody(error: DomainError): {
  message: string;
  code?: string;
  details?: unknown;
} {
  return {
    message: error.message,
    ...(error.code !== undefined ? { code: error.code } : {}),
    ...(error.details !== undefined ? { details: error.details } : {}),
  };
}
