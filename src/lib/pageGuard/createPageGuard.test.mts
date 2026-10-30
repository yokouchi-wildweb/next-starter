// src/lib/pageGuard/createPageGuard.test.mts
// ページの守りの汎用版の契約の回帰テスト(stub の束を差し込んで実際の guard / createLoader / extend を動かす。DB は使わない)。
// - 範囲は段の並びで親子 AND(子は狭めるだけ)。setup 誘導・未認証・status 別・権限不足の行き先、無ければ notFound
// - loader は範囲とページの access を単独で評価し、拒否なら load を呼ばない。public の主体は利用可能な status のときだけ
// - key が返すプリミティブが load に渡る
// 実行: pnpm test:page-guard

import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateApiAccessRule } from "@/features/core/auth/services/server/apiAccess";

import { createPageGuard } from "./createPageGuard.ts";

type FakeUser = { userId: string; role: string; status: string };
let currentUser: FakeUser | null = null;
let currentPath: string | null = "/mypage/account";
let usersExist = true;

const defineRootGuard = createPageGuard<FakeUser>({
  resolveUser: async () => currentUser,
  evaluateAccess: (rule, user, options) => evaluateApiAccessRule(rule, user as never, options as never),
  availableStatuses: ["active"],
  getRequestPathname: async () => currentPath,
  hasUserForAccess: async () => usersExist,
});

const active: FakeUser = { userId: "u1", role: "user", status: "active" };
const admin: FakeUser = { userId: "a1", role: "admin", status: "active" };
const editor: FakeUser = { userId: "e1", role: "editor", status: "active" };
const inactive: FakeUser = { userId: "u2", role: "user", status: "inactive" };
const suspendedAdmin: FakeUser = { userId: "a2", role: "admin", status: "suspended" };

const root = defineRootGuard({ access: "public" });
const userRange = root.extend({
  access: { roleCategories: ["admin", "user"] },
  redirectTo: "/login",
  forbiddenRedirectTo: "/login",
  returnBack: true,
  statusRedirects: { inactive: "/reactivate" },
});
const adminRange = root.extend({
  access: { roleCategories: ["admin"] },
  redirectTo: "/admin/login",
  forbiddenRedirectTo: "/admin/login",
  returnBack: true,
  setupRedirectTo: "/admin/setup",
});
// 子が親より広い access を書いても、親の段が先に評価されるので広がらない
const widenedChild = adminRange.extend({ access: "public" });
const usersRange = adminRange.extend({ access: { roles: ["admin"] }, redirectTo: "/admin", forbiddenRedirectTo: "/admin" });

/** redirect / notFound の結果を文字列にする(通れば "ok") */
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "ok";
  } catch (error) {
    const digest = String((error as { digest?: string }).digest ?? error);
    if (digest.startsWith("NEXT_REDIRECT")) return `redirect:${digest.split(";")[2]}`;
    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return "notFound";
    throw error;
  }
}

const as = (user: FakeUser | null, run: () => Promise<unknown>) => {
  currentUser = user;
  return outcome(run);
};

test("guard: root(public)は誰でも通す", async () => {
  assert.equal(await as(null, root.guard), "ok");
  assert.equal(await as(inactive, root.guard), "ok");
});

test("guard: 未認証は redirectTo へ returnTo 付き、行き先と同じパスなら付けない", async () => {
  assert.equal(await as(null, userRange.guard), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  currentPath = "/login";
  assert.equal(await as(null, userRange.guard), "redirect:/login");
  currentPath = "/mypage/account";
});

test("guard: status だけが通らないときは status 別の行き先(returnTo なし)", async () => {
  assert.equal(await as(inactive, userRange.guard), "redirect:/reactivate");
  assert.equal(await as(active, userRange.guard), "ok");
});

test("guard: ロール不一致は forbiddenRedirectTo、行き先が無ければ notFound", async () => {
  assert.equal(await as(active, adminRange.guard), `redirect:/admin/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  const bare = root.extend({ access: { roles: ["admin"] } });
  assert.equal(await as(active, bare.guard), "notFound");
  assert.equal(await as(null, bare.guard), "notFound");
});

test("guard: setup 誘導は access の判定より先", async () => {
  usersExist = false;
  assert.equal(await as(null, adminRange.guard), "redirect:/admin/setup");
  usersExist = true;
});

test("extend: 親子 AND。子は狭めるだけで、広い access を書いても親が先に止める", async () => {
  assert.equal(await as(active, widenedChild.guard), `redirect:/admin/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  assert.equal(await as(admin, widenedChild.guard), "ok");
  // 子の段: 管理者カテゴリでも admin ロール以外は子の行き先へ
  assert.equal(await as(editor, usersRange.guard), "redirect:/admin");
  assert.equal(await as(admin, usersRange.guard), "ok");
  // 親の段が先: 管理者カテゴリでない利用者は親の行き先へ
  assert.equal(await as(active, usersRange.guard), `redirect:/admin/login?returnTo=${encodeURIComponent("/mypage/account")}`);
});

test("createLoader: 範囲かページの access が拒否なら load を呼ばない", async () => {
  let calls = 0;
  const load = userRange.createLoader({
    access: { roles: ["admin"] },
    load: async () => {
      calls += 1;
      return "data";
    },
  });
  assert.equal(await as(null, () => load({})), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  assert.equal(await as(active, () => load({})), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  assert.equal(calls, 0);
  assert.equal(await as(admin, () => load({})), "ok");
  assert.equal(calls, 1);
});

test("createLoader: access none は notFound", async () => {
  const load = root.createLoader({ access: "none", load: async () => "x" });
  assert.equal(await as(admin, () => load({})), "notFound");
});

test("createLoader: public の主体は利用可能な status のときだけ非 null", async () => {
  const seen: Array<string | null> = [];
  const load = root.createLoader({
    access: "public",
    load: async ({ user }) => {
      seen.push(user?.userId ?? null);
    },
  });
  for (const user of [null, active, inactive, suspendedAdmin]) await as(user, () => load({}));
  assert.deepEqual(seen, [null, "u1", null, null]);
  // ページで宣言した allowStatuses なら通す
  const withInactive = root.createLoader({
    access: "public",
    allowStatuses: ["active", "inactive"],
    load: async ({ user }) => user?.userId ?? null,
  });
  currentUser = inactive;
  assert.equal(await withInactive({}), "u2");
});

test("createLoader: key のプリミティブが load に渡る", async () => {
  type Props = { params: Promise<{ slug: string; page: string }> };
  const load = root.createLoader({
    access: "public",
    key: async (props: Props) => {
      const { slug, page } = await props.params;
      return [slug, Number(page)] as const;
    },
    load: async (_ctx, slug, page) => `${slug}:${page + 1}`,
  });
  currentUser = null;
  assert.equal(await load({ params: Promise.resolve({ slug: "coin", page: "1" }) }), "coin:2");
});

test("createLoader: allows は別の access を同じ利用者で評価する", async () => {
  const load = root.createLoader({
    access: "public",
    load: async ({ allows }) => [allows({ roles: ["admin"] }), allows("authenticated"), allows("none")],
  });
  currentUser = admin;
  assert.deepEqual(await load({}), [true, true, false]);
  currentUser = active;
  assert.deepEqual(await load({}), [false, true, false]);
  currentUser = null;
  assert.deepEqual(await load({}), [false, false, false]);
});
