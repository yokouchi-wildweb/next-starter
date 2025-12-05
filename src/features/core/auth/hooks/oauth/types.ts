/**
 * OAuth認証フロー用の型定義
 */

import type { extractOAuthCredential } from "@/features/core/auth/utils/extractOAuthCredential";
import type { UserProviderType } from "@/types/user";

/**
 * OAuthフローの進行段階
 */
export type OAuthPhase =
  | "initial" // 認証フローの開始に向けて前処理を行っている状態
  | "redirecting" // 認証プロバイダーのページへ遷移中の状態
  | "processing" // リダイレクトから戻り認証情報を検証している状態
  | "completed" // 認証と仮登録が完了し次の画面へ進める状態
  | "alreadyRegistered" // 対象アカウントがすでに登録済みである状態
  | "invalidProcess"; // 必要な情報が不足するなど手続きが成立しない状態

/**
 * useOAuthPhaseのパラメータ
 */
export type UseOAuthPhaseParams = {
  provider?: UserProviderType;
};

/**
 * OAuth認証情報
 */
export type OAuthCredentialInfo = Awaited<ReturnType<typeof extractOAuthCredential>>;

/**
 * OAuthステートマシンのステート
 */
export type OAuthState = {
  phase: OAuthPhase;
  credentialInfo: OAuthCredentialInfo | null;
  error: Error | null;
};

/**
 * OAuthステートマシンのアクション
 */
export type OAuthAction =
  | { type: "SET_PHASE"; payload: OAuthPhase }
  | { type: "SET_CREDENTIAL"; payload: OAuthCredentialInfo }
  | { type: "SET_ERROR"; payload: Error }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };
