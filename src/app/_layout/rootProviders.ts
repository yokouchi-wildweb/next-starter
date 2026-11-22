// src/app/_layout/rootProviders.ts
// 点 rootProviders の入れ子の並び(外 → 内)を決める純関数。段の並び(宣言 ./extensionPoints.ts の stages)の順に、
// 骨組みの段(outer・inner)は呼び手(src/wiring/AppProviders.tsx)が渡す Provider、ほかの段は門番で絞った項目(一覧の並び = <差す側>/<名前>)。
// テスト: ./rootProviders.test.ts

import type { RootProvider } from "./types";

/** 段の並び(外 → 内、宣言の stages と同じ) */
export const ROOT_PROVIDER_STAGES = ["outer", "session", "domain", "inner", "project"] as const;
export type RootProviderStage = (typeof ROOT_PROVIDER_STAGES)[number];

/** 骨組みだけが使う段(宣言の skeletonStages) */
export type RootProviderSkeleton = Record<"outer" | "inner", readonly RootProvider[]>;

/** 入れ子の並び(外 → 内)。entries は門番で絞った一覧(項目の stage は骨組みの段を選べない: 生成器が止める) */
export function orderRootProviders(
  skeleton: RootProviderSkeleton,
  entries: readonly { stage: string; plug: RootProvider }[],
): RootProvider[] {
  return ROOT_PROVIDER_STAGES.flatMap((stage) =>
    stage === "outer" || stage === "inner" ? [...skeleton[stage]] : entries.filter((entry) => entry.stage === stage).map((entry) => entry.plug),
  );
}
