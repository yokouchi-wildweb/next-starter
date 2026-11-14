"use client";

// src/features/core/messaging/hooks/useMessageSendModal.ts
//
// 管理: 送るモーダルの流れ(1 つの hook。入れ物 MessageSendModal はこれを呼んで部品を並べるだけ、CLAUDE.md core_ui)。
// 開き方(mode):
// - new: 回の一覧の「新しく送る」。POST /api/admin/messaging/send(門 messagingBroadcast の内側)
// - sameAs: 回の詳細の「同じ内容で送る」。その回の文面・カテゴリー・宛先の形を写す(本文を残さない回は件名・題だけ。
//   選んだ利用者に送った回は同じ利用者を選んだ形)。テンプレートの回はそのテンプレートを今の公開版で呼び出す(送るのは今の公開版だけ、
//   古い版は 409)。直して送った回は直した文言を写す。公開中でないテンプレートはその場で書く形にして sameAsNote で知らせる
// - bulk: 管理一覧の一括操作。宛先 = 選んだ記録(target + recordIds)、POST /api/admin/messaging/bulk-send(門の外)。予約は無い
// 流れ: テンプレートを呼び出す(門 messagingTemplates が開の時だけ)→ 文言が書く欄に写る → 直す → 宛先 → カテゴリー(宛先で選べる物、D80)
// → 経路の絞り(カテゴリーの経路の中、既定は全部オン)→ 文言の無い経路は空欄で見せ、送る前に止める(D85、サーバーの 400 と同じ線)
// → 予約(bulk 以外)→ プレビュー・自分へのテスト送信 → 見込み → 確認 → 送る → 結果。
// - 見込み → 確認の段・予約の検査・二重送信を防ぐ鍵(開くたびに 1 つ、送った後に作り直す)はこの hook の中
// - 書きかけ(dirty)の間: ページを離れる前に確かめる(@/lib/unsavedGuard)。閉じる前の確かめは closeConfirm を Modal の confirmOnClose に渡す
// - 初めの値(sameAs の写し・bulk の既定)は state に入れず、まだ触っていない欄は mode と選択肢から導く(effect で写さない)

import { useCallback, useMemo, useState } from "react";

import { useGate } from "@/featureGate/client";
import { useDomainMutation } from "@/lib/crud/hooks";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import {
  adminBulkSend,
  previewAdminBulkMessage,
  sendAdminBulkTestMessage,
  type AdminBulkSendInput,
  type AdminBulkSendResult,
  type AdminDispatchDetail,
  type AdminFreeTextCategoryOption,
} from "../services/client/adminMessagingClient";
import {
  adminSendMessage,
  estimateAdminRecipients,
  previewAdminMessage,
  sendAdminTestMessage,
  type AdminSendInput,
  type AdminSendOptions,
  type AdminSendPreviewInput,
  type AdminSendResult,
  type MessagePreview,
  type RecipientEstimate,
} from "../services/client/sendClient";

import { MESSAGE_CHANNEL_LABELS } from "../constants/channelLabels";

import { ADMIN_DISPATCHES_KEY, ADMIN_MESSAGING_KEY } from "./adminMessagingKeys";
import { ADMIN_SEND_KEY } from "./sendKeys";
import { useAdminBulkSendOptions } from "./useAdminBulkSend";
import { useAdminSendOptions } from "./useAdminSendOptions";

/** 一覧の一括操作の既定のカテゴリー(種別 direct、D81) */
export const ADMIN_BULK_SEND_DEFAULT_CATEGORY = "operatorDirect";

/** 書く欄の初期値(bulk) */
export type MessageSendDefaults = {
  emailSubject?: string;
  emailBody?: string;
  inAppTitle?: string;
  inAppBody?: string;
};

export type MessageSendMode =
  | { type: "new" }
  | { type: "sameAs"; dispatch: AdminDispatchDetail }
  | {
      type: "bulk";
      /** 受け口 bulkSendTargets の項目の鍵 */
      target: string;
      /** 選んだ記録の id */
      recordIds: string[];
      /** 記録の名詞(例: "振込レビュー") */
      recordNoun: string;
      defaults?: MessageSendDefaults;
      /** 既定のカテゴリー(既定 operatorDirect、選べなければ最初) */
      defaultCategory?: string;
      /** 送り元(省略 = サーバーが "<target>.bulk") */
      source?: string;
    };

export type MessageSendAudienceType = "all" | "role" | "audience" | "users";
export type MessageSendStep = "edit" | "confirm" | "done";
export type MessageSendTemplate = AdminSendOptions["templates"][number];

/** 書く中身: その場で書く(email・inApp の件名 / 題と本文)か、呼び出したテンプレートの文言(経路ごとの欄) */
export type MessageSendDraft = {
  source: "adhoc" | "template";
  /** 呼び出したテンプレート(source template の時) */
  template: { id: string; version: number } | null;
  /** 経路ごとの欄。adhoc = { email: { subject, body }, inApp: { title, body } } / template = 版の欄の写し */
  content: Record<string, Record<string, unknown>>;
  /** テンプレートの変数の値(回に 1 組、入力は文字) */
  vars: Record<string, string>;
};

export type MessageSendAudience = { type: MessageSendAudienceType; roles: string[]; audienceKey: string; userIds: string[] };

export type MessageSendResult =
  | { kind: "send"; result: AdminSendResult }
  | { kind: "bulk"; result: AdminBulkSendResult };

/** 送り先の経路 1 つ(カテゴリーの経路) */
export type MessageSendChannel = { key: string; label: string; on: boolean; blank: boolean };

/** その場で書く欄の今の部品が書ける経路(欄の作り直しは画面の指令。サーバーは全部の経路の文面を受ける) */
const ADHOC_CHANNELS = ["email", "inApp"];

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const str = (value: unknown) => (typeof value === "string" ? value : "");
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

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

/** 変数の値(入力は文字。数の型だけ数にする。空は送らない) */
export function templateVarsForInput(template: MessageSendTemplate | null, values: Record<string, string>): Record<string, unknown> {
  if (!template) return {};
  const out: Record<string, unknown> = {};
  for (const variable of template.variables) {
    if (variable.source !== "dispatch") continue;
    const raw = values[variable.key];
    if (raw === undefined || raw.trim() === "") continue;
    out[variable.key] = variable.type === "number" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  }
  return out;
}

/** 経路の欄が空か(送れない) */
export function isBlankChannel(draft: MessageSendDraft, channel: string): boolean {
  const fields = draft.content[channel];
  if (!fields) return true;
  if (draft.source === "adhoc") {
    if (channel === "email") return !str(fields.subject).trim() || !str(fields.body).trim();
    if (channel === "inApp") return !str(fields.title).trim() || !str(fields.body).trim();
    return true;
  }
  if (channel === "email") return !str(fields.subject).trim();
  if (channel === "inApp") return !str(fields.title).trim();
  if (channel === "line") return !str(fields.text).trim();
  return Object.keys(fields).length === 0;
}

/** その場で書く中身の空の欄 */
function emptyAdhoc(defaults: MessageSendDefaults = {}): MessageSendDraft {
  return {
    source: "adhoc",
    template: null,
    content: {
      email: { subject: defaults.emailSubject ?? "", body: defaults.emailBody ?? "" },
      inApp: { title: defaults.inAppTitle ?? "", body: defaults.inAppBody ?? "" },
    },
    vars: {},
  };
}

/** 回の本文の欄から文を取る(段落は空行で結ぶ) */
function textOf(fields: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = fields[name];
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value) && value.length > 0) return value.map(String).join("\n\n");
  }
  return "";
}

/** テンプレートを呼び出した中身(版の欄の写し) */
export function draftFromTemplate(template: MessageSendTemplate): MessageSendDraft {
  return {
    source: "template",
    template: { id: template.id, version: template.currentVersion },
    content: JSON.parse(JSON.stringify(template.content ?? {})) as Record<string, Record<string, unknown>>,
    vars: {},
  };
}

/** 写す文言(経路ごとの欄)をその場で書く欄(email 件名・本文 / inApp 題・本文)へ。件名・題は回の headings を先に見る */
function adhocFromContent(content: Record<string, unknown>, headings: Record<string, string | undefined> = {}): MessageSendDraft {
  const email = record(content.email);
  const inApp = record(content.inApp);
  return {
    source: "adhoc",
    template: null,
    content: {
      email: { subject: headings.email ?? textOf(email, "subject"), body: textOf(email, "body", "paragraphs") },
      inApp: { title: headings.inApp ?? textOf(inApp, "title"), body: textOf(inApp, "body") },
    },
    vars: {},
  };
}

/**
 * mode から導く初めの中身(sameAs の写し・bulk の既定)。sameAs:
 * - テンプレートの回で、そのテンプレートが今も公開中: 呼び出しの形。直して送った回(templateEdited)は直した文言、ほかは今の版の文言
 *   (送る口は今の公開中の版だけを受けるので、版はいつも今の版。直した文言はサーバーがその版に対する template_edited として残す)
 * - 公開中でない(取り下げ・門 messagingTemplates が閉): その場で書く形。直した文言があればそれを、無ければ回の本文を欄へ写す
 * - その場で書いた回: 回の本文(記録の段が vars / full の時だけ DTO に載る)。無ければ件名・題だけ写し、本文は空(書くまで送れない)
 */
export function initialDraftOf(mode: MessageSendMode, templates: readonly MessageSendTemplate[]): MessageSendDraft {
  if (mode.type === "bulk") return emptyAdhoc(mode.defaults);
  if (mode.type === "new") return emptyAdhoc();
  const { dispatch } = mode;
  // 書いて送った文面(テンプレートの回は版から直した時だけ写す。ほかは今の版の文面)
  const edited = dispatch.content && (!dispatch.templateId || dispatch.templateEdited) ? dispatch.content : null;
  if (!dispatch.templateId && edited) return adhocFromContent(edited, dispatch.headings);
  if (dispatch.templateId) {
    const template = templates.find((item) => item.id === dispatch.templateId);
    if (template) {
      const called = draftFromTemplate(template);
      return edited ? { ...called, content: JSON.parse(JSON.stringify(edited)) as MessageSendDraft["content"] } : called;
    }
    if (edited) return adhocFromContent(edited);
  }
  const body = record(dispatch.body);
  const email = record(body.email);
  const inApp = record(body.inApp);
  return {
    source: "adhoc",
    template: null,
    content: {
      email: { subject: dispatch.headings.email ?? textOf(email, "subject"), body: textOf(email, "body", "paragraphs") },
      inApp: { title: dispatch.headings.inApp ?? textOf(inApp, "title"), body: textOf(inApp, "body") },
    },
    vars: {},
  };
}

/**
 * sameAs でテンプレートを呼び出しの形にできない時の知らせ(テンプレートの回で、そのテンプレートが公開中の選択肢に無い)。
 * 写した文言が書く欄に入らなかった時(メール・お知らせの欄が空)はそれも言う。ほかは null
 */
export function sameAsNoteOf(mode: MessageSendMode, templates: readonly MessageSendTemplate[], draft: MessageSendDraft): string | null {
  if (mode.type !== "sameAs" || !mode.dispatch.templateId) return null;
  if (templates.some((item) => item.id === mode.dispatch.templateId)) return null;
  const copied = ADHOC_CHANNELS.some((channel) => Object.values(record(draft.content[channel])).some((v) => str(v).trim() !== ""));
  return copied
    ? "この回のテンプレートは今は公開されていないため、文言をその場で書く欄へ写しました"
    : "この回のテンプレートは今は公開されていないため、その場で書く欄で書き直してください(写せる文言がありませんでした)";
}

/** mode から導く初めの宛先(sameAs = 回の宛先の形。選んだ利用者に送った回は同じ利用者を選んだ形) */
export function initialAudienceOf(mode: MessageSendMode): MessageSendAudience {
  const blank: MessageSendAudience = { type: "all", roles: [], audienceKey: "", userIds: [] };
  if (mode.type !== "sameAs") return blank;
  const audience = record(mode.dispatch.audience);
  if (audience.type === "role" && Array.isArray(audience.roles)) return { ...blank, type: "role", roles: audience.roles.map(String) };
  if (audience.type === "audience" && typeof audience.key === "string") return { ...blank, type: "audience", audienceKey: audience.key };
  if (audience.type === "all") return blank;
  // 全員・ロール・集め方でない回(選んだ利用者・一覧の一括)= 選んだ利用者の形。利用者 id は回の詳細が返す時だけ写す(多すぎる回は選び直し)
  return { ...blank, type: "users", userIds: [...(mode.dispatch.audienceUserIds ?? [])] };
}

export type UseMessageSendModalOptions = {
  mode: MessageSendMode;
  /** 送った後(結果を出した時)に呼ぶ。一括操作なら選択の解除と一覧の取り直し */
  onSent?: (result: MessageSendResult) => void;
};

export function useMessageSendModal({ mode, onSent }: UseMessageSendModalOptions) {
  const gate = useGate();
  const isBulk = mode.type === "bulk";
  const [open, setOpenState] = useState(false);
  const [step, setStep] = useState<MessageSendStep>("edit");
  const [draftState, setDraftState] = useState<MessageSendDraft | null>(null);
  const [audienceState, setAudienceState] = useState<MessageSendAudience | null>(null);
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);
  const [channelsOff, setChannelsOff] = useState<string[]>([]);
  const [scheduleMode, setScheduleModeState] = useState<"now" | "at">("now");
  const [scheduledAt, setScheduledAtState] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [preview, setPreview] = useState<MessagePreview | null>(null);
  const [estimate, setEstimate] = useState<RecipientEstimate | null>(null);
  const [result, setResult] = useState<MessageSendResult | null>(null);

  // 選択肢: bulk = GET bulk-send(門の外)、それ以外 = GET send/options(門 messagingBroadcast)。開いている間だけ取る
  const sendOptions = useAdminSendOptions(open && !isBulk);
  const bulkOptions = useAdminBulkSendOptions(open && isBulk);
  const optionsLoaded = isBulk ? bulkOptions.options !== null : sendOptions.options !== null;
  const optionsError = isBulk ? bulkOptions.error : sendOptions.error;

  const templatesOpen = gate.enabled("messagingTemplates");
  const templates: MessageSendTemplate[] = useMemo(() => {
    if (!templatesOpen) return [];
    return (isBulk ? bulkOptions.options?.templates : sendOptions.options?.templates) ?? [];
  }, [templatesOpen, isBulk, bulkOptions.options, sendOptions.options]);
  const allCategories: AdminFreeTextCategoryOption[] = useMemo(
    () => (isBulk ? bulkOptions.options?.categories : sendOptions.options?.categories) ?? [],
    [isBulk, bulkOptions.options, sendOptions.options],
  );
  // 経路の表示名 = 選択肢の経路(受け口の label、送る・一括送信で同じ)。取れる前は constants の控え
  const channelLabels = useMemo(() => {
    const labels: Record<string, string> = { ...MESSAGE_CHANNEL_LABELS };
    for (const channel of (isBulk ? bulkOptions.options?.channels : sendOptions.options?.channels) ?? []) labels[channel.key] = channel.label;
    return labels;
  }, [isBulk, bulkOptions.options, sendOptions.options]);
  const maxDays = sendOptions.options?.maxScheduleDays ?? 90;

  const initialDraft = useMemo(() => initialDraftOf(mode, templates), [mode, templates]);
  const draft = draftState ?? initialDraft;
  const sameAsNote = useMemo(
    () => (optionsLoaded ? sameAsNoteOf(mode, templates, initialDraft) : null),
    [optionsLoaded, mode, templates, initialDraft],
  );
  const initialAudience = useMemo(() => initialAudienceOf(mode), [mode]);
  const audience = audienceState ?? initialAudience;
  const calledTemplate = useMemo(
    () => (draft.template ? (templates.find((item) => item.id === draft.template!.id) ?? null) : null),
    [draft.template, templates],
  );

  /** 宛先の種類と中身で選べるカテゴリー(D80) */
  const allowedCategories = useMemo(
    () =>
      allCategories.filter(
        (option) =>
          option.audiences.includes(isBulk ? "bulk" : audience.type) &&
          (draft.source !== "adhoc" || option.channels.every((key) => ADHOC_CHANNELS.includes(key))),
      ),
    [allCategories, isBulk, audience.type, draft.source],
  );
  const preferredCategory =
    chosenCategory ??
    (mode.type === "sameAs" ? mode.dispatch.category : mode.type === "bulk" ? (mode.defaultCategory ?? ADMIN_BULK_SEND_DEFAULT_CATEGORY) : null);
  const category = allowedCategories.some((option) => option.key === preferredCategory)
    ? (preferredCategory as string)
    : (allowedCategories[0]?.key ?? "");
  const categoryOption = allowedCategories.find((option) => option.key === category) ?? null;
  /** 選んだカテゴリーの経路(その場で書く時は email・inApp だけ) */
  const categoryChannels = useMemo(
    () => (categoryOption?.channels ?? []).filter((key) => draft.source !== "adhoc" || ADHOC_CHANNELS.includes(key)),
    [categoryOption, draft.source],
  );
  /** 送る経路 = カテゴリーの経路 − 外した経路(既定は全部オン) */
  const sendChannels = useMemo(() => categoryChannels.filter((key) => !channelsOff.includes(key)), [categoryChannels, channelsOff]);
  const channels: MessageSendChannel[] = useMemo(
    () =>
      categoryChannels.map((key) => ({
        key,
        label: channelLabels[key] ?? key,
        on: !channelsOff.includes(key),
        blank: isBlankChannel(draft, key),
      })),
    [categoryChannels, channelLabels, channelsOff, draft],
  );

  // ---- 欄の操作 ----
  const editDraft = useCallback((next: (current: MessageSendDraft) => MessageSendDraft) => {
    setDraftState((prev) => next(prev ?? initialDraft));
    setPreview(null);
  }, [initialDraft]);
  const setChannelFields = useCallback(
    (channel: string, fields: Record<string, unknown>) => editDraft((current) => ({ ...current, content: { ...current.content, [channel]: fields } })),
    [editDraft],
  );
  const setVar = useCallback(
    (key: string, value: string) => editDraft((current) => ({ ...current, vars: { ...current.vars, [key]: value } })),
    [editDraft],
  );
  /** テンプレートを呼び出す(文言を書く欄に写す。前に書いた物は置き換わる) */
  const callTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;
      setDraftState(draftFromTemplate(template));
      setChannelsOff([]);
      setPreview(null);
    },
    [templates],
  );
  /** 呼び出しをやめて、その場で書く */
  const clearTemplate = useCallback(() => {
    setDraftState(emptyAdhoc(mode.type === "bulk" ? mode.defaults : undefined));
    setChannelsOff([]);
    setPreview(null);
  }, [mode]);
  const setAudience = useCallback(
    (patch: Partial<MessageSendAudience>) => setAudienceState((prev) => ({ ...(prev ?? initialAudience), ...patch })),
    [initialAudience],
  );
  const setCategory = useCallback((key: string) => {
    setChosenCategory(key);
    setChannelsOff([]);
    setPreview(null);
  }, []);
  const toggleChannel = useCallback((channel: string, on: boolean) => {
    setChannelsOff((prev) => (on ? prev.filter((key) => key !== channel) : prev.includes(channel) ? prev : [...prev, channel]));
    setPreview(null);
  }, []);
  const setScheduleMode = useCallback(
    (next: "now" | "at") => {
      setScheduleModeState(next);
      setScheduleError(scheduleErrorOf(next, scheduledAt, maxDays, Date.now()));
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

  // ---- 入力を組む ----
  const buildContent = useCallback((): AdminSendPreviewInput => {
    if (draft.source === "template" && draft.template) {
      return {
        content: draft.content,
        template: { templateId: draft.template.id, version: draft.template.version },
        vars: templateVarsForInput(calledTemplate, draft.vars),
        category,
        channels: sendChannels,
      };
    }
    // その場で書く欄(件名 / 題と本文)を経路の欄の形へ(メールの本文は段落 1 つ、改行はそのまま)
    const email = draft.content.email ?? {};
    const inApp = draft.content.inApp ?? {};
    return {
      content: {
        ...(sendChannels.includes("email") ? { email: { subject: str(email.subject).trim(), paragraphs: [str(email.body).trim()] } } : {}),
        ...(sendChannels.includes("inApp") ? { inApp: { title: str(inApp.title).trim(), body: str(inApp.body).trim() } } : {}),
      },
      category,
      channels: sendChannels,
    };
  }, [draft, calledTemplate, category, sendChannels]);

  const buildAudience = useCallback((): AdminSendInput["audience"] => {
    if (audience.type === "role") return { type: "role", roles: audience.roles };
    if (audience.type === "audience") return { type: "audience", key: audience.audienceKey };
    if (audience.type === "users") return { type: "users", userIds: audience.userIds };
    return { type: "all" };
  }, [audience]);

  const buildSendInput = useCallback(
    (): AdminSendInput => ({
      ...buildContent(),
      audience: buildAudience(),
      ...(scheduleMode === "at" && scheduledAt ? { scheduledAt } : {}),
      idempotencyKey,
    }),
    [buildContent, buildAudience, scheduleMode, scheduledAt, idempotencyKey],
  );

  const buildBulkInput = useCallback((): AdminBulkSendInput => {
    if (mode.type !== "bulk") throw new Error("bulk の時だけ");
    return {
      target: mode.target,
      recordIds: mode.recordIds,
      ...buildContent(),
      idempotencyKey,
      ...(mode.source ? { source: mode.source } : {}),
    };
  }, [mode, buildContent, idempotencyKey]);

  // ---- 誤り ----
  const contentError = useMemo(() => {
    if (draft.source === "template") {
      const missing = (calledTemplate?.variables ?? []).filter(
        (variable) => variable.source === "dispatch" && variable.required && variable.default === undefined && !draft.vars[variable.key]?.trim(),
      );
      if (missing.length > 0) return `変数 ${missing.map((v) => v.label || v.key).join("・")} を入れてください`;
    }
    if (sendChannels.length === 0) return "送る経路を選んでください(カテゴリーの経路の中から)";
    const blank = sendChannels.filter((key) => isBlankChannel(draft, key));
    if (blank.length > 0) return `経路 ${blank.map((key) => channelLabels[key] ?? key).join("・")} の文言がありません(書くか経路を外してください)`;
    return null;
  }, [draft, calledTemplate, sendChannels, channelLabels]);

  const audienceError = useMemo(() => {
    if (!isBulk) {
      if (audience.type === "role" && audience.roles.length === 0) return "ロールを選んでください";
      if (audience.type === "audience" && !audience.audienceKey) return "宛先の集め方を選んでください";
      if (audience.type === "users" && audience.userIds.length === 0) return "利用者を選んでください";
    } else if (mode.recordIds.length === 0) {
      return "記録を選んでください";
    }
    if (!category) return "この宛先に送れるカテゴリーがありません";
    return null;
  }, [isBulk, audience, mode, category]);

  const canSend = optionsLoaded && !contentError && !audienceError && !scheduleError;
  const dirty =
    open && step !== "done" && (draftState !== null || audienceState !== null || chosenCategory !== null || channelsOff.length > 0 || scheduledAt !== "");
  useUnsavedGuard(dirty);

  // ---- 操作 ----
  const revalidateKeys = [ADMIN_DISPATCHES_KEY];
  const previewMutation = useDomainMutation<MessagePreview, AdminSendPreviewInput>(`${ADMIN_SEND_KEY}/modal/preview`, (input) =>
    isBulk ? previewAdminBulkMessage(input) : previewAdminMessage(input),
  );
  const testMutation = useDomainMutation<AdminSendResult, AdminSendPreviewInput & { idempotencyKey: string }>(
    `${ADMIN_SEND_KEY}/modal/test`,
    (input) => (isBulk ? sendAdminBulkTestMessage(input) : sendAdminTestMessage(input)),
    revalidateKeys,
  );
  const estimateMutation = useDomainMutation<RecipientEstimate, { audience: AdminSendInput["audience"] }>(
    `${ADMIN_SEND_KEY}/modal/estimate`,
    (input) => estimateAdminRecipients(input),
  );
  const sendMutation = useDomainMutation<AdminSendResult, AdminSendInput>(`${ADMIN_SEND_KEY}/modal/send`, (input) => adminSendMessage(input), revalidateKeys);
  const bulkMutation = useDomainMutation<AdminBulkSendResult, AdminBulkSendInput>(
    `${ADMIN_MESSAGING_KEY}/bulk-send/modal`,
    (input) => adminBulkSend(input),
    revalidateKeys,
  );

  /** プレビュー(投げた誤りは呼び手が出す) */
  const runPreview = useCallback(async () => {
    const next = await previewMutation.trigger(buildContent());
    setPreview(next);
    return next;
  }, [previewMutation, buildContent]);

  /** 自分へのテスト送信(毎回新しい鍵) */
  const sendTest = useCallback(() => testMutation.trigger({ ...buildContent(), idempotencyKey: newKey() }), [testMutation, buildContent]);

  /** 確認へ進む: 予約を確かめ直し、見込みを取る(bulk は選んだ記録の数) */
  const requestConfirm = useCallback(async () => {
    if (!isBulk) {
      const late = scheduleErrorOf(scheduleMode, scheduledAt, maxDays, Date.now());
      setScheduleError(late);
      if (late) throw new Error(late);
      setEstimate(await estimateMutation.trigger({ audience: buildAudience() }));
    }
    setStep("confirm");
  }, [isBulk, scheduleMode, scheduledAt, maxDays, estimateMutation, buildAudience]);

  /** 確認から書く欄へ戻る */
  const backToEdit = useCallback(() => setStep("edit"), []);

  /** 送る(確認の段から)。成功 = 結果の段、鍵を作り直し、onSent */
  const confirmSend = useCallback(async () => {
    let sent: MessageSendResult;
    if (isBulk) {
      sent = { kind: "bulk", result: await bulkMutation.trigger(buildBulkInput()) };
    } else {
      const late = scheduleErrorOf(scheduleMode, scheduledAt, maxDays, Date.now());
      if (late) {
        setScheduleError(late);
        setStep("edit");
        throw new Error(late);
      }
      sent = { kind: "send", result: await sendMutation.trigger(buildSendInput()) };
    }
    setResult(sent);
    setStep("done");
    setIdempotencyKey(newKey());
    onSent?.(sent);
    return sent;
  }, [isBulk, bulkMutation, buildBulkInput, scheduleMode, scheduledAt, maxDays, sendMutation, buildSendInput, onSent]);

  const reset = useCallback(() => {
    setStep("edit");
    setDraftState(null);
    setAudienceState(null);
    setChosenCategory(null);
    setChannelsOff([]);
    setScheduleModeState("now");
    setScheduledAtState("");
    setScheduleError(null);
    setPreview(null);
    setEstimate(null);
    setResult(null);
  }, []);

  /** 開く・閉じる(閉じたら全部を初めに戻す。書きかけの確かめは Modal の confirmOnClose) */
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (next) setIdempotencyKey(newKey());
      else reset();
    },
    [reset],
  );

  return {
    mode,
    open,
    setOpen,
    step,
    optionsLoaded,
    /** sameAs でテンプレートを呼び出しの形にできなかった時の知らせ(書く段の上に出す) */
    sameAsNote,
    optionsError,
    /** 書きかけ(閉じる・離れる前に確かめる) */
    dirty,
    /** Modal の confirmOnClose に渡す */
    closeConfirm: { enabled: dirty, message: "書きかけの連絡は送っていません。閉じてもよろしいですか？" },
    /** テンプレートを呼び出せるか(門 messagingTemplates が開で公開中のテンプレートがある) */
    templatesAvailable: templates.length > 0,
    templates,
    calledTemplate,
    draft,
    audience,
    roles: sendOptions.options?.roles ?? [],
    audiences: sendOptions.options?.audiences ?? [],
    allowedCategories,
    category,
    channels,
    sendChannels,
    showSchedule: !isBulk,
    scheduleMode,
    scheduledAt,
    scheduleError,
    scheduleNote: `予約の粒度は cron の周期です(Vercel Hobby では 1 日 1 回なので、時刻より遅れて送られます)。${maxDays} 日先まで予約できます。`,
    contentError,
    audienceError,
    canSend,
    preview,
    estimate,
    result,
    isPreviewing: previewMutation.isMutating,
    isTesting: testMutation.isMutating,
    isSending: sendMutation.isMutating || bulkMutation.isMutating,
    buildContent,
    buildSendInput,
    buildBulkInput,
    callTemplate,
    clearTemplate,
    setChannelFields,
    setVar,
    setAudience,
    setCategory,
    toggleChannel,
    setScheduleMode,
    setScheduledAt,
    runPreview,
    sendTest,
    requestConfirm,
    backToEdit,
    confirmSend,
    reset,
  };
}

export type MessageSendModalState = ReturnType<typeof useMessageSendModal>;
