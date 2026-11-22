"use client";

// src/domains/core/messaging/hooks/useLayoutPreview.ts
//
// レイアウトのプレビューの流れ(部品 LayoutPreview に渡す。テンプレートの作る・直す画面と送る画面が使う、D114)。
// - 送信チャンネルのタブ = 渡した channels(カテゴリーの送信チャンネル)。選んだ送信チャンネル 1 つを描く
// - 空の欄(D127): mode send = 描かない(空のボタン・リンク・画像も出さない)/ template = 欄の見出しの目印で描き、部品 LayoutPreview が仮の枠に置き換える
//   (ブロックの並びが空なら目印の段落 1 つ、空のブロックは種類の名前の目印、目印を行き先の URL に入れない = "#")
// - 入力が止まって 400ms 後に POST /api/admin/messaging/layouts/preview(保存しない)。結果がいまの求めの物でなければ描き直し中
// - 必須の欄が空の送信チャンネルを incompleteChannels で返す(タブの印、D117)
// - お知らせ(inApp)はカードを client の描き方(layoutInApps)で描くので、送信チャンネルだけの欄を除いた中身(inAppValues)も返す

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fieldBelongsTo,
  fieldRequiredIn,
  MESSAGE_BLOCK_KIND_LABELS,
  type MessageBlockKind,
  type MessageFieldShape,
  type MessageLayoutFields,
} from "@/lib/messaging";

import { previewMarker } from "@/domains/core/messaging/components/common/LayoutPreview";

import { previewMessageLayout, type AdminLayoutPreview } from "../services/client/templateClient";

export type UseLayoutPreviewOptions = {
  /** レイアウトの鍵(無い = 描かない) */
  layout?: string | null;
  /** レイアウトの欄の宣言(仮の文と送信チャンネルだけの欄に使う) */
  fields?: MessageLayoutFields | null;
  /** 今の欄の中身(フォームの watch の値) */
  values?: Readonly<Record<string, unknown>> | null;
  /** 使う送信チャンネルの鍵(タブの順) */
  channels: readonly string[];
  /** 送るカテゴリー(停止のリンクの見本) */
  category?: string | null;
  /** 描くか(閉じたモーダルでは描かない) */
  enabled?: boolean;
  /** プレビューの形(既定 template。送る画面は send、D127) */
  mode?: LayoutPreviewMode;
};

/** 空か(文字は空白だけ・並びは 0 個・object は中が全部空) */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isEmptyValue);
  return false;
}

/** プレビューの形(D127): send = 空の欄は描かない / template = 空の欄は見出しの目印で描き、部品が仮の枠に置き換える */
export type LayoutPreviewMode = "send" | "template";

const isBlank = (value: unknown) => typeof value !== "string" || value.trim() === "";
const str = (value: unknown) => (typeof value === "string" ? value : "");
const rec = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** ブロック 1 つを送る形に: 描けない空のブロックは null(落とす) */
function sendBlock(block: Record<string, unknown>): Record<string, unknown> | null {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return isBlank(block.text) ? null : block;
    case "button":
      return isBlank(block.label) || isBlank(block.url) ? null : block;
    case "image":
      return isBlank(block.src) ? null : block;
    case "keyValueTable": {
      const rows = (Array.isArray(block.rows) ? block.rows : []).map(rec).filter((row) => !isBlank(row.key));
      return rows.length === 0 ? null : { ...block, rows };
    }
    case "bulletList": {
      const items = (Array.isArray(block.items) ? block.items : []).filter((item) => !isBlank(item));
      return items.length === 0 ? null : { ...block, items };
    }
    default:
      return block;
  }
}

/** ブロック 1 つをテンプレートのプレビューの形に: 空の所は種類の名前の目印(URL は "#"、目印を行き先に入れない) */
function templateBlock(block: Record<string, unknown>): Record<string, unknown> {
  const kind = MESSAGE_BLOCK_KIND_LABELS[block.type as MessageBlockKind] ?? String(block.type);
  const mark = previewMarker(kind);
  switch (block.type) {
    case "heading":
    case "paragraph":
      return isBlank(block.text) ? { ...block, text: mark } : block;
    case "button":
      return { ...block, label: isBlank(block.label) ? mark : block.label, url: isBlank(block.url) ? "#" : block.url };
    case "keyValueTable": {
      const rows = (Array.isArray(block.rows) ? block.rows : []).map(rec);
      return rows.length === 0 || rows.every((row) => isBlank(row.key)) ? { ...block, rows: [{ key: mark, value: "" }] } : block;
    }
    case "bulletList": {
      const items = (Array.isArray(block.items) ? block.items : []).filter((item) => !isBlank(item));
      return items.length === 0 ? { ...block, items: [mark] } : { ...block, items };
    }
    default:
      return block;
  }
}

/** 欄 1 つを送る形に(空は undefined = 落とす) */
function sendValue(shape: MessageFieldShape, value: unknown): unknown {
  switch (shape.type) {
    case "line":
    case "paragraph":
    case "longText":
    case "image":
    case "date":
    case "select":
      return isBlank(value) ? undefined : value;
    case "number":
      return typeof value === "number" ? value : undefined;
    case "button": {
      const v = rec(value);
      return isBlank(v.label) || isBlank(v.url) ? undefined : v;
    }
    case "link": {
      const v = rec(value);
      return isBlank(v.url) ? undefined : isBlank(v.label) ? { url: v.url } : v;
    }
    case "keyValue": {
      const rows = (Array.isArray(value) ? value : []).map(rec).filter((row) => !isBlank(row.key));
      return rows.length === 0 ? undefined : rows;
    }
    case "blocks": {
      const blocks = (Array.isArray(value) ? value : []).map(rec).map(sendBlock).filter((block) => block !== null);
      return blocks.length === 0 ? undefined : blocks;
    }
    case "list": {
      const items = (Array.isArray(value) ? value : []).map((item) => sendValue(shape.of, item)).filter((item) => item !== undefined);
      return items.length === 0 ? undefined : items;
    }
    case "group": {
      const v = rec(value);
      const out = Object.fromEntries(
        Object.entries(shape.fields)
          .map(([key, field]) => [key, sendValue(field, v[key])] as const)
          .filter(([, item]) => item !== undefined),
      );
      return Object.keys(out).length === 0 ? undefined : out;
    }
  }
}

/** 欄 1 つをテンプレートのプレビューの形に(空は見出しの目印。画像・数は形の合う目印が無いので落とす) */
function templateValue(shape: MessageFieldShape, value: unknown, label: string): unknown {
  const mark = previewMarker(label);
  switch (shape.type) {
    case "line":
    case "paragraph":
    case "longText":
    case "date":
    case "select":
      return isBlank(value) ? mark : value;
    case "image":
      return isBlank(value) ? undefined : value;
    case "number":
      return typeof value === "number" ? value : undefined;
    case "button":
    case "link": {
      const v = rec(value);
      return { ...v, label: isBlank(v.label) ? mark : str(v.label), url: isBlank(v.url) ? "#" : str(v.url) };
    }
    case "keyValue": {
      const rows = (Array.isArray(value) ? value : []).map(rec);
      return rows.length === 0 || rows.every((row) => isBlank(row.key)) ? [{ key: mark, value: "" }] : rows;
    }
    case "blocks": {
      const blocks = (Array.isArray(value) ? value : []).map(rec);
      return blocks.length === 0 ? [{ type: "paragraph", text: mark }] : blocks.map(templateBlock);
    }
    case "list": {
      const items = Array.isArray(value) ? value : [];
      if (items.length === 0) {
        const one = templateValue(shape.of, undefined, label);
        return one === undefined ? undefined : [one];
      }
      return items.map((item) => templateValue(shape.of, item, label)).filter((item) => item !== undefined);
    }
    case "group": {
      const v = rec(value);
      return Object.fromEntries(
        Object.entries(shape.fields)
          .map(([key, field]) => [key, templateValue(field, v[key], field.label ?? label)] as const)
          .filter(([, item]) => item !== undefined),
      );
    }
  }
}

/** プレビューに送る中身(形 mode ごと)。送る口はこれを通らない(送った連絡に目印は入らない) */
export function previewValuesOf(
  fields: MessageLayoutFields,
  values: Readonly<Record<string, unknown>>,
  mode: LayoutPreviewMode,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(fields)) {
    const next = mode === "send" ? sendValue(spec, values[key]) : templateValue(spec, values[key], spec.label);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

export function useLayoutPreview({ layout, fields, values, channels, category, enabled = true, mode = "template" }: UseLayoutPreviewOptions) {
  const [channelState, setChannelState] = useState<string | null>(null);
  // 選んだ送信チャンネルがタブから消えたら最初のタブ(effect で戻さない)
  const channel = channelState && channels.includes(channelState) ? channelState : (channels[0] ?? null);

  const filled = useMemo(() => (fields ? previewValuesOf(fields, values ?? {}, mode) : {}), [fields, values, mode]);
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
  /** お知らせのカードに渡す中身(その送信チャンネルの欄だけ、仮の文で埋めた物) */
  const channelValues = useMemo(() => {
    if (!fields || !channel) return filled;
    return Object.fromEntries(Object.entries(filled).filter(([key]) => !fields[key] || fieldBelongsTo(fields[key], channel)));
  }, [fields, channel, filled]);

  const setChannel = useCallback((next: string) => setChannelState(next), []);

  /** 必須の欄(その送信チャンネルで使う物。必須は fieldRequiredIn で channels に対して: requiredFor の件名はメールがある時だけ、D211)が空の送信チャンネル(仮の文で埋める前の値で見る、D117) */
  const incompleteChannels = useMemo(() => {
    if (!fields) return [];
    const raw = values ?? {};
    return channels.filter((key) =>
      Object.entries(fields).some(([name, spec]) => fieldRequiredIn(spec, channels) && fieldBelongsTo(spec, key) && isEmptyValue(raw[name])),
    );
  }, [fields, values, channels]);

  // 前の結果は描き直しの間も残す(同じ送信チャンネルの物だけ)
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
