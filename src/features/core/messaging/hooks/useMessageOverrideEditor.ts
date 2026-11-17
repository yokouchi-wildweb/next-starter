"use client";

// src/features/core/messaging/hooks/useMessageOverrideEditor.ts
//
// 管理: 1 連絡の文言の編集(入れ物 AdminMessageOverrideModal はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui_guards)。
// - 欄ごとの下書き(文字 = string、段落 = string[]。長さはコードの値のまま)。初めは送る時の値(effective)
// - 保存(PUT)・既定に戻す(DELETE)は欄 1 つずつ。成功したらその欄の下書きを捨て、1 連絡と一覧を取り直す
// - 下書きが 1 つでもあれば、ページを離れる前に確かめる(@/lib/unsavedGuard)。モーダルを閉じる前の確かめは closeConfirm
// - 下書きの中の知らない {{鍵}}(使ってよい鍵の外)を欄ごとに返す(保存はサーバーが同じ検査で止める)
// - 欄の道 = ひな形の欄の鍵(D132)。直せる欄は既定でひな形の全欄(連絡が adminEditableOnly で絞ればその欄だけ。server が決める)。
//   経路のタブは欄の channels(その欄を使う経路)で絞る。使えない行(経路の無い行)はどのタブにも出す
// - 欄の値はひな形の欄の中身の形のまま(1 行の文・段落・並び・組・ラベルと値・ブロックの並び …。入力は部品 LayoutFieldInput)
// - 埋め込み情報のタグ(部品 EmbeddedInfoTags): 1 件の embedded を共通 / 専用に分けて渡す(useEmbeddedInfoTags)
// - 2 つの欄の編集(D80): 今の経路のタブ(activeChannel)・入力中の欄(focusedPath)・
//   描いたプレビュー(POST /preview: 保存した値と下書きを重ねたひな形の描き方。メールは HTML、お知らせはひな形の描き方の材料 values + summary。
//   下書きが変わってから少し待って取り直す、D86)

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
  type MessageOverridePreview,
} from "../services/client/overrideClient";
import type { LayoutPreviewContent } from "../components/common/LayoutPreview";

import { MESSAGE_OVERRIDES_KEY, messageOverrideKey } from "./overrideKeys";
import { useEmbeddedInfoTags } from "./useEmbeddedInfoTags";
import { useMessageOverride } from "./useMessageOverride";

/** 欄の値(ひな形の欄の中身の形のまま: 文字・数・並び・組・ブロックの並び …) */
export type OverrideFieldValue = unknown;

/** 値を編集の形にそろえる(無い値は空の文字) */
export function toEditable(value: unknown): OverrideFieldValue {
  return value === null || value === undefined ? "" : value;
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

/** 描いた HTML に入力中の欄の枠の style を足す(data-field の印に当てる) */
export function withFocusStyle(html: string, focusedPath: string | null | undefined): string {
  if (!focusedPath) return html;
  const value = focusedPath.replace(/["\\]/g, "");
  const style = `<style>[data-field="${value}"],[data-field^="${value}."]{outline:2px solid #f59e0b;outline-offset:2px;border-radius:2px}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : `${style}${html}`;
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
    (field: AdminOverrideField): OverrideFieldValue => (field.path in drafts ? drafts[field.path] : toEditable(field.effective)),
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

  /** 今の経路の欄(その経路が使う欄と、使えない・直せなくなった行) */
  const activeFields = useMemo(
    () => (detail?.fields ?? []).filter((field) => field.channels.includes(activeChannel) || field.channels.length === 0),
    [detail, activeChannel],
  );
  /** 今の経路の値(下書き、無ければ送る時の値)。プレビューが読む */
  const activeValues = useMemo(
    () => Object.fromEntries(activeFields.filter((field) => field.editable).map((field) => [field.path, drafts[field.path] ?? field.effective])),
    [activeFields, drafts],
  );
  const activeDrafts = useMemo(
    () => Object.fromEntries(Object.entries(drafts).filter(([path]) => activeFields.some((field) => field.path === path))),
    [drafts, activeFields],
  );
  const draftSignature = JSON.stringify(activeDrafts);
  const detailVersion = detail ? JSON.stringify(detail.fields.map((field) => field.updatedAt)) : "";
  // 今の求め(経路・下書き・保存の版)。結果がこの求めの物でなければ描き直し中
  const previewRequest = `${activeChannel}|${draftSignature}|${detailVersion}`;
  const [preview, setPreview] = useState<{ request: string; result: MessageOverridePreview | null } | null>(null);
  const hasDetail = Boolean(detail);
  useEffect(() => {
    if (!hasDetail || !activeChannel) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewMessageOverride(messageKey, { channel: activeChannel, values: JSON.parse(draftSignature) as Record<string, unknown> })
        .then((result) => {
          if (!cancelled) setPreview({ request: previewRequest, result });
        })
        .catch(() => {
          // 描けない時はプレビューを出さない(画面の操作は止めない)
          if (!cancelled) setPreview({ request: previewRequest, result: null });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [messageKey, activeChannel, draftSignature, previewRequest, hasDetail]);
  const previewLoading = hasDetail && preview?.request !== previewRequest;
  const previewResult = preview?.result && preview.result.channel === activeChannel ? preview.result : null;
  const activeChannelInfo = detail?.channels.find((channel) => channel.key === activeChannel) ?? null;
  /** プレビューの描く物(部品 LayoutPreview の content。メールの HTML には入力中の欄の枠) */
  const previewContent = useMemo<LayoutPreviewContent | null>(
    () =>
      previewResult
        ? {
            html: previewResult.html ? withFocusStyle(previewResult.html, focusedPath) : null,
            text: previewResult.text,
            title: previewResult.summary?.title ?? null,
            values: previewResult.values,
            summary: previewResult.summary,
            cannotRender: previewResult.cannotRender,
          }
        : null,
    [previewResult, focusedPath],
  );
  const embeddedTags = useEmbeddedInfoTags({ catalog: detail?.embedded ?? null });
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
    activeChannelInfo,
    activeFields,
    activeValues,
    focusedPath,
    setFocusedPath,
    /** 描いたプレビュー(今の経路の物だけ。メールの HTML・お知らせの描き方の材料。無ければ null) */
    preview: previewResult,
    /** プレビューのひな形の鍵と描く物(部品 LayoutPreview に渡す) */
    previewLayout: preview?.result?.layout ?? null,
    previewContent,
    previewLoading,
    /** 埋め込み情報のタグ(共通 / 専用・押すとコピー) */
    embeddedTags,
    /** 使えない行の数(送る時はコードの値) */
    unusableCount: (detail?.fields ?? []).filter((field) => field.unusable).length,
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
