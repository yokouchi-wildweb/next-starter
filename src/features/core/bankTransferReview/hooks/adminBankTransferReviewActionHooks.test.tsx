// 管理画面の振込レビューの操作の公開 hook の検査(jsdom の上で動かす。client 関数・toast・CSV の書き出しは偽物)。
// - useAdminBankTransferReviewDecision: reviewId の変化で確認・入力・誤りを初期化 / 拒否理由の検査(空・上限超え)で送らない /
//   検証中メモの空は null / 成功で success の toast・閉じる・onDone / 失敗で error の toast・開いたまま・onDone なし
// - useAdminBankTransferReviewCsvImport: 空の CSV は送らない / dry-run で preview と executed の解除 /
//   fatalError で executed を立てない / 成功で executed と onDone、二度目の実行はしない / 差し替えで解除 / エラー行の CSV
// 実行: pnpm test src/features/core/bankTransferReview/hooks/adminBankTransferReviewActionHooks.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

type Call = { fn: string; arg: unknown };
const calls: Call[] = [];
let fail = false;
let importResult: Record<string, unknown> = {};
const toasts: { message: unknown; variant?: string }[] = [];
const downloads: { kind: string; arg: unknown }[] = [];

const record = (fn: string) => async (arg: unknown) => {
  calls.push({ fn, arg });
  if (fail) throw new Error(`${fn} failed`);
  return fn === "import" ? importResult : {};
};
mock.module("@/features/core/bankTransferReview", {
  namedExports: {
    adminConfirmBankTransferReview: record("confirm"),
    adminRejectBankTransferReview: record("reject"),
    adminInvestigateBankTransferReview: record("investigate"),
    adminBulkImportBankTransferReviewCsv: record("import"),
    BANK_TRANSFER_REVIEW_IMPORT_HEADERS: ["transfer_name", "transfer_amount"],
  },
});
mock.module("@/lib/toast", {
  namedExports: {
    useToast: () => ({
      showToast: (message: unknown, variant?: string) => {
        toasts.push({ message, variant });
      },
    }),
  },
});
mock.module("@/lib/csv", {
  namedExports: {
    buildCsv: (headers: string[], rows: string[][]) => [headers, ...rows].map((r) => r.join(",")).join("\n"),
    downloadCsv: (arg: unknown) => downloads.push({ kind: "csv", arg }),
    downloadCsvTemplate: (arg: unknown) => downloads.push({ kind: "template", arg }),
    formatYmd: () => "20261108",
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useAdminBankTransferReviewDecision: typeof import("./useAdminBankTransferReviewDecision").useAdminBankTransferReviewDecision;
let useAdminBankTransferReviewCsvImport: typeof import("./useAdminBankTransferReviewCsvImport").useAdminBankTransferReviewCsvImport;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useAdminBankTransferReviewDecision } = await import("./useAdminBankTransferReviewDecision"));
  ({ useAdminBankTransferReviewCsvImport } = await import("./useAdminBankTransferReviewCsvImport"));
});
after(() => dom.window.close());
beforeEach(() => {
  calls.length = 0;
  toasts.length = 0;
  downloads.length = 0;
  fail = false;
  importResult = {};
  doneCount = 0;
});

let doneCount = 0;
const onDone = () => {
  doneCount += 1;
};

type Decision = ReturnType<typeof useAdminBankTransferReviewDecision>;
let decision: Decision | undefined;
const DecisionProbe = ({ reviewId }: { reviewId: string }) => {
  const state = useAdminBankTransferReviewDecision({ reviewId, onDone });
  useEffect(() => {
    decision = state;
  });
  return null;
};

const mountDecision = async (reviewId: string) => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(DecisionProbe, { reviewId })));
  return {
    rerender: (id: string) => act(async () => root.render(createElement(DecisionProbe, { reviewId: id }))),
    unmount: () => act(async () => root.unmount()),
  };
};

const run = async <T,>(fn: () => Promise<T> | T): Promise<T> => {
  let result: T | undefined;
  await act(async () => {
    result = await fn();
  });
  return result as T;
};

test("判定: reviewId が変わると確認・入力・誤りを初期化する", async () => {
  const view = await mountDecision("r1");
  await run(() => decision?.open("reject"));
  await run(() => decision?.setRejectReason(""));
  await run(() => decision?.reject());
  assert.equal(decision?.openDialog, "reject");
  assert.equal(decision?.rejectError, "拒否理由を入力してください。");
  await run(() => decision?.setInvestigateNote("メモ"));
  await view.rerender("r2");
  assert.equal(decision?.openDialog, null);
  assert.equal(decision?.rejectReason, "");
  assert.equal(decision?.rejectError, null);
  assert.equal(decision?.investigateNote, "");
  await view.unmount();
});

test("判定: 拒否理由が空・上限超えなら送らず、入力し直すと誤りを消す", async () => {
  const view = await mountDecision("r1");
  assert.equal(await run(() => decision!.reject()), false);
  await run(() => decision?.setRejectReason("x".repeat(501)));
  assert.equal(await run(() => decision!.reject()), false);
  assert.equal(decision?.rejectError, "拒否理由は 500 文字以内で入力してください。");
  assert.ok(!calls.some((c) => c.fn === "reject"));
  await run(() => decision?.setRejectReason(" 照合できない "));
  assert.equal(decision?.rejectError, null);
  await run(() => decision?.open("reject"));
  assert.equal(await run(() => decision!.reject()), true);
  assert.deepEqual(calls.find((c) => c.fn === "reject")?.arg, { reviewId: "r1", rejectReason: "照合できない" });
  assert.equal(decision?.openDialog, null);
  assert.equal(decision?.rejectReason, "");
  assert.equal(doneCount, 1);
  assert.deepEqual(toasts.at(-1), { message: "レビューを拒否しました", variant: "success" });
  await view.unmount();
});

test("判定: 承認の成功で閉じて onDone、検証中メモの空は null・上限超えは送らない", async () => {
  const view = await mountDecision("r1");
  await run(() => decision?.open("confirm"));
  assert.equal(await run(() => decision!.confirm()), true);
  assert.deepEqual(calls.find((c) => c.fn === "confirm")?.arg, "r1");
  assert.equal(decision?.openDialog, null);
  assert.equal(doneCount, 1);

  await run(() => decision?.setInvestigateNote("y".repeat(501)));
  assert.equal(await run(() => decision!.investigate()), false);
  assert.equal(decision?.investigateError, "メモは 500 文字以内で入力してください。");
  await run(() => decision?.setInvestigateNote("   "));
  assert.equal(await run(() => decision!.investigate()), true);
  assert.deepEqual(calls.find((c) => c.fn === "investigate")?.arg, { reviewId: "r1", note: null });
  assert.equal(doneCount, 2);
  await view.unmount();
});

test("判定: 失敗は error の toast、確認は開いたまま、onDone を呼ばない", async () => {
  fail = true;
  const view = await mountDecision("r1");
  await run(() => decision?.open("confirm"));
  assert.equal(await run(() => decision!.confirm()), false);
  assert.equal(decision?.openDialog, "confirm");
  assert.equal(toasts.at(-1)?.variant, "error");
  assert.ok(!toasts.some((t) => t.variant === "success"));
  assert.equal(doneCount, 0);
  assert.equal(decision?.confirming, false);
  await view.unmount();
});

type CsvImport = ReturnType<typeof useAdminBankTransferReviewCsvImport>;
let csv: CsvImport | undefined;
const CsvProbe = () => {
  const state = useAdminBankTransferReviewCsvImport({ onDone });
  useEffect(() => {
    csv = state;
  });
  return null;
};
const mountCsv = async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(CsvProbe)));
  return { unmount: () => act(async () => root.unmount()) };
};
const row = (rowIndex: number, status: string) => ({
  rowIndex,
  status,
  rawTransferName: `名${rowIndex}`,
  rawAmount: "1500",
  parsedIdentifier: status === "error" ? null : "12345678",
  message: status === "error" ? "一致なし" : null,
});
const summary = (rows: ReturnType<typeof row>[], extra: Record<string, unknown> = {}) => ({
  rows,
  confirmedCount: rows.filter((r) => r.status === "confirm").length,
  needsCheckCount: 0,
  skipCount: 0,
  errorCount: rows.filter((r) => r.status === "error").length,
  fatalError: null,
  ...extra,
});

test("CSV: 空の CSV は送らず error の toast", async () => {
  const view = await mountCsv();
  assert.equal(await run(() => csv!.validate()), false);
  assert.ok(!calls.some((c) => c.fn === "import"));
  assert.deepEqual(toasts.at(-1), { message: "CSVが空です", variant: "error" });
  await view.unmount();
});

test("CSV: dry-run で preview、実行で executed と onDone、二度目は実行しない、差し替えで解除", async () => {
  const view = await mountCsv();
  const file = new dom.window.File(["a,1500"], "meisai.csv", { type: "text/csv" }) as unknown as File;
  await run(() => csv!.selectFile(file));
  assert.equal(csv?.fileName, "meisai.csv");
  assert.equal(csv?.csvText, "a,1500");

  importResult = summary([row(1, "confirm"), row(2, "error")]);
  assert.equal(await run(() => csv!.validate()), true);
  assert.deepEqual(calls.at(-1)?.arg, { csvText: "a,1500", dryRun: true });
  assert.equal(csv?.preview?.rows.length, 2);
  assert.equal(csv?.errorRows.length, 1);
  assert.equal(csv?.executed, false);

  await run(() => csv!.downloadErrorRows());
  assert.equal(downloads.at(-1)?.kind, "csv");
  assert.match(
    (downloads.at(-1)?.arg as { csvContent: string }).csvContent,
    /row_index,transfer_name,transfer_amount,parsed_identifier,error_message\n2,名2,1500,,一致なし/,
  );

  assert.equal(await run(() => csv!.submit()), true);
  assert.deepEqual(calls.at(-1)?.arg, { csvText: "a,1500", dryRun: false });
  assert.equal(csv?.executed, true);
  assert.equal(doneCount, 1);
  assert.match(String(toasts.at(-1)?.message), /^取り込み完了: 承認 1件/);

  const before = calls.length;
  assert.equal(await run(() => csv!.submit()), false);
  assert.equal(calls.length, before, "実行済みのあとは送らない");

  await run(() => csv!.setText("b,2000"));
  assert.equal(csv?.executed, false);
  assert.equal(csv?.preview, null);
  assert.equal(csv?.fileName, undefined);
  await view.unmount();
});

test("CSV: fatalError では executed を立てず error の toast、onDone を呼ばない", async () => {
  const view = await mountCsv();
  await run(() => csv!.setText("a,1500"));
  importResult = summary([row(1, "confirm")]);
  await run(() => csv!.validate());
  importResult = summary([], { fatalError: "ヘッダーが違います" });
  assert.equal(await run(() => csv!.submit()), false);
  assert.equal(csv?.executed, false);
  assert.deepEqual(toasts.at(-1), { message: "ヘッダーが違います", variant: "error" });
  assert.equal(doneCount, 0);
  await view.unmount();
});
