// SendResult の検査(jsdom の上で描く。props だけの部品、D214 (1))。
// - 送信チャンネルごとの数の行(数が無い送信は出さない)
// - 届かなかった人の行: 名前(無い・利用者なし)・送信チャンネル・状態・理由(送らなかった = 理由の表示名、失敗 = 符号の文、表に無い符号 = 決まった文、理由なし = 出さない)
// - 0 件の文、button の読み方で「もっと見る」が failed.loadMore を呼ぶ
// 実行: pnpm test src/features/core/messaging/components/common/SendResult/index.test.tsx
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let parts: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  parts = await import("./index");
});
after(() => dom.window.close());

type Props = Parameters<typeof import("./index").SendResult>[0];
const page = (over: Partial<Props["failed"]> = {}): Props["failed"] => ({
  items: [],
  isInitialLoading: false,
  isFetchingMore: false,
  hasMore: false,
  error: null,
  ...over,
});
const COUNT = { targeted: 3, sent: 1, failed: 1, suppressed: 1, skipped_no_address: 1, skipped_throttled: 0 };

const render = async (props: Props) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(parts.SendResult, props)));
  return { container, unmount: () => act(async () => root.unmount()) };
};

test("sendFailureReasonText: 送らなかった = 理由の表示名、失敗 = 符号の文、表に無い符号 = 決まった文、理由なし = null", () => {
  assert.equal(parts.sendFailureReasonText({ status: "suppressed", reason: "no_address" }), "連絡先未登録");
  assert.equal(parts.sendFailureReasonText({ status: "failed", reason: "rate_limited" }), "送信サービスの送信数の上限に達しました");
  assert.equal(parts.sendFailureReasonText({ status: "bounced", reason: "zzz" }), "送信できませんでした");
  assert.equal(parts.sendFailureReasonText({ status: "failed", reason: null }), null);
});

test("数の行と届かなかった人の行", async () => {
  const view = await render({
    channels: { email: COUNT },
    failed: page({
      items: [
        { userId: "u1", name: "花子", channel: "email", status: "failed", reason: "timeout" },
        { userId: "u2", name: null, channel: "inApp", status: "suppressed", reason: "preference" },
        { userId: null, name: null, channel: "email", status: "bounced", reason: null },
      ],
    }),
  });
  const counts = view.container.querySelector("[data-slot=send-result-counts]")?.textContent ?? "";
  assert.match(counts, /メール/);
  assert.match(counts, /対象 3 \/ 送信完了 1 \/ 送信エラー 1 \/ 送信対象外 1 \/ 連絡先未登録 1 \/ 送信頻度の上限 0/);
  const rows = [...view.container.querySelectorAll("[data-slot=send-failure-row]")].map((row) => row.textContent ?? "");
  assert.equal(rows.length, 3);
  assert.match(rows[0]!, /送信エラー.*メール.*花子.*理由: 送信サービスから時間内に応答がありませんでした/);
  assert.match(rows[1]!, /送信対象外.*サービス内通知.*\(名前未設定のユーザー\).*理由: 本人が受信を停止/);
  assert.match(rows[2]!, /宛先不正.*\(利用者なし\)/);
  assert.doesNotMatch(rows[2]!, /理由/);
  assert.doesNotMatch(view.container.textContent ?? "", /u1|u2/, "利用者の id は出さない");
  await view.unmount();
});

test("数が無い・0 件・もっと見る", async () => {
  const empty = await render({ channels: null, failed: page() });
  assert.equal(empty.container.querySelector("[data-slot=send-result-counts]"), null);
  assert.match(empty.container.textContent ?? "", /届かなかった宛先はありません/);
  await empty.unmount();

  let loaded = 0;
  const more = await render({
    channels: {},
    loadMode: "button",
    failed: page({
      items: [{ userId: "u1", name: "花子", channel: "email", status: "failed", reason: null }],
      hasMore: true,
      loadMore: () => void (loaded += 1),
    }),
  });
  const button = [...more.container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("もっと見る"));
  assert.ok(button);
  await act(async () => button!.click());
  assert.equal(loaded, 1);
  await more.unmount();
});
