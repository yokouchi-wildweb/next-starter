// src/domains/core/pairedDevice/entities/devicePairing/model.ts

import type { Jsonified } from "../pairedDevice/model";
import type { DevicePairingFlow, DevicePairingStatus } from "@/domains/pairedDevice/constants";

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
/** 管理 API が返すペアリング（JSON） */
export type DevicePairingDto = Jsonified<DevicePairing>;
/** 承認画面用の情報（JSON） */
export type DevicePairingRequestForApproverDto = Jsonified<DevicePairingRequestForApprover>;
