// src/features/core/auth/hooks/registration/useRegistrationFormCore.ts
//
// 本登録 form（Email / OAuth）の共通部: 招待コード欄・ロールの監視・root エラー・送信（useRegistrationSubmit）。
// useForm は各公開 hook が持ち、ここへ渡す。
// 内部ファイル: 公開の入口は hooks/useEmailRegistrationForm・hooks/useOAuthRegistrationForm。

"use client";

import { useWatch, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";

import { useInviteCodePrefill } from "@/features/core/auth/hooks/useInviteCodePrefill";
import { useInviteCodeValidation } from "@/features/core/auth/hooks/useInviteCodeValidation";

import { REGISTRATION_PROFILES } from "./registrationProfiles";
import type { RegistrationFormValuesBase, RegistrationVariant } from "./submitFlow";
import { useRegistrationSubmit } from "./useRegistrationSubmit";

export function useRegistrationFormCore<TValues extends RegistrationFormValuesBase & FieldValues>(
  form: UseFormReturn<TValues>,
  variant: RegistrationVariant<TValues>,
) {
  // 招待コード欄の「適用」検証（購入ページのクーポン欄と同じ操作モデル）+ 未適用のままの送信ブロック
  const { state: inviteCodeState, assertInviteCodeSubmittable } = useInviteCodeValidation({ form });

  // 招待リンク（?invite=CODE）由来のコードを招待コード欄へプリフィルし、1回だけ自動で「適用」する
  const inviteCodePath = "inviteCode" as Path<TValues>;
  const { resolveInviteCodePayload } = useInviteCodePrefill({
    getInviteCode: () => form.getValues(inviteCodePath) as string | undefined,
    setInviteCode: (code) => {
      form.setValue(inviteCodePath, code as TValues[typeof inviteCodePath]);
      void inviteCodeState.apply(code);
    },
  });

  const submit = useRegistrationSubmit({
    form,
    variant,
    assertInviteCodeSubmittable,
    resolveInviteCodePayload,
  });

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: form.control, name: "role" as Path<TValues> }) as string;

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return {
    ...submit,
    inviteCodeState,
    selectedRole,
    rootErrorMessage,
    profiles: REGISTRATION_PROFILES,
  } as const;
}
