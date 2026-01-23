// 自分の招待コード取得フック

import useSWR from "swr";
import {
  getMyInviteCode,
  type InviteCodeData,
} from "../services/client/inviteCode";

const SWR_KEY = "/api/coupon/my-invite";

type UseMyInviteCodeReturn = {
  inviteCode: InviteCodeData | null | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
};

/**
 * 自分の招待コードを取得するフック
 *
 * - 発行済み → inviteCode にデータ
 * - 未発行 → inviteCode が null
 * - ロード中 → inviteCode が undefined
 *
 * @example
 * const { inviteCode, isLoading, mutate } = useMyInviteCode();
 *
 * if (isLoading) return <Skeleton />;
 *
 * if (!inviteCode) {
 *   return <Button onClick={handleIssue}>クーポンを発行</Button>;
 * }
 *
 * return <InviteCodeDisplay code={inviteCode.code} />;
 */
export function useMyInviteCode(): UseMyInviteCodeReturn {
  const { data, error, isLoading, mutate } = useSWR(
    SWR_KEY,
    async () => {
      const res = await getMyInviteCode();
      return res.inviteCode;
    }
  );

  return {
    inviteCode: data,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}

// SWR キーをエクスポート（useIssueMyInviteCode で使用）
export const MY_INVITE_CODE_SWR_KEY = SWR_KEY;
