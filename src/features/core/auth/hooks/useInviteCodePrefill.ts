// src/features/core/auth/hooks/useInviteCodePrefill.ts

import { useCallback, useEffect, useRef } from "react";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { usePendingInviteCode } from "@/features/core/referral/hooks/usePendingInviteCode";

type UseInviteCodePrefillParams = {
  /** フォームの現在の招待コード値を返す */
  getInviteCode: () => string | undefined;
  /** フォームの招待コード欄に値をセットする */
  setInviteCode: (code: string) => void;
};

type UseInviteCodePrefillReturn = {
  /**
   * 送信ペイロード用の招待コードを解決する。
   * - 非空: その値を送る（手入力 / プリフィル値）
   * - 空 & プリフィル済み: "" を送る = 明示的拒否（サーバーは cookie フォールバックしない）
   * - 空 & プリフィル無し: undefined = 未指定（サーバーが cookie フォールバック可）
   */
  resolveInviteCodePayload: (value: string | undefined) => string | undefined;
};

/**
 * 招待リンク（?invite=CODE）由来のコードをサインアップフォームの
 * 招待コード欄へプリフィルするフック（Email / OAuth 登録フォーム共用）。
 *
 * ユーザーが既に入力済みの場合は上書きしない。
 * プリフィル後にユーザーが値を消して送信した場合は「明示的拒否」として扱い、
 * サーバー側の cookie フォールバック適用も抑止する。
 */
export function useInviteCodePrefill({
  getInviteCode,
  setInviteCode,
}: UseInviteCodePrefillParams): UseInviteCodePrefillReturn {
  // ゲートは referral 機能フラグのみ（流入経路解析のオンオフとは独立）
  const enabled = APP_FEATURES.marketing.referral.enabled;
  const { inviteCode: pendingInviteCode } = usePendingInviteCode(enabled);
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (!pendingInviteCode || prefilledRef.current) return;
    // ユーザーが既に手入力している場合は触らない（手入力優先）
    if (getInviteCode()) return;

    setInviteCode(pendingInviteCode);
    prefilledRef.current = true;
    // getInviteCode / setInviteCode はインラインで渡される想定のため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode]);

  const resolveInviteCodePayload = useCallback((value: string | undefined) => {
    if (value) return value;
    return prefilledRef.current ? "" : undefined;
  }, []);

  return { resolveInviteCodePayload };
}
