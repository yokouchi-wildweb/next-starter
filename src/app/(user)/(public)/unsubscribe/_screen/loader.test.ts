// /unsubscribe の loader の検査(guard は偽物、トークンの確かめは偽物の describe)。
// - searchParams.token が正しい → 種類と経路の表示名つき / 正しくない・無い・配列 → valid false
// 実行: pnpm test "src/app/(user)/(public)/unsubscribe/_screen/loader.test.ts"
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

type Def = { key?: (props: unknown) => Promise<unknown[]>; load: (ctx: unknown, ...keys: unknown[]) => unknown };
const accesses: unknown[] = [];
const createLoader = (def: Def & { access: unknown }) => {
  accesses.push(def.access);
  return async (props: unknown) => {
    const keys = def.key ? await def.key(props) : [];
    return def.load({ user: null }, ...keys);
  };
};
mock.module("@/app/guard", { namedExports: { createLoader } });
const asked: (string | null)[] = [];
mock.module("@/features/core/messaging/services/server/unsubscribe", {
  namedExports: {
    describeUnsubscribeToken: (token: string | null) => {
      asked.push(token);
      return token === "good" ? { valid: true, categoryLabel: "キャンペーン情報", channelLabel: "メール" } : { valid: false };
    },
  },
});

let load: typeof import("./loader").loadUnsubscribeScreen;
before(async () => {
  ({ loadUnsubscribeScreen: load } = await import("./loader"));
});
const run = (searchParams: Record<string, unknown>) => load({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) } as never);

test("access は public", () => {
  assert.deepEqual(accesses, ["public"]);
});

test("正しいトークン → 表示名つき", async () => {
  assert.deepEqual(await run({ token: "good" }), { valid: true, token: "good", categoryLabel: "キャンペーン情報", channelLabel: "メール" });
});

test("正しくない・無い・配列・古い引数 t → valid false", async () => {
  assert.deepEqual(await run({ token: "bad" }), { valid: false });
  assert.deepEqual(await run({}), { valid: false });
  assert.deepEqual(await run({ token: ["good", "good"] }), { valid: false });
  assert.deepEqual(await run({ t: "good" }), { valid: false });
  assert.deepEqual(asked.slice(-3), [null, null, null]);
});
