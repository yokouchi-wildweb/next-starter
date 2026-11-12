// /admin/messaging/overrides と /admin/messaging/overrides/[key] の loader の検査(挙動の固定。guard・next/navigation・featureGate は偽物)。
// - 門の機能 messagingOverrides が閉 → notFound / 開 → 一覧は何もしない、1 件は連絡の鍵を返す(URL の符号は戻す)
// - [key] の loader もここで見る(node --test はファイルの引数の [] を glob に読み、[key] の下のテストを拾わないため)
// 実行: pnpm test "src/app/admin/(protected)/messaging/overrides/_screen/loader.test.ts"
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
mock.module("@/app/admin/(protected)/guard", { namedExports: { createLoader } });

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

let enabled = true;
const asked: string[] = [];
mock.module("@/featureGate", {
  namedExports: {
    gate: {
      enabled: (name: string) => {
        asked.push(name);
        return enabled;
      },
    },
  },
});

let load: typeof import("./loader").loadAdminMessagingOverrideListScreen;
let loadOne: typeof import("../[key]/_screen/loader").loadAdminMessagingOverrideScreen;
before(async () => {
  ({ loadAdminMessagingOverrideListScreen: load } = await import("./loader"));
  ({ loadAdminMessagingOverrideScreen: loadOne } = await import("../[key]/_screen/loader"));
});
beforeEach(() => {
  currentUser = { userId: "a1", role: "admin" };
  enabled = true;
  asked.length = 0;
});
const run = () => outcome(() => load({} as never));

test("一覧: messagingOverrides が閉 → notFound", async () => {
  enabled = false;
  assert.deepEqual(await run(), { notFound: true });
  assert.deepEqual(asked, ["messagingOverrides"]);
});

test("一覧: 開 → 何もしない", async () => {
  assert.deepEqual(await run(), { value: undefined });
});

const runOne = (key: string) =>
  outcome(() => loadOne({ params: Promise.resolve({ key }), searchParams: Promise.resolve({}) } as never));

test("1 件: messagingOverrides が閉 → notFound", async () => {
  enabled = false;
  assert.deepEqual(await runOne("user.registrationComplete"), { notFound: true });
  assert.deepEqual(asked, ["messagingOverrides"]);
});

test("1 件: 開 → 連絡の鍵を返す", async () => {
  assert.deepEqual(await runOne("user.registrationComplete"), { value: { messageKey: "user.registrationComplete" } });
  assert.deepEqual(await runOne("wallet%2EexpiredNotice"), { value: { messageKey: "wallet.expiredNotice" } });
});
