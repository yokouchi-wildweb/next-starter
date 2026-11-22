// src/lib/messaging/layout/types.ts
//
// レイアウト(layout、D122)の型。レイアウト = 欄の宣言・仮の文・要約(必須)・管理者が選べる印・改版の対応。
// 種別・カテゴリー・送信チャンネルを知らない(送信チャンネルだけの欄は欄の channels に送信チャンネルの鍵を値として持つだけ)。
// 送信チャンネルごとの描き方はレイアウトのフォルダのファイル(server = email、client = inApp)が持ち、この型は持たない。

import type { MessageFieldSpec, MessageFieldValue } from "./vocabulary";

/** 欄の宣言の束(欄の鍵 → 宣言。宣言の順 = 描く順・画面の順) */
export type MessageLayoutFields = Readonly<Record<string, MessageFieldSpec>>;

/** 欄の中身(必須でない欄は省ける) */
export type MessageLayoutValues<F extends MessageLayoutFields = MessageLayoutFields> = {
  [K in keyof F]?: MessageFieldValue<F[K]>;
};

/**
 * 要約(D124): どのレイアウトも欄の中身から返す。送信チャンネルのレイアウトの描き方も汎用の描き方も無い時の最後の拠り所、
 * お知らせの行・一覧・プッシュ / LINE(shortBody ?? body)が読む
 */
export type MessageLayoutSummary = {
  title: string;
  body: string;
  /** storage:// の参照か URL */
  image?: string;
  link?: { label?: string; url: string };
  /** 短い本文(プッシュ・LINE 向け。無ければ body) */
  shortBody?: string;
};

export type MessageLayout<F extends MessageLayoutFields = MessageLayoutFields> = {
  /** レイアウトの鍵(受け口のフォルダの名前) */
  key: string;
  /** 管理画面の表示名 */
  label: string;
  description?: string;
  fields: F;
  /** 欄の中身 → 要約(必須) */
  summary: (values: MessageLayoutValues<F>) => MessageLayoutSummary;
  /** 管理者がテンプレートで選べるか(既定 false = 定義連絡だけが使う) */
  adminSelectable?: boolean;
  /** 版(既定 1)。欄の鍵を変えた・消した時に 1 上げ、revisions にその段の対応を書く。送信は送った時の版を残す(D128) */
  version?: number;
  /**
   * 改版の対応(版ごと): { [上げる前の版]: { 前の欄の鍵: 新しい欄の鍵 | null(捨てる) } }。1 から今の版の 1 つ前まで、全部の段を書く
   * (欄の鍵が変わらない段も空の {})。保存した値(送信の values・テンプレート)とテキストの編集を今の版へ読み替える(upgradeLayoutValues)
   */
  revisions?: Readonly<Record<number, Readonly<Record<string, string | null>>>>;
};

/** 型の版の既定 */
export const DEFAULT_LAYOUT_VERSION = 1;

/** レイアウトの今の版 */
export function layoutVersionOf(layout: Pick<MessageLayout, "version">): number {
  return layout.version ?? DEFAULT_LAYOUT_VERSION;
}

/** レイアウトを宣言する(欄の宣言から中身の型を引く) */
export function defineMessageLayout<const F extends MessageLayoutFields>(layout: MessageLayout<F>): MessageLayout<F> {
  return layout;
}
