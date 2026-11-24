// src/domains/core/rateLimit/services/server/consume.ts
// 鍵・規則・重みで数える(D24・D56・D57)。consumeRateLimit は数えて足す、peekRateLimit は読むだけ。
// - 鍵 = { scope, identifier }。scope はカテゴリの名前か "<地区>.<名前>"(どちらでもなければ投げる)
// - 規則 = カテゴリの名前(固定の窓・windowSeconds・limit = maxRequests)か { window: "fixed" | "sliding", windowSeconds, bucketSeconds?, limit }
// - limit 回まで通す(カテゴリで数える checkRateLimit も同じ、D21)
// 依存は createRateLimit に渡す(単体テストは偽物の表)。本物の束は ./index.ts

import type { TransactionClient } from "@/lib/drizzle";

import type { RateLimitResult } from "../../constants";
import type { RateLimitRule } from "../../config";
import type { RateLimitCount, RateLimitStore } from "./store";

/** 数える鍵: scope = カテゴリの名前か "<地区>.<名前>"、identifier = IP・利用者の id・台 × 利用者など */
export type RateLimitKey = { scope: string; identifier: string };

/** 窓を直に書く規則。sliding は bucketSeconds(0 < bucketSeconds ≤ windowSeconds)の刻みで和を取る */
export type RateLimitWindowRule =
  | { window: "fixed"; windowSeconds: number; limit: number }
  | { window: "sliding"; windowSeconds: number; bucketSeconds: number; limit: number };

export type ConsumeRateLimitInput<C extends string = string> = {
  key: RateLimitKey;
  /** カテゴリの名前(固定の窓・maxRequests 回)か窓を直に書く規則 */
  rule: C | RateLimitWindowRule;
  /** 1 回で数える量(既定 1、1 以上の整数) */
  weight?: number;
  /** 渡せば同じ取引で数える(取引が戻れば数えも戻る) */
  tx?: TransactionClient;
};

export type RateLimitDeps = {
  store: RateLimitStore;
  /** カテゴリの名前 → 規則(合成済みの config) */
  categories: Readonly<Record<string, RateLimitRule>>;
  now?: () => Date;
};

const SCOPE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*\.[A-Za-z][A-Za-z0-9_-]*$/;

export function createRateLimit(deps: RateLimitDeps) {
  const now = deps.now ?? (() => new Date());

  function resolve(input: ConsumeRateLimitInput): { rule: RateLimitWindowRule; weight: number; key: string } {
    const { scope, identifier } = input.key;
    if (!Object.hasOwn(deps.categories, scope) && !SCOPE_PATTERN.test(scope)) {
      throw new Error(`rateLimit: scope "${scope}" はカテゴリの名前か "<地区>.<名前>" にする`);
    }
    if (!identifier) throw new Error(`rateLimit: ${scope} の identifier が空`);
    const weight = input.weight ?? 1;
    if (!Number.isInteger(weight) || weight < 1) throw new Error(`rateLimit: weight は 1 以上の整数(${weight})`);
    let rule: RateLimitWindowRule;
    if (typeof input.rule === "string") {
      const category = deps.categories[input.rule];
      if (!Object.hasOwn(deps.categories, input.rule) || !category) throw new Error(`rateLimit: カテゴリ ${input.rule} が無い`);
      rule = { window: "fixed", windowSeconds: category.windowSeconds, limit: category.maxRequests };
    } else {
      rule = input.rule;
    }
    if (!(rule.windowSeconds > 0)) throw new Error(`rateLimit: windowSeconds は正の数(${rule.windowSeconds})`);
    if (!Number.isInteger(rule.limit) || rule.limit < 0) throw new Error(`rateLimit: limit は 0 以上の整数(${rule.limit})`);
    if (rule.window === "sliding" && !(rule.bucketSeconds > 0 && rule.bucketSeconds <= rule.windowSeconds)) {
      throw new Error(`rateLimit: sliding の bucketSeconds は 0 < bucketSeconds ≤ windowSeconds(${rule.bucketSeconds})`);
    }
    return { rule, weight, key: `${scope}:${identifier}` };
  }

  const toResult = (limit: number, counted: RateLimitCount): RateLimitResult => ({
    allowed: counted.allowed,
    remaining: Math.max(0, limit - counted.count),
    resetAt: counted.resetAt,
    count: counted.count,
  });

  /** 数えて足す。足すと limit を超えるなら拒否して足さない */
  async function consumeRateLimit<C extends string>(input: ConsumeRateLimitInput<C>): Promise<RateLimitResult> {
    const { rule, weight, key } = resolve(input);
    const base = { key, windowSeconds: rule.windowSeconds, limit: rule.limit, weight, now: now(), tx: input.tx };
    const counted =
      rule.window === "fixed"
        ? await deps.store.consumeFixed(base)
        : await deps.store.consumeSliding({ ...base, bucketSeconds: rule.bucketSeconds });
    return toResult(rule.limit, counted);
  }

  /** 読むだけ。allowed = 今 weight を足しても limit の内か */
  async function peekRateLimit<C extends string>(input: ConsumeRateLimitInput<C>): Promise<RateLimitResult> {
    const { rule, weight, key } = resolve(input);
    const base = { key, windowSeconds: rule.windowSeconds, limit: rule.limit, weight, now: now(), tx: input.tx };
    const counted =
      rule.window === "fixed" ? await deps.store.peekFixed(base) : await deps.store.peekSliding({ ...base, bucketSeconds: rule.bucketSeconds });
    return toResult(rule.limit, counted);
  }

  return { consumeRateLimit, peekRateLimit };
}
