// src/lib/messaging/definition/types.ts

import type { z } from "zod";

import type { ChannelFieldSchemas, UpstreamChannelFields } from "./channels";

import type { MessageKind } from "./kinds";

export type { MessageKind } from "./kinds";

/**
 * 本文の残し方
 * - meta: 鍵・宛先・状態・件名 / 題だけ
 * - vars: meta + vars の写し(zod の secret の印は落とす)+ 全員同文の描画結果を回に 1 つ(既定)
 * - full: vars + 受信者ごとのメール本文
 */
export type MessageRecord = "meta" | "vars" | "full";

/** 連絡の鍵(`<domain>.<name>`) */
export type MessageKey = `${string}.${string}`;

/**
 * 会話の間引き(同じ受信者 × 定義 × by の値で続けて送らない)
 * - untilRead: お知らせの未読の item が残る間は送らない(お知らせは最新に置き換える)
 * - window: 前の配達から seconds 以内は送らない
 */
export type MessageThrottle<VarKey extends string = string> = {
  by: readonly VarKey[];
  mode: "untilRead" | "window";
  seconds: number;
};

/**
 * vars の鍵。条件型で引く(keyof を直に書くと型引数 Vars が反変と測られ、具体的な定義を MessageDefinition<AnyZodObject> へ渡せなくなる)
 */
type VarKeys<Vars extends z.AnyZodObject> = Vars extends z.ZodObject<infer Shape> ? keyof Shape & string : string;

/**
 * ひな形の欄の中身(欄の鍵 → 値、D122)。文字列の中に {{鍵}} を書ける(送る時に vars・共通の文脈・enrichers の値を差し込む)
 */
export type MessageLayoutValuesSource = Readonly<Record<string, unknown>>;

/**
 * 連絡の定義(messages/<名前>.ts に 1 本)。データだけで、送る処理は持たない。
 * 中身 = ひな形(layouts の受け口の鍵)+ ひな形の欄の中身。経路ごとの中身は持たず、送る口が経路ごとに 3 段(ひな形の描き方 >
 * 経路の汎用 > 要約、D124)で描く
 */
export type MessageDefinition<
  Vars extends z.AnyZodObject = z.AnyZodObject,
  C extends ChannelFieldSchemas = UpstreamChannelFields,
> = {
  key: MessageKey;
  /**
   * 連絡の名前(管理画面に出す日本語の表示名。例 パスワードの再設定)。必須。運営する人は鍵を読まない(D46)。
   * 表示だけなので上書きで変えられる(種類の label と同じ、D70)
   */
  label: string;
  /**
   * 種類 = categories の受け口の鍵(全部の連絡に必須、D81)。種別(kind)と経路(channels)は種類から引く(D86)。
   * 受け口に無い鍵は検査で落ちる。override で付け替えられない(D74)
   */
  category: string;
  /** 呼び手が渡す値 */
  vars: Vars;
  /** 止められない連絡(認証など)。enabled:false・email の除外・adminEditableOnly・throttle を付けられない */
  required?: boolean;
  /**
   * 管理画面で直せる欄の絞り(ひな形の欄の鍵、D132)。無い = ひな形の欄のうち種類の経路で使う物を全部直せる(種別の性質
   * adminTextOverride が true・required でない連絡)。書いた時だけその欄に絞る。required の連絡は付けない
   */
  adminEditableOnly?: readonly string[];
  /** 本文の残し方(既定 = 種別の性質の recordDefault) */
  record?: MessageRecord;
  throttle?: MessageThrottle<VarKeys<Vars>>;
  /** ひな形の鍵(layouts の受け口のフォルダの名前。例 notice・link) */
  layout: string;
  /** ひな形の欄の中身(ひな形の欄の zod を通る) */
  values: MessageLayoutValuesSource;
  /** fork が足す欄の入れ物(描き方の .replace が読む) */
  extras?: Record<string, unknown>;
};

/**
 * 一部の上書き(messages/<名前>.override.ts、データだけ)。label(表示名)は変えられる。key・vars・required・category・layout は変えられない
 * (種類の付け替えは D74 で無し。経路は種類の override で変える)。values はひな形の欄ごとに重ねる(欄の鍵は変えられない)。throttle: null で外す。
 */
export type MessageOverride<C extends ChannelFieldSchemas = UpstreamChannelFields> = {
  /** 連絡の名前(管理画面の表示名) */
  label?: string;
  /** ひな形の欄の中身を欄ごとに差し替える */
  values?: MessageLayoutValuesSource;
  extras?: Record<string, unknown>;
  /** 連絡 1 本の入切(既定 true)。上流の functional の連絡は止められない(D68) */
  enabled?: boolean;
  /** 管理画面で直せる欄の絞り(ひな形の欄の鍵) */
  adminEditableOnly?: readonly string[];
  record?: MessageRecord;
  throttle?: MessageThrottle | null;
};

/** 上書きを重ねた後の定義(enabled と、種類から引いた種別・経路を持つ) */
export type ResolvedMessageDefinition<
  Vars extends z.AnyZodObject = z.AnyZodObject,
  C extends ChannelFieldSchemas = UpstreamChannelFields,
> = MessageDefinition<Vars, C> & {
  enabled: boolean;
  /** 種類の種別 */
  kind: MessageKind;
  /** 種類の経路(fork の種類の override を重ねた後) */
  channels: readonly (keyof C & string)[];
};
