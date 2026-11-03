// src/features/core/auth/hooks/useOAuthRegistrationForm.ts
//
// 本登録（外部アカウント認証済み）form の公開 hook。useForm・既定値・provider のプロフィール → form の反映・
// 送信（idToken・reCAPTCHA v3 / v2 再送・登録 API・セッション更新・完了画面への遷移）・429 の表示・招待コード欄までを持ち、form を返す。
// 既定の部品 OAuthRegistrationForm はこれを呼んで描くだけ。fork は同じ hook で自由な markup を描ける。
// 契約（引数・戻り値・form の項目名）→ auth README「公開 hook の契約表」

"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { auth } from "@/lib/firebase/client/app";

import { DefaultValues, FormSchema, type FormValues } from "./registration/oauthFormEntities";
import { oauthRegistrationVariant } from "./registration/submitFlow";
import { useRegistrationFormCore } from "./registration/useRegistrationFormCore";

export type OAuthRegistrationFormValues = FormValues;

export function useOAuthRegistrationForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });

  const core = useRegistrationFormCore<FormValues>(form, oauthRegistrationVariant);

  // provider のプロフィール（メール・表示名）を form の初期値へ反映する
  const currentUser = auth.currentUser;
  const providerProfile = {
    email: currentUser?.email ?? "",
    name: currentUser?.displayName ?? "",
  };
  const isSubmitted = form.formState.isSubmitted;

  useEffect(() => {
    form.setValue("email", providerProfile.email, {
      shouldValidate: isSubmitted,
    });
    form.setValue("name", providerProfile.name, {
      shouldValidate: isSubmitted,
    });
  }, [form, isSubmitted, providerProfile.name, providerProfile.email]);

  return { form, ...core } as const;
}
