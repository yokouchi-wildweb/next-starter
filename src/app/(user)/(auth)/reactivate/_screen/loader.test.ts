// /reactivate の loader の行き先の検査(挙動の固定。guard・next/navigation・featureGate・user の定数は偽物)。
// - 休会機能が無効 → notFound(未ログインより前)/ 未ログイン → /login / inactive 以外 → / / inactive → 何もしない
// 実行: pnpm test "src/app/(user)/(auth)/reactivate/_screen/loader.test.ts"
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

let pauseEnabled = true;
mock.module("@/featureGate", {
  namedExports: { gate: { enabled: (name: string) => (name === "pause" ? pauseEnabled : true) } },
});
mock.module("@/features/core/user/constants", { namedExports: { USER_STATUSES: ["active", "inactive"] } });

let load: typeof import("./loader").loadReactivateScreen;
before(async () => {
  ({ loadReactivateScreen: load } = await import("./loader"));
});
beforeEach(() => {
  pauseEnabled = true;
  currentUser = null;
});
const run = () => outcome(() => load({} as never));

test("休会機能が無効 → notFound(未ログインでも先に)", async () => {
  pauseEnabled = false;
  assert.deepEqual(await run(), { notFound: true });
});

test("未ログイン → /login", async () => {
  assert.deepEqual(await run(), { redirect: "/login" });
});

test("inactive 以外 → /", async () => {
  for (const status of ["active", "suspended", "banned"]) {
    currentUser = { userId: "u1", status };
    assert.deepEqual(await run(), { redirect: "/" }, status);
  }
});

test("inactive → 何もしない", async () => {
  currentUser = { userId: "u1", status: "inactive" };
  assert.deepEqual(await run(), { value: undefined });
});
