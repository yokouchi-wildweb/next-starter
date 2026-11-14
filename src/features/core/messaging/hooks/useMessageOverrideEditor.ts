"use client";

// src/features/core/messaging/hooks/useMessageOverrideEditor.ts
//
// 管理: 1 連絡の文言の編集(入れ物 AdminMessageOverrideModal はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui_guards)。
// - 欄ごとの下書き(文字 = string、段落 = string[]。長さはコードの値のまま)。初めは送る時の値(effective)
// - 保存(PUT)・既定に戻す(DELETE)は欄 1 つずつ。成功したらその欄の下書きを捨て、1 連絡と一覧を取り直す
// - 下書きが 1 つでもあれば、ページを離れる前に確かめる(@/lib/unsavedGuard)。モーダルを閉じる前の確かめは closeConfirm
// - 下書きの中の知らない {{鍵}}(使ってよい鍵の外)を欄ごとに返す(保存はサーバーが同じ検査で止める)

import { useCallback, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { listVariables } from "@/lib/structuredDocument";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import {
  resetMessageOverride,
  saveMessageOverride,
  type AdminOverrideField,
  type AdminOverrideMessageDetail,
} from "../services/client/overrideClient";

import { MESSAGE_OVERRIDES_KEY, messageOverrideKey } from "./overrideKeys";
import { useMessageOverride } from "./useMessageOverride";

/** 欄の値(文字 or 段落の並び) */
export type OverrideFieldValue = string | string[];

/** 値を編集の形にそろえる(文字・文字の並び以外は文字にする) */
export function toEditable(value: unknown): OverrideFieldValue {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : String(v ?? "")));
  if (typeof value === "string") return value;
  return value === null || value === undefined ? "" : String(value);
}

/** 値の中の知らない {{鍵}} */
export function unknownKeysOf(value: OverrideFieldValue, allowedKeys: readonly string[]): string[] {
  const texts = Array.isArray(value) ? value : [value];
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
        showToast("既定に戻しました", "success");
      } catch (e) {
        showToast(err(e, "既定に戻せませんでした"), "error");
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
    allowedKeys,
    valueOf,
    setDraft,
    isDirty,
    hasDrafts,
    /** モーダルを閉じる前の確かめ(Modal の confirmOnClose に渡す) */
    closeConfirm: { enabled: hasDrafts, message: "保存していない欄があります。閉じてもよろしいですか？" },
    unknownKeys: (field: AdminOverrideField) => unknownKeysOf(valueOf(field), allowedKeys),
    save,
    reset,
    discard,
  };
}
