// page 層(page.tsx スイッチ + _screen/ + loader)の規律テスト。
// 実行: pnpm test:screens (node:test + tsx。registry の .ts を読むため tsx ランナーを使う)
//
// 守りたい契約(設計: src/lib/screens/README.md):
// 1. ルートを所有するリポジトリでは page.tsx が「./_screen/<Name>Screen への 1 行の re-export」+ 任意のページ設定
//    (metadata / dynamic 等の export、generateMetadata、それらに必要な import)だけ。
//    画面ロジック(JSX、セクションコンテナや next/navigation の import)を page.tsx に戻さない
//    — 所有者 = entry.owner(origin URL の正規表現)が一致するリポジトリ限定の検査
// 2. `_screen/<Name>Screen.tsx` が存在し <Name>Screen を named export している
//    — 全リポジトリで実行(削除すると将来 upstream 改修時に modify/delete 衝突になるため早期に検出)
// 3. loader は `import "server-only"` と React の cache() を使い load<Name>Screen を export する — 全リポジトリ
//
// 検査対象 = UPSTREAM_ROUTES(upstream が出荷する core ルート。upstream で core のユーザー向けページを増やしたらここに追加)
//          + FORK_SCREEN_ROUTES(src/registry/screenRoutesRegistry.ts。中間 Tier の fork が自分のルートを登録)
// 下流でルートごと削除した場合は該当行を外す(README「upstream の画面を使わない」)。
// 検査関数の本体は ./checks.mjs(副作用なし)。自前のテストを書く fork はそちらを import する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FORK_SCREEN_ROUTES } from "../../registry/screenRoutesRegistry.ts";
import {
  UPSTREAM_OWNER,
  checkLoaderFile,
  checkScreenFile,
  checkSwitchPage,
  isRouteOwner,
} from "./checks.mjs";

export { UPSTREAM_OWNER, checkLoaderFile, checkScreenFile, checkSwitchPage, isRouteOwner };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

/** origin の URL(取得できなければ空文字)。所有者判定に使う */
function originUrl() {
  try {
    return execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
const origin = originUrl();

/**
 * 上流が出荷する core のユーザー向けルート(ScreenRouteEntry[])。
 * dir: ルートディレクトリ(repo 相対) | screen: _screen/<screen>.tsx の named export | loader: 任意(repo 相対) | owner: origin の正規表現
 */
export const UPSTREAM_ROUTES = [
  {
    dir: "src/app/(user)/(protected)/wallet",
    screen: "WalletIndexScreen",
    loader: "src/features/core/wallet/services/server/loaders/walletIndex.ts",
    owner: UPSTREAM_OWNER,
  },
  {
    dir: "src/app/(user)/(protected)/wallet/[slug]",
    screen: "WalletBalanceScreen",
    loader: "src/features/core/wallet/services/server/loaders/walletBalance.ts",
    owner: UPSTREAM_OWNER,
  },
  {
    dir: "src/app/(user)/(protected)/wallet/[slug]/history",
    screen: "WalletHistoryScreen",
    loader: "src/features/core/wallet/services/server/loaders/walletHistory.ts",
    owner: UPSTREAM_OWNER,
  },
];

/** 検査対象のルートに対してテストを登録する(UPSTREAM_ROUTES と FORK_SCREEN_ROUTES で共通) */
export function registerRouteTests(routes, originUrlValue = origin) {
  for (const route of routes) {
    const screenPath = `${route.dir}/_screen/${route.screen}.tsx`;
    const pagePath = `${route.dir}/page.tsx`;

    test(`${route.dir}: _screen/${route.screen}.tsx が存在し ${route.screen} を named export している`, () => {
      assert.ok(existsSync(resolve(repoRoot, screenPath)), `${screenPath} が無い。ルートごと削除した場合は一覧から外す`);
      const problems = checkScreenFile(read(screenPath), route.screen);
      assert.deepEqual(problems, [], `${screenPath}: ${problems.join(" / ")}`);
    });

    test(`${route.dir}: page.tsx は _screen への 1 行スイッチ(所有リポジトリ限定)`, (t) => {
      if (!isRouteOwner(route, originUrlValue)) {
        t.skip(`このリポジトリはルートの所有者ではない(page.tsx は下流所有)。owner: ${route.owner}`);
        return;
      }
      const problems = checkSwitchPage(read(pagePath), route.screen);
      assert.deepEqual(problems, [], `${pagePath}: ${problems.join(" / ")}`);
    });

    if (route.loader) {
      test(`${route.dir}: loader ${route.loader} は server-only + cache()`, () => {
        assert.ok(existsSync(resolve(repoRoot, route.loader)), `${route.loader} が無い`);
        const problems = checkLoaderFile(read(route.loader));
        assert.deepEqual(problems, [], `${route.loader}: ${problems.join(" / ")}`);
      });
    }
  }
}

registerRouteTests(UPSTREAM_ROUTES);
registerRouteTests(FORK_SCREEN_ROUTES);

test("FORK_SCREEN_ROUTES の各エントリは dir / screen / owner を持ち、upstream のルートと重複しない", () => {
  const upstreamDirs = new Set(UPSTREAM_ROUTES.map((r) => r.dir));
  for (const entry of FORK_SCREEN_ROUTES) {
    for (const key of ["dir", "screen", "owner"]) {
      assert.equal(typeof entry[key], "string", `screenRoutesRegistry: ${JSON.stringify(entry)} に ${key} が無い`);
    }
    assert.doesNotThrow(() => new RegExp(entry.owner), `screenRoutesRegistry: owner "${entry.owner}" が正規表現として不正`);
    assert.equal(upstreamDirs.has(entry.dir), false, `screenRoutesRegistry: ${entry.dir} は upstream のルート(登録不要)`);
  }
});

test("isRouteOwner: owner の正規表現が origin に一致するときだけ所有者", () => {
  const entry = { dir: "x", screen: "XScreen", owner: UPSTREAM_OWNER };
  assert.equal(isRouteOwner(entry, "git@github.com:yokouchi-wildweb/next-starter.git"), true);
  assert.equal(isRouteOwner(entry, "https://github.com/yokouchi-wildweb/next-starter"), true);
  assert.equal(isRouteOwner(entry, "git@github.com:acme/shop.git"), false);
  assert.equal(isRouteOwner({ ...entry, owner: "[:/]acme/shop(\\.git)?/?$" }, "git@github.com:acme/shop.git"), true);
  assert.equal(isRouteOwner({ ...entry, owner: "[:/]acme/shop(\\.git)?/?$" }, "https://github.com/acme/shop/"), true);
  assert.equal(isRouteOwner({ ...entry, owner: "[:/]acme/shop(\\.git)?/?$" }, "git@github.com:notacme/shop.git"), false);
});

test("checkSwitchPage: metadata / generateMetadata / loader import は許可し、画面ロジックは弾く", () => {
  const ok = `
    import type { Metadata } from "next";
    import { createMetadata } from "@/lib/metadata";
    import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "@/features/core/wallet/services/server/loaders/walletBalance";
    import type { ScreenProps } from "@/lib/screens/types";

    export const dynamic = "force-dynamic";
    export const metadata: Metadata = {
      title: "ウォレット",
      openGraph: { images: ["/og.png"] },
    };

    export async function generateMetadata(props: ScreenProps<WalletBalanceScreenParams>): Promise<Metadata> {
      const { label } = await loadWalletBalanceScreen(props);
      return createMetadata({ title: \`\${label}管理\` });
    }

    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.deepEqual(checkSwitchPage(ok, "WalletBalanceScreen"), []);

  // 生成された管理画面の形: dynamic は page.tsx に、metadata は _screen から re-export
  const generated = `
    export const dynamic = "force-dynamic";
    export { AdminSampleListScreen as default, metadata } from "./_screen/AdminSampleListScreen";
  `;
  assert.deepEqual(checkSwitchPage(generated, "AdminSampleListScreen"), []);

  const dynamicReexport = `export { AdminSampleListScreen as default, dynamic } from "./_screen/AdminSampleListScreen";`;
  assert.ok(checkSwitchPage(dynamicReexport, "AdminSampleListScreen").some((p) => p.includes("dynamic")));

  const jsx = `
    import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
    export default function Page() { return <UserPage />; }
  `;
  assert.ok(checkSwitchPage(jsx, "WalletBalanceScreen").length > 0);

  const navigation = `
    import { notFound } from "next/navigation";
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(checkSwitchPage(navigation, "WalletBalanceScreen").some((p) => p.includes("next/navigation")));

  const sectionContainer = `
    import { WalletBalancePage } from "@/features/core/wallet/components/WalletBalancePage";
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(checkSwitchPage(sectionContainer, "WalletBalanceScreen").some((p) => p.includes("components/WalletBalancePage")));

  const wrongTarget = `export { WalletBalanceScreen as default } from "./_components/WalletBalanceScreen";`;
  assert.ok(checkSwitchPage(wrongTarget, "WalletBalanceScreen").length > 0);
});
