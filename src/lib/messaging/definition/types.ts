// src/lib/messaging/definition/types.ts

import type { z } from "zod";

import type { MessageVarDeclaration } from "../vars/declaration";
import type { MessageKind } from "./kinds";

export type { MessageKind } from "./kinds";

/**
 * 本文の残し方
 * - meta: 鍵・宛先・状態・件名 / 題だけ
 * - vars: meta + vars の写し(zod の secret の印は落とす)+ 全員同文の描画結果を送信に 1 つ(既定)
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
 * vars の値 1 つの名前(D133): 日本語の別名(埋め込み情報の別名と同じ形。{{別名}} でも {{鍵}} と同じ値で埋まる)+ 管理画面の短い説明
 */
export type MessageVarName = {
  alias: string;
  description: string;
};

/** vars の全部の鍵の名前(鍵が欠けると型の誤り) */
export type MessageVarNames<Vars extends z.AnyZodObject> = { readonly [K in VarKeys<Vars>]: MessageVarName };

/**
 * vars の値 1 つの入力の型(D175。DB のテンプレートの専用の埋め込み情報と同じ型: 1 行の文・数・日付・日時・URL・選択肢)。
 * 別名は varNames が持つ。管理者が入れる値(adminVars)も記録から引く値(recordVars)も型を書く
 */
export type MessageVarInput = Omit<MessageVarDeclaration, "key" | "alias">;

/**
 * 管理者が送る時の宛先(D175・D190): records = 記録の宛先(recordTargets の項目がこの定義を名指す)/ all・role・group = 全員・ロール・ユーザーグループ。
 * 定義が宣言しない = ["records"](全員・ロール・グループは書いた時だけ)
 */
export const MESSAGE_DEFINITION_ADMIN_TARGETS = ["records", "all", "role", "group"] as const;
export type MessageDefinitionAdminTarget = (typeof MESSAGE_DEFINITION_ADMIN_TARGETS)[number];
/** adminTargets を書かない定義の宛先 */
export const DEFAULT_DEFINITION_ADMIN_TARGETS: readonly MessageDefinitionAdminTarget[] = ["records"];

/**
 * 送信チャンネルの固定(D212): on = いつも送る(管理者も外せない)/ off = 使わない(コードの送信でも落とす)/ free = 管理者が選べる(既定)。
 * 書けるのはカテゴリーの送信チャンネルだけ(集まりはカテゴリーが決める、D197)
 */
export const MESSAGE_CHANNEL_MODES = ["on", "off", "free"] as const;
export type MessageChannelMode = (typeof MESSAGE_CHANNEL_MODES)[number];

/**
 * レイアウトの欄の中身(欄の鍵 → 値、D122)。文字列の中に {{鍵}} を書ける(送る時に vars・共通の文脈・enrichers の値を差し込む)
 */
export type MessageLayoutValuesSource = Readonly<Record<string, unknown>>;

/**
 * 連絡定義(messages/<名前>.ts に 1 本)。データだけで、送る処理は持たない。
 * 中身 = レイアウト(layouts の受け口の鍵)+ レイアウトの欄の中身。送信チャンネルごとの中身は持たず、送る口が送信チャンネルごとに 3 段(レイアウトの描き方 >
 * 送信チャンネルの汎用 > 要約、D124)で描く
 */
export type MessageDefinition<
  Vars extends z.AnyZodObject = z.AnyZodObject,
> = {
  key: MessageKey;
  /**
   * 連絡の名前(管理画面に出す日本語の表示名。例 パスワードの再設定)。必須。運営する人は鍵を読まない(D46)。
   * 表示だけなので上書きで変えられる(カテゴリーの label と同じ、D70)
   */
  label: string;
  /**
   * カテゴリー = categories の受け口の鍵(全部の連絡に必須、D81)。種別(kind)と送信チャンネル(channels)はカテゴリーから引く(D86)。
   * 受け口に無い鍵は検査で落ちる。override で付け替えられない(D74)
   */
  category: string;
  /** 呼び手が渡す値 */
  vars: Vars;
  /**
   * vars の鍵ごとの日本語の別名と説明(全部の鍵に必須、秘密の値も。D133)。別名は共通・enrichers・ほかの vars の名前と重ならない。
   * 共通・enrichers と同じ鍵の値(例 serviceNameShort・displayName)はその別名を書く。上書きで変えられない
   */
  varNames: MessageVarNames<Vars>;
  /** 止められない連絡(認証など)。enabled:false・email の除外・adminEditableOnly・throttle を付けられない */
  required?: boolean;
  /**
   * 管理画面で直せる欄の絞り(レイアウトの欄の鍵、D132)。無い = レイアウトの欄のうちカテゴリーの送信チャンネルで使う物を全部直せる(種別の性質
   * adminTextOverride が true・required でない連絡)。書いた時だけその欄に絞る。required の連絡は付けない
   */
  adminEditableOnly?: readonly string[];
  /** 本文の残し方(既定 = 種別の性質の recordDefault) */
  record?: MessageRecord;
  throttle?: MessageThrottle<VarKeys<Vars>>;
  /** レイアウトの鍵(layouts の受け口のフォルダの名前。例 notice・link) */
  layout: string;
  /** レイアウトの欄の中身(レイアウトの欄の zod を通る) */
  values: MessageLayoutValuesSource;
  /** fork が足す欄の入れ物(描き方の .replace が読む) */
  extras?: Record<string, unknown>;
  /**
   * 管理者が送る時に画面で入れる vars(鍵 → 入力の型、D175・D195)。recordVars と同じ鍵は検査が止める。
   * どちらにも無い vars はコードだけが渡す(管理者の送る口は required の値が埋まらなければ断る)
   */
  adminVars?: { readonly [K in VarKeys<Vars>]?: MessageVarInput };
  /** 記録の宛先が記録から引く vars(鍵 → 入力の型、D195。resolveRecipients の vars)。adminVars と同じ鍵は検査が止める */
  recordVars?: { readonly [K in VarKeys<Vars>]?: MessageVarInput };
  /** 管理者が送れる宛先(D175)。無い = ["records"] */
  adminTargets?: readonly MessageDefinitionAdminTarget[];
  /** 送信チャンネルの固定(送信チャンネルの鍵 → on / off / free、D212)。書かない送信チャンネルは free */
  channelModes?: Readonly<Record<string, MessageChannelMode>>;
};

/**
 * 一部の上書き(messages/<名前>.override.ts、データだけ)。label(表示名)は変えられる。key・vars・varNames・required・category・layout は変えられない
 * (カテゴリーの付け替えは D74 で無し。送信チャンネルはカテゴリーの override で変える)。values はレイアウトの欄ごとに重ねる(欄の鍵は変えられない)。throttle: null で外す。
 */
export type MessageOverride = {
  /** 連絡の名前(管理画面の表示名) */
  label?: string;
  /** レイアウトの欄の中身を欄ごとに差し替える */
  values?: MessageLayoutValuesSource;
  extras?: Record<string, unknown>;
  /** 連絡 1 本の入切(既定 true)。上流の functional の連絡は止められない(D68) */
  enabled?: boolean;
  /** 管理画面で直せる欄の絞り(レイアウトの欄の鍵) */
  adminEditableOnly?: readonly string[];
  record?: MessageRecord;
  throttle?: MessageThrottle | null;
};

/** 上書きを重ねた後の定義(enabled と、カテゴリーから引いた種別・送信チャンネルを持つ) */
export type ResolvedMessageDefinition<
  Vars extends z.AnyZodObject = z.AnyZodObject,
> = MessageDefinition<Vars> & {
  enabled: boolean;
  /** カテゴリーの種別 */
  kind: MessageKind;
  /** カテゴリーの送信チャンネル(fork のカテゴリーの override を重ねた後) */
  channels: readonly string[];
};
