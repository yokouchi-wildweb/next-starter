// useGeneralUserListTable の検査(jsdom の上でフックを動かす。router・トースト・削除・gate・設定・一括操作は偽物):
// 削除の流れ(成功・失敗・対象なし)・対象の開閉・機能の開閉・選択テーブルの設定・変更の後の再読み込み(onChanged)・columnOptions
// 実行: pnpm test src/features/core/user/hooks/useGeneralUserListTable.test.tsx
// (tsx + node:test のモジュールモック + jsdom。type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { JSDOM } from "jsdom";

import type { User } from "@/features/core/user/entities";

import type { UseGeneralUserListTableOptions, UseGeneralUserListTableReturn } from "./useGeneralUserListTable";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

// 偽物の振る舞い(テストごとに beforeEach で戻す)
let refreshes = 0;
const toasts: Array<[string, string]> = [];
const deleted: string[] = [];
let deleteFails = false;
let walletGateOpen = true;
const bulkItems = [{ key: "fake" }];
// 設定は本物の代わりの書き換えられるオブジェクト
const userConfig = {
  enableUserManagement: false,
  enableUserMemo: false,
  userListPage: {
    enableSelectionTable: { general: false, managerial: false },
    selectionBehavior: "row",
    bulkActionsAlwaysVisible: false,
  },
};
const walletConfig = { enableAdminBalanceAdjust: true };

mock.module("@/lib/unsavedGuard", {
  namedExports: {
    useRouter: () => ({
      refresh: () => {
        refreshes += 1;
      },
    }),
  },
});
mock.module("@/lib/toast", {
  namedExports: {
    useToast: () => ({
      showToast: (message: string, kind: string) => {
        toasts.push([message, kind]);
      },
    }),
  },
});
mock.module("@/featureGate/client", {
  namedExports: {
    useGate: () => ({ enabled: (name: string) => (name === "wallet" ? walletGateOpen : true) }),
  },
});
mock.module("@/features/user/config", { namedExports: { userConfig } });
mock.module("@/features/wallet/config", { namedExports: { walletConfig } });
mock.module("@/features/core/user/hooks/useUserAdminBulkActions", {
  namedExports: { useUserAdminBulkActions: () => bulkItems },
});
mock.module("@/features/core/user/hooks/useSoftDeleteUser", {
  namedExports: {
    useSoftDeleteUser: () => ({
      trigger: async ({ userId }: { userId: string }) => {
        deleted.push(userId);
        if (deleteFails) throw new Error("削除できません(テスト)");
      },
      isMutating: false,
    }),
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useGeneralUserListTable: typeof import("./useGeneralUserListTable").useGeneralUserListTable;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useGeneralUserListTable } = await import("./useGeneralUserListTable"));
});
after(() => dom.window.close());
beforeEach(() => {
  refreshes = 0;
  toasts.length = 0;
  deleted.length = 0;
  deleteFails = false;
  walletGateOpen = true;
  walletConfig.enableAdminBalanceAdjust = true;
  userConfig.enableUserManagement = false;
  userConfig.enableUserMemo = false;
  userConfig.userListPage.enableSelectionTable.general = false;
  userConfig.userListPage.selectionBehavior = "row";
  userConfig.userListPage.bulkActionsAlwaysVisible = false;
});

const alice = { id: "u1", name: "アリス", email: "a@example.com" } as unknown as User;

/** フックを描いて、最新の戻り値を返す */
async function mount(options?: UseGeneralUserListTableOptions) {
  let latest: UseGeneralUserListTableReturn | null = null;
  const report = (value: UseGeneralUserListTableReturn) => {
    latest = value;
  };
  function Probe() {
    report(useGeneralUserListTable(options));
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
  const hook = () => latest as unknown as UseGeneralUserListTableReturn;
  return { hook, unmount: () => act(async () => root.unmount()) };
}

test("削除の成功: 対象を消し、トースト・閉じる・再読み込み", async () => {
  const { hook, unmount } = await mount();
  await act(async () => hook().remove.request(alice));
  assert.equal(hook().remove.target, alice);
  await act(async () => {
    await hook().remove.confirm();
  });
  assert.deepEqual(deleted, ["u1"]);
  assert.deepEqual(toasts, [["ユーザーを削除しました", "success"]]);
  assert.equal(hook().remove.target, null);
  assert.equal(refreshes, 1);
  await unmount();
});

test("削除の失敗: エラーのトースト、ダイアログは開いたまま、再読み込みしない", async () => {
  deleteFails = true;
  const { hook, unmount } = await mount();
  await act(async () => hook().remove.request(alice));
  await act(async () => {
    await hook().remove.confirm();
  });
  assert.deepEqual(toasts, [["削除できません(テスト)", "error"]]);
  assert.equal(hook().remove.target, alice);
  assert.equal(refreshes, 0);
  await unmount();
});

test("削除の対象なし: confirm は何もしない / cancel で閉じる", async () => {
  const { hook, unmount } = await mount();
  await act(async () => {
    await hook().remove.confirm();
  });
  assert.deepEqual(deleted, []);
  await act(async () => hook().remove.request(alice));
  await act(async () => hook().remove.cancel());
  assert.equal(hook().remove.target, null);
  await unmount();
});

test("対象の開閉: ポイント操作・管理", async () => {
  const { hook, unmount } = await mount();
  await act(async () => hook().adjust.open(alice));
  await act(async () => hook().manage.open(alice));
  assert.equal(hook().adjust.target, alice);
  assert.equal(hook().manage.target, alice);
  await act(async () => hook().adjust.close());
  await act(async () => hook().manage.close());
  assert.equal(hook().adjust.target, null);
  assert.equal(hook().manage.target, null);
  await unmount();
});

test("機能の開閉: wallet の gate と設定の両方が開いたときだけポイント操作", async () => {
  let m = await mount();
  assert.equal(m.hook().canAdjustWallet, true);
  await m.unmount();
  walletGateOpen = false;
  m = await mount();
  assert.equal(m.hook().canAdjustWallet, false);
  await m.unmount();
  walletGateOpen = true;
  walletConfig.enableAdminBalanceAdjust = false;
  m = await mount();
  assert.equal(m.hook().canAdjustWallet, false);
  await m.unmount();
});

test("機能の開閉と選択テーブル: 設定をそのまま返し、一括操作は general の項目", async () => {
  userConfig.enableUserManagement = true;
  userConfig.enableUserMemo = true;
  userConfig.userListPage.enableSelectionTable.general = true;
  userConfig.userListPage.selectionBehavior = "checkbox";
  userConfig.userListPage.bulkActionsAlwaysVisible = true;
  const { hook, unmount } = await mount();
  assert.equal(hook().canManage, true);
  assert.equal(hook().canMemo, true);
  assert.deepEqual(hook().selection, { enabled: true, behavior: "checkbox", bulkActionsAlwaysVisible: true });
  assert.equal(hook().bulkActions, bulkItems);
  await unmount();
});

test("再読み込み: ポイント操作の後・一括操作の後に router.refresh と onChanged", async () => {
  let changed = 0;
  const { hook, unmount } = await mount({ onChanged: () => (changed += 1) });
  await act(async () => hook().adjust.onAdjusted());
  await act(async () => hook().onBulkDone());
  assert.equal(refreshes, 2);
  assert.equal(changed, 2);
  await unmount();
});

test("columnOptions: 開閉と処理中の値、押下は対象を開く", async () => {
  userConfig.enableUserMemo = true;
  const { hook, unmount } = await mount();
  const o = hook().columnOptions;
  assert.equal(o.canAdjustWallet, true);
  assert.equal(o.canManage, false);
  assert.equal(o.canMemo, true);
  assert.equal(o.isDeleting, false);
  await act(async () => o.onAdjust(alice));
  await act(async () => o.onManage(alice));
  await act(async () => o.onDelete(alice));
  assert.equal(hook().adjust.target, alice);
  assert.equal(hook().manage.target, alice);
  assert.equal(hook().remove.target, alice);
  await unmount();
});
