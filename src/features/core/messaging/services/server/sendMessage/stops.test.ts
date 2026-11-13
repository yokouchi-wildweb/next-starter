// 配信停止の判定の検査(D35)
// - 好み: 取引(transactional)と required は見ない。'*' の種類・経路は全部に当たる。
//   種別まるごとの行(kind X、'*' '*')は種別 X の連絡の全種類・全経路に当たり、ほかの種別には当たらない(和、D71)
// - 宛先の停止: required でない連絡は hard_bounce・complaint・manual にいつも従い、one_click は範囲が種類か '*' の時だけ。
//   required は hard_bounce だけ
// - 宛先が複数なら止めた宛先だけ外し、残りが無ければ suppression
// 実行: pnpm test src/features/core/messaging/services/server/sendMessage/stops.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkStops, hashAddress, honoursPreferences, type StopContext } from "./stops";
import { createDeps, createMemoryStore } from "./testHelpers";

const marketing: StopContext = { kind: "marketing", required: false, category: "news" };
const transactional: StopContext = { kind: "transactional", required: false, category: "account" };
const required: StopContext = { kind: "transactional", required: true, category: "account" };
const target = (userId: string | null, addresses: string[], channel = "email") => ({
  recipientKey: userId ? `user:${userId}` : `addr:${hashAddress(addresses[0])}`,
  userId,
  channel,
  addresses,
});

function setup() {
  const store = createMemoryStore();
  return { store, deps: createDeps({ store }) };
}

test("好みに従う連絡か", () => {
  assert.equal(honoursPreferences(marketing), true);
  assert.equal(honoursPreferences({ ...marketing, kind: "activity" }), true);
  assert.equal(honoursPreferences(transactional), false);
  assert.equal(honoursPreferences({ ...marketing, required: true }), false);
});

test("好み: 種類 × 経路、'*' は全部、取引と required は見ない", async () => {
  const { store, deps } = setup();
  store.preferences.push(
    { userId: "u1", category: "news", channel: "email" },
    { userId: "u2", category: "*", channel: "email" },
    { userId: "u3", category: "news", channel: "*" },
    { userId: "u4", category: "other", channel: "email" },
  );
  const targets = ["u1", "u2", "u3", "u4"].map((id) => target(id, [`${id}@x.test`]));
  assert.deepEqual(
    (await checkStops(deps, marketing, targets)).map((v) => (v.stopped ? v.reason : "ok")),
    ["preference", "preference", "preference", "ok"],
  );
  assert.deepEqual(
    (await checkStops(deps, transactional, targets)).map((v) => v.stopped),
    [false, false, false, false],
  );
});

test("好み: 種別まるごとの行は同じ種別の連絡だけを全経路で止める", async () => {
  const { store, deps } = setup();
  store.preferences.push(
    { userId: "u1", category: "*", channel: "*", kind: "marketing" },
    { userId: "u2", category: "*", channel: "*", kind: "activity" },
  );
  const targets = [target("u1", ["a@x.test"]), target("u1", ["a"], "inApp"), target("u2", ["b@x.test"])];
  assert.deepEqual((await checkStops(deps, marketing, targets)).map((v) => v.stopped), [true, true, false]);
  assert.deepEqual(
    (await checkStops(deps, { ...marketing, kind: "activity", category: "likes" }, targets)).map((v) => v.stopped),
    [false, false, true],
  );
});

test("宛先の停止: 理由と範囲、required は hard_bounce だけ", async () => {
  const { store, deps } = setup();
  const add = (address: string, reason: string, scope = "*") =>
    store.suppressions.push({ channel: "email", addressHash: hashAddress(address), reason, scope });
  add("bounce@x.test", "hard_bounce");
  add("complaint@x.test", "complaint");
  add("manual@x.test", "manual");
  add("oneclick-news@x.test", "one_click", "news");
  add("oneclick-other@x.test", "one_click", "other");
  add("oneclick-all@x.test", "one_click", "*");
  const addresses = [
    "bounce@x.test",
    "complaint@x.test",
    "manual@x.test",
    "oneclick-news@x.test",
    "oneclick-other@x.test",
    "oneclick-all@x.test",
  ];
  const targets = addresses.map((address) => target(null, [address]));
  const verdicts = (ctx: StopContext) =>
    checkStops(deps, ctx, targets).then((list) => list.map((v) => (v.stopped ? v.reason : "ok")));
  assert.deepEqual(await verdicts(marketing), ["suppression", "suppression", "suppression", "suppression", "ok", "suppression"]);
  assert.deepEqual(await verdicts(transactional), ["suppression", "suppression", "suppression", "ok", "ok", "suppression"]);
  assert.deepEqual(await verdicts(required), ["suppression", "ok", "ok", "ok", "ok", "ok"]);
  // 宛先は正規化して照らす
  assert.equal((await checkStops(deps, marketing, [target(null, ["  BOUNCE@x.test "])]))[0].stopped, true);
});

test("宛先が複数なら止めた宛先だけ外す", async () => {
  const { store, deps } = setup();
  store.suppressions.push({ channel: "email", addressHash: hashAddress("a@x.test"), reason: "hard_bounce", scope: "*" });
  const [verdict] = await checkStops(deps, marketing, [target("u1", ["a@x.test", "b@x.test"])]);
  assert.deepEqual(verdict, { stopped: false, addresses: ["b@x.test"] });
});
