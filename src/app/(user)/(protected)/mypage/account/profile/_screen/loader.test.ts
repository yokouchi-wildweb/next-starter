// /mypage/account/profile の loader の行き先の検査(挙動の固定。guard・next/navigation・項目の判定・userService・userProfileService は偽物)。
// - 項目 profile が一覧に無い → /mypage/account(レコードの取得より前)/ ある → 利用者とプロフィール、レコード取得の行き先は /login
// 実行: pnpm test "src/app/(user)/(protected)/mypage/account/profile/_screen/loader.test.ts"
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// guard の createLoader は偽物: access の評価を飛ばし、key → load({ user }, ...key) を直に呼ぶ
let currentUser: Record<string, unknown> | null = null;
type Def = { key?: (props: unknown) => Promise<unknown[]>; load: (ctx: unknown, ...keys: unknown[]) => unknown };
const createLoader = (def: Def) => async (props: unknown) => {
  const keys = def.key ? await def.key(props) : [];
  return def.load({ user: currentUser }, ...keys);
};
mock.module("@/app/(user)/(protected)/guard", { namedExports: { createLoader } });

// redirect / notFound は投げる偽物(Next と同じく以降を実行しない)。行き先を記録する
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
class NotFound extends Error {}
mock.module(pathToFileURL(require.resolve("next/navigation")).href, {
  namedExports: {
    redirect: (to: string) => {
      throw new Redirected(to);
    },
    notFound: () => {
      throw new NotFound();
    },
  },
});

/** loader を呼び、redirect なら行き先、notFound なら "notFound"、それ以外は返り値 */
const outcome = async (run: () => Promise<unknown>) => {
  try {
    return { value: await run() };
  } catch (e) {
    if (e instanceof Redirected) return { redirect: e.to };
    if (e instanceof NotFound) return { notFound: true };
    throw e;
  }
};

// 項目の判定は偽物: 変えられる一覧を test ごとに差し替える(本物の一覧は user の設定 account.editableItems)
const editable = new Set<string>();
mock.module("@/features/core/user/utils/accountItems", {
  namedExports: { isAccountItemEditable: (item: string) => editable.has(item) },
});

const recordRedirects: string[] = [];
const userRecord = { id: "u1", role: "user" };
mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    requireUserRecord: async (_user: unknown, redirectTo: string) => {
      recordRedirects.push(redirectTo);
      return userRecord;
    },
  },
});
mock.module("@/features/core/userProfile/services/server/userProfileService", {
  namedExports: { userProfileService: { getProfile: async () => ({ bio: "x" }) } },
});

let load: typeof import("./loader").loadMyPageAccountProfileScreen;
before(async () => {
  ({ loadMyPageAccountProfileScreen: load } = await import("./loader"));
});
beforeEach(() => {
  currentUser = { userId: "u1", status: "active" };
  recordRedirects.length = 0;
  editable.clear();
  editable.add("profile");
});
const run = () => outcome(() => load({} as never));

test("項目 profile が一覧に無い → /mypage/account、レコードは取らない", async () => {
  editable.clear();
  assert.deepEqual(await run(), { redirect: "/mypage/account" });
  assert.deepEqual(recordRedirects, []);
});

test("一覧にある → 利用者とプロフィール。レコードが無いときの行き先は /login", async () => {
  assert.deepEqual(await run(), { value: { user: userRecord, profileData: { bio: "x" } } });
  assert.deepEqual(recordRedirects, ["/login"]);
});
