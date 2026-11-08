// 監査ログの横断検索の絞り込みの検査。
// - buildAuditLogSearchWhere: 空白だけの欄は使わない・前後の空白を落とす・1 条件はそのまま・複数は and・操作名は前方一致
// - useAuditLogSearchFilters: 下書きの変更は where を変えず、apply で確定、reset で両方を空に戻す
// 実行: pnpm test src/features/core/auditLog/hooks/useAuditLogSearchFilters.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

import { buildAuditLogSearchWhere, EMPTY_AUDIT_LOG_SEARCH_FILTERS } from "../utils/searchWhere";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useAuditLogSearchFilters: typeof import("./useAuditLogSearchFilters").useAuditLogSearchFilters;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useAuditLogSearchFilters } = await import("./useAuditLogSearchFilters"));
});
after(() => dom.window.close());

test("where: 条件なしは undefined、空白だけの欄は使わない", () => {
  assert.equal(buildAuditLogSearchWhere(EMPTY_AUDIT_LOG_SEARCH_FILTERS), undefined);
  assert.equal(buildAuditLogSearchWhere({ ...EMPTY_AUDIT_LOG_SEARCH_FILTERS, targetId: "   " }), undefined);
});

test("where: 1 条件はそのまま、値の前後の空白を落とす", () => {
  assert.deepEqual(buildAuditLogSearchWhere({ ...EMPTY_AUDIT_LOG_SEARCH_FILTERS, actionPrefix: " user.email " }), {
    field: "action",
    op: "startsWith",
    value: "user.email",
  });
});

test("where: 複数は and(対象の種類・id・実行者・操作名・バッチの順)", () => {
  assert.deepEqual(
    buildAuditLogSearchWhere({ targetType: "user", targetId: "u1", actorId: "a1", actionPrefix: "user.", batchId: "b1" }),
    {
      and: [
        { field: "targetType", op: "eq", value: "user" },
        { field: "targetId", op: "eq", value: "u1" },
        { field: "actorId", op: "eq", value: "a1" },
        { field: "action", op: "startsWith", value: "user." },
        { field: "batchId", op: "eq", value: "b1" },
      ],
    },
  );
});

test("hook: 下書きは apply まで where を変えず、reset で両方を空に戻す", async () => {
  let state: ReturnType<typeof useAuditLogSearchFilters> | undefined;
  const Probe = () => {
    const s = useAuditLogSearchFilters();
    useEffect(() => {
      state = s;
    });
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  await act(async () => state?.setDraftField("targetType", "user"));
  assert.equal(state?.draft.targetType, "user");
  assert.equal(state?.where, undefined);
  await act(async () => state?.apply());
  assert.deepEqual(state?.where, { field: "targetType", op: "eq", value: "user" });
  assert.equal(state?.applied.targetType, "user");
  await act(async () => state?.reset());
  assert.deepEqual(state?.draft, EMPTY_AUDIT_LOG_SEARCH_FILTERS);
  assert.equal(state?.where, undefined);
  await act(async () => root.unmount());
});
