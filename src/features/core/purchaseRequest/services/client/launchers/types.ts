// src/features/core/purchaseRequest/services/client/launchers/types.ts
//
// クライアント側の決済起動レイヤ用の型定義。
// PaymentProvider.createSession が返す LaunchInstruction を、クライアント側で
// 「実際にブラウザ上で何が起こるか」に変換する責務を担う。

import type { LaunchInstruction } from "@/features/core/purchaseRequest/types/payment";

/**
 * 起動の文脈情報。
 *
 * provider の種類によらず、起動側 Hook がサーバーから受け取って渡す共通情報。
 * - purchaseRequestId: client_sdk 完了時に確定 API を叩く際に必要
 * - successUrl / cancelUrl: 起動完了 / 失敗時に Hub が遷移させる先
 */
export type LaunchContext = {
  purchaseRequestId: string;
  successUrl: string;
  cancelUrl: string;
};

/**
 * 起動の結果。
 *
 * - "redirected": ブラウザが外部 URL や内部ページに遷移済み。呼び元はもうこのページに居ない。
 * - "completed":  決済完了（SDK 型のみ）。確定 API も成功している。successUrl への遷移は handler が実施済。
 * - "rejected":   決済拒否（カード否決等）。cancelUrl への遷移は handler が実施済。
 * - "closed":     ユーザーがモーダルを閉じた。明示的な購入意思の中断。遷移はしない（呼び元判断）。
 * - "failed":     ハンドラ内部でエラー発生。詳細は error フィールド。
 */
export type LaunchResult =
  | { kind: "redirected" }
  | { kind: "completed"; providerPaymentId: string; rawResult?: unknown }
  | { kind: "rejected"; reason?: string; rawResult?: unknown }
  | { kind: "closed"; rawResult?: unknown }
  | { kind: "failed"; error: Error };

/**
 * LaunchInstruction.type ごとに用意される起動ハンドラ。
 *
 * launchers/index.ts のレジストリに登録し、executePaymentLaunch がディスパッチする。
 * 新規 type ("qr_poll" 等) を LaunchInstruction に追加した場合、対応する LaunchHandler を
 * 実装してレジストリに登録すれば動く。
 */
export type LaunchHandler<I extends LaunchInstruction = LaunchInstruction> = {
  execute(instruction: I, context: LaunchContext): Promise<LaunchResult>;
};
