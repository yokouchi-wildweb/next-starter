// src/features/setting/hooks/useAdminSetup.ts
//
// 管理者の初期セットアップ(/admin/setup。管理者がまだ居ないときだけ開く画面)。
// - trigger / isMutating / error: 送信だけ(並列の trigger に安全、lib/crud/hooks/internal/useDomainMutation)
// - submit(values): 送信 → 成功の toast → redirectTo(既定 "/admin/login")へ遷移。初期設定の form の customSubmit に渡す
// - submit の失敗: error の toast を出して投げ直す(form の AppForm が未保存の守りを戻す。成功扱いにしない)

"use client";

import { useCallback } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import { useRouter } from "@/lib/unsavedGuard";

import { adminSetupClient, type AdminSetupResult } from "../services/client/adminSetupClient";
import type { AdminSetupInput } from "../services/types";

/** 初期セットアップの後の既定の行き先(作った管理者でログインする) */
export const ADMIN_SETUP_REDIRECT_PATH = "/admin/login";

export type UseAdminSetupOptions = {
  /** submit の成功の後の遷移先。省略 = ADMIN_SETUP_REDIRECT_PATH */
  redirectTo?: string;
};

export const useAdminSetup = ({ redirectTo = ADMIN_SETUP_REDIRECT_PATH }: UseAdminSetupOptions = {}) => {
  const mutation = useDomainMutation<AdminSetupResult, AdminSetupInput>(
    "setting/setup",
    (input) => adminSetupClient.initialize(input),
  );
  const router = useRouter();
  const { showToast } = useToast();
  const { trigger } = mutation;

  const submit = useCallback(
    async (values: AdminSetupInput) => {
      try {
        await trigger(values);
      } catch (error) {
        showToast(err(error, "初回セットアップに失敗しました"), "error");
        throw error;
      }
      showToast("初回セットアップが完了しました", "success");
      router.push(redirectTo);
    },
    [trigger, showToast, router, redirectTo],
  );

  return {
    trigger: mutation.trigger,
    submit,
    isMutating: mutation.isMutating,
    error: mutation.error,
  };
};
