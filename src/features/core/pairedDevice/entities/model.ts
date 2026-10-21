// src/features/core/pairedDevice/entities/model.ts

import type { DevicePairingFlow, DevicePairingStatus } from "@/features/core/pairedDevice/constants";

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
 * 認証済みの端末（リクエストの主体）。getSessionDevice / createDeviceRoute が返す。
 * scope は kind の scopeSchema で検証済み。
 */
export type SessionDevice<TKind extends string = string, TScope = unknown> = {
  deviceId: string;
  kind: TKind;
  label: string;
  scope: TScope;
};

/** device_pairings の 1 レコード。codeHash / pendingTokenHash は返却時は常に null */
export type DevicePairing = {
  id: string;
  flow: DevicePairingFlow;
  status: DevicePairingStatus;
  deviceId: string | null;
  codeHash: string | null;
  pendingTokenHash: string | null;
  expiresAt: Date;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  requestIp: string | null;
  requestUserAgent: string | null;
  createdAt: Date;
};

/** 読み取り時に導出する実効ステータス（expired は DB に書かない） */
export type EffectiveDevicePairingStatus = DevicePairingStatus | "expired";

/** 承認画面に見せる、端末側から始めたペアリングの情報 */
export type DevicePairingRequestForApprover = {
  id: string;
  status: EffectiveDevicePairingStatus;
  expiresAt: Date;
  requestIp: string | null;
  requestUserAgent: string | null;
  /**
   * 承認者と端末が同じ公開 IP から来ているか（参考情報。取れなければ null）。
   * 認可の条件にはしない。違う場合は「その場の端末に出ているコードか」を確かめてもらう
   */
  sameNetworkAsApprover: boolean | null;
  createdAt: Date;
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
/** 管理 API が返すペアリング（JSON） */
export type DevicePairingDto = Jsonified<DevicePairing>;
/** 承認画面用の情報（JSON） */
export type DevicePairingRequestForApproverDto = Jsonified<DevicePairingRequestForApprover>;
