// src/lib/messaging/definition/types.ts

import type { z } from "zod";

import type {
  ChannelFieldSchemas,
  MessageContent,
  MessageFieldPath,
  UpstreamChannelFields,
} from "./channels";

/**
 * 種別(配信停止の単位)
 * - transactional: 取引・認証の連絡(好みの表を見ない)
 * - marketing: 宣伝・お知らせの配信
 * - activity: 利用者の動きから起こる連絡(いいね・返信など)
 */
export type MessageKind = "transactional" | "marketing" | "activity";

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
  kind: MessageKind;
  /**
   * 種類(配信停止の好みの表の行) = categories の受け口の鍵(上流 marketing・activity と fork の項目)。
   * marketing・activity は必須、取引(transactional)は省ける(好みを見ない)。受け口に無い鍵は検査で落ちる
   */
  category?: string;
  /** 呼び手が渡す値 */
  vars: Vars;
  /** 止められない連絡(認証など)。enabled:false・email の除外・adminEditable・throttle を付けられない */
  required?: boolean;
  /** 管理画面で直せる欄の名前(`<経路>.<欄>`)。required の連絡は空 */
  adminEditable?: readonly MessageFieldPath<C>[];
  /** 本文の残し方(既定 vars) */
  record?: MessageRecord;
  throttle?: MessageThrottle<VarKeys<Vars>>;
  /** 既定で送る経路(content を持つ経路だけ) */
  defaultChannels: readonly (keyof C & string)[];
  /** 経路ごとの欄 */
  content: MessageContent<C>;
  /** fork が足す欄の入れ物(描き方の .replace が読む) */
  extras?: Record<string, unknown>;
};

/**
 * 一部の上書き(messages/<名前>.override.ts、データだけ)。key・kind・vars・required は変えられない。
 * content は経路ごとに欄を重ねる(欄の名前は変えられない)。throttle: null で外す。
 */
export type MessageOverride<C extends ChannelFieldSchemas = UpstreamChannelFields> = {
  content?: { [K in keyof MessageContent<C>]?: Partial<NonNullable<MessageContent<C>[K]>> };
  extras?: Record<string, unknown>;
  defaultChannels?: readonly (keyof C & string)[];
  /** 連絡 1 本の入切(既定 true) */
  enabled?: boolean;
  adminEditable?: readonly MessageFieldPath<C>[];
  category?: string;
  record?: MessageRecord;
  throttle?: MessageThrottle | null;
};

/** 上書きを重ねた後の定義(enabled を持つ) */
export type ResolvedMessageDefinition<
  Vars extends z.AnyZodObject = z.AnyZodObject,
  C extends ChannelFieldSchemas = UpstreamChannelFields,
> = MessageDefinition<Vars, C> & { enabled: boolean };
