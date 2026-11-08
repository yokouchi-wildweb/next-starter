// 管理画面の設定の節の form(useSettingSectionForm)と初期セットアップ(useAdminSetup の submit)の検査
// (jsdom の上で動かす。保存の client・toast・router は偽物)。
// - 成功: 成功の toast → 遷移
// - 失敗: error の toast を出して投げ直す(AppForm が未保存の守りを戻すため。成功扱いにしない)・遷移しない
// 実行: pnpm test src/features/core/setting/hooks/adminFormHooks.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";
import { z } from "zod";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

let fail = false;
const saved: unknown[] = [];
const pushes: string[] = [];
const toasts: { message: unknown; variant?: string }[] = [];

mock.module("@/lib/unsavedGuard", { namedExports: { useRouter: () => ({ push: (href: string) => pushes.push(href) }) } });
mock.module("@/lib/toast", {
  namedExports: {
    useToast: () => ({ showToast: (message: unknown, variant?: string) => toasts.push({ message, variant }) }),
  },
});
mock.module("./useUpdateSetting", {
  namedExports: {
    useUpdateSetting: () => ({
      isMutating: false,
      trigger: async (arg: unknown) => {
        saved.push(arg);
        if (fail) throw new Error("保存できませんでした");
      },
    }),
  },
});
mock.module("../services/client/adminSetupClient", {
  namedExports: {
    adminSetupClient: {
      initialize: async (input: unknown) => {
        saved.push(input);
        if (fail) throw new Error("作れませんでした");
        return {};
      },
    },
  },
});
mock.module("@/features/core/setting/extensions/sections", {
  namedExports: { sections: { site: { key: "site", label: "サイト", order: 1, groups: [] } } },
});
mock.module("@/features/core/setting/extensions/fields", { namedExports: { fields: {} } });
mock.module("@/features/core/setting/utils/sectionForm", {
  namedExports: {
    buildSectionForm: () => ({ keys: [], fieldConfigs: [], schema: z.object({}), defaultValues: {} }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useSettingSectionForm: typeof import("./useSettingSectionForm").useSettingSectionForm;
let useAdminSetup: typeof import("./useAdminSetup").useAdminSetup;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useSettingSectionForm } = await import("./useSettingSectionForm"));
  ({ useAdminSetup } = await import("./useAdminSetup"));
});
after(() => dom.window.close());
beforeEach(() => {
  fail = false;
  saved.length = 0;
  pushes.length = 0;
  toasts.length = 0;
});

const mount = async <T,>(useHook: () => T) => {
  const ref: { current?: T } = {};
  const Probe = () => {
    const value = useHook();
    useEffect(() => {
      ref.current = value;
    });
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  return { ref, unmount: () => act(async () => root.unmount()) };
};

const setting = { id: "global" } as never;

test("設定の節: 成功で節の名前の toast と遷移", async () => {
  const view = await mount(() => useSettingSectionForm({ sectionKey: "site", setting, redirectPath: "/admin/settings/site" }));
  await act(async () => {
    await view.ref.current?.submit({ siteName: "x" });
  });
  assert.deepEqual(saved, [{ id: "global", data: { siteName: "x" } }]);
  assert.deepEqual(toasts.at(-1), { message: "サイトを更新しました", variant: "success" });
  assert.deepEqual(pushes, ["/admin/settings/site"]);
  assert.equal(view.ref.current?.section.key, "site");
  await view.unmount();
});

test("設定の節: 失敗は error の toast を出して投げ直し、遷移しない", async () => {
  fail = true;
  const view = await mount(() => useSettingSectionForm({ sectionKey: "site", setting }));
  await act(async () => {
    await assert.rejects(() => view.ref.current!.submit({}), /保存できませんでした/);
  });
  assert.deepEqual(toasts.at(-1), { message: "保存できませんでした", variant: "error" });
  assert.ok(!toasts.some((t) => t.variant === "success"));
  assert.deepEqual(pushes, []);
  await view.unmount();
});

test("初期セットアップ: 成功で toast と既定の行き先 /admin/login", async () => {
  const view = await mount(() => useAdminSetup());
  const values = { name: "管理者", email: "a@example.test", localPassword: "password1" };
  await act(async () => {
    await view.ref.current?.submit(values);
  });
  assert.deepEqual(saved, [values]);
  assert.deepEqual(toasts.at(-1), { message: "初回セットアップが完了しました", variant: "success" });
  assert.deepEqual(pushes, ["/admin/login"]);
  await view.unmount();
});

test("初期セットアップ: 失敗は error の toast を出して投げ直し、遷移しない。redirectTo で行き先を替えられる", async () => {
  fail = true;
  const view = await mount(() => useAdminSetup({ redirectTo: "/admin" }));
  await act(async () => {
    await assert.rejects(() => view.ref.current!.submit({ name: "a", email: "a@example.test", localPassword: "p" }));
  });
  assert.equal(toasts.at(-1)?.variant, "error");
  assert.deepEqual(pushes, []);
  await view.unmount();

  fail = false;
  const ok = await mount(() => useAdminSetup({ redirectTo: "/admin" }));
  await act(async () => {
    await ok.ref.current?.submit({ name: "a", email: "a@example.test", localPassword: "p" });
  });
  assert.deepEqual(pushes, ["/admin"]);
  await ok.unmount();
});
