// src/features/core/wallet/hooks/useMyExpiringLots.ts

"use client";

import useSWR from "swr";

import type { ExpiringLotsPayload } from "@/features/core/wallet/services/types";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import { walletClient } from "@/features/core/wallet/services/client/walletClient";

/**
 * 本人の失効間近残高を取得する（/api/me/wallet/expiring）。
 *
 * 有効期限が無効な walletType では常に空（totalExpiring: 0）が返るため、
 * 呼び出し側で有効/無効の分岐は不要。失効予告 UI・通知バナー等はダウンストリームで実装する。
 * userId は「ログイン済みか」のゲート兼 SWR キャッシュキーとしてのみ使う（取得対象はサーバーが強制）。
 */
export const useMyExpiringLots = (
  userId: string | null | undefined,
  walletType: WalletTypeValue,
  withinDays?: number,
) =>
  useSWR<ExpiringLotsPayload>(
    userId ? `my-expiring-lots:${userId}:${walletType}:${withinDays ?? "default"}` : null,
    () => walletClient.getMyExpiringLots(walletType, withinDays),
  );
