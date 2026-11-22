// src/domains/core/auth/plugs/proxyUser/session.test.mts
// 点 proxyUser の上流の項目(createProxyUser)の回帰テスト。DB は使わない(解決器の部品を差し替える)。
// 遅延(呼ばれなければ解決しない)・リクエスト内メモ化・利用可能な status だけ非 null・Cookie なし / DB 未構成は解決せず null
// 実行: pnpm test src/domains/core/auth/plugs/proxyUser/session.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { SessionUser } from "@/domains/core/auth/entities/session";

import { createProxyUser } from "./session.default";

const user = (role: string, extra: Partial<SessionUser> = {}): SessionUser =>
  ({ userId: `${role}-1`, role, status: "active", isDemo: false, providerType: "email", providerUid: "x", name: role, ...extra }) as SessionUser;

test("createProxyUser: 遅延・メモ化・利用可能な status だけ・Cookie なし / DB 未構成は解決しない", async () => {
  let resolves = 0;
  const deps = (stored: SessionUser | null, configured = true) => ({
    isConfigured: () => configured,
    readToken: (cookies: { get(name: string): { value?: string | null } | undefined }) => cookies.get("t")?.value ?? null,
    resolve: async () => {
      resolves += 1;
      return stored;
    },
    availableStatuses: ["active"] as const,
  });
  const cookies = (token?: string) => ({ get: (name: string) => (name === "t" && token ? { value: token } : undefined) });

  // 呼ばなければ解決しない
  createProxyUser(cookies("tok"), deps(user("admin")));
  assert.equal(resolves, 0);

  // 2 回呼んで解決は 1 回
  const get = createProxyUser(cookies("tok"), deps(user("admin")));
  assert.equal((await get())?.role, "admin");
  assert.equal((await get())?.role, "admin");
  assert.equal(resolves, 1);

  // 停止中・休会中は null
  for (const status of ["suspended", "inactive"]) {
    assert.equal(await createProxyUser(cookies("tok"), deps(user("admin", { status } as Partial<SessionUser>)))(), null, status);
  }

  // Cookie なし・DB 未構成は解決しない
  resolves = 0;
  assert.equal(await createProxyUser(cookies(), deps(user("admin")))(), null);
  assert.equal(await createProxyUser(cookies("tok"), deps(user("admin"), false))(), null);
  assert.equal(resolves, 0);
});
