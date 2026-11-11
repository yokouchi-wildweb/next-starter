"use client";

// src/features/core/messaging/hooks/useAdminBulkSendForm.ts
//
// 管理の一括送信の書く欄・開閉・送信の流れ(部品 AdminBulkSendButton はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 開く: 二重送信を防ぐ鍵を 1 つ発行(同じフォームの再試行は同じ鍵。サーバーは同じ鍵の 2 回目を送らない)
// - 送る: { target, recordIds } + 経路 + 中身 + 種別を useAdminBulkSend へ。成功 = 結果を持ち、onSent → onSuccess

import { useCallback, useMemo, useState } from "react";

import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import type { AdminBulkSendInput, AdminBulkSendResult } from "../services/client/adminMessagingClient";

import { useAdminBulkSend } from "./useAdminBulkSend";

/** 種別(marketing = 受け取りの設定に従う / transactional = 設定で止めない業務の連絡) */
export type AdminBulkSendKind = "marketing" | "transactional";

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
  /** 既定 "marketing" */
  defaultKind?: AdminBulkSendKind;
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
  defaultKind = "marketing",
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

  const [kind, setKind] = useState<AdminBulkSendKind>(defaultKind);
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
    setKind(defaultKind);
    setUseEmail(defaultEmail);
    setUseInApp(defaultInApp);
    setEmailSubject(dSubject ?? "");
    setEmailBody(dBody ?? "");
    setInAppTitle(dTitle ?? "");
    setInAppBody(dInAppBody ?? "");
  }, [defaultKind, defaultEmail, defaultInApp, dSubject, dBody, dTitle, dInAppBody]);

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
    const channels: AdminBulkSendInput["channels"] = [];
    if (useEmail) channels.push("email");
    if (useInApp) channels.push("inApp");
    return {
      target,
      recordIds: ids,
      kind,
      channels,
      email: useEmail ? { subject: emailSubject.trim(), body: emailBody.trim() } : undefined,
      inApp: useInApp ? { title: inAppTitle.trim(), body: inAppBody.trim() } : undefined,
      idempotencyKey: idempotencyKey ?? undefined,
      source,
    };
  }, [useEmail, useInApp, target, ids, kind, emailSubject, emailBody, inAppTitle, inAppBody, idempotencyKey, source]);

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
      kind,
      setKind,
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
