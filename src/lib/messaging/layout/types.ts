// src/lib/messaging/layout/types.ts
//
// ひな形(layout、D122)の型。ひな形 = 欄の宣言・仮の文・要約(必須)・管理者が選べる印・改版の対応。
// 種別・カテゴリー・経路を知らない(経路だけの欄は欄の channels に経路の鍵を値として持つだけ)。
// 経路ごとの描き方はひな形のフォルダのファイル(server = email、client = inApp)が持ち、この型は持たない。

import type { MessageFieldSpec, MessageFieldValue } from "./vocabulary";

/** 欄の宣言の束(欄の鍵 → 宣言。宣言の順 = 描く順・画面の順) */
export type MessageLayoutFields = Readonly<Record<string, MessageFieldSpec>>;

/** 欄の中身(必須でない欄は省ける) */
export type MessageLayoutValues<F extends MessageLayoutFields = MessageLayoutFields> = {
  [K in keyof F]?: MessageFieldValue<F[K]>;
};

/**
 * 要約(D124): どのひな形も欄の中身から返す。経路のひな形の描き方も汎用の描き方も無い時の最後の拠り所、
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
  /** ひな形の鍵(受け口のフォルダの名前) */
  key: string;
  /** 管理画面の表示名 */
  label: string;
  description?: string;
  fields: F;
  /** 欄の中身 → 要約(必須) */
  summary: (values: MessageLayoutValues<F>) => MessageLayoutSummary;
  /** 管理者がテンプレートで選べるか(既定 false = コードの連絡だけが使う) */
  adminSelectable?: boolean;
  /** 改版の対応: 前の版の欄の鍵 → 新しい版の欄の鍵(null = 捨てる)。保存した値と文言の上書きの両方に効く */
  revisions?: Readonly<Record<string, string | null>>;
};

/** ひな形を宣言する(欄の宣言から中身の型を引く) */
export function defineMessageLayout<const F extends MessageLayoutFields>(layout: MessageLayout<F>): MessageLayout<F> {
  return layout;
}
