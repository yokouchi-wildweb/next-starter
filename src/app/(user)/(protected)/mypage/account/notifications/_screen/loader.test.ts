// /mypage/account/notifications の loader の検査(挙動の固定。guard・next/navigation・featureGate は偽物)。
// - 門の機能 messagingPreferences が閉 → notFound / 開 → 何もしない
// 実行: pnpm test "src/app/(user)/(protected)/mypage/account/notifications/_screen/loader.test.ts"
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

let load: typeof import("./loader").loadMyPageAccountNotificationsScreen;
before(async () => {
  ({ loadMyPageAccountNotificationsScreen: load } = await import("./loader"));
});
beforeEach(() => {
  currentUser = { userId: "u1", status: "active" };
  enabled = true;
  asked.length = 0;
});
const run = () => outcome(() => load({} as never));

test("messagingPreferences が閉 → notFound", async () => {
  enabled = false;
  assert.deepEqual(await run(), { notFound: true });
  assert.deepEqual(asked, ["messagingPreferences"]);
});

test("開 → 何もしない", async () => {
  assert.deepEqual(await run(), { value: undefined });
});
