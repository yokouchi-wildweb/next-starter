// src/features/core/auth/hooks/useEmailRegistrationForm.ts
//
// 本登録（メール認証済み）form の公開 hook。useForm・既定値・送信（idToken・reCAPTCHA v3 / v2 再送・
// 登録 API・セッション更新・完了画面への遷移）・429 の表示・招待コード欄までを持ち、form を返す。
// 既定の部品 EmailRegistrationForm はこれを呼んで描くだけ。fork は同じ hook で自由な markup を描ける。
// 契約（引数・戻り値・form の項目名）→ auth README「公開 hook の契約表」

"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useLocalStorage } from "@/lib/browserStorage";

import {
  DefaultValues,
  FormSchema,
  isDoubleMode,
  type FormValues,
} from "./registration/emailFormEntities";
import { emailRegistrationVariant } from "./registration/submitFlow";
import { useRegistrationFormCore } from "./registration/useRegistrationFormCore";

export type EmailRegistrationFormValues = FormValues;

export function useEmailRegistrationForm() {
  const [savedEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  // ローカルストレージのメールアドレスを優先（認証時に保存された正しい値）
  const email = useMemo(() => savedEmail.trim(), [savedEmail]);
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...DefaultValues,
      email,
    },
  });

  const core = useRegistrationFormCore<FormValues>(form, emailRegistrationVariant);

  useEffect(() => {
    form.setValue("email", email, { shouldValidate: form.formState.isSubmitted });
  }, [email, form]);

  return {
    form,
    ...core,
    /** パスワード（確認）欄を出すか（APP_FEATURES.auth.signup.passwordInputMode === "double"） */
    passwordConfirmationRequired: isDoubleMode,
  } as const;
}
