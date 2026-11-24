// src/domains/core/outbox/points.ts
// 型だけの入口: 送り箱の点 outboxHandlers の項目の約束の型(差す側はここだけを型として読む)。点の宣言: ./extensionPoints.ts

import type { ZodType } from "zod";

/** 積む中身: JSON で、版の欄 v(数)を必ず持つ。秘密(鍵・トークン・パスワード)は入れない */
export type OutboxPayload = { v: number } & { [key: string]: unknown };

/** 処理の項目の名前: "<差した地区>.<動作>"(表の kind の列・積む時の kind も同じ型) */
export type OutboxKind = `${string}.${string}`;

/** 処理に渡す文脈。id は提供元の冪等の鍵に使う(少なくとも 1 回届く・順序なし) */
export type OutboxHandlerContext = {
  /** 送り箱の行の id */
  id: string;
  /** 何回目の試行か(1 から) */
  attempt: number;
};

/** 再試行の間隔: 指数(baseSeconds × 2^(試行 − 1))、maxSeconds で頭打ち */
export type OutboxBackoff = { baseSeconds: number; maxSeconds?: number };

/**
 * 送り箱の処理 1 つ(<地区>/plugs/outboxHandlers/<名前>.ts の export const handler)。
 * handle は冪等に書く(同じ行が 2 回届いても壊れない)。失敗は投げる(送り箱が再試行・上限で隔離する)
 */
export type OutboxHandler<P extends OutboxPayload = OutboxPayload> = {
  /** "<差した地区>.<動作>"(字面で書く。先頭が違えば生成で止める)。全体で一意 */
  kind: OutboxKind;
  /** 積む時と届ける時に payload を確かめる */
  schema: ZodType<P>;
  handle(payload: P, ctx: OutboxHandlerContext): Promise<void>;
  /** 隔離するまでの試行の上限(fork は上書きで変えられる) */
  maxAttempts?: number;
  /** 再試行の間隔(fork は上書きで変えられる) */
  backoff?: OutboxBackoff;
};
