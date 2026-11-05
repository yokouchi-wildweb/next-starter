// PrepareProofImage の検査: アップロードが失敗したら親の値は null のまま(④の申告に進めない)、欄にエラーを残し、
// 選び直し・削除で消える。実行: pnpm test:standalone-upload-failure(tsx + node:test のモジュールモック + jsdom)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useState, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "Event", "MouseEvent", "File", "navigator", "getComputedStyle"]) {
  // navigator は Node の組み込み(getter だけ)なので defineProperty で差し替える
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
URL.createObjectURL = () => "blob:preview";
URL.revokeObjectURL = () => {};

// アップロードの結果を手で決める: 呼ばれるたびに次の結果(true = 成功)を使う
const outcomes: boolean[] = [];
let uploads = 0;
let discards = 0;
mock.module("@/features/core/purchaseRequest/hooks/useBankTransferProofUpload", {
  namedExports: {
    useBankTransferProofUpload: () => ({
      upload: async () => {
        uploads += 1;
        if (!(outcomes.shift() ?? true)) throw new Error("network");
        return { ref: `storage://purchaseRequest.bankProof/${uploads}`, src: "" };
      },
      discardCurrent: () => {
        discards += 1;
      },
    }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let PrepareProofImage: typeof import("./PrepareProofImage").PrepareProofImage;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ PrepareProofImage } = await import("./PrepareProofImage"));
});
after(() => dom.window.close());

const FAILED_TEXT = /画像のアップロードに失敗しました。もう一度添付してください/;

const mount = async () => {
  const values: Array<string | null> = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  // 親(BankTransferInstruction)と同じく、値を state で持って imageUrl に戻す
  const Parent = (): ReactNode => {
    const [url, setUrl] = useState<string | null>(null);
    return createElement(PrepareProofImage, {
      step: 2,
      requestId: "req-1",
      imageUrl: url,
      onChange: (next: string | null) => {
        values.push(next);
        setUrl(next);
      },
    });
  };
  await act(async () => root.render(createElement(Parent)));
  return { container, values, unmount: () => act(async () => root.unmount()) };
};

const pick = (container: HTMLElement) =>
  act(async () => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new dom.window.File(["x"], "proof.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const clickButton = (container: HTMLElement, label: string) =>
  act(async () => {
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
    assert.ok(button, `${label} のボタンがある`);
    button.click();
  });

test("失敗: 親の値は null のまま、欄にエラーが残る → 選び直して成功するとエラーが消えて値が入る", async () => {
  outcomes.push(false, true);
  const view = await mount();

  await pick(view.container);
  assert.deepEqual(view.values, [null, null], "選んだ瞬間と失敗のどちらも null(古い値で進めない)");
  assert.match(view.container.textContent ?? "", FAILED_TEXT, "欄にエラーが残る");

  await pick(view.container);
  assert.equal(view.values.at(-1), "storage://purchaseRequest.bankProof/2");
  assert.doesNotMatch(view.container.textContent ?? "", FAILED_TEXT, "成功でエラーが消える");
  assert.match(view.container.textContent ?? "", /アップロード完了/);
  await view.unmount();
});

test("失敗の後に選び直しで再び失敗してもエラーは出たまま。成功の後の削除ではエラーは出ない", async () => {
  outcomes.push(false, false, true);
  const view = await mount();
  await pick(view.container);
  await pick(view.container);
  assert.match(view.container.textContent ?? "", FAILED_TEXT);
  await pick(view.container);
  const before = discards;
  await clickButton(view.container, "削除");
  assert.equal(discards, before + 1, "削除で上げた画像を取り消す");
  assert.equal(view.values.at(-1), null);
  assert.doesNotMatch(view.container.textContent ?? "", FAILED_TEXT);
  await view.unmount();
});
