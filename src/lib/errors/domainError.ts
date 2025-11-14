// src/lib/errors/domainError.ts

/**
 * ドメインサービスでクライアントに通知したいエラーを表す共通例外。
 * ステータスコードを持たせることで API レイヤーで適切なレスポンスに変換できます。
 */
export class DomainError extends Error {
  /**
   * 推奨する HTTP ステータスコード。
   */
  readonly status: number;

  constructor(message: string, options: { status?: number } = {}) {
    super(message);
    this.name = "DomainError";
    this.status = options.status ?? 400;
  }
}

/**
 * エラーが DomainError かどうかを判定するユーティリティ。
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
