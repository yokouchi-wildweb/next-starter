// src/features/core/messaging/layouts/alert/layout.ts
// 上流のひな形「セキュリティの警告」(D122・D123): アカウントのロックなどの警告。コードの連絡だけが使う(adminSelectable false)。
// ラベルと値(発生時刻・アクセス元 IP など)は値が空の行を描かない。心当たりの段落は最初の行を太字で描く。
// 要約: 題 = 件名 / 本文 = 説明 / 短い本文 = プレビューの文

import { defineMessageLayout } from "@/lib/messaging";

export const layout = defineMessageLayout({
  key: "alert",
  label: "セキュリティの警告",
  description: "見出し・説明・ラベルと値・心当たりがない場合とある場合の案内を出す、セキュリティの警告",
  adminSelectable: false,
  fields: {
    subject: { type: "line", label: "件名", required: true },
    preheader: { type: "line", label: "プレビューの文" },
    heading: { type: "line", label: "見出し", required: true },
    explanation: { type: "paragraph", label: "説明", required: true },
    details: { type: "keyValue", label: "ラベルと値(値が空の行は出さない)" },
    notYou: { type: "paragraph", label: "心当たりがない場合(最初の行を太字)" },
    ifYou: { type: "paragraph", label: "心当たりがある場合(最初の行を太字)" },
    footer: { type: "paragraph", label: "末尾の注意書き" },
  },
  summary: (values) => ({
    title: values.subject ?? "",
    body: values.explanation ?? "",
    ...(values.preheader ? { shortBody: values.preheader } : {}),
  }),
});

export type AlertValues = Parameters<typeof layout.summary>[0];

/** 値が空でない項目の行 */
export function visibleDetails(values: AlertValues): { key: string; value: string }[] {
  return (values.details ?? []).filter((row) => row.value.trim() !== "");
}

/** 心当たりの段落を最初の行と残りに分ける */
export function splitFirstLine(text: string): { first: string; rest: string | null } {
  const [first, ...rest] = text.split("\n");
  return { first: first ?? "", rest: rest.length > 0 ? rest.join("\n") : null };
}
