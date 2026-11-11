// src/lib/messaging/definition/emailView.ts
//
// 連絡ごとのメールの描き方(messages/views/<名前>.tsx)の形。メールの経路の項目が、宛先に載った連絡の鍵で
// 生成の一覧(messageRegistry)の view を読み、あればその EmailView で描く(無ければ経路の既定の描き方)。
// - views/<名前>.tsx = 1 行スイッチ(export { EmailView } from "./<名前>.default"。fork の丸ごとの差し替えは .replace)
// - 受け取るのは {{鍵}} を差し込んだ後のメールの欄・色・配信停止のリンクだけ。変数(vars)は渡さない
//   (秘密の変数を経路に出さない。文言は欄にあるので管理画面と override で直せる)
// - 色の型はメールの部品の lib が決める(この lib は React とメールの部品に依らない)ので、ここでは型の引数

import type { z } from "zod";

import type { emailFieldsSchema } from "./channels";

/** メールの欄の値({{鍵}} は差し込み済み) */
export type EmailFields = z.infer<typeof emailFieldsSchema>;

/** 描き方の部品の props */
export type MessageEmailViewProps<Theme> = {
  content: EmailFields;
  theme: Theme;
  /** 配信停止のリンク(好みに従う連絡だけ。本文の最後に出す) */
  unsubscribeUrl?: string;
};

/**
 * views/<名前>.tsx のモジュールの形。色の型は問わない(never = どの色の型の部品も受ける)。
 * 生成の一覧の型がこの形を求めるので、形の合わない描き方は tsc で止まる
 */
export type MessageEmailViewModule = {
  EmailView: (props: MessageEmailViewProps<never>) => unknown;
};
