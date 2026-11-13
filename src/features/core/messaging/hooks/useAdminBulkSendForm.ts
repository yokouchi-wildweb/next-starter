"use client";

// src/features/core/messaging/hooks/useAdminBulkSendForm.ts
//
// 管理の一括送信の書く欄・開閉・送信の流れ(部品 AdminBulkSendButton はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 開く: 二重送信を防ぐ鍵を 1 つ発行(同じフォームの再試行は同じ鍵。サーバーは同じ鍵の 2 回目を送らない)
// - 送る: { target, recordIds } + 経路 + 中身 + カテゴリーを useAdminBulkSend へ。成功 = 結果を持ち、onSent → onSuccess
// - カテゴリー: 開いている間に選択肢(useAdminBulkSendOptions、一覧の一括で送れるカテゴリー)を取る。既定 operatorDirect(運営からのご連絡、D81)

import { useCallback, useMemo, useState } from "react";

import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import type {
  AdminBulkSendInput,
  AdminBulkSendResult,
  AdminFreeTextCategoryOption,
} from "../services/client/adminMessagingClient";

import { useAdminBulkSend, useAdminBulkSendOptions } from "./useAdminBulkSend";

/** 一覧の一括操作の既定のカテゴリー(種別 direct、D81) */
export const ADMIN_BULK_SEND_DEFAULT_CATEGORY = "operatorDirect";

/** 書く欄の初期値 */
export type AdminBulkSendDefaults = {
  emailSubject?: string;
  emailBody?: string;
  inAppTitle?: string;
  inAppBody?: string;
};

export type UseAdminBulkSendFormOptions = {
  /** 選んだ記録の id */
  ids: string[];
  /** 受け口 bulkSendTargets の項目の鍵 */
  target: string;
  defaults?: AdminBulkSendDefaults;
  /** 送るカテゴリーの既定(既定 operatorDirect。選択肢に無ければ最初の選択肢) */
  defaultCategory?: string;
  /** 最初にメールを送る側にするか(既定 true) */
  defaultEmail?: boolean;
  /** 最初にサービス内のお知らせも送る側にするか(既定 true) */
  defaultInApp?: boolean;
  /** 送り元(省略 = サーバーが "<target>.bulk") */
  source?: string;
  onSuccess?: () => void;
  onSent?: (result: AdminBulkSendResult) => void;
};

export function useAdminBulkSendForm({
  ids,
  target,
  defaults = {},
  defaultCategory = ADMIN_BULK_SEND_DEFAULT_CATEGORY,
  defaultEmail = true,
  defaultInApp = true,
  source,
  onSuccess,
  onSent,
}: UseAdminBulkSendFormOptions) {
  const { showToast } = useToast();
  const { send } = useAdminBulkSend();

  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<AdminBulkSendResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const [chosenCategory, setCategory] = useState<string>(defaultCategory);
  const { options } = useAdminBulkSendOptions(formOpen);
  const categories: AdminFreeTextCategoryOption[] = useMemo(() => options?.categories ?? [], [options]);
  // 選んだカテゴリーが選択肢に無い(読み込み後)= 最初の選択肢
  const category =
    categories.length === 0 || categories.some((option) => option.key === chosenCategory)
      ? chosenCategory
      : categories[0].key;
  const [useEmail, setUseEmail] = useState(defaultEmail);
  const [useInApp, setUseInApp] = useState(defaultInApp);
  const [emailSubject, setEmailSubject] = useState(defaults.emailSubject ?? "");
  const [emailBody, setEmailBody] = useState(defaults.emailBody ?? "");
  const [inAppTitle, setInAppTitle] = useState(defaults.inAppTitle ?? "");
  const [inAppBody, setInAppBody] = useState(defaults.inAppBody ?? "");

  const isValid = useMemo(() => {
    if (!useEmail && !useInApp) return false;
    if (useEmail && (!emailSubject.trim() || !emailBody.trim())) return false;
    if (useInApp && (!inAppTitle.trim() || !inAppBody.trim())) return false;
    return true;
  }, [useEmail, useInApp, emailSubject, emailBody, inAppTitle, inAppBody]);

  const { emailSubject: dSubject, emailBody: dBody, inAppTitle: dTitle, inAppBody: dInAppBody } = defaults;
  const reset = useCallback(() => {
    setCategory(defaultCategory);
    setUseEmail(defaultEmail);
    setUseInApp(defaultInApp);
    setEmailSubject(dSubject ?? "");
    setEmailBody(dBody ?? "");
    setInAppTitle(dTitle ?? "");
    setInAppBody(dInAppBody ?? "");
  }, [defaultCategory, defaultEmail, defaultInApp, dSubject, dBody, dTitle, dInAppBody]);

  const setOpen = useCallback(
    (open: boolean) => {
      if (confirmOpen) return;
      setFormOpen(open);
      if (open) setIdempotencyKey(crypto.randomUUID());
      else reset();
    },
    [confirmOpen, reset],
  );

  /** 送る入力(確認の前に組む形と同じ。テストが見る) */
  const buildInput = useCallback((): AdminBulkSendInput => {
    const channels: string[] = [];
    if (useEmail) channels.push("email");
    if (useInApp) channels.push("inApp");
    // 中身は送る画面と同じ形(その場で書く連絡)。テンプレート・プレビュー・テスト送信は送るモーダル(指令 40)
    return {
      target,
      recordIds: ids,
      category,
      channels,
      message: {
        type: "adhoc",
        ...(useEmail ? { email: { subject: emailSubject.trim(), body: emailBody.trim() } } : {}),
        ...(useInApp ? { inApp: { title: inAppTitle.trim(), body: inAppBody.trim() } } : {}),
      },
      idempotencyKey: idempotencyKey ?? undefined,
      source,
    };
  }, [useEmail, useInApp, target, ids, category, emailSubject, emailBody, inAppTitle, inAppBody, idempotencyKey, source]);

  /** 確認の「送信する」(Dialog が Promise の間 loading を出す) */
  const submit = useCallback(async () => {
    try {
      const res = await send(buildInput());
      setConfirmOpen(false);
      setFormOpen(false);
      setResult(res);
      showToast("送信を受け付けました", "success");
      onSent?.(res);
      onSuccess?.();
    } catch (error) {
      setConfirmOpen(false);
      showToast(err(error, "一括送信に失敗しました"), "error");
    }
  }, [send, buildInput, showToast, onSent, onSuccess]);

  const closeResult = useCallback(() => {
    setResult(null);
    reset();
  }, [reset]);

  return {
    formOpen,
    setOpen,
    confirmOpen,
    setConfirmOpen,
    result,
    closeResult,
    isValid,
    buildInput,
    submit,
    fields: {
      category,
      setCategory,
      categories,
      useEmail,
      setUseEmail,
      useInApp,
      setUseInApp,
      emailSubject,
      setEmailSubject,
      emailBody,
      setEmailBody,
      inAppTitle,
      setInAppTitle,
      inAppBody,
      setInAppBody,
    },
  };
}
