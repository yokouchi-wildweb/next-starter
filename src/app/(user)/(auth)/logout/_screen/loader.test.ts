// /logout の loader の行き先の検査(挙動の固定。guard・next/navigation は偽物、戻り先の検査は本物)。
// - redirectTo 未指定・配列・外部 URL → / / 内部パス → そのまま
// 実行: pnpm test "src/app/(user)/(auth)/logout/_screen/loader.test.ts"
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

let load: typeof import("./loader").loadLogoutScreen;
before(async () => {
  ({ loadLogoutScreen: load } = await import("./loader"));
});
beforeEach(() => {
  currentUser = null;
});
const run = (redirectTo?: string | string[]) =>
  outcome(() => load({ params: Promise.resolve({}), searchParams: Promise.resolve({ redirectTo }) } as never));

test("未指定 → /", async () => {
  assert.deepEqual(await run(), { value: { redirectTo: "/" } });
});

test("配列(同じキーが複数)→ /", async () => {
  assert.deepEqual(await run(["/a", "/b"]), { value: { redirectTo: "/" } });
});

test("外部 URL・プロトコル相対 → /", async () => {
  assert.deepEqual(await run("https://evil.example/"), { value: { redirectTo: "/" } });
  assert.deepEqual(await run("//evil.example/"), { value: { redirectTo: "/" } });
});

test("内部パス → そのまま", async () => {
  assert.deepEqual(await run("/signup"), { value: { redirectTo: "/signup" } });
});
