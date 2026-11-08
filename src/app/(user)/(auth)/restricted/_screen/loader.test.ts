// /restricted の loader の行き先の検査(挙動の固定。guard・next/navigation・user の定数は偽物)。
// - 未ログイン → /login / active → / / inactive → /reactivate / 残る status → { status }
// 実行: pnpm test "src/app/(user)/(auth)/restricted/_screen/loader.test.ts"
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
mock.module("@/app/guard", { namedExports: { createLoader } });

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

mock.module("@/features/core/user/constants", { namedExports: { USER_STATUSES: ["active", "inactive"] } });

let load: typeof import("./loader").loadRestrictedScreen;
before(async () => {
  ({ loadRestrictedScreen: load } = await import("./loader"));
});
beforeEach(() => {
  currentUser = null;
});
const run = () => outcome(() => load({} as never));

test("未ログイン → /login", async () => {
  assert.deepEqual(await run(), { redirect: "/login" });
});

test("active → /", async () => {
  currentUser = { userId: "u1", status: "active" };
  assert.deepEqual(await run(), { redirect: "/" });
});

test("inactive → /reactivate", async () => {
  currentUser = { userId: "u1", status: "inactive" };
  assert.deepEqual(await run(), { redirect: "/reactivate" });
});

test("残る status → status を返す", async () => {
  for (const status of ["suspended", "banned", "security_locked"]) {
    currentUser = { userId: "u1", status };
    assert.deepEqual(await run(), { value: { status } }, status);
  }
});
