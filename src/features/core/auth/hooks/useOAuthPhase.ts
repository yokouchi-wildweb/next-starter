// src/features/auth/hooks/useOAuthPhase.ts

"use client";

import { useEffect, useRef } from "react";

import { createOAuthProvider } from "@/features/core/auth/utils/createOAuthProvider";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { log } from "@/utils/log";
import { isHttpError } from "@/lib/errors";

import { useOAuthStateMachine } from "./oauth/useOAuthStateMachine";
import { useOAuthRedirect } from "./oauth/useOAuthRedirect";
import { useOAuthCredential } from "./oauth/useOAuthCredential";
import { useOAuthRegistration } from "./oauth/useOAuthRegistration";
import { clearRedirectAttempt } from "./oauth/utils";
import type { UseOAuthPhaseParams, OAuthPhase, OAuthCredentialInfo } from "./oauth/types";

// 型のエクスポート（後方互換性のため）
export type { OAuthPhase } from "./oauth/types";

/**
 * OAuth認証フローを管理するフック
 *
 * @description
 * OAuth認証のフローを6つのフェーズで管理します：
 * - initial: 認証フローの開始準備
 * - redirecting: 認証プロバイダーへのリダイレクト中
 * - processing: 認証情報の検証中
 * - completed: 新規ユーザー登録完了
 * - alreadyRegistered: 既存ユーザーのログイン完了
 * - invalidProcess: エラーまたは無効な状態
 */
export function useOAuthPhase({ provider }: UseOAuthPhaseParams) {
  const sessionStorage = useSessionStorage();
  const isActiveRef = useRef(true);

  // ステートマシン
  const { phase, setPhase, setCredential, setError } = useOAuthStateMachine();

  // サブフック（関数を個別に取得）
  const { getResult, executeRedirect, checkAttempted } = useOAuthRedirect({ sessionStorage, provider });
  const { extract, checkUser } = useOAuthCredential({ provider });
  const { registerNewUser, createSessionForExistingUser } = useOAuthRegistration({ provider });

  useEffect(() => {
    log(3, "[useOAuthPhase] effect start", {
      provider,
      sessionHasRedirectAttempt: checkAttempted(),
    });

    // プロバイダーのバリデーション
    if (!provider) {
      log(3, "[useOAuthPhase] provider missing. Abort flow");
      setPhase("invalidProcess");
      return;
    }

    const authProvider = createOAuthProvider(provider);
    if (!authProvider) {
      log(3, "[useOAuthPhase] invalid provider detected", { provider });
      setPhase("invalidProcess");
      return;
    }

    // メインフロー
    const run = async () => {
      let extractedCredential: OAuthCredentialInfo | null = null;
      try {
        // 1. リダイレクト結果の取得
        const redirectResult = await getResult();
        if (!isActiveRef.current) return;

        // 2. リダイレクト結果がない場合
        if (!redirectResult) {
          await handleMissingRedirectResult();
          return;
        }

        // 3. リダイレクト結果がある場合の処理
        setPhase("processing");
        clearRedirectAttempt(sessionStorage, provider);

        // 4. 認証情報の抽出
        extractedCredential = await extract(redirectResult);
        if (!isActiveRef.current) return;
        setCredential(extractedCredential);

        // 5. ユーザー存在チェック
        const { isRegistered: userIsRegistered } = await checkUser(
          extractedCredential,
        );
        if (!isActiveRef.current) return;

        // 6. 既存ユーザーの場合
        if (userIsRegistered) {
          await handleAlreadyRegistered(extractedCredential);
          return;
        }

        // 7. 新規ユーザーの仮登録
        await registerNewUser(extractedCredential);
        if (!isActiveRef.current) return;

        setPhase("completed");
        log(3, "[useOAuthPhase] authentication flow completed successfully");
      } catch (error) {
        handleError(error, extractedCredential);
      }
    };

    /**
     * リダイレクト結果がない場合の処理
     */
    async function handleMissingRedirectResult() {
      log(3, "[useOAuthPhase] redirect result absent", {
        provider,
        sessionHasRedirectAttempt: checkAttempted(),
      });

      // リダイレクト試行済みなのに結果がない場合はエラー
      if (checkAttempted()) {
        log(3, "[useOAuthPhase] redirect attempt detected but result missing. Mark invalid.");
        markInvalidProcess();
        return;
      }

      // リダイレクト実行
      setPhase("redirecting");
      await executeRedirect(authProvider!);
    }

    /**
     * 既存ユーザーのログイン処理
     */
    async function handleAlreadyRegistered(cred: OAuthCredentialInfo | null) {
      if (!cred) {
        log(3, "[useOAuthPhase] credential info missing for registered user", { provider });
        markInvalidProcess();
        return;
      }

      await createSessionForExistingUser(cred);
      if (!isActiveRef.current) return;

      clearRedirectAttempt(sessionStorage, provider);
      setPhase("alreadyRegistered");
    }

    /**
     * エラーハンドリング
     */
    function handleError(error: unknown, currentCredential: OAuthCredentialInfo | null) {
      console.error("[useOAuthPhase] OAuth signup process failed", {
        error,
        provider,
        sessionHasRedirectAttempt: checkAttempted(),
      });

      // 409エラーは既存ユーザー
      if (isHttpError(error) && error.status === 409 && currentCredential) {
        log(3, "[useOAuthPhase] handled 409 error as already registered", { provider });
        void handleAlreadyRegistered(currentCredential);
        return;
      }

      if (!isActiveRef.current) {
        log(3, "[useOAuthPhase] effect no longer active. Abort error handling.");
        return;
      }

      log(3, "[useOAuthPhase] fallback to invalid process due to error", { provider });
      markInvalidProcess();
      if (error instanceof Error) {
        setError(error);
      }
    }

    /**
     * フローを無効化
     */
    function markInvalidProcess() {
      clearRedirectAttempt(sessionStorage, provider);
      log(3, "[useOAuthPhase] mark flow as invalid process", { provider });
      setPhase("invalidProcess");
    }

    void run();

    return () => {
      log(3, "[useOAuthPhase] effect cleanup", { provider });
      isActiveRef.current = false;
    };
  }, [
    provider,
    sessionStorage,
    getResult,
    executeRedirect,
    checkAttempted,
    extract,
    checkUser,
    registerNewUser,
    createSessionForExistingUser,
    setPhase,
    setCredential,
    setError,
  ]);

  return {
    phase,
  } as const;
}
