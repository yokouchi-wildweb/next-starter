// src/features/core/userAcquisition/hooks/usePendingInviteCode.ts

import useSWR from "swr";

import { getPendingInviteCode } from "../services/client/getPendingInviteCode";

const SWR_KEY = "/api/acquisition/pending-invite-code";

type UsePendingInviteCodeReturn = {
  /** 保留中の招待コード（null = 無し、undefined = ロード中） */
  inviteCode: string | null | undefined;
  isLoading: boolean;
  error: Error | undefined;
};

/**
 * 招待リンク（?invite=CODE）由来の保留中招待コードを取得するフック。
 *
 * @param enabled false の場合はリクエスト自体を行わない
 *   （計測 or referral 機能が無効な環境で無駄な HTTP を発生させないため）
 */
export function usePendingInviteCode(enabled: boolean = true): UsePendingInviteCodeReturn {
  const { data, error, isLoading } = useSWR(
    enabled ? SWR_KEY : null,
    async () => (await getPendingInviteCode()).inviteCode,
    { revalidateOnFocus: false },
  );

  return {
    inviteCode: data,
    isLoading,
    error,
  };
}
