// src/lib/cacheTags/sharedRead.ts — ドメインの宣言でない仕組みの共有の読み(server だけ、入口 ./server)
// ドメインの読みは宣言 cache と pnpm generate cache(生成物 cachedReads.ts)。これはその形に乗らない仕組み
// (例: analytics の withAnalyticsCache)が同じ置き場・同じ札・同じ落ち方で読むための 1 つの道。

import { cacheLife, cacheTag } from "next/cache";
import { readThrough } from "./readThrough";

/** 寿命(秒)。cacheLife に渡す形。expire は必ず書く(寿命は有限) */
export type SharedReadLife = { stale?: number; revalidate: number; expire: number };

/** 呼ぶたびに渡す寿命と札(札は cacheTagOf で作る。書き込みの側が同じ札を markCacheTags で積む) */
export type SharedReadOptions = { life: SharedReadLife; tags: readonly string[] };

type AnyRead = (...args: unknown[]) => Promise<unknown>;

/** 名前 → 読み。"use cache: remote" の関数は関数を引数で受け取れない(pass-through だけ)ので、名前で引く */
const reads = new Map<string, AnyRead>();

/**
 * 共有の置き場の体。鍵 = この関数 + 引数(名前・寿命・札・読みの引数)。読みの本体は名前で引く
 * (関数は引数に乗せない)。引いた読みが無い時は投げる(readThrough が DB を直に読む)。
 */
async function sharedRead(name: string, life: SharedReadLife, tags: string[], args: unknown[]): Promise<unknown> {
  "use cache: remote";
  cacheLife(life);
  if (tags.length > 0) cacheTag(...tags);
  const read = reads.get(name);
  if (!read) throw new Error(`defineSharedRead: "${name}" の読みがこの process で定義されていません`);
  return read(...args);
}

/**
 * 読み `read` を名前 `name` で定義し、共有の置き場("use cache: remote")で覚える読みを返す。
 * - 返す関数は `(options, ...args)`: options = 寿命と札(呼ぶたびに決めてよい。鍵の一部になる)、args = read の引数
 * - args と戻り値は直列化できる値だけ(素のオブジェクト・配列・Date・Map・Set。クラスのインスタンス・関数は不可)
 * - 置き場が止まって投げた時は readThrough で read を直に呼ぶ(DomainError はそのまま投げる)
 * - 同じ名前の別の読みは投げる(名前は鍵の一部。同じ定義の読み直し = 開発中の再読み込みは置き換える)
 * - 消すのは札: 書き込みの側が markCacheTags(同じ札)を積み、入口が要求の終わりに消す
 */
export function defineSharedRead<A extends unknown[], T>(
  name: string,
  read: (...args: A) => Promise<T>,
): (options: SharedReadOptions, ...args: A) => Promise<T> {
  if (!name) throw new Error("defineSharedRead: name を書いてください");
  const stored = read as unknown as AnyRead;
  const existing = reads.get(name);
  if (existing && existing !== stored && String(existing) !== String(read)) {
    throw new Error(`defineSharedRead: "${name}" は別の読みで定義済みです(名前は読みごとに 1 つ)`);
  }
  reads.set(name, stored);
  return (options, ...args) =>
    readThrough(
      name,
      () => sharedRead(name, options.life, [...options.tags], args) as Promise<T>,
      () => read(...args),
    );
}
