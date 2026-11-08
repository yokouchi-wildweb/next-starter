// /mypage/account/password の loader の行き先の検査(挙動の固定。guard・next/navigation・userService は偽物)。
// - email 以外・メール無し → /mypage/account / email + メール有り → { email } / レコード取得の行き先は /login
// 実行: pnpm test "src/app/(user)/(protected)/mypage/account/password/_screen/loader.test.ts"
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

let record: Record<string, unknown> = {};
const recordRedirects: string[] = [];
mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    requireUserRecord: async (_user: unknown, redirectTo: string) => {
      recordRedirects.push(redirectTo);
      return record;
    },
  },
});

let load: typeof import("./loader").loadMyPageAccountPasswordScreen;
before(async () => {
  ({ loadMyPageAccountPasswordScreen: load } = await import("./loader"));
});
beforeEach(() => {
  currentUser = { userId: "u1", status: "active" };
  recordRedirects.length = 0;
});
const run = () => outcome(() => load({} as never));

test("email 以外の認証 → /mypage/account", async () => {
  record = { providerType: "google", email: "a@example.test" };
  assert.deepEqual(await run(), { redirect: "/mypage/account" });
});

test("メール無し → /mypage/account", async () => {
  record = { providerType: "email", email: null };
  assert.deepEqual(await run(), { redirect: "/mypage/account" });
});

test("email + メール有り → メールを返す。レコードが無いときの行き先は /login", async () => {
  record = { providerType: "email", email: "a@example.test" };
  assert.deepEqual(await run(), { value: { email: "a@example.test" } });
  assert.deepEqual(recordRedirects, ["/login"]);
});
