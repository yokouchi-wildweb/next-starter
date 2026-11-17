// src/lib/messaging/embedded/common.ts
//
// 共通の埋め込み情報(D111・D126): どの連絡・テンプレートでも文面に書ける名前。鍵(英語)と日本語の別名のどちらで書いても同じ値で埋まる。
// 値は送る口が受信者ごとに埋める(受信者・サービス名・起点の URL)。collapsedCount は間引き(throttle)のある連絡だけ

/** 埋め込み情報 1 つの名前(鍵 = 英数字の鍵、alias = 日本語の別名、description = 管理画面の説明) */
export type MessageEmbeddedName = {
  key: string;
  alias: string;
  description: string;
};

/** 共通の埋め込み情報 1 つ(throttleOnly = 間引きのある連絡だけで使える) */
export type MessageCommonEmbedded = MessageEmbeddedName & { throttleOnly?: true };

/** 共通の埋め込み情報の一覧(並び = 管理画面の並び) */
export const MESSAGE_COMMON_EMBEDDED: readonly MessageCommonEmbedded[] = [
  { key: "recipientName", alias: "受信者名", description: "受け取る人の名前(名前が無ければ空)" },
  { key: "recipientEmail", alias: "受信者のメール", description: "受け取る人のメールアドレス" },
  { key: "serviceName", alias: "サービス名", description: "このサービスの名前" },
  { key: "serviceNameShort", alias: "サービスの短い名前", description: "このサービスの短い名前(件名の頭など)" },
  { key: "appBaseUrl", alias: "サイトのURL", description: "このサイトの起点の URL(例 https://example.com)" },
  { key: "collapsedCount", alias: "まとめた件数", description: "間引きでまとめた件数(間引きのある連絡だけ)", throttleOnly: true },
];
