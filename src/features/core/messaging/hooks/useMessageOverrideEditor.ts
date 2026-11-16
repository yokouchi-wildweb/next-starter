"use client";

// src/features/core/messaging/hooks/useMessageOverrideEditor.ts
//
// 管理: 1 連絡の文言の編集(入れ物 AdminMessageOverrideModal はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui_guards)。
// - 欄ごとの下書き(文字 = string、段落 = string[]。長さはコードの値のまま)。初めは送る時の値(effective)
// - 保存(PUT)・既定に戻す(DELETE)は欄 1 つずつ。成功したらその欄の下書きを捨て、1 連絡と一覧を取り直す
// - 下書きが 1 つでもあれば、ページを離れる前に確かめる(@/lib/unsavedGuard)。モーダルを閉じる前の確かめは closeConfirm
// - 下書きの中の知らない {{鍵}}(使ってよい鍵の外)を欄ごとに返す(保存はサーバーが同じ検査で止める)
// - 2 つの欄の編集(D80): 今の経路のタブ(activeChannel)・入力中の欄(focusedPath)・今の経路の値(下書きを重ねた物)、
//   描いたプレビュー(POST /preview。下書きが変わってから少し待って取り直す、D86)

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { listVariables } from "@/lib/structuredDocument";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import {
  previewMessageOverride,
  resetMessageOverride,
  saveMessageOverride,
  type AdminOverrideField,
  type AdminOverrideMessageDetail,
} from "../services/client/overrideClient";

import { MESSAGE_OVERRIDES_KEY, messageOverrideKey } from "./overrideKeys";
import { useMessageOverride } from "./useMessageOverride";

/** 欄の値(文字・文字の並び・部分の object(例 メールのボタン { label, url })) */
export type OverrideFieldValue = string | string[] | Record<string, unknown>;

/** 値を編集の形にそろえる(文字・文字の並び・object 以外は文字にする) */
export function toEditable(value: unknown): OverrideFieldValue {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : String(v ?? "")));
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return { ...(value as Record<string, unknown>) };
  return value === null || value === undefined ? "" : String(value);
}

function collectTexts(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectTexts(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectTexts(item, out);
  return out;
}

/** 値の中の知らない {{鍵}} */
export function unknownKeysOf(value: OverrideFieldValue, allowedKeys: readonly string[]): string[] {
  const texts = collectTexts(value, []);
  const found = new Set<string>();
  for (const text of texts) for (const key of listVariables(text)) if (!allowedKeys.includes(key)) found.add(key);
  return [...found];
}

const same = (a: OverrideFieldValue, b: OverrideFieldValue) => JSON.stringify(a) === JSON.stringify(b);

export function useMessageOverrideEditor(messageKey: string) {
  const { showToast } = useToast();
  const { detail, error, isLoading } = useMessageOverride(messageKey);
  const [drafts, setDrafts] = useState<Record<string, OverrideFieldValue>>({});
  const revalidateKeys = [messageOverrideKey(messageKey), MESSAGE_OVERRIDES_KEY];

  const saveMutation = useDomainMutation<AdminOverrideMessageDetail, { fieldPath: string; value: OverrideFieldValue }>(
    `${messageOverrideKey(messageKey)}/save`,
    (input) => saveMessageOverride(messageKey, input),
    revalidateKeys,
  );
  const resetMutation = useDomainMutation<AdminOverrideMessageDetail, string>(
    `${messageOverrideKey(messageKey)}/reset`,
    (fieldPath) => resetMessageOverride(messageKey, fieldPath),
    revalidateKeys,
  );

  const allowedKeys = useMemo(() => detail?.allowedKeys ?? [], [detail]);
  const [channelState, setActiveChannel] = useState<string | null>(null);
  const activeChannel = channelState ?? detail?.channels[0]?.key ?? "";
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  /** 欄の今の値(下書き、無ければ送る時の値) */
  const valueOf = useCallback(
    (field: AdminOverrideField): OverrideFieldValue => drafts[field.path] ?? toEditable(field.effective),
    [drafts],
  );

  const setDraft = useCallback(
    (field: AdminOverrideField, value: OverrideFieldValue) =>
      setDrafts((prev) => {
        const next = { ...prev };
        if (same(value, toEditable(field.effective))) delete next[field.path];
        else next[field.path] = value;
        return next;
      }),
    [],
  );

  const dropDraft = useCallback(
    (path: string) =>
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      }),
    [],
  );

  const isDirty = useCallback((field: AdminOverrideField) => field.path in drafts, [drafts]);

  /** 今の経路の欄(直せる欄と直せなくなった欄の行) */
  const activeFields = useMemo(() => (detail?.fields ?? []).filter((field) => field.channel === activeChannel), [detail, activeChannel]);
  /** 今の経路の欄の表示の約束 */
  const activeFieldMeta = useMemo(
    () => Object.fromEntries(activeFields.filter((field) => field.editable).map((field) => [field.field, field.meta])),
    [activeFields],
  );
  /** 今の経路の値(下書き、無ければ送る時の値)。プレビューが読む */
  const activeValues = useMemo(
    () => Object.fromEntries(activeFields.filter((field) => field.editable).map((field) => [field.field, drafts[field.path] ?? field.effective])),
    [activeFields, drafts],
  );
  const activeDrafts = useMemo(
    () => Object.fromEntries(Object.entries(drafts).filter(([path]) => path.startsWith(`${activeChannel}.`))),
    [drafts, activeChannel],
  );
  const draftSignature = JSON.stringify(activeDrafts);
  const detailVersion = detail ? JSON.stringify(detail.fields.map((field) => field.updatedAt)) : "";
  // 今の求め(経路・下書き・保存の版)。結果がこの求めの物でなければ描き直し中
  const previewRequest = `${activeChannel}|${draftSignature}|${detailVersion}`;
  const [preview, setPreview] = useState<{ request: string; channel: string; html: string | null } | null>(null);
  const hasDetail = Boolean(detail);
  useEffect(() => {
    if (!hasDetail || !activeChannel) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewMessageOverride(messageKey, { channel: activeChannel, values: JSON.parse(draftSignature) as Record<string, unknown> })
        .then((result) => {
          if (!cancelled) setPreview({ request: previewRequest, channel: result.channel, html: result.html });
        })
        .catch(() => {
          // 描けない時は欄から組んだ形に戻る(画面の操作は止めない)
          if (!cancelled) setPreview({ request: previewRequest, channel: activeChannel, html: null });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [messageKey, activeChannel, draftSignature, previewRequest, hasDetail]);
  const previewLoading = hasDetail && preview?.request !== previewRequest;
  const hasDrafts = Object.keys(drafts).length > 0;
  useUnsavedGuard(hasDrafts);

  /** 欄 1 つを保存(ConfirmPopover・ボタンが Promise の間 loading) */
  const save = useCallback(
    async (field: AdminOverrideField) => {
      try {
        await saveMutation.trigger({ fieldPath: field.path, value: valueOf(field) });
        dropDraft(field.path);
        showToast("保存しました", "success");
      } catch (e) {
        showToast(err(e, "保存できませんでした"), "error");
      }
    },
    [saveMutation, valueOf, dropDraft, showToast],
  );

  /** 欄 1 つを既定に戻す(行を消す) */
  const reset = useCallback(
    async (field: AdminOverrideField) => {
      try {
        await resetMutation.trigger(field.path);
        dropDraft(field.path);
        showToast("元の文言に戻しました", "success");
      } catch (e) {
        showToast(err(e, "元の文言に戻せませんでした"), "error");
      }
    },
    [resetMutation, dropDraft, showToast],
  );

  /** 下書きを捨てる */
  const discard = useCallback((field: AdminOverrideField) => dropDraft(field.path), [dropDraft]);

  return {
    detail,
    error,
    isLoading,
    /** 経路のタブ(連絡の種類の経路) */
    channels: detail?.channels ?? [],
    activeChannel,
    setActiveChannel,
    activeChannelInfo: detail?.channels.find((channel) => channel.key === activeChannel) ?? null,
    activeFields,
    activeFieldMeta,
    activeValues,
    focusedPath,
    setFocusedPath,
    /** 描いたプレビューの HTML(今の経路の物だけ。無ければ null) */
    previewHtml: preview && preview.channel === activeChannel ? preview.html : null,
    previewLoading,
    allowedKeys,
    valueOf,
    setDraft,
    isDirty,
    hasDrafts,
    /** モーダルを閉じる前の確かめ(Modal の confirmOnClose に渡す) */
    closeConfirm: { enabled: hasDrafts, message: "保存していない変更があります。閉じてもよろしいですか？" },
    unknownKeys: (field: AdminOverrideField) => unknownKeysOf(valueOf(field), allowedKeys),
    save,
    reset,
    discard,
  };
}
