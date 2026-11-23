// 設定のメニュー項目に点 userMenuItems の差した項目を重ねる関数(./mergeMenuItems.ts)の検査。
// 閉じたドメインの項目を外すのは門番(useGate().plugs、src/featureGate の検査)で、ここには届かない
// 実行: pnpm test 'src/app/(user)/_layout/hooks/mergeMenuItems.test.ts'
import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeMenuItems, type MenuPlug } from "./mergeMenuItems";

type Item = { key: string };
const base: Item[] = [{ key: "home" }, { key: "service" }, { key: "mypage" }];
const keys = (items: Item[]) => items.map((item) => item.key);
const plug = (key: string, rest: Partial<MenuPlug<Item>> = {}): MenuPlug<Item> => ({ audience: "all", entry: { key }, ...rest });

test("差した項目が無ければ設定の項目のまま(差さない fork は見た目が変わらない)", () => {
  assert.deepEqual(mergeMenuItems(base, [], true), base);
  assert.deepEqual(mergeMenuItems(base, [], false), base);
});

test("after の鍵の項目の直後に入り、同じ位置の項目は差した順(点の並び)のまま", () => {
  const merged = mergeMenuItems(base, [plug("a", { after: "home" }), plug("b", { after: "home" }), plug("c", { after: "mypage" })], true);
  assert.deepEqual(keys(merged), ["home", "a", "b", "service", "mypage", "c"]);
});

test("after が無い・設定に無い鍵は末尾", () => {
  const merged = mergeMenuItems(base, [plug("x"), plug("y", { after: "unknown" })], true);
  assert.deepEqual(keys(merged), ["home", "service", "mypage", "x", "y"]);
});

test("audience: ログイン中は authenticated と all、未ログインは guest と all だけ", () => {
  const plugs = [plug("in", { audience: "authenticated" }), plug("out", { audience: "guest" }), plug("both")];
  assert.deepEqual(keys(mergeMenuItems(base, plugs, true)), ["home", "service", "mypage", "in", "both"]);
  assert.deepEqual(keys(mergeMenuItems(base, plugs, false)), ["home", "service", "mypage", "out", "both"]);
});

test("設定の配列を書き換えない", () => {
  const before = [...base];
  mergeMenuItems(base, [plug("a", { after: "home" })], true);
  assert.deepEqual(base, before);
});
