// src/lib/pageGuard/wire.ts
//
// 結び目 wirePageGuard(宣言 ./extensionPoints.ts の wire)。生成物 src/wiring/pageGuard.ts が門番で絞った点 pageGuardUser の一覧と、
// 項目の具体の型 <点>Map を渡し、root の範囲の作り手 defineRootGuard を受け取る(src/app/guard.ts だけが呼ぶ)

import { createPageGuard } from "./createPageGuard";
import type { AnyPageGuardUserPlug, GuardUserOf } from "./plugs";
import type { PageGuard, PageGuardDeps, PageGuardPolicy } from "./types";

/** 点 pageGuardUser の一覧(ちょうど 1 つ。生成の検査が 0 個・2 個以上を止め、常設のドメインの項目なので門番で外れない) */
export function wirePageGuard<M>(lists: {
  pageGuardUser: readonly { plug: AnyPageGuardUserPlug }[];
}): (policy: PageGuardPolicy) => PageGuard<GuardUserOf<M>> {
  const [entry] = lists.pageGuardUser;
  if (!entry) throw new Error("pageGuardUser: 項目がありません(常設のドメインの項目がちょうど 1 つ要る。pnpm generate extensions)");
  return createPageGuard(entry.plug.deps as PageGuardDeps<GuardUserOf<M>>);
}
