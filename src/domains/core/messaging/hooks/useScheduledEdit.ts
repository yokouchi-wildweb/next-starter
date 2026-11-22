"use client";

// src/domains/core/messaging/hooks/useScheduledEdit.ts
//
// 公開の hook: 予約した送信の送る前の直し(D210、ui.scheduledEdit)。入れ物 ScheduledEditModal はこれを呼んで部品を並べるだけ(CLAUDE.md core_ui)。
// 自由連絡・定義連絡の送信を 1 つで受ける。
// - 材料: 開いている間 GET dispatches/[id]/edit-options(useScheduledEditOptions)。予約できる日数はこれだけから読む(門 messagingBroadcast に依らない)
// - 文面: canEdit.content が開で材料にレイアウトがある時だけ。直せる欄(editableFields)だけを LayoutFields で(定義連絡の required = 欄なし)。
//   送る edits は変えた欄だけ(changedEdits。触っていない欄は送信の記録の edited_fields に入れない)
// - 送信チャンネル: 材料の固定で off は出さない / on はいつも入り外せない(locked)/ free は選べる。初めは送信の送信チャンネル。
//   送る channels は選んだ集合が送信の送信チャンネルと違う時だけ、直した後の一覧を全部
// - canEdit.content が閉 = 予約の時刻だけ(理由の文 DISPATCH_OPERATION_REASON_TEXT)
// - 宛先・レイアウトは見せるだけで送らない: PATCH の体に宛先はどんな時も入らない(宛先は送り始めで固まる D98・D101、送る口も受けない)
// - 段: 書く → 確認(変わる物の前と後)→ 保存。時刻の検査は送る画面と同じ scheduleErrorOf
// - 保存の後: 送信 1 件の SWR のキーを返った DTO で置き換え、送信のキーと直しの材料を読み直し、onSaved(detail)(一覧の行を置き換えるのは呼び手)。
//   409(送り始めた・削除した送信)・400(過ぎた時刻・欄の検査など)の文は error に残し、確認の段から書く段へ戻す

import { useCallback, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { useSWRConfig } from "swr";

import { useGate } from "@/featureGate/client";
import { err } from "@/lib/errors";
import { useDomainMutation } from "@/lib/crud";
import type { MessageLayoutFields } from "@/lib/messaging";

import { messageChannelLabel } from "../constants/channelLabels";
import { DISPATCH_OPERATION_REASON_TEXT, type DispatchOperationReason } from "../constants/dispatchOperations";
import {
  editAdminScheduledDispatch,
  type AdminDispatchDetail,
} from "../services/client/adminMessagingClient";
import type { AdminScheduledEditInput } from "../services/server/admin/scheduledEdit";

import { useAdminSendOptions } from "./useAdminSendOptions";
import { changedEdits } from "./useDefinitionSendModal";
import { layoutFieldsDefaults, useLayoutFieldsForm } from "./useLayoutFieldsForm";
import { scheduleErrorOf } from "./useMessageSendModal";
import { useScheduledEditOptions } from "./useScheduledEditOptions";
import { ADMIN_DISPATCHES_KEY, adminDispatchEditKey, adminDispatchKey } from "./messagingKeys";

/** 直す送信(詳細の DTO の一部) */
export type ScheduledEditDispatch = Pick<
  AdminDispatchDetail,
  "id" | "scheduledAt" | "channels" | "target" | "targetGroup" | "recipientCount" | "content" | "operations"
>;

export type UseScheduledEditOptions = {
  dispatch: ScheduledEditDispatch;
  /** 保存できた(返った送信 1 件)。一覧の行の置き換えなど */
  onSaved?: (detail: AdminDispatchDetail) => void;
};

/** 直した値(書く段の今の値) */
export type ScheduledEditChange = {
  /** 予約の時刻(入力の値。空 = 変えない) */
  scheduledAt: string;
  /** 変えた欄だけ(空 = 文面を変えない) */
  edits?: Readonly<Record<string, unknown>>;
  /** 選んだ送信チャンネル(送信の送信チャンネルと同じ集合 = 変えない) */
  channels?: readonly string[];
};

/** 送信チャンネル 1 つの行(部品 SendCategoryChannels の channels の形) */
export type ScheduledEditChannel = { key: string; label: string; on: boolean; locked: boolean };

/** 確認の段の文面の変わる欄 */
export type ScheduledEditFieldChange = { key: string; label: string };

const NO_VALUES: Readonly<Record<string, unknown>> = {};

/** 予約の時刻の注記(送る画面と同じ文。日数が分からなければその文は出さない) */
export function scheduledEditNote(maxDays: number | null): string {
  const base = "予約は定期処理のタイミングで送信されます(Vercel Hobby では 1 日 1 回のため、指定時刻より遅れることがあります)。";
  return maxDays === null ? base : `${base}${maxDays} 日先まで予約できます。`;
}

/** 2 つの送信チャンネルの一覧が同じ集合か */
export function sameChannelSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((key) => right.has(key));
}

/**
 * 直した値 → PATCH の体(変えた物だけ。何も変えていなければ null)。
 * scheduledAt = 時刻を変えた時 / edits = 変えた欄がある時 / channels = 集合が送信の送信チャンネルと違う時だけ、直した後の一覧を全部。
 * 宛先はどんな時も入れない
 */
export function scheduledEditInputOf(
  dispatch: Pick<ScheduledEditDispatch, "scheduledAt" | "channels">,
  change: ScheduledEditChange,
): AdminScheduledEditInput | null {
  const input: AdminScheduledEditInput = {};
  if (change.scheduledAt) {
    const before = dispatch.scheduledAt ? new Date(dispatch.scheduledAt).getTime() : null;
    const after = new Date(change.scheduledAt).getTime();
    if (!Number.isNaN(after) && before !== after) input.scheduledAt = new Date(after).toISOString();
  }
  if (change.edits && Object.keys(change.edits).length > 0) input.edits = { ...change.edits };
  if (change.channels && change.channels.length > 0 && !sameChannelSet(change.channels, dispatch.channels)) input.channels = [...change.channels];
  return Object.keys(input).length > 0 ? input : null;
}

/** 材料の送信チャンネルの固定 → 出す送信チャンネル(off を除く)と外せない物(on) */
export function scheduledEditChannelShape(modes: Readonly<Record<string, string>>): { keys: string[]; locked: string[] } {
  const keys = Object.keys(modes).filter((key) => modes[key] !== "off");
  return { keys, locked: keys.filter((key) => modes[key] === "on") };
}

export function useScheduledEdit({ dispatch, onSaved }: UseScheduledEditOptions) {
  const [open, setOpenState] = useState(false);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [scheduledAt, setScheduledAtState] = useState(dispatch.scheduledAt ?? "");
  const [channelsState, setChannelsState] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = dispatch.operations.canEdit.allowed;
  const contentFlag = dispatch.operations.canEdit.content;

  // 直しの材料(開いている間。時刻だけ直せる送信も答える)
  const material = useScheduledEditOptions(dispatch.id, open && allowed);
  const options = material.options;
  const maxDays = options?.maxScheduleDays ?? null;
  const editLayout = contentFlag.allowed ? (options?.layout ?? null) : null;
  /** 文面・送信チャンネルを直せるか(content が開で、材料にレイアウトがある) */
  const contentEditable = editLayout !== null;
  /** 時刻だけの理由(content が閉の時の文。材料を待つ間・開の時は null) */
  const contentReason = contentFlag.allowed
    ? null
    : (DISPATCH_OPERATION_REASON_TEXT[contentFlag.reason as DispatchOperationReason] ?? "この送信は予約の時刻だけ直せます");

  // レイアウトの表示名: 材料のレイアウトから。無い時(時刻だけの送信)は送る画面の選択肢で引く(門 messagingBroadcast の中、分からなければ null = 行を出さない)
  const broadcastOpen = useGate().enabled("messagingBroadcast");
  const needLabelLookup = open && options !== null && !options.layout && Boolean(dispatch.content?.layout);
  const sendOptions = useAdminSendOptions(needLabelLookup && broadcastOpen);
  const layoutLabel = useMemo(() => {
    if (options?.layout) return options.layout.label;
    const key = dispatch.content?.layout;
    if (!key) return null;
    return sendOptions.options?.layouts.find((layout) => layout.key === key)?.label ?? null;
  }, [options, dispatch.content?.layout, sendOptions.options]);

  // ---- 送信チャンネル ----
  const channelShape = useMemo(
    () => (contentEditable && options ? scheduledEditChannelShape(options.channels) : { keys: [], locked: [] }),
    [contentEditable, options],
  );
  const channelsOn = useMemo(() => {
    const picked = channelsState ?? dispatch.channels;
    return channelShape.keys.filter((key) => channelShape.locked.includes(key) || picked.includes(key));
  }, [channelShape, channelsState, dispatch.channels]);
  const channels = useMemo<ScheduledEditChannel[]>(
    () =>
      channelShape.keys.map((key) => ({
        key,
        label: messageChannelLabel(key),
        on: channelsOn.includes(key),
        locked: channelShape.locked.includes(key),
      })),
    [channelShape, channelsOn],
  );
  const toggleChannel = useCallback(
    (key: string, on: boolean) => {
      if (channelShape.locked.includes(key)) return;
      const base = channelsState ?? dispatch.channels;
      setChannelsState(on ? [...new Set([...base, key])] : base.filter((item) => item !== key));
      setError(null);
    },
    [channelShape.locked, channelsState, dispatch.channels],
  );
  /** 選んだ集合が送信と違うか(違う時だけ channels を送る) */
  const channelsChanged = contentEditable && !sameChannelSet(channelsOn, dispatch.channels);

  // ---- 文面(直せる欄だけ) ----
  const editableKey = contentEditable && options ? options.editableFields.join(",") : "";
  const textLayout = useMemo(() => {
    if (!editLayout || editableKey === "") return null;
    const keys = editableKey.split(",");
    const fields: MessageLayoutFields = Object.fromEntries(Object.entries(editLayout.fields).filter(([key]) => keys.includes(key)));
    return { key: editLayout.key, fields };
  }, [editLayout, editableKey]);
  const textValues = options?.values ?? NO_VALUES;
  const textForm = useLayoutFieldsForm({ layout: textLayout, values: textValues, channels: channelsOn });
  const watched = useWatch({ control: textForm.control }) as Record<string, unknown> | undefined;
  const initialText = useMemo(() => layoutFieldsDefaults(textForm.fields, textValues), [textForm.fields, textValues]);
  const edits = useMemo(() => (textLayout ? changedEdits(initialText, watched ?? {}) : {}), [textLayout, initialText, watched]);
  /** 確認の段の変わる欄(表示名) */
  const editedFields = useMemo<ScheduledEditFieldChange[]>(
    () => Object.keys(edits).map((key) => ({ key, label: textForm.fields[key]?.label ?? key })),
    [edits, textForm.fields],
  );

  // ---- 時刻・体 ----
  const timeChanged = useMemo(() => {
    if (!scheduledAt) return false;
    const before = dispatch.scheduledAt ? new Date(dispatch.scheduledAt).getTime() : null;
    return new Date(scheduledAt).getTime() !== before;
  }, [scheduledAt, dispatch.scheduledAt]);
  const timeError = scheduleErrorOf("at", scheduledAt, maxDays ?? Number.POSITIVE_INFINITY, Date.now());
  const input = useMemo(
    () => scheduledEditInputOf(dispatch, { scheduledAt, edits, channels: channelsChanged ? channelsOn : undefined }),
    [dispatch, scheduledAt, edits, channelsChanged, channelsOn],
  );
  const changed = input !== null;
  const channelsError = contentEditable && channelsOn.length === 0 ? "送信方法を 1 つ以上選んでください" : null;
  const canConfirm = allowed && changed && !timeError && !channelsError;

  const { mutate } = useSWRConfig();
  const mutation = useDomainMutation<AdminDispatchDetail, AdminScheduledEditInput>(
    adminDispatchEditKey(dispatch.id),
    (body) => editAdminScheduledDispatch(dispatch.id, body),
  );
  const { trigger } = mutation;
  const { resetTo } = textForm;

  const reset = useCallback(() => {
    setStep("edit");
    setScheduledAtState(dispatch.scheduledAt ?? "");
    setChannelsState(null);
    setError(null);
    resetTo(textForm.fields, textValues);
  }, [dispatch.scheduledAt, resetTo, textForm.fields, textValues]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (!next) reset();
    },
    [reset],
  );

  const setScheduledAt = useCallback((at: string) => {
    setScheduledAtState(at);
    setError(null);
  }, []);

  /** 確認へ(欄の検査が通る時だけ) */
  const toConfirm = useCallback(async () => {
    if (!canConfirm) return;
    if (textLayout && !(await textForm.form.trigger())) return;
    setError(null);
    setStep("confirm");
  }, [canConfirm, textLayout, textForm.form]);
  const backToEdit = useCallback(() => setStep("edit"), []);

  /** 保存(確認の段から)。誤りは error に残して書く段へ戻す */
  const save = useCallback(async () => {
    if (!input) return null;
    try {
      const detail = await trigger(input);
      await mutate(adminDispatchKey(dispatch.id), detail, { revalidate: false });
      await mutate((key) => typeof key === "string" && key.startsWith(ADMIN_DISPATCHES_KEY));
      onSaved?.(detail);
      setOpen(false);
      return detail;
    } catch (caught) {
      setError(err(caught, "予約した送信を直せませんでした"));
      setStep("edit");
      return null;
    }
  }, [input, trigger, mutate, dispatch.id, onSaved, setOpen]);

  return {
    open,
    setOpen,
    /** 直せるか(operations.canEdit。false なら入口を出さない) */
    allowed,
    step,
    toConfirm,
    backToEdit,
    // 材料
    /** 材料を読んでいる(文面・送信チャンネルの箱はまだ出さない) */
    materialLoading: material.isLoading,
    /** 材料を読めない(409 = 送り始めた・削除した送信) */
    materialError: material.error,
    // 見せるだけの値
    layoutLabel,
    // 文面・送信チャンネル
    /** 文面・送信チャンネルを直せるか(false = 時刻だけ) */
    contentEditable,
    /** 時刻だけの理由の文(content が閉の時) */
    contentReason,
    /** 文面の欄(直せる欄だけ。無ければ null = 文面の箱を出さない) */
    textControl: textForm.control,
    textFields: textLayout ? textForm.fields : null,
    /** 変えた欄だけ(PATCH の edits) */
    edits,
    editedFields,
    channels,
    toggleChannel,
    channelsOn,
    channelsChanged,
    /** 前の送信チャンネル */
    previousChannels: dispatch.channels,
    channelsError,
    // 予約の時刻
    scheduledAt,
    setScheduledAt,
    timeChanged,
    /** 時刻の誤り(入力の途中は出し、確認に進めない) */
    timeError,
    scheduleNote: scheduledEditNote(maxDays),
    /** 前の時刻(ISO) */
    previousScheduledAt: dispatch.scheduledAt,
    /** PATCH の体(変えた物だけ。何も変えていなければ null) */
    input,
    changed,
    canConfirm,
    save,
    isSaving: mutation.isMutating,
    /** 保存の誤り(409 = 送り始めた・削除した送信、400 = 時刻・欄の検査など) */
    error,
  };
}

export type ScheduledEditState = ReturnType<typeof useScheduledEdit>;
