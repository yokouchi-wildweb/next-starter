"use client";

// src/features/core/messaging/hooks/useMessageOverrideEditor.ts
//
// 管理: 1 連絡の文言の編集(入れ物 AdminMessageOverrideModal はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui_guards)。
// - 欄ごとの下書き(ひな形の欄の中身の形)。初めは送る時の値(effective)
// - 保存は 1 回(D132): 下の帯の「保存」が直した欄の全部と「元の文言に戻す」の印の欄を PUT { fields } でまとめて送る(1 つの取引、
//   どれかが誤りなら何も書かない)。欄の誤りは fieldErrors(400 code override_fields_invalid の details.fields)で欄に出す。
//   成功したら下書き・印を捨て、1 連絡と一覧を取り直す
// - 欄ごとの操作は「元の文言に戻す」だけ(resetField): 保存してある欄は戻す印を付けて保存で消す(画面はコードの値を見せる)、下書きだけの欄は下書きを捨てる
// - 下書きが 1 つでもあれば、ページを離れる前に確かめる(@/lib/unsavedGuard)。モーダルを閉じる前の確かめは closeConfirm
// - 下書きの中の知らない {{鍵}}(使ってよい鍵の外)を欄ごとに返す(保存はサーバーが同じ検査で止める)
// - 欄の道 = ひな形の欄の鍵(D132)。直せる欄は既定でひな形の全欄(連絡が adminEditableOnly で絞ればその欄だけ。server が決める)。
//   経路のタブは欄の channels(その欄を使う経路)で絞る。使えない行(経路の無い行)はどのタブにも出す
// - 欄の値はひな形の欄の中身の形のまま(1行テキスト・段落・並び・組・ラベルと値・ブロックの並び …。入力は部品 LayoutFieldInput)
// - 埋め込み情報のタグ(部品 EmbeddedInfoTags): 1 件の embedded を共通 / 専用に分けて渡す(useEmbeddedInfoTags)
// - 別名で見せる(D133): 画面に出す値(入力・元の文言・使えない名前・プレビュー)の {{鍵}} は一覧の別名があれば {{別名}} で見せる。
//   直していない欄の比べる元も別名にした値なので、開いただけでは下書きにならない。打った値は {{別名}} のまま保存する(サーバーは別名も通す)
// - 「すべてデフォルトに戻す」(D136): resetAll = 下書きを捨て、保存してある欄(使えない行も)の全部に戻す印。保存で当たる
// - 2 つの欄の編集(D80): 今の経路のタブ(activeChannel)・入力中の欄(focusedPath)・
//   描いたプレビュー(POST /preview: 保存した値と下書きを重ねたひな形の描き方。メールは HTML、お知らせはひな形の描き方の材料 values + summary。
//   下書きが変わってから少し待って取り直す、D86)

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err, getErrorCode, getErrorDetails } from "@/lib/errors";
import { listVariables } from "@/lib/templateVariables";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import {
  previewMessageOverride,
  saveMessageOverride,
  type AdminOverrideField,
  type AdminOverrideMessageDetail,
  type MessageOverridePreview,
  type SaveMessageOverrideInput,
} from "../services/client/overrideClient";
import type { LayoutPreviewContent } from "../components/common/LayoutPreview";

import { MESSAGE_OVERRIDES_KEY, messageOverrideKey } from "./overrideKeys";
import { replaceKeysWithAliases, useEmbeddedInfoTags, valueWithAliases } from "./useEmbeddedInfoTags";
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

/** HTML に入れる別名(属性の中にも入るので " も) */
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const same = (a: OverrideFieldValue, b: OverrideFieldValue) => JSON.stringify(a) === JSON.stringify(b);

/** まとめての保存で欄に誤りがある時の 400 の code(server overrides/overrideService.ts OVERRIDE_FIELDS_INVALID と同じ字) */
const OVERRIDE_FIELDS_INVALID = "override_fields_invalid";

/** 400 の details から欄ごとの誤り(形が違えば空) */
function fieldErrorsOf(error: unknown): Record<string, string> {
  if (getErrorCode(error) !== OVERRIDE_FIELDS_INVALID) return {};
  const fields = (getErrorDetails(error) as { fields?: unknown } | null)?.fields;
  if (!fields || typeof fields !== "object") return {};
  return Object.fromEntries(Object.entries(fields as Record<string, unknown>).map(([path, message]) => [path, String(message)]));
}

export function useMessageOverrideEditor(messageKey: string) {
  const { showToast } = useToast();
  const { detail, error, isLoading } = useMessageOverride(messageKey);
  const [drafts, setDrafts] = useState<Record<string, OverrideFieldValue>>({});
  /** 「元の文言に戻す」の印の欄(保存してある欄。保存で行を消す) */
  const [resets, setResets] = useState<string[]>([]);
  /** 欄ごとの保存の誤り(まとめての保存の 400) */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const revalidateKeys = [messageOverrideKey(messageKey), MESSAGE_OVERRIDES_KEY];

  const saveMutation = useDomainMutation<AdminOverrideMessageDetail, SaveMessageOverrideInput>(
    `${messageOverrideKey(messageKey)}/save`,
    (input) => saveMessageOverride(messageKey, input),
    revalidateKeys,
  );

  const allowedKeys = useMemo(() => detail?.allowedKeys ?? [], [detail]);
  const embeddedTags = useEmbeddedInfoTags({ catalog: detail?.embedded ?? null });
  const { aliases } = embeddedTags;
  /** 欄の送る時の値(別名で見せる形。下書きの比べる元) */
  const effectiveOf = useCallback((field: AdminOverrideField) => valueWithAliases(toEditable(field.effective), aliases), [aliases]);
  /** 欄のコードの値(元の文言。別名で見せる形) */
  const codeValueOf = useCallback((field: AdminOverrideField) => valueWithAliases(toEditable(field.codeValue), aliases), [aliases]);
  const [channelState, setActiveChannel] = useState<string | null>(null);
  const activeChannel = channelState ?? detail?.channels[0]?.key ?? "";
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  /** 欄の今の値(下書き、戻す印ならコードの値、無ければ送る時の値。{{鍵}} は別名で見せる) */
  const valueOf = useCallback(
    (field: AdminOverrideField): OverrideFieldValue =>
      field.path in drafts ? drafts[field.path] : resets.includes(field.path) ? codeValueOf(field) : effectiveOf(field),
    [drafts, resets, codeValueOf, effectiveOf],
  );

  const clearError = useCallback(
    (path: string) =>
      setFieldErrors((prev) => {
        if (!(path in prev)) return prev;
        const next = { ...prev };
        delete next[path];
        return next;
      }),
    [],
  );

  const dropDraft = useCallback(
    (path: string) =>
      setDrafts((prev) => {
        if (!(path in prev)) return prev;
        const next = { ...prev };
        delete next[path];
        return next;
      }),
    [],
  );

  /** 欄を直す(送る時の値と同じなら下書きを捨てる。戻す印は外す) */
  const setDraft = useCallback(
    (field: AdminOverrideField, value: OverrideFieldValue) => {
      setResets((prev) => (prev.includes(field.path) ? prev.filter((path) => path !== field.path) : prev));
      clearError(field.path);
      setDrafts((prev) => {
        const next = { ...prev };
        if (same(value, effectiveOf(field))) delete next[field.path];
        else next[field.path] = value;
        return next;
      });
    },
    [clearError, effectiveOf],
  );

  /** 下書きか戻す印がある(保存していない) */
  const isDirty = useCallback((field: AdminOverrideField) => field.path in drafts || resets.includes(field.path), [drafts, resets]);
  /** 戻す印がある(保存すると行を消す) */
  const isResetPending = useCallback((field: AdminOverrideField) => resets.includes(field.path), [resets]);

  /** 今の経路の欄(その経路が使う欄と、使えない・直せなくなった行) */
  const activeFields = useMemo(
    () => (detail?.fields ?? []).filter((field) => field.channels.includes(activeChannel) || field.channels.length === 0),
    [detail, activeChannel],
  );
  /** 今の経路の値(下書き、戻す印ならコードの値、無ければ送る時の値)。プレビューが読む */
  const activeValues = useMemo(
    () => Object.fromEntries(activeFields.filter((field) => field.editable).map((field) => [field.path, valueOf(field)])),
    [activeFields, valueOf],
  );
  /** プレビューに重ねる未保存の値(下書きと、戻す印の欄のコードの値) */
  const activeDrafts = useMemo(
    () =>
      Object.fromEntries(
        activeFields
          .filter((field) => field.editable && (field.path in drafts || resets.includes(field.path)))
          .map((field) => [field.path, valueOf(field)]),
      ),
    [drafts, resets, activeFields, valueOf],
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
  // コードの値に残る {{鍵}} も別名で見せる(HTML に入れる別名は escape)
  const previewContent = useMemo<LayoutPreviewContent | null>(
    () =>
      previewResult
        ? {
            html: previewResult.html ? withFocusStyle(replaceKeysWithAliases(previewResult.html, aliases, escapeHtml), focusedPath) : null,
            text: previewResult.text ? replaceKeysWithAliases(previewResult.text, aliases) : previewResult.text,
            title: previewResult.summary?.title ? replaceKeysWithAliases(previewResult.summary.title, aliases) : null,
            values: valueWithAliases(previewResult.values, aliases),
            summary: valueWithAliases(previewResult.summary, aliases),
            cannotRender: previewResult.cannotRender,
          }
        : null,
    [previewResult, focusedPath, aliases],
  );
  const hasDrafts = Object.keys(drafts).length > 0 || resets.length > 0;
  useUnsavedGuard(hasDrafts);

  /**
   * 1 回の保存(D132): 直した欄の全部と戻す印の欄をまとめて保存する(1 つの取引)。下の帯の「保存」(ConfirmPopover・Promise の間 loading)。
   * 欄の誤りは fieldErrors に入れて欄に出す(何も保存されない)。誤りは知らせに出し、投げない
   */
  const saveAll = useCallback(async () => {
    const fields: SaveMessageOverrideInput["fields"] = [
      ...Object.entries(drafts).map(([fieldPath, value]) => ({ fieldPath, value })),
      ...resets.filter((path) => !(path in drafts)).map((fieldPath) => ({ fieldPath, reset: true as const })),
    ];
    if (fields.length === 0) return;
    try {
      await saveMutation.trigger({ fields });
      setDrafts({});
      setResets([]);
      setFieldErrors({});
      showToast("保存しました", "success");
    } catch (e) {
      setFieldErrors(fieldErrorsOf(e));
      showToast(err(e, "保存できませんでした"), "error");
    }
  }, [drafts, resets, saveMutation, showToast]);

  /** 「すべてデフォルトに戻す」(D136): 下書き・誤りを捨て、保存してある欄(使えない行も)の全部に戻す印。保存で当たる */
  const resetAll = useCallback(() => {
    setDrafts({});
    setFieldErrors({});
    setResets((detail?.fields ?? []).filter((field) => field.edited).map((field) => field.path));
  }, [detail]);
  /** すべて戻すことで変わる物がある(下書きか、戻す印の無い保存してある欄) */
  const canResetAll = Object.keys(drafts).length > 0 || (detail?.fields ?? []).some((field) => field.edited && !resets.includes(field.path));

  /** 「元の文言に戻す」: 保存してある欄は戻す印(保存で行を消す)、下書きだけの欄は下書きを捨てる */
  const reset = useCallback(
    (field: AdminOverrideField) => {
      dropDraft(field.path);
      clearError(field.path);
      if (field.edited) setResets((prev) => (prev.includes(field.path) ? prev : [...prev, field.path]));
    },
    [dropDraft, clearError],
  );

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
    isResetPending,
    hasDrafts,
    /** 保存していない欄の数(下書き + 戻す印) */
    pendingCount: new Set([...Object.keys(drafts), ...resets]).size,
    /** 欄ごとの保存の誤り(欄の鍵 → 理由) */
    fieldErrors,
    isSaving: saveMutation.isMutating,
    /** モーダルを閉じる前の確かめ(Modal の confirmOnClose に渡す) */
    closeConfirm: { enabled: hasDrafts, message: "保存していない変更があります。閉じてもよろしいですか？" },
    /** 下書きの中の知らない名前(別名のある名前は別名で) */
    unknownKeys: (field: AdminOverrideField) => unknownKeysOf(valueOf(field), allowedKeys).map(embeddedTags.aliasOf),
    /** 欄のコードの値(元の文言、別名で見せる形) */
    codeValueOf,
    saveAll,
    reset,
    resetAll,
    canResetAll,
  };
}
