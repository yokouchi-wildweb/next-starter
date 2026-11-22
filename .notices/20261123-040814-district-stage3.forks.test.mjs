// .notices/20261123-040814-district-stage3.forks.test.mjs
// 段 3 の fork の手当ての道具(./20261123-040814-district-stage3.forks.mjs、注文 39)のテスト。一時フォルダの fixture の fork(git は使わない:
// fork が足したファイルは求められず、手の作業の一覧にその旨が出る)。実行: node --test .notices/20261123-040814-district-stage3.forks.test.mjs

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { rewriteForkProviders, runForks } from "./20261123-040814-district-stage3.forks.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "stage3-forks-"));
  const all = {
    "repo.json": JSON.stringify({ repo_id: "acme", tier: "leaf" }),
    "src/lib/CATALOG.md": "# x\n\n## next-starter\n\n## acme\n",
    ".notices/applied/next-starter.md": "",
    // 上流の宣言(取り込み済み): 型だけの入口と点
    "src/proxies/extensionPoints.ts": 'export const extensionPoints = {\n  proxyHandlers: { change: "add", plugs: true, export: "handler", type: { from: "@/proxies/points", name: "ProxyHandler" }, side: "server", stages: ["maintenance", "mode", "gate", "redirect", "main"], skeletonStages: ["gate", "redirect"] },\n};\n',
    "src/proxies/points.ts": 'export type { ProxyHandler, ProxyContext } from "./types";\n',
    "src/proxies/types.ts": "export type ProxyHandler = unknown;\nexport type ProxyContext = unknown;\n",
    "src/proxies/index.ts": "export const x = 1;\n",
    "src/featureGate/rules/shop.ts": 'export const rule = { pathPatterns: ["/shop"], domains: ["shop"] };\n',
    // fork のドメイン: shop(規則に載る)・ticket(どの規則にも載らない、宣言のファイルも無い)
    "src/domains/shop/index.ts": "export {};\n",
    "src/domains/ticket/index.ts": "export {};\n",
    // 古い置き場の fork の項目
    "src/wiring/formInputs/inputs/ticketRates.ts": 'import { x } from "./helper";\nexport const formInput = { name: "ticketRates", load: () => import("./x") };\n',
    "src/wiring/formInputs/inputs/helper.ts": "export const x = 1;\n",
    "src/wiring/formInputs/inputs/README.md": "x\n",
    "src/wiring/dbAgent/promptFragments/oripaCore.ts": "export const fragment = 'x';\n",
    "src/wiring/serverErrors/reporters/sentry.ts": "export const reporter = { report: async () => {}, register: () => {} };\n",
    "src/proxies/shopThrottle.ts": 'import type { ProxyHandler } from "./types";\nexport const handler: ProxyHandler = async () => null;\n',
    "src/proxies/redirects/shopOld.ts": 'export const redirects = [{ sourcePath: "/old", destination: "/shop" }];\n',
    "src/app/_layout/adminCommand/categories/shopPoints.tsx": "export const category = {};\n",
    "src/app/_providers/ForkProviders.replace.tsx": 'import type { ReactNode } from "react";\n\nexport type { ForkProvidersProps } from "./ForkProviders.default";\n\nexport function ForkProviders({ children }: Readonly<{ children: ReactNode }>) {\n  return children;\n}\n',
    "src/featureGate/alwaysOnExceptions/wire.ts": 'export const exception = { file: "src/wiring/x.ts", reason: "r" };\n',
    "src/domains/shop/components/x.tsx": "// eslint-disable-next-line import-boundaries/lib-no-domains\nexport const y = 1;\n",
  };
  for (const [path, text] of Object.entries({ ...all, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("dry-run は書かない。行き先が名前で決まらない物・register を持つ送り先・ForkProviders は止め、止めた物があれば --apply も書かない", () => {
  const root = fixture({});
  const r = runForks(root);
  assert.deepEqual(r.moves.map((m) => `${m.from} → ${m.to}`).sort(), [
    "src/app/_layout/adminCommand/categories/shopPoints.tsx → src/domains/shop/plugs/adminCommandCategories/shopPoints.tsx",
    "src/proxies/redirects/shopOld.ts → src/domains/shop/plugs/proxyRedirects/shopOld.ts",
    "src/proxies/shopThrottle.ts → src/domains/shop/plugs/proxyHandlers/shopThrottle.ts",
    "src/wiring/formInputs/inputs/ticketRates.ts → src/domains/ticket/plugs/formInputs/ticketRates.ts",
  ]);
  assert.deepEqual(r.stops.map((s) => s.path).sort(), ["src/app/_providers/ForkProviders.replace.tsx", "src/wiring/dbAgent/promptFragments/oripaCore.ts", "src/wiring/formInputs/inputs/helper.ts", "src/wiring/serverErrors/reporters/sentry.ts"]);
  assert.ok(r.stops.find((s) => s.path.endsWith("sentry.ts")).text.includes("startupTasks"));
  assert.deepEqual(r.alwaysOpen.map((a) => `${a.path}:${a.create}`), ["src/domains/ticket/extensionPoints.ts:true"]);
  assert.deepEqual(r.lintFiles, ["src/domains/shop/components/x.tsx"]);
  assert.ok(r.hand.some((h) => h.path === "src/featureGate/alwaysOnExceptions/wire.ts"));
  assert.ok(r.stopCount > 0);
  runForks(root, { apply: true });
  assert.ok(existsSync(join(root, "src/proxies/shopThrottle.ts")), "止めた物があれば書かない");
});

test("--owner で決めて --apply: 移す・相対の import を直す・段を足す・ForkProviders を rootProviders の項目に・常設の宣言・型の入口・lint の名前。2 回目は何もしない", () => {
  const root = fixture({ "src/wiring/serverErrors/reporters/sentry.ts": "export const reporter = { report: async () => {} };\n" });
  const owners = {
    "src/wiring/formInputs/inputs/helper.ts": "src/domains/ticket",
    "src/wiring/dbAgent/promptFragments/oripaCore.ts": "src/domains/shop",
    "src/wiring/serverErrors/reporters/sentry.ts": "src/domains/shop",
    "src/app/_providers/ForkProviders.replace.tsx": "src/domains/shop",
  };
  const r = runForks(root, { apply: true, owners });
  assert.equal(r.stopCount, 0, JSON.stringify(r.stops));
  const read = (p) => readFileSync(join(root, p), "utf8");
  assert.match(read("src/domains/ticket/plugs/formInputs/ticketRates.ts"), /from "\.\.\/\.\.\/\.\.\/\.\.\/wiring\/formInputs\/inputs\/helper"|from "@\/wiring\/formInputs\/inputs\/helper"/);
  const handler = read("src/domains/shop/plugs/proxyHandlers/shopThrottle.ts");
  assert.match(handler, /import type \{ ProxyHandler \} from "@\/proxies\/points";/, "相対の ./types → @/proxies/types → 型の入口");
  assert.match(handler, /export const stage = "main";/);
  const provider = read("src/domains/shop/plugs/rootProviders/shopProviders.tsx");
  assert.match(provider, /export const stage = "project";/);
  assert.match(provider, /export const provider: RootProvider = ForkProviders;/);
  assert.match(provider, /import type \{ RootProvider \} from "@\/app\/_layout\/points";/);
  assert.doesNotMatch(provider, /ForkProviders\.default/);
  assert.match(read("src/domains/ticket/extensionPoints.ts"), /export const alwaysOpen = true;/);
  assert.match(read("src/domains/shop/components/x.tsx"), /import-boundaries\/district-no-domains/);
  assert.ok(!existsSync(join(root, "src/app/_providers")), "空になった古い置き場は消す");
  const again = runForks(root, { owners });
  assert.deepEqual([again.moves.length, again.alwaysOpen.length, again.lintFiles.length, again.points.length, again.stopCount], [0, 0, 0, 0, 0]);
});

test("ForkProviders の書き換え: 既定の型の再出しを消し、段と provider と型の import を足す(既にあれば足さない)", () => {
  const once = rewriteForkProviders('import type { ReactNode } from "react";\nexport type { ForkProvidersProps } from "./ForkProviders.default";\nexport function ForkProviders() {}\n');
  assert.equal(rewriteForkProviders(once), once);
  assert.equal(once.match(/export const stage/g).length, 1);
});

test("上流のドメインの古い受け口に残った項目は fork のドメインへ・adminBulkActions は手で・止めた物の候補は読むドメインが先・消えた 1 行スイッチは消す(注文 40)", () => {
  const root = fixture({
    "src/domains/core/messaging/layouts/shopNotice/layout.ts": "export const layout = {};\n",
    "src/domains/core/user/adminBulkActions/shopBulk.tsx": "export const bulkAction = {};\n",
    "src/wiring/dbAgent/promptFragments/oripaCore.ts": 'import { t } from "@/domains/ticket/services/server";\nexport const fragment = t;\n',
    "src/app/_providers/ForkProviders.tsx": '// 1 行スイッチ\nexport { ForkProviders, type ForkProvidersProps } from "./ForkProviders.replace";\n',
  });
  const r = runForks(root);
  assert.ok(r.moves.some((m) => m.from === "src/domains/core/messaging/layouts/shopNotice" && m.to === "src/domains/shop/plugs/messagingLayouts/shopNotice"));
  assert.ok(r.hand.some((h) => h.path === "src/domains/core/user/adminBulkActions/shopBulk.tsx" && h.text.includes("adminBulkActions")));
  const oripa = r.stops.find((s) => s.path.endsWith("oripaCore.ts"));
  assert.deepEqual([oripa.reads, oripa.candidates[0]], [["src/domains/ticket"], "src/domains/ticket"]);
  assert.deepEqual(r.removes, ["src/app/_providers/ForkProviders.tsx"]);
});

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (root, files) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
};

test("git が上流の plugs/<点>/ へ運んだ fork の項目を fork のドメインへ、上書きは対象の隣へ(隣にあれば残す)。親の版の項目は動かさない(注文 40)", () => {
  const parent = mkdtempSync(join(tmpdir(), "stage3-forks-parent-"));
  git(parent, "init", "-q");
  put(parent, {
    "repo.json": JSON.stringify({ repo_id: "next-starter", tier: "root" }),
    "src/lib/CATALOG.md": "# x\n\n## next-starter\n",
    "src/domains/core/admin/plugs/adminMenuCategories/system.ts": "export const category = {};\n",
    "src/domains/core/user/plugs/adminMenuCategories/users.ts": "export const category = {};\n",
    "src/domains/core/user/plugs/adminMenuItems/users.ts": "export const item = {};\n",
  });
  git(parent, "add", "-A");
  git(parent, "commit", "-qm", "parent");
  const fork = mkdtempSync(join(tmpdir(), "stage3-forks-fork-"));
  git(fork, "clone", "-q", parent, ".");
  git(fork, "remote", "rename", "origin", "upstream");
  put(fork, {
    "repo.json": JSON.stringify({ repo_id: "acme", tier: "leaf" }),
    "src/lib/CATALOG.md": "# x\n\n## next-starter\n\n## acme\n",
    ".notices/applied/next-starter.md": "",
    "src/domains/shop/index.ts": "export {};\n",
    "src/featureGate/rules/shop.ts": 'export const rule = { pathPatterns: ["/shop"], domains: ["shop"] };\n',
    "src/domains/core/user/plugs/adminMenuItems/shopOrders.ts": "export const item = {};\n",
    "src/domains/core/user/plugs/adminMenuItems/users.override.ts": "export const override = {};\n",
    "src/domains/core/admin/plugs/adminMenuCategories/users.override.ts": "export const override = {};\n",
  });
  git(fork, "add", "-A");
  git(fork, "commit", "-qm", "fork");
  const r = runForks(fork, { apply: true });
  assert.equal(r.stopCount, 0, JSON.stringify(r.stops));
  assert.deepEqual(r.moves.map((m) => `${m.from} → ${m.to}`).sort(), [
    "src/domains/core/admin/plugs/adminMenuCategories/users.override.ts → src/domains/core/user/plugs/adminMenuCategories/users.override.ts",
    "src/domains/core/user/plugs/adminMenuItems/shopOrders.ts → src/domains/shop/plugs/adminMenuItems/shopOrders.ts",
  ]);
  assert.ok(existsSync(join(fork, "src/domains/core/user/plugs/adminMenuItems/users.override.ts")), "隣に対象のある上書きは残す");
  assert.ok(existsSync(join(fork, "src/domains/core/user/plugs/adminMenuItems/users.ts")), "親の版の項目は動かさない");
  assert.equal(runForks(fork).moves.length, 0);
});
