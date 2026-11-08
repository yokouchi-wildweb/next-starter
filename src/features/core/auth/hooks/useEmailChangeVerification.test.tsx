// useEmailChangeVerification の検査(jsdom の上でフックを動かす。URL・セッション・Firebase・userClient は偽物)。
// - oobCode を省略: URL の ?oobCode= を読む / 渡した値(null も)は URL より優先(今の呼び方の互換)
// - loginHref = /login?returnTo=<今のパス + oobCode>
// - コードなし: エラー / 未ログイン: require_login / ログイン済み: 検証して completed
// 実行: pnpm test src/features/core/auth/hooks/useEmailChangeVerification.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let query = new URLSearchParams();
let authenticated = false;
const applied: string[] = [];
let confirmed = 0;

mock.module(pathToFileURL(require.resolve("next/navigation")).href, {
  namedExports: {
    useSearchParams: () => query,
    usePathname: () => "/email/verify",
  },
});
mock.module("@/features/core/auth/hooks/useAuthSession", {
  namedExports: { useAuthSession: () => ({ isAuthenticated: authenticated }) },
});
mock.module("@/lib/firebase/client/applyEmailChange", {
  namedExports: {
    getEmailChangeInfo: async () => ({ newEmail: "new@example.test" }),
    applyEmailChange: async (code: string) => {
      applied.push(code);
      return true;
    },
  },
});
mock.module("@/features/core/user/services/client/userClient", {
  namedExports: {
    userClient: {
      confirmEmailChange: async () => {
        confirmed += 1;
      },
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useEmailChangeVerification: typeof import("./useEmailChangeVerification").useEmailChangeVerification;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useEmailChangeVerification } = await import("./useEmailChangeVerification"));
});
after(() => dom.window.close());
beforeEach(() => {
  query = new URLSearchParams();
  authenticated = false;
  applied.length = 0;
  confirmed = 0;
});

type Result = ReturnType<typeof useEmailChangeVerification>;
const run = async (params?: Parameters<typeof useEmailChangeVerification>[0]) => {
  let latest: Result | undefined;
  const report = (r: Result) => {
    latest = r;
  };
  // 引数の省略を確かめるため、params が無いときは引数なしで呼ぶ部品を使う
  const ProbeNoArgs = () => {
    const r = useEmailChangeVerification();
    useEffect(() => report(r));
    return null;
  };
  const ProbeWithArgs = ({ p }: { p: NonNullable<typeof params> }) => {
    const r = useEmailChangeVerification(p);
    useEffect(() => report(r));
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(params === undefined ? createElement(ProbeNoArgs) : createElement(ProbeWithArgs, { p: params })),
  );
  await act(async () => root.unmount());
  return latest!;
};

test("省略: URL の oobCode を読み、未ログインなら require_login と戻り先付きの loginHref", async () => {
  query = new URLSearchParams("oobCode=a b&x=1");
  const r = await run();
  assert.equal(r.phase, "require_login");
  assert.equal(r.loginHref, `/login?returnTo=${encodeURIComponent("/email/verify?oobCode=a%20b")}`);
});

test("省略・ログイン済み: URL の oobCode で変更を適用して completed", async () => {
  query = new URLSearchParams("oobCode=code-1");
  authenticated = true;
  const r = await run();
  assert.equal(r.phase, "completed");
  assert.equal(r.newEmail, "new@example.test");
  assert.deepEqual(applied, ["code-1"]);
  assert.equal(confirmed, 1);
});

test("コードなし(URL にも無い): エラー、loginHref は今のパスだけ", async () => {
  const r = await run();
  assert.equal(r.phase, "error");
  assert.equal(r.error, "無効なリンクです。");
  assert.equal(r.loginHref, `/login?returnTo=${encodeURIComponent("/email/verify")}`);
});

test("今の呼び方 { oobCode }: 渡した値が URL より優先(null = コードなし)", async () => {
  query = new URLSearchParams("oobCode=from-url");
  authenticated = true;
  const passed = await run({ oobCode: "passed" });
  assert.equal(passed.phase, "completed");
  assert.deepEqual(applied, ["passed"]);
  const none = await run({ oobCode: null });
  assert.equal(none.phase, "error");
});
