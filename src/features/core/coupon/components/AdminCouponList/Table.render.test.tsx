// 管理一覧の Table の検査:
// - 列の関数とフックに切り出す前の出力と同じ(__fixtures__ は切り出す前のコードで記録)
// - 列の関数は列の配列を返す(fork は自分の列を差し込める)
// - フックは行のクリックで詳細のモーダルの対象を決め、閉じると空に戻す
// 実行: pnpm test src/features/core/coupon
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { useAdminCouponListTable, type UseAdminCouponListTableReturn } from "@/features/core/coupon/hooks/useAdminCouponListTable";

import { createAdminCouponListColumns } from "./columns";
import { couponTableCases, sampleCoupons } from "./tableCases";

const fixtures = JSON.parse(readFileSync("src/features/core/coupon/components/AdminCouponList/__fixtures__/couponTable.json", "utf8")) as Record<string, string>;

test("出力は切り出す前と同じ", () => {
  assert.deepEqual(Object.keys(couponTableCases).sort(), Object.keys(fixtures).sort());
  for (const [name, el] of Object.entries(couponTableCases)) assert.equal(renderToStaticMarkup(el), fixtures[name], name);
});

test("列の関数は列の配列を返し、自分の列を足せる", () => {
  const columns = createAdminCouponListColumns();
  assert.ok(Array.isArray(columns) && columns.length > 0);
  const extended = [...columns, { header: "追加", render: () => "x" }];
  assert.equal(extended.length, columns.length + 1);
  assert.notEqual(createAdminCouponListColumns(), columns); // 呼ぶたびに新しい配列(呼び手が書き換えても上流に残らない)
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "navigator"]) {
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
});
after(() => dom.window.close());

test("フック: 行のクリックで詳細の対象が決まり、閉じると空に戻る", async () => {
  let t = null as unknown as UseAdminCouponListTableReturn;
  const capture = (value: UseAdminCouponListTableReturn) => {
    t = value;
  };
  function Probe() {
    capture(useAdminCouponListTable());
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  assert.equal(t.modal.open, false);
  assert.equal(t.rowProps.rowClassName, "cursor-pointer");
  await act(async () => t.rowProps.onRowClick(sampleCoupons[1]));
  assert.deepEqual(({ couponId: t.modal.couponId, open: t.modal.open }), { couponId: "c2", open: true });
  await act(async () => t.modal.onOpenChange(false));
  assert.equal(t.modal.open, false);
  await act(async () => root.unmount());
});
