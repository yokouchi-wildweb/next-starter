// src/features/core/userGroup/services/server/activeCriteria.ts
// 使える条件の部品の一覧: 生成の一覧(fork の上書きを重ねた後)から enabled: false と、読む機能が閉(available() が false)の部品を外す。
// - 部品の一覧の API・定義の検査・評価の口・定期計算はどれもこの一覧を読む。外れた部品を指す定義は「知らない部品」の誤り
//   (保存の時は 400、保存済みの定義は壊れた条件の 409)
// - available は呼ぶたびに読む(門の値を読み直す)。enabled は読み込みの時に決まる
// - inStaticGroup は止められない(例外の人と静的グループの条件が使う): enabled: false なら読み込みの時に投げる

import { criteria } from "../../extensions/criteria";
import type { UserGroupCriterion } from "../../types/criterion";

/** 止められない部品 */
export const REQUIRED_CRITERIA = ["inStaticGroup"] as const;

type CriteriaMap = Readonly<Record<string, UserGroupCriterion>>;

/** 使える部品だけを見せる一覧(読むたびに available を確かめる) */
export function createActiveCriteria(all: CriteriaMap): CriteriaMap {
  for (const key of REQUIRED_CRITERIA) {
    if (all[key]?.enabled === false) {
      throw new Error(`userGroup: 条件の部品 ${key} は止められません(例外の人と静的グループの条件が使う)。${key}.override.ts の enabled: false を外してください`);
    }
  }
  const usable = (key: string): boolean => {
    const item = all[key];
    return Boolean(item) && item!.enabled !== false && (item!.available?.() ?? true);
  };
  const target = Object.create(null) as Record<string, UserGroupCriterion>;
  return new Proxy(target, {
    get: (_target, key) => (typeof key === "string" && usable(key) ? all[key] : undefined),
    has: (_target, key) => typeof key === "string" && usable(key),
    ownKeys: () => Object.keys(all).filter(usable),
    getOwnPropertyDescriptor: (_target, key) =>
      typeof key === "string" && usable(key) ? { value: all[key], enumerable: true, configurable: true, writable: false } : undefined,
  });
}

/** 本物の使える部品の一覧(生成の一覧から) */
export const activeCriteria = createActiveCriteria(criteria);
