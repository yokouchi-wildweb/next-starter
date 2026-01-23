// 自分の招待コード発行フック

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import {
  issueMyInviteCode,
  type InviteCodeData,
} from "../services/client/inviteCode";
import { MY_INVITE_CODE_SWR_KEY } from "./useMyInviteCode";

type UseIssueMyInviteCodeReturn = {
  issue: () => Promise<InviteCodeData>;
  isLoading: boolean;
  error: Error | null;
};

/**
 * 自分の招待コードを発行するフック
 *
 * - 既存コードがあればそれを返す
 * - なければ新規発行
 * - 発行後に useMyInviteCode のキャッシュを自動更新
 *
 * @example
 * const { issue, isLoading } = useIssueMyInviteCode();
 *
 * const handleIssue = async () => {
 *   try {
 *     const code = await issue();
 *     console.log("発行完了:", code.code);
 *   } catch (err) {
 *     console.error("発行失敗:", err);
 *   }
 * };
 */
export function useIssueMyInviteCode(): UseIssueMyInviteCodeReturn {
  const { mutate } = useSWRConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const issue = useCallback(async (): Promise<InviteCodeData> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await issueMyInviteCode();
      // useMyInviteCode のキャッシュを更新
      mutate(MY_INVITE_CODE_SWR_KEY, res.inviteCode, false);
      return res.inviteCode;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("招待コードの発行に失敗しました。");
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [mutate]);

  return { issue, isLoading, error };
}
