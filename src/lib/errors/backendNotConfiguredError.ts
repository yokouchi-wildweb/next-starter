// src/lib/errors/backendNotConfiguredError.ts

/** BackendNotConfiguredError の欄(各 *NotConfiguredError が super に渡す) */
export type BackendNotConfiguredErrorOptions = {
  /** 未設定の口の名前(例 "database" / "firebase" / "storage" / "mail") */
  port: string;
  /** 口の実装の名前(例 Storage の保存先 "pub"、メールの webhook の "resend")。決まっていなければ省く */
  implementation?: string;
  /** 足りない env の名前(名前だけ。値は入れない) */
  missing: readonly string[];
  /** 未設定に到達した側 */
  side: "client" | "server";
};

/**
 * 外部の口(DB・Firebase・Storage・メールの webhook など)の env が未設定のまま、それを要する処理に
 * 到達したときの誤りの共通の親。各口の誤り(DatabaseNotConfiguredError 等)がこれを継ぐ。
 *
 * - DomainError ではない(利用者に見せる業務の誤りではなく、環境の不足)
 * - 判定は「未設定」のみ。設定済みで到達できない障害には使わない(障害を未設定扱いで覆い隠さない)
 * - 依存を持たない(client でも server でも読める)
 */
export class BackendNotConfiguredError extends Error {
  readonly port: string;
  readonly implementation?: string;
  readonly missing: readonly string[];
  readonly side: "client" | "server";

  constructor(message: string, options: BackendNotConfiguredErrorOptions) {
    super(message);
    this.name = "BackendNotConfiguredError";
    this.port = options.port;
    this.implementation = options.implementation;
    this.missing = options.missing;
    this.side = options.side;
  }
}

/** エラーが BackendNotConfiguredError(どの口の未設定でも)かどうか */
export function isBackendNotConfiguredError(error: unknown): error is BackendNotConfiguredError {
  return error instanceof BackendNotConfiguredError;
}
