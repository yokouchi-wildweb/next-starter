// src/lib/pageGuard/createPageGuard.test.mts
// ページの守りの汎用版の契約の回帰テスト(stub の束を差し込んで実際の guard / createLoader / extend を動かす。DB は使わない)。
// - 範囲は段の並びで親子 AND(子は狭めるだけ)。setup 誘導・未認証・status 別・権限不足の行き先、無ければ notFound
// - loader は範囲とページの access を単独で評価し、拒否なら load を呼ばない。public の主体は利用可能な status のときだけ
// - key が返すプリミティブが load に渡る
// - Guard(範囲の layout の守りの境界)は Suspense の内側で範囲を評価してから children を返し、断られた訪問者には投げる
// - 全段 public で setup 誘導の無い鎖は、load が getUser()・allows() を呼んだ時だけ利用者を解く(それ以外は先に評価)
// - その鎖の既定は load の前に connection()。load の無い loader と shell: true の load は待たない(殻に入る)
// - access の評価は差し込む関数(束の evaluateAccess)。ここでは auth の評価と同じ答えを返す小さな代わりを置く
//   (閉じた lib は features を読まない。本物の評価 evaluateApiAccessRule は auth のテストが見る)
// 実行: pnpm test src/lib/pageGuard/createPageGuard.test.mts

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import nextServer from "next/server";

import type { PageAccess, PageAccessDecision } from "./types.ts";

// 遅らせる鎖の既定は load の前に next/server の connection() を待つ。Next のリクエストの外(ここ)では throw するので、呼ばれた数を数える物にする
let connectionCalls = 0;
mock.module("next/server", {
  namedExports: {
    ...nextServer,
    connection: async () => {
      connectionCalls += 1;
    },
  },
});
const { createPageGuard } = await import("./createPageGuard.ts");

type FakeUser = { userId: string; role: string; status: string };

/** ロール → カテゴリ(テストの利用者の分だけ) */
const ROLE_CATEGORY: Record<string, string> = { admin: "admin", editor: "admin", user: "user" };
const AVAILABLE_STATUSES: readonly string[] = ["active"];

/** auth の evaluateApiAccessRule と同じ順の代わり: none → public → 未認証 → status → authenticated → roles → roleCategories */
function evaluateAccess(
  rule: PageAccess,
  user: FakeUser | null,
  options: { allowStatuses?: readonly string[] },
): PageAccessDecision {
  if (rule === "none") return "not_found";
  if (rule === "public") return "granted";
  if (!user) return "unauthenticated";
  if (!(options.allowStatuses ?? AVAILABLE_STATUSES).includes(user.status)) return "forbidden";
  if (rule === "authenticated") return "granted";
  if (rule.roles?.includes(user.role)) return "granted";
  const category = ROLE_CATEGORY[user.role];
  if (category && rule.roleCategories?.includes(category)) return "granted";
  return "forbidden";
}
let currentUser: FakeUser | null = null;
let resolveCalls = 0;
let currentPath: string | null = "/mypage/account";
let usersExist = true;

const defineRootGuard = createPageGuard<FakeUser>({
  resolveUser: async () => {
    resolveCalls += 1;
    return currentUser;
  },
  evaluateAccess,
  availableStatuses: AVAILABLE_STATUSES,
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
  returnBack: true,
  statusRedirects: { inactive: "/reactivate" },
});
const adminRange = root.extend({
  access: { roleCategories: ["admin"] },
  redirectTo: "/admin/login",
  returnBack: true,
  setupRedirectTo: "/admin/setup",
});
// 子が親より広い access を書いても、親の段が先に評価されるので広がらない
const widenedChild = adminRange.extend({ access: "public" });
// ログイン済みの人を別の画面へ送る forbiddenRedirectTo(ログインと別の値、D116)
const usersRange = adminRange.extend({ access: { roles: ["admin"] }, forbiddenRedirectTo: "/admin" });

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

/** 範囲の守り(Guard の境界の内側の評価)を走らせる */
const enforce = (range: typeof adminRange) => () => renderGuarded(range, "children");

test("Guard の守り: root(public)は誰でも通す", async () => {
  assert.equal(await as(null, enforce(root)), "ok");
  assert.equal(await as(inactive, enforce(root)), "ok");
});

test("Guard の守り: 未認証は redirectTo へ returnTo 付き、行き先と同じパスなら付けない", async () => {
  assert.equal(await as(null, enforce(userRange)), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  currentPath = "/login";
  assert.equal(await as(null, enforce(userRange)), "redirect:/login");
  currentPath = "/mypage/account";
});

test("Guard の守り: status だけが通らないときは status 別の行き先(returnTo なし)", async () => {
  assert.equal(await as(inactive, enforce(userRange)), "redirect:/reactivate");
  assert.equal(await as(active, enforce(userRange)), "ok");
});

test("Guard の守り: ログイン済みのロール不一致は forbiddenRedirectTo、無ければ notFound(ログインへは送らない、D116)", async () => {
  assert.equal(await as(active, enforce(adminRange)), "notFound", "会員が管理を開くと notFound");
  assert.equal(await as(editor, enforce(usersRange)), "redirect:/admin", "別の画面へ送る forbiddenRedirectTo は残る");
  const bare = root.extend({ access: { roles: ["admin"] } });
  assert.equal(await as(active, enforce(bare)), "notFound");
  assert.equal(await as(null, enforce(bare)), "notFound");
});

test("Guard の守り: setup 誘導は access の判定より先", async () => {
  usersExist = false;
  assert.equal(await as(null, enforce(adminRange)), "redirect:/admin/setup");
  usersExist = true;
});

test("extend: 親子 AND。子は狭めるだけで、広い access を書いても親が先に止める", async () => {
  assert.equal(await as(active, enforce(widenedChild)), "notFound");
  assert.equal(await as(admin, enforce(widenedChild)), "ok");
  // 子の段: 管理者カテゴリでも admin ロール以外は子の行き先へ
  assert.equal(await as(editor, enforce(usersRange)), "redirect:/admin");
  assert.equal(await as(admin, enforce(usersRange)), "ok");
  // 親の段が先: 管理者カテゴリでない利用者は親の段で notFound、未ログインは親のログインへ
  assert.equal(await as(active, enforce(usersRange)), "notFound");
  assert.equal(await as(null, enforce(usersRange)), `redirect:/admin/login?returnTo=${encodeURIComponent("/mypage/account")}`);
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
  assert.equal(await as(active, () => load({})), "notFound", "ページの access で拒まれたログイン済みの人は notFound(D116)");
  assert.equal(calls, 0);
  assert.equal(await as(admin, () => load({})), "ok");
  assert.equal(calls, 1);
});

test("createLoader: 返る loader の publicChain = 範囲の全段とページが public の遅らせる鎖だけ true(D119)", () => {
  assert.equal(root.createLoader({ access: "public" }).publicChain, true);
  assert.equal(root.createLoader({ access: { roles: ["admin"] } }).publicChain, false);
  assert.equal(userRange.createLoader({ access: "public" }).publicChain, false, "守りの範囲の public のページは公開の鎖でない");
});

test("createLoader: ページの拒否は範囲に forbiddenRedirectTo があっても notFound、未認証は最寄りの段のログイン(D116)", async () => {
  const load = usersRange.createLoader({ access: { roles: ["owner"] } });
  assert.equal(await as(admin, () => load({})), "notFound");
  const inUser = userRange.createLoader({ access: { roles: ["admin"] } });
  assert.equal(await as(null, () => inUser({})), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
});

test("createLoader: access none は notFound", async () => {
  const load = root.createLoader({ access: "none", load: async () => "x" });
  assert.equal(await as(admin, () => load({})), "notFound");
});

test("createLoader: public の主体は利用可能な status のときだけ非 null", async () => {
  const seen: Array<string | null> = [];
  const load = root.createLoader({
    access: "public",
    load: async ({ getUser }) => {
      seen.push((await getUser())?.userId ?? null);
    },
  });
  for (const user of [null, active, inactive, suspendedAdmin]) await as(user, () => load({}));
  assert.deepEqual(seen, [null, "u1", null, null]);
  // ページで宣言した allowStatuses なら通す
  const withInactive = root.createLoader({
    access: "public",
    allowStatuses: ["active", "inactive"],
    load: async ({ getUser }) => (await getUser())?.userId ?? null,
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
    load: async ({ allows }) => [await allows({ roles: ["admin"] }), await allows("authenticated"), await allows("none")],
  });
  currentUser = admin;
  assert.deepEqual(await load({}), [true, true, false]);
  currentUser = active;
  assert.deepEqual(await load({}), [false, true, false]);
  currentUser = null;
  assert.deepEqual(await load({}), [false, false, false]);
});

test("createLoader: 全段 public の鎖は getUser・allows を呼ばなければ利用者を解かない", async () => {
  const load = root.createLoader({ access: "public", load: async () => "data" });
  currentUser = active;
  resolveCalls = 0;
  assert.equal(await load({}), "data");
  assert.equal(resolveCalls, 0);
});

test("createLoader: 全段 public の鎖で getUser と allows を呼ぶと、利用者を 1 回だけ解いて共有する", async () => {
  const load = root.createLoader({
    access: "public",
    load: async ({ getUser, allows }) => [(await getUser())?.userId ?? null, await allows("authenticated"), (await getUser())?.userId ?? null],
  });
  currentUser = active;
  resolveCalls = 0;
  assert.deepEqual(await load({}), ["u1", true, "u1"]);
  assert.equal(resolveCalls, 1);
});

test("createLoader: setup 誘導のある段・public でない段かページの鎖は load の前に評価する", async () => {
  const order: string[] = [];
  const track = <T,>(range: typeof root, access: PageAccess) =>
    range.createLoader({
      access,
      load: async () => {
        order.push(`load:${resolveCalls}`);
        return "data" as T;
      },
    });
  // 段に setup 誘導(public の子でも親の段が先)
  resolveCalls = 0;
  usersExist = false;
  assert.equal(await as(null, () => track(widenedChild, "public")({})), "redirect:/admin/setup");
  usersExist = true;
  // ページの access が public でない(root の下でも先に評価、未認証は notFound)
  assert.equal(await as(null, () => track(root, "authenticated")({})), "notFound");
  // 範囲が public でない: 通った時も load の前に 1 回解いている
  resolveCalls = 0;
  assert.equal(await as(active, () => track(userRange, "public")({})), "ok");
  assert.deepEqual(order, ["load:1"]);
});

test("createLoader: 全段 public の鎖でも getUser は利用できない status で null、allows は status で断る", async () => {
  const load = root.createLoader({
    access: "public",
    load: async ({ getUser, allows }) => [(await getUser())?.userId ?? null, await allows("authenticated")],
  });
  currentUser = inactive;
  assert.deepEqual(await load({}), [null, false]);
});

test("createLoader: 遅らせる鎖の既定は load の前に connection() を待つ", async () => {
  const order: string[] = [];
  const load = root.createLoader({
    access: "public",
    load: async () => {
      order.push(`load:${connectionCalls}`);
      return "data";
    },
  });
  connectionCalls = 0;
  assert.equal(await load({}), "data");
  assert.deepEqual(order, ["load:1"]);
});

test("createLoader: load の無い loader は利用者も connection も読まずに undefined を返す", async () => {
  const load = root.createLoader({ access: "public" });
  connectionCalls = 0;
  resolveCalls = 0;
  currentUser = active;
  assert.equal(await load({}), undefined);
  assert.equal(connectionCalls, 0);
  assert.equal(resolveCalls, 0);
  // 守りの鎖では load が無くても先に評価する(未認証は redirect)
  assert.equal(await as(null, () => userRange.createLoader({ access: "public" })({})), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
});

test("createLoader: shell: true の load は connection を待たない、守りの鎖では評価も今どおり", async () => {
  const load = root.createLoader({ access: "public", shell: true, load: async () => "static" });
  connectionCalls = 0;
  assert.equal(await load({}), "static");
  assert.equal(connectionCalls, 0);
  // 守りの鎖では shell は意味を持たない(connection の要らない鎖、評価は先)
  const guarded = userRange.createLoader({ access: "public", shell: true, load: async () => "x" });
  assert.equal(await as(null, () => guarded({})), `redirect:/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  assert.equal(await as(active, () => guarded({})), "ok");
  assert.equal(connectionCalls, 0);
});

test("guardMetadata: 断られた訪問者には Guard と同じ redirect / notFound を投げ、base を返さない(配下のページの題名を出さない)", async () => {
  const base = { robots: { index: false, follow: false } };
  const run = (range: typeof adminRange) => async () => range.guardMetadata(base)();
  assert.equal(await as(null, run(adminRange)), `redirect:/admin/login?returnTo=${encodeURIComponent("/mypage/account")}`);
  assert.equal(await as(active, run(adminRange)), "notFound", "ログイン済みの会員は notFound(D116)");
  const bare = root.extend({ access: { roles: ["admin"] } });
  assert.equal(await as(null, async () => bare.guardMetadata()()), "notFound");
  usersExist = false;
  assert.equal(await as(null, run(adminRange)), "redirect:/admin/setup");
  usersExist = true;
});

test("guardMetadata: 許された訪問者には base を返す(省略は空)", async () => {
  currentUser = active;
  assert.deepEqual(await userRange.guardMetadata({ robots: { index: false, follow: false } })(), { robots: { index: false, follow: false } });
  assert.deepEqual(await userRange.guardMetadata()(), {});
  assert.deepEqual(await root.guardMetadata()(), {});
});

/** Guard の要素から境界の内側の部品(守りを待ってから children を返す)を取り出して走らせる */
async function renderGuarded(range: typeof adminRange, children: unknown) {
  const boundary = range.Guard({ fallback: "loading", children: children as never }) as {
    props: { fallback: unknown; children: { type: (props: { children: unknown }) => Promise<unknown>; props: { children: unknown } } };
  };
  assert.equal(boundary.props.fallback, "loading");
  const inner = boundary.props.children;
  return inner.type(inner.props);
}

test("Guard: 範囲を通る訪問者には境界の内側で children を返す", async () => {
  currentUser = admin;
  const rendered = (await renderGuarded(adminRange, "secret")) as { props: { children: unknown } };
  assert.equal(rendered.props.children, "secret");
});

test("Guard: 未ログインは境界の内側で redirect を投げ、children を返さない", async () => {
  assert.equal(
    await as(null, () => renderGuarded(adminRange, "secret")),
    `redirect:/admin/login?returnTo=${encodeURIComponent("/mypage/account")}`,
  );
});

test("Guard: 権限の足りない訪問者は境界の内側で断られ(行き先が無ければ notFound)、children を返さない", async () => {
  const bare = root.extend({ access: { roles: ["admin"] } });
  assert.equal(await as(active, () => renderGuarded(bare, "secret")), "notFound");
  assert.equal(await as(editor, () => renderGuarded(usersRange, "secret")), "redirect:/admin");
});
