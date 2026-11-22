"use client";

// src/features/core/messaging/hooks/useMessageSendModal.ts
//
// 管理: 送るモーダルの流れ(1 つの hook。入れ物 MessageSendModal はこれを呼んで部品を並べるだけ、CLAUDE.md core_ui)。
// 開き方(mode):
// - new: 送信の一覧の「新規送信」。POST /api/admin/messaging/send(門 messagingBroadcast の内側)。initialRecipients(利用者 id)を渡すと
//   宛先が「選んだ利用者」のその人たちから始まる(管理者が変えられる。利用者の詳細などの入口、D177)。/send を通るので呼び手は門 messagingBroadcast で包む
// - sameAs: 送信の詳細の「同じ内容で送る」。送信のカテゴリー(→ 種別)・送信チャンネル・宛先の形と、送信の中身(レイアウト + values、D128)を写す。
//   テンプレートの送信でそのテンプレートが今も公開中 = 今の版を読み込んだ形(直して送信した物は直した文で、文面を直す状態から。専用の埋め込み情報の値も写す)。
//   公開中でない・レイアウトから書いた送信 = 送信のレイアウトに送信の values を入れた形(管理画面で選べないレイアウトなら写せない = sameAsNote)
// - bulk: 管理一覧の一括操作。宛先 = 選んだ記録(target + recordIds)、POST /api/admin/messaging/bulk-send(門の外)。予約は無い
// 流れ(D110 D115): 種別 → カテゴリー(種別に 2 つ以上ある時だけ選ぶ)→ 宛先(種別が許す種類だけ。direct はグループも、D109)
// → レイアウト(初めは選択肢の initialLayout。選べるのは管理画面で選べて無効でない物。替えると欄の中身は白紙、D171 D195)
// → テンプレート(任意の読み込みの道具。その種別の公開中の物、使えないレイアウトの物はサーバーが出さない)→ 文面(useSendTemplateText: 読み込んだ直後は固定、
// 『文面を直す』で全文、『テンプレートの読み込みを解除』でそのテンプレートのレイアウト(選べなければ初めのレイアウト)へ、『テンプレートを更新』で新しい版、D118 D119 D120)
// → 送信チャンネルの絞り(カテゴリーの送信チャンネルの中、既定は全部オン)→ 予約(bulk 以外)→ プレビュー(レイアウトの描き方 useLayoutPreview がいつも、
// 「プレビュー」= あなた宛ての表示例を送る口で描く)・自分へのテスト送信 → 見込み → 確認 → 送る → 結果。
// - 送る口の入力 = { category, channels?, origin: { layout } | { id, version }, values, edited?, vars? }(services/server/admin/send.ts)
// - 見込み → 確認の段・予約の検査・二重送信を防ぐ鍵(開くたびに 1 つ、送った後に作り直す)はこの hook の中
// - 書きかけ(dirty)の間: ページを離れる前に確かめる(@/lib/unsavedGuard)。閉じる前の確かめは closeConfirm を Modal の confirmOnClose に渡す
// - 初めの値(sameAs の写し・bulk の既定)は state に入れず、まだ触っていない物は mode と選択肢から導く(effect で写さない)

import { useCallback, useMemo, useState } from "react";

import { useGate } from "@/featureGate/client";
import { useDomainMutation } from "@/lib/crud";
import type { MessageVarEntry } from "@/lib/messaging";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import { MESSAGE_CHANNEL_LABELS } from "../constants/channelLabels";
import { MESSAGE_KIND_LABELS } from "../constants/kindLabels";
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
  type AdminSendLayoutOption,
  type AdminSendOptions,
  type AdminSendPreviewInput,
  type AdminSendResult,
  type MessagePreview,
  type RecipientEstimate,
} from "../services/client/sendClient";

import { ADMIN_DISPATCHES_KEY, ADMIN_MESSAGING_KEY } from "./adminMessagingKeys";
import { ADMIN_SEND_KEY } from "./sendKeys";
import { useAdminBulkSendOptions } from "./useAdminBulkSend";
import { useAdminSendOptions } from "./useAdminSendOptions";
import { useLayoutPreview } from "./useLayoutPreview";
import { layoutTextState, varPreviewValues, templateTextState, useSendTemplateText, type SendTextState } from "./useSendTemplateText";

/** 一覧の一括操作の既定のカテゴリー(種別 direct、D81) */
export const ADMIN_BULK_SEND_DEFAULT_CATEGORY = "operatorDirect";

/** 書く欄の初期値(bulk)。values = 種別の白紙のレイアウトの欄の中身に重ねる値(例 汎用のお知らせ { title, body }) */
export type MessageSendDefaults = {
  values?: Record<string, unknown>;
};

export type MessageSendMode =
  | {
      type: "new";
      /** 初めの宛先(利用者 id)。あれば宛先は「選んだ利用者」のこの人たちから始まる(管理者が変えられる)。/send を通るので呼び手は門 messagingBroadcast で包む */
      initialRecipients?: readonly string[];
    }
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
      /** 既定のカテゴリー(既定 operatorDirect、選べなければ最初。種別もこのカテゴリーの物から) */
      defaultCategory?: string;
      /** 送り元(省略 = サーバーが "<target>.bulk") */
      source?: string;
    };

export type MessageSendTargetType = "all" | "role" | "group" | "users";
export type MessageSendStep = "edit" | "confirm" | "done";
export type MessageSendTemplate = AdminSendOptions["templates"][number];

/** 宛先(group = ユーザーグループ。groupId は値としてだけ持ち、画面には名前を出す、D94) */
export type MessageSendTarget = { type: MessageSendTargetType; roles: string[]; groupId: string; userIds: string[] };

export type MessageSendResult =
  | { kind: "send"; result: AdminSendResult }
  | { kind: "bulk"; result: AdminBulkSendResult };

const TARGET_TYPES: readonly MessageSendTargetType[] = ["all", "role", "group", "users"];

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** 予約の時刻の誤り(無ければ null)。now を受ける純粋な関数 */
export function scheduleErrorOf(mode: "now" | "at", scheduledAt: string, maxDays: number, now: number): string | null {
  if (mode !== "at") return null;
  if (!scheduledAt) return "予約日時を入力してください";
  const at = new Date(scheduledAt).getTime();
  if (Number.isNaN(at)) return "予約日時が正しくありません";
  if (at <= now) return "予約日時は現在より後にしてください";
  if (at > now + maxDays * 24 * 60 * 60 * 1000) return `予約できるのは ${maxDays} 日先までです`;
  return null;
}

/** 選択肢のカテゴリーに出る種別(受け口の順、重なりなし) */
export function kindsOf(categories: readonly AdminFreeTextCategoryOption[]): string[] {
  return [...new Set(categories.map((option) => option.kind))];
}

/** mode から導く初めのカテゴリー(sameAs = 送信のカテゴリー、bulk = 既定のカテゴリー) */
function preferredCategoryOf(mode: MessageSendMode): string | null {
  if (mode.type === "sameAs") return mode.dispatch.category;
  if (mode.type === "bulk") return mode.defaultCategory ?? ADMIN_BULK_SEND_DEFAULT_CATEGORY;
  return null;
}

/**
 * 初めのレイアウト = 選択肢の initialLayout(config の messaging.initialLayout)の管理画面で選べるレイアウト。選択肢に無ければ null
 * (ほかのレイアウトに替えない。管理画面で選べる使えるレイアウトであることはサーバーの連絡の一覧の検査が見る)
 */
export function blankLayoutOf(layouts: readonly AdminSendLayoutOption[], initialLayout: string | null): { key: string; label: string } | null {
  const found = layouts.find((option) => option.selectable && option.key === initialLayout);
  return found ? { key: found.key, label: found.label } : null;
}

/** 送信の埋め込み情報の値のうちテンプレートの今の版が宣言する鍵だけ */
function varsOfDispatch(sameAs: NonNullable<AdminDispatchDetail["sameAs"]>, template: MessageSendTemplate): Record<string, string> {
  const values = sameAs.vars;
  return Object.fromEntries(template.vars.filter((item) => values[item.key] !== undefined).map((item) => [item.key, String(values[item.key])]));
}

/**
 * mode と選択肢から導く初めの文面(まだ触っていない時)。sameAs:
 * - テンプレートの送信で、そのテンプレートが今も公開中: 今の版を読み込んだ形。直して送信した物は送信の values で文面を直す状態から(レイアウトが今の版と同じ時)
 * - それ以外: 送信のレイアウトが管理画面で選べる物なら、そのレイアウトに送信の values を入れる。選べなければ初めのレイアウト(白紙)
 */
export function initialTextOf(
  mode: MessageSendMode,
  kind: string,
  layouts: readonly AdminSendLayoutOption[],
  initialLayout: string | null,
  categories: readonly AdminFreeTextCategoryOption[],
  templates: readonly MessageSendTemplate[],
): SendTextState | null {
  const blank = blankLayoutOf(layouts, initialLayout);
  const blankState = blank ? layoutTextState(blank) : null;
  if (mode.type === "bulk") {
    return blankState ? { ...blankState, start: { ...blankState.start, ...(mode.defaults?.values ?? {}) } } : null;
  }
  if (mode.type === "new") return blankState;
  // 写すのはサーバーが答えた自由連絡の写しだけ(定義連絡の送信は null = 白紙、D193)
  const same = mode.dispatch.sameAs;
  if (!same) return blankState;
  const templateId = same.template?.id ?? null;
  if (templateId) {
    // 今の種別のテンプレートだけ(種別を選び直した後は白紙から)
    const template = templates.find(
      (item) => item.id === templateId && categories.find((option) => option.key === item.category)?.kind === kind,
    );
    if (template) {
      const copyEdited = same.template!.edited && same.layout === template.layout;
      return templateTextState(template, {
        ...(copyEdited ? { start: same.values, unlocked: true } : {}),
        vars: varsOfDispatch(same, template),
      });
    }
  }
  const sameLayout = layouts.find((option) => option.selectable && option.key === same.layout);
  if (sameLayout) return layoutTextState(sameLayout, same.values);
  return blankState;
}

/** sameAs で送信の文面をそのまま写せなかった時の知らせ(ほかは null) */
export function sameAsNoteOf(
  mode: MessageSendMode,
  text: SendTextState | null,
  templates: readonly MessageSendTemplate[],
): string | null {
  if (mode.type !== "sameAs") return null;
  const same = mode.dispatch.sameAs;
  const templateId = same?.template?.id ?? null;
  const templateGone = templateId !== null && !templates.some((item) => item.id === templateId);
  const copied = text !== null && same !== null && same.layout === text.layout;
  if (templateGone) {
    return copied
      ? "元の送信のテンプレートは現在公開されていないため、内容を白紙のテンプレートにコピーしました"
      : "元の送信のテンプレートは現在公開されていないため、内容を入力し直してください(コピーできる内容がありませんでした)";
  }
  if (templateId === null && !copied) return "元の送信の内容はこの画面の形と違うためコピーできませんでした。内容を入力し直してください";
  return null;
}

/**
 * mode から導く初めの宛先(new + initialRecipients = その利用者を選んだ形。sameAs = 送信の宛先の形: グループ宛ての送信は同じグループ、
 * 選んだ利用者への送信は同じ利用者を選んだ形)
 */
export function initialTargetOf(mode: MessageSendMode): MessageSendTarget {
  const blank: MessageSendTarget = { type: "all", roles: [], groupId: "", userIds: [] };
  if (mode.type === "new") {
    const userIds = [...new Set(mode.initialRecipients ?? [])];
    return userIds.length > 0 ? { ...blank, type: "users", userIds } : blank;
  }
  if (mode.type !== "sameAs") return blank;
  if (mode.dispatch.targetGroup) return { ...blank, type: "group", groupId: mode.dispatch.targetGroup.id };
  const target = record(mode.dispatch.target);
  if (target.type === "role" && Array.isArray(target.roles)) return { ...blank, type: "role", roles: target.roles.map(String) };
  if (target.type === "all") return blank;
  // 全員・ロール・グループでない送信(選んだ利用者・一覧の一括)= 選んだ利用者の形。利用者 id は送信の詳細が返す時だけ写す(多すぎる送信は選び直し)
  return { ...blank, type: "users", userIds: [...(mode.dispatch.targetUserIds ?? [])] };
}

/** 見込みが人数の上限を超えた時の理由(確認の段に出し、送るを止める) */
export function overLimitText(estimate: Pick<RecipientEstimate, "count" | "memberLimit">): string {
  return `宛先数 ${estimate.count.toLocaleString("ja-JP")} 人が上限 ${(estimate.memberLimit ?? 0).toLocaleString("ja-JP")} 人を超えているため送信できません`;
}

/** 元の送信のグループが今は選べない時の知らせ(全員に広げない、D64) */
export const TARGET_GROUP_GONE_NOTE = "元の送信のグループは現在選べません(アーカイブされたか、ユーザーグループ機能が無効です)。宛先を選び直してください";

const NO_LAYOUTS: AdminSendLayoutOption[] = [];

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
  const [kindState, setKindState] = useState<string | null>(null);
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);
  const [targetState, setTargetState] = useState<MessageSendTarget | null>(null);
  /** 文面を手で触ったか(書きかけの印と、読み込みの上書きの確かめ) */
  const [textTouched, setTextTouched] = useState(false);
  /** 上書きを確かめている読み込み(テンプレートの id) */
  const [pendingLoad, setPendingLoad] = useState<string | null>(null);
  /** 書きかけを消すのを確かめているレイアウトの切り替え(レイアウトの鍵) */
  const [pendingLayout, setPendingLayout] = useState<string | null>(null);
  /** 外した送信チャンネル(null = まだ触っていない = mode から導く。sameAs は元の送信が使わなかった送信チャンネルを外した形) */
  const [channelsOffState, setChannelsOff] = useState<string[] | null>(null);
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
  const options = isBulk ? bulkOptions.options : sendOptions.options;
  const optionsLoaded = options !== null;
  const optionsError = isBulk ? bulkOptions.error : sendOptions.error;

  const templatesOpen = gate.enabled("messagingTemplates");
  const allTemplates: MessageSendTemplate[] = useMemo(() => (templatesOpen ? (options?.templates ?? []) : []), [templatesOpen, options]);
  const allCategories: AdminFreeTextCategoryOption[] = useMemo(() => options?.categories ?? [], [options]);
  const layouts = options?.layouts ?? NO_LAYOUTS;
  const initialLayout = options?.initialLayout ?? null;
  // 送信チャンネルの表示名 = 選択肢の送信チャンネル(受け口の label)。取れる前は constants の控え
  const channelLabels = useMemo(() => {
    const labels: Record<string, string> = { ...MESSAGE_CHANNEL_LABELS };
    for (const channel of options?.channels ?? []) labels[channel.key] = channel.label;
    return labels;
  }, [options]);
  const maxDays = sendOptions.options?.maxScheduleDays ?? 90;

  // ---- 種別 → カテゴリー ----
  const kinds = useMemo(
    () => kindsOf(allCategories).map((key) => ({ key, label: MESSAGE_KIND_LABELS[key as keyof typeof MESSAGE_KIND_LABELS] ?? key })),
    [allCategories],
  );
  const preferredCategory = preferredCategoryOf(mode);
  // 新しく送る時は種別を選ばせる(先に選んでおかない、D110 D118)。同じ内容で送る・一括送信は送信 / 既定のカテゴリーの種別
  const initialKind = allCategories.find((option) => option.key === preferredCategory)?.kind ?? "";
  const kind = kindState !== null && kinds.some((item) => item.key === kindState) ? kindState : initialKind;
  const kindCategories = useMemo(() => allCategories.filter((option) => option.kind === kind), [allCategories, kind]);
  const categoryPick = chosenCategory ?? preferredCategory;
  const category = kindCategories.some((option) => option.key === categoryPick) ? (categoryPick as string) : (kindCategories[0]?.key ?? "");
  const categoryOption = kindCategories.find((option) => option.key === category) ?? null;

  // ---- 宛先(種別が許す種類だけ。許さない形は最初の許す種類に読み替える) ----
  const allowedTargetTypes = useMemo(
    () => TARGET_TYPES.filter((type) => categoryOption?.targets.includes(type) ?? false),
    [categoryOption],
  );
  const groups = useMemo(() => sendOptions.options?.groups ?? [], [sendOptions.options]);
  // sameAs のグループが今の選択肢に無い(保管・門が閉)= グループは選ばれていない形にして知らせる(全員に広げない)
  const initialTarget = useMemo(() => {
    const first = initialTargetOf(mode);
    if (first.type !== "group" || !sendOptions.options || groups.some((group) => group.id === first.groupId)) return first;
    return { ...first, groupId: "" };
  }, [mode, sendOptions.options, groups]);
  const targetGroupGone =
    targetState === null && mode.type === "sameAs" && mode.dispatch.targetGroup !== null && initialTarget.type === "group" && initialTarget.groupId === "";
  const rawTarget = targetState ?? initialTarget;
  const target: MessageSendTarget = useMemo(
    () => (allowedTargetTypes.length === 0 || allowedTargetTypes.includes(rawTarget.type) ? rawTarget : { ...rawTarget, type: allowedTargetTypes[0]! }),
    [allowedTargetTypes, rawTarget],
  );

  // ---- テンプレート(選んだ種別の物) ----
  const kindOfCategory = useCallback((key: string) => allCategories.find((option) => option.key === key)?.kind ?? null, [allCategories]);
  const templates = useMemo(() => allTemplates.filter((item) => kindOfCategory(item.category) === kind), [allTemplates, kindOfCategory, kind]);
  /** 初めのレイアウト(開いた時の出どころ。読み込みを解除してテンプレートのレイアウトが選べない時も) */
  const blank = useMemo(() => blankLayoutOf(layouts, initialLayout), [layouts, initialLayout]);
  /** 選べるレイアウト(管理画面で選べて無効でない物、受け口の順) */
  const layoutChoices = useMemo(
    () => layouts.filter((option) => option.selectable).map((option) => ({ key: option.key, label: option.label })),
    [layouts],
  );
  /** レイアウトから書く形へ戻る先: そのレイアウトが選べればそれ(今の文を残す)、選べなければ初めのレイアウト */
  const backToLayoutOf = useCallback(
    (key: string | null) => layoutChoices.find((option) => option.key === key) ?? blank,
    [layoutChoices, blank],
  );
  /** 選ぶ小窓の並び = 公開中のテンプレート(門 messagingTemplates が開の時) */
  const pickerTemplates = useMemo(
    () => (templatesOpen ? templates.map((item) => ({ id: item.id, name: item.name, currentVersion: item.currentVersion })) : []),
    [templates, templatesOpen],
  );

  // ---- 送信チャンネル ----
  /** 選んだカテゴリーの送信チャンネル */
  const categoryChannels = useMemo(() => categoryOption?.channels ?? [], [categoryOption]);
  // 送信チャンネルをまだ触っていない時のオン: カテゴリーの最初の送信チャンネル(defaultChannels、無ければ全部、D119)。
  // sameAs で種別・カテゴリーをまだ触っていない = 元の送信が使った送信チャンネルだけオン(今のカテゴリーの送信チャンネルの中で。全部外れてしまう時は全部オン)
  const categoryDefaults = useMemo(() => categoryOption?.defaultChannels ?? categoryChannels, [categoryOption, categoryChannels]);
  const initialChannelsOff = useMemo(() => {
    const used = mode.type === "sameAs" && chosenCategory === null && kindState === null ? (mode.dispatch.channels ?? []) : categoryDefaults;
    const off = categoryChannels.filter((key) => !used.includes(key));
    return off.length === categoryChannels.length ? [] : off;
  }, [mode, chosenCategory, kindState, categoryChannels, categoryDefaults]);
  const channelsOff = channelsOffState ?? initialChannelsOff;
  /** 使う送信チャンネル = カテゴリーの送信チャンネル − 外した送信チャンネル */
  const sendChannels = useMemo(() => categoryChannels.filter((key) => !channelsOff.includes(key)), [categoryChannels, channelsOff]);
  const channels = useMemo(
    () => categoryChannels.map((key) => ({ key, label: channelLabels[key] ?? key, on: !channelsOff.includes(key) })),
    [categoryChannels, channelLabels, channelsOff],
  );

  // ---- 文面 ----
  const initialText = useMemo(
    () => (optionsLoaded ? initialTextOf(mode, kind, layouts, initialLayout, allCategories, allTemplates) : null),
    [optionsLoaded, mode, kind, layouts, initialLayout, allCategories, allTemplates],
  );
  const touchText = useCallback(() => {
    setTextTouched(true);
    setPreview(null);
  }, []);
  const text = useSendTemplateText({ layouts, initial: initialText, channels: sendChannels, templatesOpen, onChange: touchText });
  const sameAsNote = useMemo(() => (optionsLoaded ? sameAsNoteOf(mode, initialText, allTemplates) : null), [optionsLoaded, mode, initialText, allTemplates]);
  /** 埋め込み情報のタグ(共通 + カテゴリーに当たる enrichers + 読み込んだテンプレートの専用) */
  const varCatalog = useMemo<MessageVarEntry[]>(
    () => [
      ...(categoryOption?.catalog ?? []).map((entry) => ({
        key: entry.key,
        alias: entry.alias,
        source: entry.source,
        ...(entry.description ? { description: entry.description } : {}),
      })),
      ...(text.state?.varDeclarations ?? []).map((item) => ({ key: item.key, alias: item.alias, source: "own" as const, declaration: item })),
    ],
    [categoryOption, text.state],
  );
  const textDirty = textTouched || text.form.formState.isDirty;
  /** レイアウトの実際の描き方のプレビュー(送信チャンネルのタブ、未入力は仮の文、D114。書く段の間だけ) */
  // 専用の埋め込み情報は入れた値(空なら既定値)で埋めて描く(「あなた宛ての表示例」と同じ。共通・enricher は受信者ごとなので {{名前}} のまま)
  const previewValues = useMemo(
    () => varPreviewValues(text.values, text.state?.varDeclarations ?? [], text.state?.vars ?? {}),
    [text.values, text.state?.varDeclarations, text.state?.vars],
  );
  const layoutPreview = useLayoutPreview({
    layout: text.layout?.key ?? null,
    fields: text.layout?.fields ?? null,
    values: previewValues,
    channels: sendChannels,
    category: category || null,
    enabled: open && step === "edit",
    // 送る画面のプレビューは送る形: 空の欄は描かない(D127)
    mode: "send",
  });

  // ---- 操作 ----
  const setKind = useCallback(
    (next: string) => {
      if (next === kind) return;
      setKindState(next);
      // 種別を替えたらその種別の最初のカテゴリーを選び直す(D118)
      setChosenCategory(allCategories.find((option) => option.kind === next)?.key ?? null);
      // 送信方法は新しいカテゴリーの最初の送信チャンネルに戻す(D119)
      setChannelsOff(null);
      setPreview(null);
      // レイアウトは種別に関わらない → 選んだレイアウトと文はそのまま。テンプレートは種別ごと → 読み込んでいれば外す(そのレイアウトへ、文は残す)
      if (text.source?.type === "template") {
        const back = backToLayoutOf(text.state?.layout ?? null);
        text.reset(back ? text.toBlank(back) : null);
      }
    },
    [kind, allCategories, text, backToLayoutOf],
  );
  const setCategory = useCallback((key: string) => {
    setChosenCategory(key);
    setChannelsOff(null);
    setPreview(null);
  }, []);
  const setTarget = useCallback(
    (patch: Partial<MessageSendTarget>) => setTargetState((prev) => ({ ...(prev ?? target), ...patch })),
    [target],
  );

  /** テンプレートを読み込む(その版の文は固定から、D119) */
  const applyLoad = useCallback(
    (templateId: string) => {
      setPendingLoad(null);
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;
      text.reset(templateTextState(template));
      setTextTouched(false);
      setPreview(null);
    },
    [templates, text],
  );
  /** 読み込む。手で直した書きかけがあれば上書きを確かめる(pendingLoad → confirmLoad / cancelLoad) */
  const loadTemplate = useCallback(
    (templateId: string) => {
      if (textDirty && text.state?.unlocked) setPendingLoad(templateId);
      else applyLoad(templateId);
    },
    [textDirty, text.state, applyLoad],
  );
  const confirmLoad = useCallback(() => {
    if (pendingLoad) applyLoad(pendingLoad);
  }, [pendingLoad, applyLoad]);
  const cancelLoad = useCallback(() => setPendingLoad(null), []);
  /** 『テンプレートの読み込みを解除』: そのテンプレートのレイアウトへ(選べなければ初めのレイアウト。レイアウトが同じなら今の文を残す、D118) */
  const unloadTemplate = useCallback(() => {
    const back = backToLayoutOf(text.state?.layout ?? null);
    text.reset(back ? text.toBlank(back) : null);
    setTextTouched(true);
    setPreview(null);
  }, [text, backToLayoutOf]);

  /** レイアウトに替える(欄の中身は白紙から。前のレイアウトの値は持ち越さない。テンプレートを読み込んでいれば外れる) */
  const applyLayout = useCallback(
    (key: string) => {
      setPendingLayout(null);
      const layout = layoutChoices.find((option) => option.key === key);
      if (!layout) return;
      text.reset(layoutTextState(layout));
      setTextTouched(false);
      setPreview(null);
    },
    [layoutChoices, text],
  );
  /** レイアウトを選ぶ。選べない物・今と同じ(レイアウトから書いている時)は何もしない。手で書いた書きかけがあれば消すのを確かめる(pendingLayout) */
  const chooseLayout = useCallback(
    (key: string) => {
      if (!layoutChoices.some((option) => option.key === key)) return;
      if (text.source?.type === "layout" && text.source.layout === key) return;
      if (textDirty) setPendingLayout(key);
      else applyLayout(key);
    },
    [layoutChoices, text.source, textDirty, applyLayout],
  );
  const confirmLayout = useCallback(() => {
    if (pendingLayout) applyLayout(pendingLayout);
  }, [pendingLayout, applyLayout]);
  const cancelLayout = useCallback(() => setPendingLayout(null), []);

  const toggleChannel = useCallback(
    (channel: string, on: boolean) => {
      setChannelsOff((prev) => {
        const base = prev ?? initialChannelsOff;
        return on ? base.filter((key) => key !== channel) : base.includes(channel) ? base : [...base, channel];
      });
      setPreview(null);
    },
    [initialChannelsOff],
  );
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

  // ---- 入力を組む(送る・プレビュー・テスト送信・一括送信がこの 1 つを使う) ----
  const buildContent = useCallback((): AdminSendPreviewInput => {
    const source = text.source;
    if (!source) throw new Error("管理画面で選べるレイアウトが無いため、テンプレートを読み込んでください");
    const values = text.values;
    if (source.type === "template") {
      return {
        origin: { id: source.id, version: source.version },
        values,
        edited: text.edited,
        vars: text.varsForInput ?? {},
        category,
        channels: sendChannels,
      };
    }
    return {
      origin: { layout: source.layout },
      values,
      category,
      channels: sendChannels,
    };
  }, [text, category, sendChannels]);

  const buildTarget = useCallback((): AdminSendInput["target"] => {
    if (target.type === "role") return { type: "role", roles: target.roles };
    if (target.type === "group") return { type: "group", groupId: target.groupId };
    if (target.type === "users") return { type: "users", userIds: target.userIds };
    return { type: "all" };
  }, [target]);

  const buildSendInput = useCallback(
    (): AdminSendInput => ({
      ...buildContent(),
      target: buildTarget(),
      ...(scheduleMode === "at" && scheduledAt ? { scheduledAt } : {}),
      idempotencyKey,
    }),
    [buildContent, buildTarget, scheduleMode, scheduledAt, idempotencyKey],
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
    if (!text.state) return "この種別には白紙のテンプレートが無いため、テンプレートを読み込んでください";
    if (!text.layout) return "テンプレートのひな形を読み込めません(ひな形が無くなった可能性があります)";
    if (text.missingVars.length > 0) return `埋め込み情報「${text.missingVars.map((item) => item.alias || item.key).join("・")}」を入力してください`;
    if (sendChannels.length === 0) return "送信方法を 1 つ以上選んでください";
    return null;
  }, [text.state, text.layout, text.missingVars, sendChannels]);

  const targetError = useMemo(() => {
    if (!kind) return kinds.length === 0 ? "送れる種別がありません" : "種別を選んでください";
    if (!category) return "この種別に使えるカテゴリーがありません";
    if (!isBulk) {
      if (target.type === "role" && target.roles.length === 0) return "ロールを選んでください";
      if (target.type === "group" && target.groupId === "") return "グループを選んでください";
      if (target.type === "users" && target.userIds.length === 0) return "ユーザーを選んでください";
    } else if (mode.recordIds.length === 0) {
      return "対象を選んでください";
    }
    return null;
  }, [kind, kinds.length, category, isBulk, target, mode]);

  const canSend = optionsLoaded && !contentError && !targetError && !scheduleError;
  const dirty =
    open &&
    step !== "done" &&
    (kindState !== null ||
      targetState !== null ||
      chosenCategory !== null ||
      textDirty ||
      (channelsOffState !== null && [...channelsOffState].sort().join() !== [...initialChannelsOff].sort().join()) ||
      scheduledAt !== "");
  useUnsavedGuard(dirty);

  // ---- 送る口 ----
  const revalidateKeys = [ADMIN_DISPATCHES_KEY];
  const previewMutation = useDomainMutation<MessagePreview, AdminSendPreviewInput>(`${ADMIN_SEND_KEY}/modal/preview`, (input) =>
    isBulk ? previewAdminBulkMessage(input) : previewAdminMessage(input),
  );
  const testMutation = useDomainMutation<AdminSendResult, AdminSendPreviewInput & { idempotencyKey: string }>(
    `${ADMIN_SEND_KEY}/modal/test`,
    (input) => (isBulk ? sendAdminBulkTestMessage(input) : sendAdminTestMessage(input)),
    revalidateKeys,
  );
  const estimateMutation = useDomainMutation<RecipientEstimate, { target: AdminSendInput["target"] }>(
    `${ADMIN_SEND_KEY}/modal/estimate`,
    (input) => estimateAdminRecipients(input),
  );
  const sendMutation = useDomainMutation<AdminSendResult, AdminSendInput>(`${ADMIN_SEND_KEY}/modal/send`, (input) => adminSendMessage(input), revalidateKeys);
  const bulkMutation = useDomainMutation<AdminBulkSendResult, AdminBulkSendInput>(
    `${ADMIN_MESSAGING_KEY}/bulk-send/modal`,
    (input) => adminBulkSend(input),
    revalidateKeys,
  );

  /** 直している文の検査(誤りは欄に出し、投げる) */
  const assertText = useCallback(async () => {
    if (!(await text.validate())) throw new Error("内容の入力に誤りがあります");
  }, [text]);

  /** プレビュー(投げた誤りは呼び手が出す) */
  const runPreview = useCallback(async () => {
    await assertText();
    const next = await previewMutation.trigger(buildContent());
    setPreview(next);
    return next;
  }, [assertText, previewMutation, buildContent]);

  /** 自分へのテスト送信(毎回新しい鍵) */
  const sendTest = useCallback(async () => {
    await assertText();
    return testMutation.trigger({ ...buildContent(), idempotencyKey: newKey() });
  }, [assertText, testMutation, buildContent]);

  /** 確認へ進む: 文と予約を確かめ直し、見込みを取る(bulk は選んだ記録の数) */
  const requestConfirm = useCallback(async () => {
    await assertText();
    if (!isBulk) {
      const late = scheduleErrorOf(scheduleMode, scheduledAt, maxDays, Date.now());
      setScheduleError(late);
      if (late) throw new Error(late);
      setEstimate(await estimateMutation.trigger({ target: buildTarget() }));
    }
    setStep("confirm");
  }, [assertText, isBulk, scheduleMode, scheduledAt, maxDays, estimateMutation, buildTarget]);

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
      if (estimate?.overLimit) throw new Error(overLimitText(estimate));
      sent = { kind: "send", result: await sendMutation.trigger(buildSendInput()) };
    }
    setResult(sent);
    setStep("done");
    setIdempotencyKey(newKey());
    onSent?.(sent);
    return sent;
  }, [isBulk, bulkMutation, buildBulkInput, scheduleMode, scheduledAt, maxDays, sendMutation, buildSendInput, onSent, estimate]);

  /** 『テンプレートを更新』(送るとは別、D120)。投げた誤りは呼び手が出す。unchanged = 版と同じ */
  const updateTemplate = useCallback(async () => {
    const updated = await text.updateTemplate();
    setPreview(null);
    return updated;
  }, [text]);

  const { reset: resetText } = text;
  const reset = useCallback(() => {
    setStep("edit");
    setKindState(null);
    setChosenCategory(null);
    setTargetState(null);
    resetText(null);
    setTextTouched(false);
    setPendingLoad(null);
    setPendingLayout(null);
    setChannelsOff(null);
    setScheduleModeState("now");
    setScheduledAtState("");
    setScheduleError(null);
    setPreview(null);
    setEstimate(null);
    setResult(null);
  }, [resetText]);

  /** 開く・閉じる(閉じたら全部を初めに戻す。書きかけの確かめは Modal の confirmOnClose) */
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (next) setIdempotencyKey(newKey());
      else reset();
    },
    [reset],
  );

  const loadedTemplate = text.source?.type === "template" ? text.source : null;

  return {
    mode,
    open,
    setOpen,
    step,
    optionsLoaded,
    optionsError,
    /** sameAs で送信の文面をそのまま写せなかった時の知らせ(書く段の上に出す) */
    sameAsNote,
    /** 書きかけ(閉じる・離れる前に確かめる) */
    dirty,
    /** Modal の confirmOnClose に渡す */
    closeConfirm: { enabled: dirty, message: "入力中の内容は送信されていません。閉じてもよろしいですか？" },
    // 種別・カテゴリー
    kinds,
    kind,
    setKind,
    /** 選んだ種別のカテゴリー(1 つなら画面に出さない) */
    categories: kindCategories,
    category,
    setCategory,
    // 宛先
    target,
    setTarget,
    allowedTargetTypes,
    roles: sendOptions.options?.roles ?? [],
    /** 選べるグループ(使用中・名前と種類の表示名。門 userGroups が閉なら空 = グループを選ばせない) */
    groups,
    /** 門 userGroups が開か(開ならグループが 0 件でもグループの選択肢を出す) */
    groupsEnabled: gate.enabled("userGroups"),
    /** 宛先の知らせ(sameAs の元の送信のグループが今は選べない時) */
    targetNote: targetGroupGone ? TARGET_GROUP_GONE_NOTE : null,
    // テンプレートと文面
    /** テンプレートを読み込めるか(門 messagingTemplates が開) */
    templatesAvailable: templatesOpen,
    /** テンプレートの選ぶ小窓の並び(公開中のテンプレート) */
    pickerTemplates,
    /** 今のレイアウト(読み込んでいない時の出どころの表示名。DB のテンプレートを読み込んだ時は null) */
    currentLayout: text.source?.type === "layout" ? { label: text.source.label } : null,
    templates,
    /** 初めのレイアウト(選べるレイアウトが無ければ null) */
    blank,
    /** 選べるレイアウト(管理画面で選べて無効でない物) */
    layoutChoices,
    /** 選んでいるレイアウトの鍵(テンプレートを読み込んだ間はそのテンプレートのレイアウト) */
    layoutKey: text.state?.layout ?? null,
    chooseLayout,
    /** 書きかけを消すのを確かめているレイアウトの切り替え(入れ物が確かめの Dialog を出す) */
    pendingLayout,
    confirmLayout,
    cancelLayout,
    loadedTemplate,
    text,
    layoutPreview,
    /** 埋め込み情報のタグの一覧(共通 + enrichers + 専用) */
    varCatalog,
    loadTemplate,
    unloadTemplate,
    /** 上書きを確かめている読み込み(入れ物が確かめの Dialog を出す) */
    pendingLoad,
    confirmLoad,
    cancelLoad,
    updateTemplate,
    // 送信チャンネル・予約
    channels,
    sendChannels,
    toggleChannel,
    showSchedule: !isBulk,
    scheduleMode,
    scheduledAt,
    scheduleError,
    scheduleNote: `予約は定期処理のタイミングで送信されます(Vercel Hobby では 1 日 1 回のため、指定時刻より遅れることがあります)。${maxDays} 日先まで予約できます。`,
    setScheduleMode,
    setScheduledAt,
    // 誤り・送る
    contentError,
    targetError,
    canSend,
    preview,
    estimate,
    /** 見込みが人数の上限を超えている(確認の段で送れない。サーバーも 409 で断る、D64) */
    estimateOverLimit: Boolean(estimate?.overLimit),
    result,
    isPreviewing: previewMutation.isMutating,
    isTesting: testMutation.isMutating,
    isSending: sendMutation.isMutating || bulkMutation.isMutating,
    buildContent,
    buildSendInput,
    buildBulkInput,
    runPreview,
    /** 「あなた宛ての表示例」を閉じる(表示例を消す) */
    closePreview: () => setPreview(null),
    /** 表示例のお知らせの汎用の描き方に使う今のレイアウトの欄の宣言 */
    previewLayoutFields: text.layout?.fields ?? null,
    sendTest,
    requestConfirm,
    backToEdit,
    confirmSend,
    reset,
  };
}

export type MessageSendModalState = ReturnType<typeof useMessageSendModal>;
