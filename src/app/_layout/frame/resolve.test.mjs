// 実行: pnpm test src/app/_layout/frame/resolve.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkFrameDeclaration, checkFrameValue, emptyFrame, frameRowValue, hidesWholeFrame, matchFrame, overlayFrame } from "./resolve.mjs";

test("checkFrameValue: 部位は枠ごと、値は { sp?, pc? } の真偽、未知のキーは失敗", () => {
  assert.deepEqual(checkFrameValue({ hide: { bottomNav: { sp: true }, footer: { sp: false, pc: true } }, fill: true }, "user"), []);
  assert.deepEqual(checkFrameValue({ hide: { sidebar: { pc: true } } }, "admin"), []);
  assert.match(checkFrameValue({ hide: { sidebar: { pc: true } } }, "user")[0], /この枠の部位でない/);
  assert.match(checkFrameValue({ hide: { bottomNav: { sp: true } } }, "admin")[0], /この枠の部位でない/);
  assert.match(checkFrameValue({ hide: { footer: true } }, "user")[0], /\{ sp\?: boolean, pc\?: boolean \}/);
  assert.match(checkFrameValue({ hide: { footer: { tablet: true } } }, "user")[0], /端末でない/);
  assert.match(checkFrameValue({ hide: { footer: { sp: "yes" } } }, "user")[0], /真偽/);
  assert.match(checkFrameValue({ title: "x" }, "user")[0], /未知のキー title/);
  assert.match(checkFrameValue({ fill: 1 }, "user")[0], /fill は真偽/);
  assert.equal(checkFrameValue([], "user").length, 1);
});

test("checkFrameDeclaration: 範囲はキー layout / page で名指す、キーが無い・知らないキーは失敗、各範囲は値の形", () => {
  assert.deepEqual(checkFrameDeclaration({ layout: { hide: { bottomNav: { pc: true } } }, page: { fill: true } }, "user"), []);
  assert.deepEqual(checkFrameDeclaration({ page: {} }, "user"), [], "空の範囲は書ける(何も変えない)");
  assert.match(checkFrameDeclaration({}, "user")[0], /範囲のキーが無い/);
  assert.match(checkFrameDeclaration({ hide: { footer: { sp: true } } }, "user")[0], /未知のキー hide\(範囲は layout \/ page/);
  assert.match(checkFrameDeclaration({ layout: { hide: { sidebar: { sp: true } } } }, "user")[0], /^layout: hide の sidebar はこの枠の部位でない/);
  assert.match(checkFrameDeclaration({ page: { page: {} } }, "admin")[0], /^page: 未知のキー page/);
  assert.match(checkFrameDeclaration({ page: true }, "user")[0], /^page: 値は/);
  assert.equal(checkFrameDeclaration(null, "user").length, 1);
});

test("overlayFrame: 省略 = 親のまま、false = 取り消し、上に重ねた方が勝つ(部位と端末ごと)", () => {
  const parent = overlayFrame(emptyFrame(), { hide: { footer: { sp: true, pc: true }, bottomNav: { sp: true } }, fill: true }, "user");
  const child = overlayFrame(parent, { hide: { footer: { pc: false }, header: { pc: true } } }, "user");
  assert.deepEqual(frameRowValue(child, "user"), { hide: ["header-pc", "footer-sp", "bottom-nav-sp"], fill: true });
  const override = overlayFrame(child, { hide: { bottomNav: { sp: false } }, fill: false }, "user");
  assert.deepEqual(frameRowValue(override, "user"), { hide: ["header-pc", "footer-sp"], fill: false });
  assert.deepEqual(frameRowValue(parent, "user").hide, ["footer-sp", "footer-pc", "bottom-nav-sp"], "元は変えない");
  assert.deepEqual(frameRowValue(overlayFrame(emptyFrame(), { hide: { header: { sp: true } } }, "admin"), "admin").hide, ["admin-header-sp"]);
});

test("hidesWholeFrame: 全部の部位を両方の端末で隠したときだけ", () => {
  const all = { hide: { header: { sp: true, pc: true }, headerNav: { sp: true, pc: true }, footer: { sp: true, pc: true }, bottomNav: { sp: true, pc: true } } };
  assert.equal(hidesWholeFrame(overlayFrame(emptyFrame(), all, "user"), "user"), true);
  assert.equal(hidesWholeFrame(overlayFrame(emptyFrame(), { ...all, hide: { ...all.hide, footer: { sp: true } } }, "user"), "user"), false);
});

test("matchFrame: 静的が先・長い方が先・page が layout より先、当たる 1 行だけ(重ねない)、無ければ何も隠さない", () => {
  const row = (pattern, scope, hide) => ({ pattern, scope, hide, fill: false });
  const table = [
    row([], "layout", ["root"]),
    row(["(public)", "x"], "layout", ["x-layout"]),
    row(["(public)", "x", "[id]"], "page", ["x-id"]),
    row(["(public)", "x", "new"], "page", ["x-new"]),
    row(["(public)", "c", "[...slug]"], "page", ["catch"]),
    row(["(public)", "o", "[[...rest]]"], "page", ["optional"]),
  ];
  assert.deepEqual(matchFrame(["(public)", "x", "123"], table).hide, ["x-id"]);
  assert.deepEqual(matchFrame(["(public)", "x", "new"], table).hide, ["x-new"], "静的な兄弟が勝つ");
  assert.deepEqual(matchFrame(["(public)", "x", "123", "edit"], table).hide, ["x-layout"], "長さの違う page には当たらない");
  assert.deepEqual(matchFrame(["(public)", "c", "a/b"], table).hide, ["catch"], "catch-all は 1 つの segment");
  assert.deepEqual(matchFrame(["(public)", "o"], table).hide, ["optional"], "[[...x]] は無くてよい");
  assert.deepEqual(matchFrame(["(public)", "o", "a"], table).hide, ["optional"]);
  assert.deepEqual(matchFrame(["(auth)", "login"], table).hide, ["root"]);
  assert.deepEqual(matchFrame(["(auth)"], []), { hide: [], fill: false });
  assert.deepEqual(matchFrame(["a"], [row(["a"], "layout", ["layout"]), row(["a"], "page", ["page"])]).hide, ["page"]);
});
