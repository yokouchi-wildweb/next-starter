// src/lib/pageGuard/plugs.ts
//
// ページの守りの点 pageGuardUser(./extensionPoints.ts)の約束の型と、生成された <点>Map の型から利用者の型を取り出す型。値は持たない。
// 点はちょうど 1 つ(required、D53): 上流は常設の auth が 1 行スイッチの既定を差し、fork は auth の差替点 authPageGuardUser で替える。
// 項目の利用者の具体の型は項目の値の型に残り、生成された結び目(src/wiring/pageGuard.ts)が <点>Map を型引数で ./wire.ts に渡す(wiring はドメインを読まない、D22)

import type { PageGuardDeps, PageGuardUser } from "./types";

/** 点 pageGuardUser の項目(export const plug)。束は全項目必須(利用者の解き方・access の評価・既定の status・今のパス・setup 誘導の判定) */
export type PageGuardUserPlug<TUser extends PageGuardUser> = {
  deps: PageGuardDeps<TUser>;
};

/** 一覧の要素の型(宣言の type。項目ごとに利用者の型が違うので any で受ける) */
export type AnyPageGuardUserPlug = PageGuardUserPlug<any>;

/** 生成された <点>Map の型から利用者の型を取り出す(項目が無ければ lib の最小の形) */
export type GuardUserOf<M> = [M[keyof M]] extends [never]
  ? PageGuardUser
  : M[keyof M] extends { deps: { resolveUser: () => Promise<infer U> } }
    ? Extract<NonNullable<U>, PageGuardUser>
    : PageGuardUser;
