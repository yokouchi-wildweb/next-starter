// /admin/messaging/templates の loader の検査(挙動の固定。guard・next/navigation・featureGate は偽物)。
// - 門の機能 messagingTemplates が閉 → notFound / 開 → 何もしない(作る・直すは一覧のモーダル。/new と /[id] の住所は無い)
// 実行: pnpm test "src/app/admin/(protected)/messaging/templates/_screen/loader.test.ts"
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

let loadList: typeof import("./loader").loadAdminMessagingTemplateListScreen;
before(async () => {
  ({ loadAdminMessagingTemplateListScreen: loadList } = await import("./loader"));
});
beforeEach(() => {
  currentUser = { userId: "a1", role: "admin" };
  enabled = true;
  asked.length = 0;
});
const props = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params), searchParams: Promise.resolve({}) }) as never;

test("門 messagingTemplates が閉 → notFound", async () => {
  enabled = false;
  assert.deepEqual(await outcome(() => loadList(props())), { notFound: true });
  assert.deepEqual(asked, ["messagingTemplates"]);
});

test("開 → 何もしない", async () => {
  assert.deepEqual(await outcome(() => loadList(props())), { value: undefined });
});
