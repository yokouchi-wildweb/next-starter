"use client";

// src/features/core/messaging/hooks/useLayoutPreview.ts
//
// ひな形のプレビューの流れ(部品 LayoutPreview に渡す。テンプレートの作る・直す画面と送る画面が使う、D114)。
// - 経路のタブ = 渡した channels(種類の経路)。選んだ経路 1 つを描く
// - 未入力の欄はひな形が宣言した仮の文(placeholder)で埋めて描く(D114)。ブロックの並びが空なら仮の文の段落 1 つ
// - 入力が止まって 400ms 後に POST /api/admin/messaging/layouts/preview(保存しない)。結果がいまの求めの物でなければ描き直し中
// - 必須の欄が空の経路を incompleteChannels で返す(タブの印、D117)
// - お知らせ(inApp)はカードを client の描き方(layoutInApps)で描くので、経路だけの欄を除いた中身(inAppValues)も返す

import { useCallback, useEffect, useMemo, useState } from "react";

import { fieldBelongsTo, type MessageFieldSpec, type MessageLayoutFields } from "@/lib/messaging";

import { previewMessageLayout, type AdminLayoutPreview } from "../services/client/templateClient";

export type UseLayoutPreviewOptions = {
  /** ひな形の鍵(無い = 描かない) */
  layout?: string | null;
  /** ひな形の欄の宣言(仮の文と経路だけの欄に使う) */
  fields?: MessageLayoutFields | null;
  /** 今の欄の中身(フォームの watch の値) */
  values?: Readonly<Record<string, unknown>> | null;
  /** 送る経路の鍵(タブの順) */
  channels: readonly string[];
  /** 送る種類(停止のリンクの見本) */
  category?: string | null;
  /** 描くか(閉じたモーダルでは描かない) */
  enabled?: boolean;
};

/** 空か(文字は空白だけ・並びは 0 個・object は中が全部空) */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isEmptyValue);
  return false;
}

/** 欄 1 つの仮の値(宣言の placeholder を型の形にする。無ければ見出しを括弧で) */
function placeholderValue(spec: MessageFieldSpec): unknown {
  const text = spec.placeholder ?? `(${spec.label})`;
  switch (spec.type) {
    case "line":
    case "paragraph":
    case "longText":
      return text;
    case "button":
      return { label: text, url: "https://example.com" };
    case "link":
      return { label: text, url: "https://example.com" };
    case "blocks":
      return [{ type: "paragraph", text }];
    case "list":
      return spec.of.type === "line" || spec.of.type === "paragraph" || spec.of.type === "longText" ? [text] : undefined;
    default:
      // 画像・日付・数・選択肢・組・ラベルと値は仮の値を作らない(形の無い値で描きを崩さない)
      return undefined;
  }
}

/** 未入力の欄を仮の文で埋めた中身 */
export function withPlaceholders(fields: MessageLayoutFields, values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(fields)) {
    const value = values[key];
    if (!isEmptyValue(value)) out[key] = value;
    else {
      const fallback = placeholderValue(spec);
      if (fallback !== undefined) out[key] = fallback;
    }
  }
  return out;
}

export function useLayoutPreview({ layout, fields, values, channels, category, enabled = true }: UseLayoutPreviewOptions) {
  const [channelState, setChannelState] = useState<string | null>(null);
  // 選んだ経路がタブから消えたら最初のタブ(effect で戻さない)
  const channel = channelState && channels.includes(channelState) ? channelState : (channels[0] ?? null);

  const filled = useMemo(() => (fields ? withPlaceholders(fields, values ?? {}) : {}), [fields, values]);
  const filledSignature = JSON.stringify(filled);
  const request = layout && channel ? `${layout}|${channel}|${category ?? ""}|${filledSignature}` : null;
  const [result, setResult] = useState<{ request: string; preview: AdminLayoutPreview | null; error: unknown } | null>(null);

  useEffect(() => {
    if (!enabled || !request || !layout || !channel) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewMessageLayout({
        layout,
        channel,
        ...(category ? { category } : {}),
        values: JSON.parse(filledSignature) as Record<string, unknown>,
      })
        .then((preview) => {
          if (!cancelled) setResult({ request, preview, error: null });
        })
        .catch((error: unknown) => {
          if (!cancelled) setResult({ request, preview: null, error });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, request, layout, channel, category, filledSignature]);

  const current = result && result.request === request ? result : null;
  /** お知らせのカードに渡す中身(その経路の欄だけ、仮の文で埋めた物) */
  const channelValues = useMemo(() => {
    if (!fields || !channel) return filled;
    return Object.fromEntries(Object.entries(filled).filter(([key]) => !fields[key] || fieldBelongsTo(fields[key], channel)));
  }, [fields, channel, filled]);

  const setChannel = useCallback((next: string) => setChannelState(next), []);

  /** 必須の欄(その経路で使う物)が空の経路(仮の文で埋める前の値で見る、D117) */
  const incompleteChannels = useMemo(() => {
    if (!fields) return [];
    const raw = values ?? {};
    return channels.filter((key) =>
      Object.entries(fields).some(([name, spec]) => spec.required && fieldBelongsTo(spec, key) && isEmptyValue(raw[name])),
    );
  }, [fields, values, channels]);

  // 前の結果は描き直しの間も残す(同じ経路の物だけ)
  const preview = current?.preview ?? (result?.preview && result.preview.channel === channel ? result.preview : null);
  /** 部品 LayoutPreview の content(送る HTML・題・要約 + お知らせのカードの中身・描けない理由) */
  const content = useMemo(() => (preview ? { ...preview, values: channelValues } : null), [preview, channelValues]);

  return {
    channel,
    setChannel,
    channels,
    layout: layout ?? null,
    content,
    incompleteChannels,
    loading: Boolean(enabled && request) && !current,
    error: current?.error ?? null,
  };
}
