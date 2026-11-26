// src/domains/core/pairedDevice/entities/pairedDevice/model.ts

/**
 * paired_devices の 1 レコード（サービス内部・管理者向け）。
 * tokenHash は hiddenColumns によりサービス返却時は常に null。
 */
export type PairedDevice = {
  id: string;
  label: string;
  kind: string;
  scope: unknown;
  tokenHash: string | null;
  tokenExpiresAt: Date | null;
  pairedAt: Date | null;
  pairedUserAgent: string | null;
  lastSeenAt: Date | null;
  lastSeenIp: string | null;
  createdBy: string | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
/**
 * 管理者に返す端末の状態。
 * - unpaired: 登録済みだがトークン未発行（または失効後に再ペアリング待ち）
 * - active: トークンが有効
 * - expired: トークンの有効期限切れ、または長期間アクセスがなく無効
 * - revoked: 失効済み
 */
export type PairedDeviceState = "unpaired" | "active" | "expired" | "revoked";
/** 管理 API が返す端末（トークン関連の内部値を含まない） */
export type PairedDeviceForAdmin = {
  id: string;
  label: string;
  kind: string;
  scope: unknown;
  state: PairedDeviceState;
  /** 最終アクセスが onlineThresholdSeconds 以内 */
  online: boolean;
  tokenExpiresAt: Date | null;
  pairedAt: Date | null;
  pairedUserAgent: string | null;
  lastSeenAt: Date | null;
  lastSeenIp: string | null;
  createdBy: string | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
/**
 * JSON で受け取った形（Date は ISO 文字列になる）。ClientService / hooks が返すのはこの形。
 * サーバー側の型（Date）をそのままクライアントで使うと、文字列を Date として扱ってしまう
 */
export type Jsonified<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};
/** 管理 API が返す端末（JSON） */
export type PairedDeviceForAdminDto = Jsonified<PairedDeviceForAdmin>;
