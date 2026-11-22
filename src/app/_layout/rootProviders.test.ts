// src/app/_layout/rootProviders.test.ts
// 点 rootProviders の入れ子の並び(orderRootProviders)の回帰テスト。外 → 内 = outer(骨組み)→ session → domain → inner(骨組み)→ project、
// 同じ段の中は一覧の並び。実行: pnpm test src/app/_layout/rootProviders.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReactNode } from "react";

import { orderRootProviders } from "./rootProviders";

const named = (name: string) => Object.assign(({ children }: { children: ReactNode }) => children, { displayName: name });

test("段の並びで骨組みと項目を並べる(同じ段の中は一覧の並び)", () => {
  const order = orderRootProviders(
    { outer: [named("tooltip"), named("recaptcha")], inner: [named("imageViewer"), named("unsavedGuard")] },
    [
      { stage: "project", plug: named("forkTheme") },
      { stage: "domain", plug: named("adminCommand") },
      { stage: "session", plug: named("authSession") },
      { stage: "project", plug: named("forkBanner") },
    ],
  );
  assert.deepEqual(
    order.map((p) => (p as { displayName?: string }).displayName),
    ["tooltip", "recaptcha", "authSession", "adminCommand", "imageViewer", "unsavedGuard", "forkTheme", "forkBanner"],
  );
});

test("項目が無い段は骨組みだけ(閉じたドメインの Provider は門番が外した後)", () => {
  const order = orderRootProviders({ outer: [named("tooltip")], inner: [named("unsavedGuard")] }, []);
  assert.deepEqual(order.map((p) => (p as { displayName?: string }).displayName), ["tooltip", "unsavedGuard"]);
});
