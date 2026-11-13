// src/lib/messaging/definition/types.ts

import type { z } from "zod";

import type {
  ChannelFieldSchemas,
  MessageContent,
  MessageFieldPath,
  UpstreamChannelFields,
} from "./channels";

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

type VarKeys<Vars extends z.AnyZodObject> = keyof z.infer<Vars> & string;

/**
 * 連絡の定義(messages/<名前>.ts に 1 本)。データだけで、送る処理は持たない。
 */
export type MessageDefinition<
  Vars extends z.AnyZodObject = z.AnyZodObject,
  C extends ChannelFieldSchemas = UpstreamChannelFields,
> = {
  key: MessageKey;
  /**
   * 種類 = categories の受け口の鍵(全部の連絡に必須、D81)。種別(kind)と経路(channels)は種類から引く(D86)。
   * 受け口に無い鍵は検査で落ちる。override で付け替えられない(D74)
   */
  category: string;
  /** 呼び手が渡す値 */
  vars: Vars;
  /** 止められない連絡(認証など)。enabled:false・email の除外・adminEditable・throttle を付けられない */
  required?: boolean;
  /** 管理画面で直せる欄の名前(`<経路>.<欄>`)。required の連絡は空 */
  adminEditable?: readonly MessageFieldPath<C>[];
  /** 本文の残し方(既定 = 種別の性質の recordDefault) */
  record?: MessageRecord;
  throttle?: MessageThrottle<VarKeys<Vars>>;
  /** 経路ごとの欄(種類の経路の分だけ必須) */
  content: MessageContent<C>;
  /** fork が足す欄の入れ物(描き方の .replace が読む) */
  extras?: Record<string, unknown>;
};

/**
 * 一部の上書き(messages/<名前>.override.ts、データだけ)。key・vars・required・category は変えられない(種類の付け替えは D74 で無し。
 * 経路は種類の override で変える)。content は経路ごとに欄を重ねる(欄の名前は変えられない)。throttle: null で外す。
 */
export type MessageOverride<C extends ChannelFieldSchemas = UpstreamChannelFields> = {
  content?: { [K in keyof MessageContent<C>]?: Partial<NonNullable<MessageContent<C>[K]>> };
  extras?: Record<string, unknown>;
  /** 連絡 1 本の入切(既定 true)。上流の functional の連絡は止められない(D68) */
  enabled?: boolean;
  adminEditable?: readonly MessageFieldPath<C>[];
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
