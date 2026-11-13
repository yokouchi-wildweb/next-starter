"use client";

// src/features/core/messaging/hooks/useAdminSendComposer.ts
//
// 管理: 送る画面の書く欄と操作(部品 AdminMessageComposer はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 中身: 公開中のテンプレート(変数の値は回に 1 組)か、その場で書く(email・inApp)
// - 宛先: 全員・ロール・宛先の集め方(audiences の受け口)・選んだ利用者
// - カテゴリー: 選択肢 options.categories(種別 announcement・direct・marketing)を宛先の種類で絞る(その場で書く時は email・inApp の物だけ)。
//   選んだ物が絞りから外れたら最初の物(API と service も種別の性質 adminFreeText で同じ守り)
// - 予約: 今送る / 時刻(ISO、今より後で maxScheduleDays 日まで。粒度は cron の周期)
// - 操作: プレビュー・見込み・自分へのテスト送信・送る。二重送信を防ぐ鍵は画面を開いたときに 1 つ(送った後に作り直す)
// - 書きかけがある間は離れる前に確かめる(@/lib/unsavedGuard)

import { useCallback, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import {
  adminSendMessage,
  estimateAdminRecipients,
  previewAdminMessage,
  sendAdminTestMessage,
  type AdminSendEstimateInput,
  type AdminSendInput,
  type AdminSendOptions,
  type AdminSendPreviewInput,
  type AdminSendResult,
  type MessagePreview,
  type RecipientEstimate,
} from "../services/client/sendClient";

import { ADMIN_DISPATCHES_KEY } from "./adminMessagingKeys";
import { ADMIN_SEND_KEY } from "./sendKeys";

export type ComposerSource = "template" | "adhoc";
export type ComposerAudienceType = "all" | "role" | "audience" | "users";

type TemplateOption = AdminSendOptions["templates"][number];

/** 変数の値(入力は文字。数の型だけ数にする。空は送らない) */
export function templateVarsForInput(template: TemplateOption | null, values: Record<string, string>): Record<string, unknown> {
  if (!template) return {};
  const out: Record<string, unknown> = {};
  for (const variable of template.variables) {
    if (variable.source !== "dispatch") continue;
    const raw = values[variable.key];
    if (raw === undefined || raw.trim() === "") continue;
    out[variable.key] = variable.type === "number" && raw.trim() !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  }
  return out;
}

/** 予約の時刻の誤り(無ければ null)。now を受ける純粋な関数 */
export function scheduleErrorOf(mode: "now" | "at", scheduledAt: string, maxDays: number, now: number): string | null {
  if (mode !== "at") return null;
  if (!scheduledAt) return "予約の時刻を入れてください";
  const at = new Date(scheduledAt).getTime();
  if (Number.isNaN(at)) return "予約の時刻が正しくありません";
  if (at <= now) return "予約の時刻は今より後にしてください";
  if (at > now + maxDays * 24 * 60 * 60 * 1000) return `予約できるのは ${maxDays} 日先までです`;
  return null;
}

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function useAdminSendComposer(options: AdminSendOptions | null) {
  const [source, setSourceState] = useState<ComposerSource>(options && options.templates.length > 0 ? "template" : "adhoc");
  const [templateId, setTemplateIdState] = useState<string>("");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [inAppTitle, setInAppTitle] = useState("");
  const [inAppBody, setInAppBody] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [audienceType, setAudienceTypeState] = useState<ComposerAudienceType>("all");
  const [roles, setRoles] = useState<string[]>([]);
  const [audienceKey, setAudienceKey] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [chosenCategory, setCategory] = useState<string>("");
  const [scheduleMode, setScheduleModeState] = useState<"now" | "at">("now");
  const [scheduledAt, setScheduledAtState] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [preview, setPreview] = useState<MessagePreview | null>(null);
  const [sent, setSent] = useState<AdminSendResult | null>(null);

  const template = useMemo(
    () => options?.templates.find((item) => item.id === templateId) ?? null,
    [options, templateId],
  );

  const sendMutation = useDomainMutation<AdminSendResult, AdminSendInput>(
    ADMIN_SEND_KEY,
    (input) => adminSendMessage(input),
    ADMIN_DISPATCHES_KEY,
  );
  const testMutation = useDomainMutation<AdminSendResult, Parameters<typeof sendAdminTestMessage>[0]>(
    `${ADMIN_SEND_KEY}/test`,
    (input) => sendAdminTestMessage(input),
    ADMIN_DISPATCHES_KEY,
  );
  const previewMutation = useDomainMutation<MessagePreview, AdminSendPreviewInput>(`${ADMIN_SEND_KEY}/preview`, (input) =>
    previewAdminMessage(input),
  );
  const estimateMutation = useDomainMutation<RecipientEstimate, AdminSendEstimateInput>(`${ADMIN_SEND_KEY}/estimate`, (input) =>
    estimateAdminRecipients(input),
  );

  const setSource = useCallback((next: ComposerSource) => {
    setSourceState(next);
    setChannels([]);
    setPreview(null);
  }, []);
  const setTemplateId = useCallback(
    (id: string) => {
      setTemplateIdState(id);
      setVarValues({});
      setPreview(null);
      const picked = options?.templates.find((item) => item.id === id);
      setChannels(picked ? [...picked.channels] : []);
    },
    [options],
  );
  const setAudienceType = useCallback((next: ComposerAudienceType) => setAudienceTypeState(next), []);
  /** 今の宛先の種類と中身で選べるカテゴリー */
  const allowedCategories = useMemo(
    () =>
      (options?.categories ?? []).filter(
        (option) => option.audiences.includes(audienceType) && (source !== "adhoc" || option.adhoc),
      ),
    [options, audienceType, source],
  );
  const category = allowedCategories.some((option) => option.key === chosenCategory)
    ? chosenCategory
    : (allowedCategories[0]?.key ?? "");
  const toggleChannel = useCallback((channel: string, on: boolean) => {
    setChannels((prev) => (on ? (prev.includes(channel) ? prev : [...prev, channel]) : prev.filter((c) => c !== channel)));
    setPreview(null);
  }, []);

  /** 中身(プレビュー・テスト送信・送るで同じ) */
  const buildContent = useCallback((): AdminSendPreviewInput => {
    if (source === "template") {
      return {
        message: { type: "template", templateId, vars: templateVarsForInput(template, varValues) },
        channels: channels.length > 0 ? channels : undefined,
        category,
      };
    }
    return {
      message: {
        type: "adhoc",
        ...(channels.includes("email") ? { email: { subject: emailSubject.trim(), body: emailBody.trim() } } : {}),
        ...(channels.includes("inApp") ? { inApp: { title: inAppTitle.trim(), body: inAppBody.trim() } } : {}),
      },
      channels,
      category,
    };
  }, [source, templateId, template, varValues, channels, category, emailSubject, emailBody, inAppTitle, inAppBody]);

  const buildAudience = useCallback((): AdminSendInput["audience"] => {
    if (audienceType === "role") return { type: "role", roles };
    if (audienceType === "audience") return { type: "audience", key: audienceKey };
    if (audienceType === "users") return { type: "users", userIds };
    return { type: "all" };
  }, [audienceType, roles, audienceKey, userIds]);

  const buildInput = useCallback(
    (): AdminSendInput => ({
      ...buildContent(),
      audience: buildAudience(),
      ...(scheduleMode === "at" && scheduledAt ? { scheduledAt } : {}),
      idempotencyKey,
    }),
    [buildContent, buildAudience, scheduleMode, scheduledAt, idempotencyKey],
  );

  /** 予約の時刻の誤り(無ければ null)。時刻は今に依るので、描く時でなく入力の時に確かめる */
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const maxDays = options?.maxScheduleDays ?? 90;
  const setScheduleMode = useCallback(
    (mode: "now" | "at") => {
      setScheduleModeState(mode);
      setScheduleError(scheduleErrorOf(mode, scheduledAt, maxDays, Date.now()));
    },
    [scheduledAt, maxDays],
  );
  const setScheduledAt = useCallback(
    (at: string) => {
      setScheduledAtState(at);
      setScheduleError(scheduleErrorOf(scheduleMode, at, maxDays, Date.now()));
    },
    [scheduleMode, maxDays],
  );

  /** 中身の誤り(無ければ null。細かい検査はサーバー) */
  const contentError = useMemo(() => {
    if (source === "template") {
      if (!template) return "テンプレートを選んでください";
      const missing = template.variables.filter(
        (variable) => variable.source === "dispatch" && variable.required && variable.default === undefined && !varValues[variable.key]?.trim(),
      );
      if (missing.length > 0) return `変数 ${missing.map((v) => v.label || v.key).join("・")} を入れてください`;
      return null;
    }
    if (channels.length === 0) return "送る経路を選んでください";
    if (channels.includes("email") && (!emailSubject.trim() || !emailBody.trim())) return "メールの件名・本文を入れてください";
    if (channels.includes("inApp") && (!inAppTitle.trim() || !inAppBody.trim())) return "お知らせの題・本文を入れてください";
    return null;
  }, [source, template, varValues, channels, emailSubject, emailBody, inAppTitle, inAppBody]);

  const audienceError = useMemo(() => {
    if (audienceType === "role" && roles.length === 0) return "ロールを選んでください";
    if (audienceType === "audience" && !audienceKey) return "宛先の集め方を選んでください";
    if (audienceType === "users" && userIds.length === 0) return "利用者を選んでください";
    if (!category) return "この宛先に送れるカテゴリーがありません";
    return null;
  }, [audienceType, roles, audienceKey, userIds, category]);

  const dirty =
    sent === null &&
    (templateId !== "" ||
      [emailSubject, emailBody, inAppTitle, inAppBody, scheduledAt].some((v) => v.trim() !== "") ||
      Object.values(varValues).some((v) => v.trim() !== "") ||
      userIds.length > 0);
  useUnsavedGuard(dirty);

  /** プレビュー(投げた誤りは呼び手が出す) */
  const runPreview = useCallback(async () => {
    const result = await previewMutation.trigger(buildContent());
    setPreview(result);
    return result;
  }, [previewMutation, buildContent]);

  /** 宛先数の見込み */
  const runEstimate = useCallback(() => estimateMutation.trigger({ audience: buildAudience() }), [estimateMutation, buildAudience]);

  /** 自分へのテスト送信 */
  const sendTest = useCallback(
    () => testMutation.trigger({ ...buildContent(), idempotencyKey: newKey() }),
    [testMutation, buildContent],
  );

  /** 送る。成功したら結果を持ち、次の送信のために鍵を作り直す */
  const send = useCallback(async () => {
    const late = scheduleErrorOf(scheduleMode, scheduledAt, maxDays, Date.now());
    if (late) {
      setScheduleError(late);
      throw new Error(late);
    }
    const result = await sendMutation.trigger(buildInput());
    setSent(result);
    setIdempotencyKey(newKey());
    return result;
  }, [sendMutation, buildInput, scheduleMode, scheduledAt, maxDays]);

  /** 結果を閉じて、もう 1 通書く */
  const reset = useCallback(() => {
    setSent(null);
    setTemplateIdState("");
    setVarValues({});
    setEmailSubject("");
    setEmailBody("");
    setInAppTitle("");
    setInAppBody("");
    setChannels([]);
    setUserIds([]);
    setScheduleModeState("now");
    setScheduledAtState("");
    setScheduleError(null);
    setPreview(null);
  }, []);

  return {
    template,
    preview,
    sent,
    dirty,
    contentError,
    audienceError,
    scheduleError,
    /** 送れるか(誤りが無い) */
    canSend: !contentError && !audienceError && !scheduleError,
    /** 今の宛先の種類と中身で選べるカテゴリー */
    allowedCategories,
    buildContent,
    buildAudience,
    buildInput,
    runPreview,
    runEstimate,
    sendTest,
    send,
    reset,
    fields: {
      source,
      setSource,
      templateId,
      setTemplateId,
      varValues,
      setVarValue: (key: string, value: string) => setVarValues((prev) => ({ ...prev, [key]: value })),
      emailSubject,
      setEmailSubject,
      emailBody,
      setEmailBody,
      inAppTitle,
      setInAppTitle,
      inAppBody,
      setInAppBody,
      channels,
      toggleChannel,
      audienceType,
      setAudienceType,
      roles,
      setRoles,
      audienceKey,
      setAudienceKey,
      userIds,
      setUserIds,
      category,
      setCategory,
      scheduleMode,
      setScheduleMode,
      scheduledAt,
      setScheduledAt,
    },
  };
}
