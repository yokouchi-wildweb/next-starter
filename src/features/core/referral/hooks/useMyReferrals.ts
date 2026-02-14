// 自分が招待した人の一覧を取得するフック

import useSWR from "swr";
import { getMyReferrals, type MyReferralItem } from "../services/client/myReferrals";

const SWR_KEY = "/api/referral/my-referrals";

type UseMyReferralsReturn = {
  /** 招待した人の一覧（undefined = ロード中） */
  referrals: MyReferralItem[] | undefined;
  /** 招待人数（ロード中は undefined） */
  count: number | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

/**
 * 自分が招待した人の一覧を取得するフック
 */
export function useMyReferrals(): UseMyReferralsReturn {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEY,
    async () => {
      const res = await getMyReferrals();
      return res.referrals;
    }
  );

  return {
    referrals: data,
    count: data?.length,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

export const MY_REFERRALS_SWR_KEY = SWR_KEY;
