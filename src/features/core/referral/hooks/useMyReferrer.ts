// 自分の紹介元を取得するフック

import useSWR from "swr";
import { getMyReferrer, type MyReferrerResponse } from "../services/client/myReferrer";

const SWR_KEY = "/api/referral/my-referrer";

type UseMyReferrerReturn = {
  /** 紹介元情報（null = 紹介経由でない、undefined = ロード中） */
  referral: MyReferrerResponse["referral"] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

/**
 * 自分の紹介元（招待してくれた人）を取得するフック
 */
export function useMyReferrer(): UseMyReferrerReturn {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEY,
    async () => {
      const res = await getMyReferrer();
      return res.referral;
    }
  );

  return {
    referral: data,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

export const MY_REFERRER_SWR_KEY = SWR_KEY;
