// src/features/auth/hooks/useOAuthPhase.ts

"use client";

import { useEffect, useState } from "react";
import { getRedirectResult, signInWithRedirect } from "firebase/auth";

import { usePreRegistration } from "@/features/auth/hooks/usePreRegistration";
import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { createOAuthProvider } from "@/features/auth/utils/createOAuthProvider";
import { useExists } from "@/features/user/hooks/useExists";
import { useStatusChecker } from "@/features/user/hooks/useStatusChecker";
import { extractOAuthCredential } from "@/features/auth/utils/extractOAuthCredential";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { log } from "@/utils/log";
import { auth } from "@/lib/firebase/client/app";
import { isHttpError } from "@/lib/errors";
import { createFirebaseSession } from "@/features/auth/services/client/firebaseSession";
import type { UserProviderType } from "@/types/user";

const REDIRECT_ATTEMPT_STORAGE_KEY = "auth.oauth.redirectAttempted";

export type OAuthPhase =
  | "initial" // 認証フローの開始に向けて前処理を行っている状態
  | "redirecting" // 認証プロバイダーのページへ遷移中の状態
  | "processing" // リダイレクトから戻り認証情報を検証している状態
  | "completed" // 認証と仮登録が完了し次の画面へ進める状態
  | "alreadyRegistered" // 対象アカウントがすでに登録済みである状態
  | "invalidProcess"; // 必要な情報が不足するなど手続きが成立しない状態

type UseOAuthPhaseParams = {
  provider?: UserProviderType;
};

type OAuthCredentialInfo = Awaited<ReturnType<typeof extractOAuthCredential>>;

export function useOAuthPhase({ provider }: UseOAuthPhaseParams) {
  // 現在のフローの進行段階。UIはこの値に基づいて表示を切り替える。
  const [phase, setPhase] = useState<OAuthPhase>("initial");

  const { preRegister } = usePreRegistration();
  const { refreshSession } = useAuthSession();
  const { check: checkUserExistence } = useExists();
  const { isRegistered } = useStatusChecker();
  const sessionStorage = useSessionStorage();

  useEffect(() => {
    log(3, "[useOAuthPhase] effect start", {
      provider,
      sessionHasRedirectAttempt: sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY),
    });

    if (!provider) {
      // プロバイダーが取得できない場合はフローを進められない。
      log(3, "[useOAuthPhase] provider missing. Abort flow");
      setPhase("invalidProcess");
      return;
    }

    const authProvider = createOAuthProvider(provider);
    if (!authProvider) {
      // 想定外のプロバイダーが指定された場合は手続き自体を無効化する。
      log(3, "[useOAuthPhase] invalid provider detected", { provider });
      setPhase("invalidProcess");
      return;
    }

    let isActive = true;
    let credentialInfo: OAuthCredentialInfo | null = null;

    const clearRedirectAttempt = () => {
      if (!sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY)) {
        return;
      }

      sessionStorage.removeItem(REDIRECT_ATTEMPT_STORAGE_KEY);
      log(3, "[useOAuthPhase] redirect attempt flag removed", { provider });
    };

    const setPhaseSafely = (nextPhase: OAuthPhase) => {
      if (!isActive) {
        log(3, "[useOAuthPhase] skip phase update because effect is inactive", {
          nextPhase,
          provider,
        });
        return false;
      }
      setPhase(nextPhase);
      return true;
    };

    const markInvalidProcess = () => {
      clearRedirectAttempt();
      log(3, "[useOAuthPhase] mark flow as invalid process", { provider });
      setPhaseSafely("invalidProcess");
    };

    const handleAlreadyRegistered = async () => {
      if (!credentialInfo) {
        log(3, "[useOAuthPhase] credential info missing for registered user", { provider });
        markInvalidProcess();
        return;
      }

      log(3, "[useOAuthPhase] proceed as already registered", {
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
      });

      await createFirebaseSession({
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
        idToken: credentialInfo.idToken,
      });
      log(3, "[useOAuthPhase] firebase session issued for registered user", {
        providerType: provider,
        providerUid: credentialInfo.firebaseUid,
      });

      await refreshSession();
      log(3, "[useOAuthPhase] session refreshed for registered user");

      clearRedirectAttempt();
      setPhaseSafely("alreadyRegistered");
    };

    const handleMissingRedirectResult = async () => {
      log(3, "[useOAuthPhase] redirect result absent", {
        provider,
        sessionHasRedirectAttempt: sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY),
      });

      if (sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY)) {
        log(3, "[useOAuthPhase] redirect attempt detected but result missing. Mark invalid.");
        markInvalidProcess();
        return;
      }

      if (!setPhaseSafely("redirecting")) {
        return;
      }

      sessionStorage.setItem(REDIRECT_ATTEMPT_STORAGE_KEY, "1");
      log(3, "[useOAuthPhase] redirect attempt flag saved. Executing signInWithRedirect.");
      await signInWithRedirect(auth, authProvider);
    };

    const run = async () => {
      try {
        log(3, "[useOAuthPhase] fetching redirect result", { provider });
        const redirectResult = await getRedirectResult(auth);
        log(3, "[useOAuthPhase] redirect result received", {
          redirectResultExists: Boolean(redirectResult),
          redirectResultKeys: redirectResult ? Object.keys(redirectResult) : null,
        });
        if (!isActive) return;

        if (!redirectResult) {
          await handleMissingRedirectResult();
          return;
        }

        if (!setPhaseSafely("processing")) {
          return;
        }

        clearRedirectAttempt();

        log(3, "[useOAuthPhase] extracting credential info", { provider });
        credentialInfo = await extractOAuthCredential(redirectResult);
        log(3, "[useOAuthPhase] credential info extracted", credentialInfo);
        if (!isActive) return;

        const { user: existingUser } = await checkUserExistence(provider, credentialInfo.firebaseUid);
        log(3, "[useOAuthPhase] user existence checked", {
          provider,
          firebaseUid: credentialInfo.firebaseUid,
          existingUserExists: Boolean(existingUser),
          existingUser,
        });
        if (!isActive) return;

        if (existingUser && isRegistered(existingUser)) {
          await handleAlreadyRegistered();
          return;
        }

        log(3, "[useOAuthPhase] executing preRegister", {
          providerType: provider,
          providerUid: credentialInfo.firebaseUid,
          hasIdToken: Boolean(credentialInfo.idToken),
          email: credentialInfo.email ?? null,
        });
        await preRegister({
          providerType: provider,
          providerUid: credentialInfo.firebaseUid,
          idToken: credentialInfo.idToken,
          email: credentialInfo.email ?? undefined,
        });
        log(3, "[useOAuthPhase] preRegister completed");

        await refreshSession();
        log(3, "[useOAuthPhase] session refreshed after preRegister");

        if (!setPhaseSafely("completed")) {
          return;
        }

        log(3, "[useOAuthPhase] authentication flow completed successfully");
      } catch (error) {
        console.error("[useOAuthPhase] OAuth signup process failed", {
          error,
          provider,
          sessionHasRedirectAttempt: sessionStorage.exists(REDIRECT_ATTEMPT_STORAGE_KEY),
        });

        if (isHttpError(error) && error.status === 409) {
          log(3, "[useOAuthPhase] handled 409 error as already registered", { provider });
          await handleAlreadyRegistered();
          return;
        }

        if (!isActive) {
          log(3, "[useOAuthPhase] effect no longer active. Abort error handling.");
          return;
        }

        log(3, "[useOAuthPhase] fallback to invalid process due to error", { provider });
        markInvalidProcess();
      }
    };

    void run();

    return () => {
      log(3, "[useOAuthPhase] effect cleanup", {
        provider,
      });
      isActive = false;
    };
  }, [
    checkUserExistence,
    isRegistered,
    preRegister,
    provider,
    refreshSession,
    sessionStorage,
  ]);

  return {
    phase,
  } as const;
}
