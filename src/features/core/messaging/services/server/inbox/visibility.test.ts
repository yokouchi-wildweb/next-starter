// 受け取り箱の見える行と既読の規則の検査(SQL と同じ判定の写し)
// 実行: pnpm test src/features/core/messaging/services/server/inbox
import { test } from "node:test";
import assert from "node:assert/strict";

import { isRead } from "./readState";
import { isVisible, type VisibilityFacts } from "./visibility";

const NOW = new Date("2026-11-11T12:00:00Z");
const base = (): VisibilityFacts => ({
  viewer: { userId: "u1", role: "user", createdAt: new Date("2026-11-01T00:00:00Z"), optOuts: [] },
  item: { userId: null, targetRoles: null, publishedAt: new Date("2026-11-10T00:00:00Z") },
  dispatch: { showToLaterSignups: false, kind: "marketing", category: "news" },
  now: NOW,
});
const visible = (patch: (f: VisibilityFacts) => void) => {
  const facts = base();
  patch(facts);
  return isVisible(facts);
};

test("自分宛ての行は見え、他人宛ては見えない", () => {
  assert.equal(visible((f) => (f.item.userId = "u1")), true);
  assert.equal(visible((f) => (f.item.userId = "u2")), false);
});

test("共有の行: 全員(target_roles null)と自分のロールは見え、他のロールは見えない", () => {
  assert.equal(visible(() => {}), true);
  assert.equal(visible((f) => (f.item.targetRoles = ["user", "admin"])), true);
  assert.equal(visible((f) => (f.item.targetRoles = ["admin"])), false);
});

test("公開の時刻が未来の行は見えない", () => {
  assert.equal(visible((f) => (f.item.publishedAt = new Date("2026-11-12T00:00:00Z"))), false);
  assert.equal(visible((f) => { f.item.userId = "u1"; f.item.publishedAt = new Date("2026-11-12T00:00:00Z"); }), false);
});

test("show_to_later_signups: false なら登録より前の共有の行は見えない(自分宛ての行は見える)、true なら見える", () => {
  const before = new Date("2026-10-01T00:00:00Z");
  assert.equal(visible((f) => (f.item.publishedAt = before)), false);
  assert.equal(visible((f) => { f.item.publishedAt = before; f.dispatch.showToLaterSignups = true; }), true);
  assert.equal(visible((f) => { f.item.publishedAt = before; f.item.userId = "u1"; }), true);
  assert.equal(visible((f) => (f.viewer.createdAt = null)), false);
});

test("共有の行は見る人の inApp の好みで隠す('*' を含む)。取引の回と自分宛ての行は隠さない", () => {
  const stop = (category: string, channel: string) => (f: VisibilityFacts) => (f.viewer.optOuts = [{ category, channel }]);
  assert.equal(visible(stop("news", "inApp")), false);
  assert.equal(visible(stop("*", "inApp")), false);
  assert.equal(visible(stop("news", "*")), false);
  assert.equal(visible(stop("news", "email")), true);
  assert.equal(visible(stop("other", "inApp")), true);
  assert.equal(visible((f) => { stop("*", "*")(f); f.dispatch.kind = "transactional"; }), true);
  assert.equal(visible((f) => { stop("news", "inApp")(f); f.item.userId = "u1"; }), true);
});

test("種別まるごとの行(kind、'*' '*')は同じ種別の共有の行だけを隠す。kind の無い前の回には当たらない", () => {
  const kindStop = (kind: string) => (f: VisibilityFacts) => (f.viewer.optOuts = [{ category: "*", channel: "*", kind }]);
  assert.equal(visible(kindStop("marketing")), false);
  assert.equal(visible(kindStop("activity")), true);
  assert.equal(visible((f) => { kindStop("marketing")(f); f.dispatch.kind = null; }), true);
  // kind の無い '*' '*' は今までどおり全部を隠す
  assert.equal(visible((f) => { f.viewer.optOuts = [{ category: "*", channel: "*", kind: null }]; f.dispatch.kind = "activity"; }), false);
});

test("既読 = 個別の既読の行 か 公開の時刻 ≤ watermark", () => {
  const publishedAt = new Date("2026-11-10T00:00:00Z");
  assert.equal(isRead({ hasReadRow: true, publishedAt, watermark: null }), true);
  assert.equal(isRead({ hasReadRow: false, publishedAt, watermark: null }), false);
  assert.equal(isRead({ hasReadRow: false, publishedAt, watermark: publishedAt }), true);
  assert.equal(isRead({ hasReadRow: false, publishedAt, watermark: new Date("2026-11-09T00:00:00Z") }), false);
});
