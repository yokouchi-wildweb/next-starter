"use client";

// src/features/core/messaging/hooks/useDefinitionSendModal.ts
//
// 管理: 定義連絡の汎用の送るモーダルの流れ(1 つの hook。入れ物 DefinitionSendModal はこれを呼んで部品を並べるだけ、D164 D191)。
// 目的の props は持たない。入口(entry)は 2 つ:
// - records { recordTarget, recordIds }: 一覧の一括操作(definitionBulkAction)。連絡定義は項目の並びから選ぶ(1 つならそれ)。門の外。予約は無い
// - broadcast: 全員・ロール・グループ(連絡定義の adminTargets が許す物だけ)。門 messagingBroadcast の中(閉なら available = false、入れ物は何も描かない)。
//   ロール・グループの選択肢は send/options、予約は自由連絡と同じ決まり
// 書く物(定義の中身はコードが持ち、画面から送るのは次だけ。services/server/admin/definitionSend.ts):
// - 送信チャンネル: off は出さない / on はいつも入り外せない(locked)/ free は選べる。初めは選択肢の initialChannels(D213)。required はメールを外せない
// - 管理者の値(adminVars): 入力の型ごとの入力(値は文字で持ち、数は送る時に読み替え)。埋まらない必須は送れない
// - テキストの編集(D169): 直せる欄(editableFields)だけ。required・直せる欄が無い = 編集の箱なし。送る edits は変えた欄だけ
// 表示例は送る口の preview(記録の入口は最初の記録の値)、自分へのテスト送信は毎回新しい鍵、送る鍵は開くたびに 1 つ・成功で作り直す。
// 全員・ロール・グループの確認に人数の見込みは無い(上限はサーバーが断る)
// 公開の hook だけで組む(D191): useSendSteps・useIdempotencyKey・useDefinitionSendOptions / useDefinitionSend / useDefinitionPreview / useDefinitionTest・
// useAdminSendOptions・useLayoutFieldsForm

import { useCallback, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import { useGate } from "@/featureGate/client";
import type { MessageDefinitionAdminTarget } from "@/lib/messaging";

import { messageChannelLabel } from "../constants/channelLabels";
import type {
  AdminDefinitionEntry,
  AdminDefinitionOption,
  AdminDefinitionPreviewInput,
  AdminDefinitionSendInput,
  AdminDefinitionSendResult,
} from "../services/client/definitionSendClient";

import { layoutFieldsDefaults, useLayoutFieldsForm } from "./useLayoutFieldsForm";
import { useAdminSendOptions } from "./useAdminSendOptions";
import { useDefinitionPreview, useDefinitionSend, useDefinitionSendOptions, useDefinitionTest } from "./useDefinitionSend";
import { useIdempotencyKey } from "./useIdempotencyKey";
import { missingVars, varValuesForInput } from "./useSendTemplateText";
import { scheduleErrorOf } from "./useMessageSendModal";
import { useSendSteps } from "./useSendSteps";

/** 入口(目的の props は無い、D164) */
export type DefinitionSendEntry = { type: "records"; recordTarget: string; recordIds: string[] } | { type: "broadcast" };

/** 全員・ロール・グループの宛先(broadcast の入口) */
export type DefinitionSendTargetType = "all" | "role" | "group";
export type DefinitionSendTarget = { type: DefinitionSendTargetType; roles: string[]; groupId: string };

export type DefinitionSendChannel = { key: string; label: string; on: boolean; locked: boolean };

export type UseDefinitionSendModalOptions = {
  entry: DefinitionSendEntry;
  /** 送った後(結果を出した時)に呼ぶ。一括操作なら選択の解除と一覧の取り直し */
  onSent?: (result: AdminDefinitionSendResult) => void;
};

const BROADCAST_TYPES: readonly DefinitionSendTargetType[] = ["all", "role", "group"];
/** required の連絡が外せない送信チャンネル(法の義務の告知はメールを含める) */
const REQUIRED_CHANNEL = "email";
const BLANK_TARGET: DefinitionSendTarget = { type: "all", roles: [], groupId: "" };
const NO_VALUES: Readonly<Record<string, unknown>> = {};

/** 定義の送信チャンネルの並び(off を除く)と、外せない物(on と required のメール) */
export function definitionChannelsOf(definition: Pick<AdminDefinitionOption, "channels" | "required">) {
  const keys = Object.entries(definition.channels)
    .filter(([, mode]) => mode !== "off")
    .map(([key]) => key);
  const locked = keys.filter((key) => definition.channels[key] === "on" || (definition.required && key === REQUIRED_CHANNEL));
  return { keys, locked };
}

/** 全員・ロール・グループの入口で選べる宛先の種類(定義の adminTargets の順でなく 全員 → ロール → グループ) */
export function broadcastTypesOf(adminTargets: readonly MessageDefinitionAdminTarget[]): DefinitionSendTargetType[] {
  return BROADCAST_TYPES.filter((type) => adminTargets.includes(type));
}

/** 変えた欄だけ(テキストの編集の印 = 送信の記録の edited_fields になるので、触っていない欄は送らない) */
export function changedEdits(
  initial: Readonly<Record<string, unknown>>,
  current: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    if (JSON.stringify(value) !== JSON.stringify(initial[key])) out[key] = value;
  }
  return out;
}

export function useDefinitionSendModal({ entry, onSent }: UseDefinitionSendModalOptions) {
  const gate = useGate();
  const isRecords = entry.type === "records";
  const available = isRecords || gate.enabled("messagingBroadcast");
  const [open, setOpenState] = useState(false);
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  /** 送信チャンネルの入り切り(null = まだ触っていない = 定義の initialChannels) */
  const [channelsOnState, setChannelsOn] = useState<string[] | null>(null);
  const [vars, setVarsState] = useState<Record<string, string>>({});
  const [targetState, setTargetState] = useState<DefinitionSendTarget | null>(null);
  const [scheduleMode, setScheduleModeState] = useState<"now" | "at">("now");
  const [scheduledAt, setScheduledAtState] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const query = useMemo(
    () => (entry.type === "records" ? { recordTarget: entry.recordTarget } : { entry: "broadcast" as const }),
    [entry],
  );
  const definitionOptions = useDefinitionSendOptions(query, open && available);
  // ロール・グループ・予約の日数(全員・ロール・グループの入口だけ、門 messagingBroadcast の中)
  const sendOptions = useAdminSendOptions(open && available && !isRecords);
  const options = definitionOptions.options;
  const definitions = useMemo(() => options?.definitions ?? [], [options]);
  const recordNoun = options?.recordTarget?.label ?? "記録";
  const maxDays = sendOptions.options?.maxScheduleDays ?? 90;

  // ---- 連絡定義(1 つならそれ) ----
  const definition = definitions.find((item) => item.key === chosenKey) ?? (definitions.length === 1 ? definitions[0]! : null);

  // ---- 送信チャンネル ----
  const channelShape = useMemo(() => (definition ? definitionChannelsOf(definition) : { keys: [], locked: [] }), [definition]);
  const channelsOn = useMemo(() => {
    const picked = channelsOnState ?? definition?.initialChannels ?? [];
    return channelShape.keys.filter((key) => channelShape.locked.includes(key) || picked.includes(key));
  }, [channelsOnState, definition, channelShape]);
  const channels: DefinitionSendChannel[] = useMemo(
    () =>
      channelShape.keys.map((key) => ({
        key,
        label: messageChannelLabel(key),
        on: channelsOn.includes(key),
        locked: channelShape.locked.includes(key),
      })),
    [channelShape, channelsOn],
  );

  // ---- 宛先(broadcast の入口) ----
  const allowedTargetTypes = useMemo(() => (definition ? broadcastTypesOf(definition.adminTargets) : []), [definition]);
  const rawTarget = targetState ?? BLANK_TARGET;
  const target: DefinitionSendTarget =
    allowedTargetTypes.length === 0 || allowedTargetTypes.includes(rawTarget.type) ? rawTarget : { ...rawTarget, type: allowedTargetTypes[0]! };

  // ---- テキストの編集(直せる欄だけ、D169) ----
  const editable = definition && !definition.required ? definition.editableFields : [];
  const editableKey = editable.join(",");
  const editLayout = useMemo(() => {
    if (!definition || editableKey === "") return null;
    const keys = editableKey.split(",");
    const fields = Object.fromEntries(Object.entries(definition.layout.fields).filter(([key]) => keys.includes(key)));
    return { key: definition.layout.key, fields };
  }, [definition, editableKey]);
  const editValues = definition?.values ?? NO_VALUES;
  const textForm = useLayoutFieldsForm({ layout: editLayout, values: editValues, channels: channelsOn });
  const watched = useWatch({ control: textForm.control }) as Record<string, unknown> | undefined;
  const initialEdits = useMemo(() => layoutFieldsDefaults(textForm.fields, editValues), [textForm.fields, editValues]);
  const edits = useMemo(() => (editLayout ? changedEdits(initialEdits, watched ?? {}) : {}), [editLayout, initialEdits, watched]);

  // ---- 管理者の値 ----
  const adminVars = useMemo(() => definition?.adminVars ?? [], [definition]);
  const missing = useMemo(() => missingVars(adminVars, vars), [adminVars, vars]);

  // ---- 進行・鍵・表示例・テスト・送る ----
  const editing = chosenKey !== null || channelsOnState !== null || Object.keys(vars).length > 0 || targetState !== null || Object.keys(edits).length > 0;
  const steps = useSendSteps<AdminDefinitionSendResult>({ open, editing });
  const { toConfirm, backToEdit, finish, reset: resetSteps } = steps;
  const { key: idempotencyKey, renew: renewKey } = useIdempotencyKey();
  const preview = useDefinitionPreview();
  const test = useDefinitionTest();
  const { send: sendMutation, isSending } = useDefinitionSend();
  const { close: closePreview } = preview;

  // ---- 誤り ----
  const definitionError = useMemo(() => {
    if (!options) return null;
    if (definitions.length === 0) return "送れる連絡がありません";
    if (!definition) return "送る連絡を選んでください";
    return null;
  }, [options, definitions.length, definition]);
  const contentError = useMemo(() => {
    if (!definition) return null;
    if (channelsOn.length === 0) return "送信方法を 1 つ以上選んでください";
    if (missing.length > 0) return `「${missing.map((item) => item.alias || item.key).join("・")}」を入力してください`;
    return null;
  }, [definition, channelsOn.length, missing]);
  const targetError = useMemo(() => {
    if (!definition) return null;
    if (isRecords) return entry.recordIds.length === 0 ? "対象を選んでください" : null;
    if (allowedTargetTypes.length === 0) return "この連絡は全員・ロール・グループに送れません";
    if (target.type === "role" && target.roles.length === 0) return "ロールを選んでください";
    if (target.type === "group" && target.groupId === "") return "グループを選んでください";
    return null;
  }, [definition, isRecords, entry, allowedTargetTypes.length, target]);
  const canSend = Boolean(definition) && !definitionError && !contentError && !targetError && !scheduleError;

  // ---- 入力を組む ----
  const buildEntry = useCallback((): AdminDefinitionEntry => {
    if (!definition) throw new Error("送る連絡を選んでください");
    if (entry.type === "records") return { recordTarget: entry.recordTarget, recordIds: entry.recordIds, message: definition.key };
    const broadcast =
      target.type === "role"
        ? { type: "role" as const, roles: target.roles }
        : target.type === "group"
          ? { type: "group" as const, groupId: target.groupId }
          : { type: "all" as const };
    return { message: definition.key, target: broadcast };
  }, [definition, entry, target]);

  const buildContent = useCallback(
    (): AdminDefinitionPreviewInput => ({
      entry: buildEntry(),
      ...(Object.keys(edits).length > 0 ? { edits } : {}),
      channels: channelsOn,
      ...(adminVars.length > 0 ? { vars: varValuesForInput(adminVars, vars) } : {}),
    }),
    [buildEntry, edits, channelsOn, adminVars, vars],
  );

  const buildSendInput = useCallback(
    (): AdminDefinitionSendInput => ({
      ...buildContent(),
      idempotencyKey,
      ...(!isRecords && scheduleMode === "at" && scheduledAt ? { scheduledAt } : {}),
    }),
    [buildContent, idempotencyKey, isRecords, scheduleMode, scheduledAt],
  );

  /** 直している文の検査(誤りは欄に出し、投げる) */
  const assertContent = useCallback(async () => {
    if (editLayout && !(await textForm.form.trigger())) throw new Error("内容の入力に誤りがあります");
    if (contentError) throw new Error(contentError);
  }, [editLayout, textForm.form, contentError]);

  const { run: runPreviewHook } = preview;
  const runPreview = useCallback(async () => {
    await assertContent();
    return runPreviewHook(buildContent());
  }, [assertContent, runPreviewHook, buildContent]);

  const { run: runTestHook } = test;
  const sendTest = useCallback(async () => {
    await assertContent();
    return runTestHook(buildContent());
  }, [assertContent, runTestHook, buildContent]);

  const lateOf = useCallback(
    () => (isRecords ? null : scheduleErrorOf(scheduleMode, scheduledAt, maxDays, Date.now())),
    [isRecords, scheduleMode, scheduledAt, maxDays],
  );

  /** 確認へ進む(文・予約を確かめ直す。人数の見込みは無い) */
  const requestConfirm = useCallback(async () => {
    await assertContent();
    const late = lateOf();
    setScheduleError(late);
    if (late) throw new Error(late);
    toConfirm();
  }, [assertContent, lateOf, toConfirm]);

  /** 送る(確認の段から)。成功 = 結果の段、鍵を作り直し、onSent */
  const confirmSend = useCallback(async () => {
    const late = lateOf();
    if (late) {
      setScheduleError(late);
      backToEdit();
      throw new Error(late);
    }
    const result = await sendMutation(buildSendInput());
    finish(result);
    renewKey();
    onSent?.(result);
    return result;
  }, [lateOf, backToEdit, sendMutation, buildSendInput, finish, renewKey, onSent]);

  // ---- 変える ----
  const chooseDefinition = useCallback(
    (key: string) => {
      setChosenKey(key);
      setChannelsOn(null);
      setVarsState({});
      closePreview();
    },
    [closePreview],
  );
  const toggleChannel = useCallback(
    (key: string, on: boolean) => {
      if (channelShape.locked.includes(key)) return;
      setChannelsOn((prev) => {
        const base = prev ?? definition?.initialChannels ?? [];
        return on ? (base.includes(key) ? base : [...base, key]) : base.filter((item) => item !== key);
      });
      closePreview();
    },
    [channelShape.locked, definition, closePreview],
  );
  const setVar = useCallback(
    (key: string, value: string) => {
      setVarsState((prev) => ({ ...prev, [key]: value }));
      closePreview();
    },
    [closePreview],
  );
  const setTarget = useCallback(
    (patch: Partial<DefinitionSendTarget>) => setTargetState((prev) => ({ ...(prev ?? target), ...patch })),
    [target],
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

  const { resetTo } = textForm;
  const reset = useCallback(() => {
    resetSteps();
    setChosenKey(null);
    setChannelsOn(null);
    setVarsState({});
    setTargetState(null);
    setScheduleModeState("now");
    setScheduledAtState("");
    setScheduleError(null);
    resetTo(textForm.fields, editValues);
    closePreview();
  }, [resetSteps, resetTo, textForm.fields, editValues, closePreview]);

  /** 開く・閉じる(閉じたら全部を初めに戻す。書きかけの確かめは Modal の confirmOnClose) */
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (next) renewKey();
      else reset();
    },
    [reset, renewKey],
  );

  return {
    entry,
    /** 入口を使えるか(broadcast は門 messagingBroadcast が開の時だけ。false なら入れ物は何も描かない) */
    available,
    open,
    setOpen,
    step: steps.step,
    optionsLoaded: options !== null,
    optionsError: definitionOptions.error ?? null,
    dirty: steps.dirty,
    /** Modal の confirmOnClose に渡す */
    closeConfirm: steps.closeConfirm,
    // 連絡定義
    definitions,
    definition,
    chooseDefinition,
    /** 記録の名詞(項目の表示名。broadcast は使わない) */
    recordNoun,
    recordCount: isRecords ? entry.recordIds.length : 0,
    // 送信チャンネル
    channels,
    sendChannels: channelsOn,
    toggleChannel,
    // 宛先(broadcast)
    target,
    setTarget,
    allowedTargetTypes,
    roles: sendOptions.options?.roles ?? [],
    groups: sendOptions.options?.groups ?? [],
    groupsEnabled: gate.enabled("userGroups"),
    // 管理者の値
    adminVars,
    vars,
    setVar,
    missingVars: missing,
    // テキストの編集
    /** 文面を直せるか(required でなく直せる欄がある) */
    canEdit: editLayout !== null,
    textControl: textForm.control,
    textFields: textForm.fields,
    edits,
    // 予約(broadcast だけ)
    showSchedule: !isRecords,
    scheduleMode,
    scheduledAt,
    scheduleError,
    scheduleNote: `予約は定期処理のタイミングで送信されます(Vercel Hobby では 1 日 1 回のため、指定時刻より遅れることがあります)。${maxDays} 日先まで予約できます。`,
    setScheduleMode,
    setScheduledAt,
    // 誤り・送る
    definitionError,
    contentError,
    targetError,
    canSend,
    preview: preview.preview,
    isPreviewing: preview.isPreviewing,
    isTesting: test.isTesting,
    isSending,
    result: steps.result,
    buildContent,
    buildSendInput,
    runPreview,
    closePreview,
    sendTest,
    requestConfirm,
    backToEdit,
    confirmSend,
    reset,
  };
}

export type DefinitionSendModalState = ReturnType<typeof useDefinitionSendModal>;
