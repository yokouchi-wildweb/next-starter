// page 層(page.tsx スイッチ + _screen/ + loader)の規律テスト。
// 実行: pnpm test:screens (node:test、追加依存なし)
//
// 守りたい契約(設計: src/lib/screens/README.md):
// 1. 上流ルートの page.tsx は「./_screen/<Name>Screen への 1 行の re-export」+ 任意のページ設定
//    (metadata / dynamic 等の export、generateMetadata、それらに必要な import)だけ。
//    画面ロジック(JSX、セクションコンテナや next/navigation の import)を page.tsx に戻さない — 上流リポ限定の検査
// 2. 上流ルートの _screen/<Name>Screen.tsx が存在し <Name>Screen を named export している
//    — 下流 fork でも実行(削除すると将来 upstream 改修時に modify/delete 衝突になるため早期に検出)
// 3. loader は `import "server-only"` と React の cache() を使い load<Name>Screen を export する
//
// 上流で core のユーザー向けページを増やしたら UPSTREAM_ROUTES に追加する。
// 下流でルートごと削除した場合はその行を外す(README「upstream の画面を使わない」)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** origin の URL(取得できなければ空文字)。upstream 限定の検査の判定に使う */
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
const isUpstreamRepo = /yokouchi-wildweb\/next-starter(\.git)?$/.test(originUrl());

/**
 * 上流が出荷する core のユーザー向けルート。
 * dir: ルートディレクトリ(repo 相対) | screen: _screen/<screen>.tsx の named export | loader: 任意(repo 相対)
 */
export const UPSTREAM_ROUTES = [
  {
    dir: "src/app/(user)/(protected)/wallet",
    screen: "WalletIndexScreen",
    loader: "src/features/core/wallet/services/server/loaders/walletIndex.ts",
  },
  {
    dir: "src/app/(user)/(protected)/wallet/[slug]",
    screen: "WalletBalanceScreen",
    loader: "src/features/core/wallet/services/server/loaders/walletBalance.ts",
  },
  {
    dir: "src/app/(user)/(protected)/wallet/[slug]/history",
    screen: "WalletHistoryScreen",
    loader: "src/features/core/wallet/services/server/loaders/walletHistory.ts",
  },
];

// ---------------------------------------------------------------------------
// page.tsx の検査(純粋関数。export しているのは検証スクリプトから呼べるようにするため)
// ---------------------------------------------------------------------------

/** Next.js が page.tsx で認める設定 export の名前 */
const PAGE_CONFIG_EXPORTS = [
  "metadata",
  "dynamic",
  "revalidate",
  "dynamicParams",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
];

/**
 * `start` 以降で最初に現れる open と対応する close の位置(括弧の釣り合い)を返す。
 * 文字列リテラル・テンプレートリテラル内の括弧は数えない。見つからなければ -1
 */
function findBalancedEnd(src, start, open, close) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `export const metadata = {...};` / `export const dynamic = "force-dynamic";` などの設定 export を 1 つ取り除く */
function stripConfigExport(src) {
  const re = new RegExp(`export\\s+(const|let)\\s+(${PAGE_CONFIG_EXPORTS.join("|")})\\b[^=]*=\\s*`);
  const m = re.exec(src);
  if (!m) return null;
  const valueStart = m.index + m[0].length;
  let end;
  if (src[valueStart] === "{" || src[valueStart] === "[") {
    end = findBalancedEnd(src, valueStart, src[valueStart], src[valueStart] === "{" ? "}" : "]");
    if (end < 0) return null;
  } else {
    // プリミティブ値: 行末または ; まで
    const rest = src.slice(valueStart);
    const stop = rest.search(/;|\n/);
    end = valueStart + (stop < 0 ? rest.length : stop) - 1;
  }
  let cut = end + 1;
  if (src[cut] === ";") cut += 1;
  return src.slice(0, m.index) + src.slice(cut);
}

/** `export async function generateMetadata(...) {...}` を 1 つ取り除く */
function stripGenerateMetadata(src) {
  const m = /export\s+(async\s+)?function\s+generateMetadata\s*\(/.exec(src);
  if (!m) return null;
  const parenStart = m.index + m[0].length - 1;
  const parenEnd = findBalancedEnd(src, parenStart, "(", ")");
  if (parenEnd < 0) return null;
  const braceStart = src.indexOf("{", parenEnd);
  if (braceStart < 0) return null;
  const braceEnd = findBalancedEnd(src, braceStart, "{", "}");
  if (braceEnd < 0) return null;
  return src.slice(0, m.index) + src.slice(braceEnd + 1);
}

/** import 文を 1 つ取り除き、import 元を返す */
function stripImport(src) {
  const m = /import\s+(type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']\s*;?/.exec(src);
  if (!m) return null;
  return { src: src.slice(0, m.index) + src.slice(m.index + m[0].length), source: m[2] };
}

/**
 * page.tsx が許される import 元か。
 * 設定 export(metadata / generateMetadata)に必要なもの: next(型)、lib、config、ドメインの loader。
 * 画面ロジックに当たるもの(セクションコンテナ・hook・next/navigation 等)は不可
 */
function isAllowedImportSource(source) {
  if (source === "next") return true;
  if (/^@\/lib\//.test(source)) return true;
  if (/^@\/config\//.test(source)) return true;
  if (/^@\/features\/[^/]+\/services\/server\/loaders\//.test(source)) return true;
  if (/^@\/features\/core\/[^/]+\/services\/server\/loaders\//.test(source)) return true;
  return false;
}

/**
 * page.tsx の本文を検査し、問題があれば理由の配列を返す(空配列 = 合格)。
 * @param {string} source page.tsx の内容
 * @param {string} screen 期待する Screen 名
 */
export function checkSwitchPage(source, screen) {
  const problems = [];
  let src = stripComments(source);

  // 1. ./_screen/ からの re-export がちょうど 1 つ
  const reexports = [...src.matchAll(/export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*from\s*["']\.\/_screen\/(\w+)["']\s*;?/g)];
  if (reexports.length !== 1) {
    problems.push(`./_screen/ からの \`export { X as default }\` が 1 つだけ必要(${reexports.length} 個)`);
  } else {
    const [whole, name, file] = reexports[0];
    if (name !== screen) problems.push(`re-export 名が ${screen} ではない(${name})`);
    if (file !== screen) problems.push(`import 先が ./_screen/${screen} ではない(./_screen/${file})`);
    src = src.replace(whole, "");
  }

  // 2. import は許可された元だけ
  for (let hit = stripImport(src); hit; hit = stripImport(src)) {
    src = hit.src;
    if (!isAllowedImportSource(hit.source)) {
      problems.push(`page.tsx で import できない: "${hit.source}"(画面ロジックは _screen/ へ)`);
    }
  }

  // 3. 設定 export と generateMetadata は取り除く(中身は検査しない)
  for (let next = stripConfigExport(src); next !== null; next = stripConfigExport(src)) src = next;
  for (let next = stripGenerateMetadata(src); next !== null; next = stripGenerateMetadata(src)) src = next;

  // 4. 残りは空でなければならない
  const remainder = src.replace(/;/g, "").trim();
  if (remainder) {
    problems.push(`許可されない記述が残っている: ${remainder.split("\n")[0].trim()}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// テスト本体
// ---------------------------------------------------------------------------

for (const route of UPSTREAM_ROUTES) {
  const screenPath = `${route.dir}/_screen/${route.screen}.tsx`;
  const pagePath = `${route.dir}/page.tsx`;

  test(`${route.dir}: _screen/${route.screen}.tsx が存在し ${route.screen} を named export している`, () => {
    assert.ok(existsSync(resolve(repoRoot, screenPath)), `${screenPath} が無い。削除した場合は UPSTREAM_ROUTES から外す`);
    const src = stripComments(read(screenPath));
    const exported = new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${route.screen}\\b`).test(src);
    assert.ok(exported, `${screenPath} が \`export function ${route.screen}\` を持たない`);
    assert.equal(/export\s+default/.test(src), false, `${screenPath} は default export しない(page.tsx が as default で再 export する)`);
  });

  test(`${route.dir}: page.tsx は _screen への 1 行スイッチ(上流リポ限定)`, (t) => {
    if (!isUpstreamRepo) {
      t.skip("下流 fork では page.tsx は下流所有のため検査しない");
      return;
    }
    const problems = checkSwitchPage(read(pagePath), route.screen);
    assert.deepEqual(problems, [], `${pagePath}: ${problems.join(" / ")}`);
  });

  if (route.loader) {
    test(`${route.dir}: loader ${route.loader} は server-only + cache()`, () => {
      assert.ok(existsSync(resolve(repoRoot, route.loader)), `${route.loader} が無い`);
      const src = stripComments(read(route.loader));
      assert.ok(/import\s+"server-only"/.test(src), `${route.loader} に import "server-only" が無い`);
      assert.ok(/\bcache\(/.test(src), `${route.loader} が React の cache() で包まれていない`);
      assert.ok(/export\s+(const|async\s+function|function)\s+load\w+Screen\b/.test(src), `${route.loader} が load<Name>Screen を export していない`);
    });
  }
}

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
