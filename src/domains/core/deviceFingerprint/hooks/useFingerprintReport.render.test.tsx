// useFingerprintReport の検査(jsdom の上でフックを動かす。門番・収集・送信は偽物):
// 収集の口の機能 deviceFingerprintPageIngest が閉じていれば集めも送りもしない、開いていればログイン中の利用者で 1 回送る、デモ利用者は送らない
// 実行: pnpm test src/domains/core/deviceFingerprint/hooks/useFingerprintReport.render.test.tsx
// (tsx + node:test のモジュールモック + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { SessionUser } from "@/domains/core/auth/entities/session";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.localStorage = dom.window.localStorage;
g.IS_REACT_ACT_ENVIRONMENT = true;

const gateOpen: Record<string, boolean> = {};
const calls = { collect: 0, report: 0 };
mock.module("@/featureGate/client", {
  namedExports: { useGate: () => ({ enabled: (name: string) => gateOpen[name] === true }) },
});
mock.module("@/lib/fingerprint", {
  namedExports: {
    collectFingerprintPayload: async () => {
      calls.collect += 1;
      return { compositeHash: "x" };
    },
  },
});
mock.module("@/domains/core/deviceFingerprint/services/client/fingerprintClient", {
  namedExports: {
    reportFingerprint: async () => {
      calls.report += 1;
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useFingerprintReport: typeof import("./useFingerprintReport").useFingerprintReport;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useFingerprintReport } = await import("./useFingerprintReport"));
});
after(() => dom.window.close());

beforeEach(() => {
  calls.collect = 0;
  calls.report = 0;
  dom.window.localStorage.clear();
});

const member = { userId: "u1", role: "user", status: "active", isDemo: false } as unknown as SessionUser;
const demo = { ...member, isDemo: true } as unknown as SessionUser;

async function mount(user: SessionUser | null) {
  function Probe() {
    useFingerprintReport(user);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  // 収集 → 送信の Promise の鎖を流し切る
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => root.unmount());
}

test("収集の口の機能が閉じていれば、集めも送りもしない", async () => {
  gateOpen.deviceFingerprintPageIngest = false;
  await mount(member);
  assert.deepEqual(calls, { collect: 0, report: 0 });
});

test("口が開いていれば、ログイン中の利用者で 1 回集めて送る", async () => {
  gateOpen.deviceFingerprintPageIngest = true;
  await mount(member);
  assert.deepEqual(calls, { collect: 1, report: 1 });
});

test("口が開いていても、未ログインとデモ利用者は送らない", async () => {
  gateOpen.deviceFingerprintPageIngest = true;
  await mount(null);
  await mount(demo);
  assert.deepEqual(calls, { collect: 0, report: 0 });
});
