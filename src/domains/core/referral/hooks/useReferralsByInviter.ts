// 管理者用: 指定ユーザーが招待した人の一覧を取得するフック

"use client";

import useSWR from "swr";
import {
  getReferralsByInviter,
  type ReferralByInviterItem,
} from "../services/client/referralsByInviter";

const SWR_KEY = "/api/admin/referral/by-inviter";

type UseReferralsByInviterOptions = {
  /** false の間は取得しない(モーダルが閉じている間など)。既定 true */
  enabled?: boolean;
};

type UseReferralsByInviterReturn = {
  /** 紹介一覧（undefined = 未取得 / ロード中） */
  referrals: ReferralByInviterItem[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
};

/**
 * 管理者用: 指定ユーザーの紹介一覧を取得する。
 * inviterUserId が null の間、または enabled=false の間は取得しない。
 */
export function useReferralsByInviter(
  inviterUserId: string | null,
  { enabled = true }: UseReferralsByInviterOptions = {},
): UseReferralsByInviterReturn {
  const { data, error, isLoading } = useSWR(
    enabled && inviterUserId ? [SWR_KEY, inviterUserId] : null,
    async ([, userId]: [string, string]) => {
      const res = await getReferralsByInviter(userId);
      return res.referrals;
    },
  );

  return { referrals: data, isLoading, error };
}
