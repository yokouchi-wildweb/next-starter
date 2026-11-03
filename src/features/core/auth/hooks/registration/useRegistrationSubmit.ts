// src/features/core/auth/hooks/registration/useRegistrationSubmit.ts
//
// 本登録（Email / OAuth）の送信の共通部: 登録 API・セッション更新・遷移・reCAPTCHA v3 / v2 の再送・429 の表示を持つ。
// 流れそのものは submitFlow.ts の純関数。ここは実物の依存を渡し、結果を form と表示の状態へ反映するだけ。
// 内部ファイル: 公開の入口は hooks/useEmailRegistrationForm・hooks/useOAuthRegistrationForm。

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useRegistration, type RegistrationInput } from "@/features/core/auth/hooks/useRegistration";
import { auth } from "@/lib/firebase/client/app";
import {
  getRecaptchaToken,
  isV2ChallengeRequired,
  useRecaptcha,
  useRecaptchaV2Challenge,
} from "@/lib/recaptcha";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { useGuardedNavigation } from "@/lib/transitionGuard";

import {
  retryRegistrationWithV2,
  submitRegistration,
  type RegistrationFormValuesBase,
  type RegistrationOutcome,
  type RegistrationVariant,
} from "./submitFlow";

/** v2 チャレンジのモーダルに渡す値（siteKey が null の間は描かない） */
export type RegistrationRecaptchaV2State = {
  open: boolean;
  siteKey: string | null;
  onClose: () => void;
  onVerify: (token: string) => void;
};

/** レート制限の警告モーダルに渡す値 */
export type RegistrationRateLimitWarningState = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Params<TValues extends RegistrationFormValuesBase> = {
  form: UseFormReturn<TValues>;
  variant: RegistrationVariant<TValues>;
  assertInviteCodeSubmittable: (inviteCode: string | undefined) => boolean;
  resolveInviteCodePayload: (inviteCode: string | undefined) => RegistrationInput["inviteCode"];
};

export function useRegistrationSubmit<TValues extends RegistrationFormValuesBase>({
  form,
  variant,
  assertInviteCodeSubmittable,
  resolveInviteCodePayload,
}: Params<TValues>) {
  const { guardedPush } = useGuardedNavigation();
  const { executeRecaptcha } = useRecaptcha();
  const { register, isLoading } = useRegistration();
  const { refreshSession } = useAuthSession();
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);
  const { challengeState, handleV2ChallengeRequired, handleV2Verify, closeChallenge, hasV2Token } =
    useRecaptchaV2Challenge();

  // v2認証成功後に再送信するためのペイロード保存
  const pendingPayloadRef = useRef<RegistrationInput | null>(null);

  const applyOutcome = useCallback(
    (outcome: RegistrationOutcome) => {
      switch (outcome.kind) {
        case "v2Required":
          if (outcome.pendingPayload) pendingPayloadRef.current = outcome.pendingPayload;
          handleV2ChallengeRequired(outcome.error as Parameters<typeof handleV2ChallengeRequired>[0]);
          return;
        case "rateLimitWarning":
          setShowRateLimitWarning(true);
          return;
        case "rateLimitSilent":
        case "error":
          // root エラーは型上 TValues のパスに無いので setError の型を緩めて呼ぶ
          (form.setError as (name: "root", error: { type: string; message: string }) => void)("root", {
            type: "server",
            message: outcome.message,
          });
          return;
        default:
          return;
      }
    },
    [form, handleV2ChallengeRequired],
  );

  // v2認証成功後に自動的に再送信
  useEffect(() => {
    if (hasV2Token && pendingPayloadRef.current) {
      const payload = pendingPayloadRef.current;
      pendingPayloadRef.current = null;
      void retryRegistrationWithV2(payload, challengeState.v2Token ?? undefined, {
        register,
        refreshSession,
        navigate: guardedPush,
      }).then(applyOutcome);
    }
  }, [hasV2Token, challengeState.v2Token, register, refreshSession, guardedPush, applyOutcome]);

  const onSubmit = useCallback(
    async (values: TValues) => {
      const outcome = await submitRegistration(values, variant, {
        getCurrentUser: () => auth.currentUser,
        assertInviteCodeSubmittable,
        resolveInviteCodePayload,
        getRecaptchaToken: () => getRecaptchaToken(executeRecaptcha, RECAPTCHA_ACTIONS.REGISTER),
        register,
        refreshSession,
        navigate: guardedPush,
        isV2ChallengeRequired,
        getFormValues: () => form.getValues(),
      });
      applyOutcome(outcome);
    },
    [
      variant,
      assertInviteCodeSubmittable,
      resolveInviteCodePayload,
      executeRecaptcha,
      register,
      refreshSession,
      guardedPush,
      form,
      applyOutcome,
    ],
  );

  const recaptchaV2: RegistrationRecaptchaV2State = {
    open: challengeState.isOpen,
    siteKey: challengeState.siteKey,
    onClose: closeChallenge,
    onVerify: handleV2Verify,
  };

  const rateLimitWarning: RegistrationRateLimitWarningState = {
    open: showRateLimitWarning,
    onOpenChange: setShowRateLimitWarning,
  };

  return { onSubmit, isLoading, recaptchaV2, rateLimitWarning } as const;
}
