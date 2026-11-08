// scripts/runner/gates/watchCoverage.test.mjs — 門 ship に乗る上流の対象の watch が、その検査の読む物を覆うこと
// 実行: pnpm test scripts/runner/gates/watchCoverage.test.mjs
//
// watch が狭すぎると、検査を落とすはずの変更で検査が飛び、壊れた変更が素通りする(README「watch」)。
// ここでは対象ごとに「読む物」を 2 つで表す:
//   entries = 検査の入口(と入口が子のプロセスで起動するファイル)。dpdm で静的・動的 import を辿り、届く全ファイルを読む物とする
//   data    = 入口が import でなく fs で読むファイル(glob)。走査する木・宣言の JSON・設定ファイル
// 届くファイルと data の全ファイルが watch の glob のどれかに当たらなければ落ち、当たらないファイルを名前で出す。
// 検査の入口に読む物を足したら、ここの表と gate.json の watch を一緒に直す。
// fork が足した対象(gates.json の名簿の外)は watch が無くても回るだけなので見ない。
import assert from "node:assert/strict";
import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseDependencyTree } from "dpdm";

import { REQUIRED_ESLINT_RULES } from "../../../eslint-rules/required-rules.mjs";
import { globToRegExp, run } from "./run.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** 対象 → 読む物。entries・data はリポジトリ直下からの glob */
const READS = {
  config: { entries: ["scripts/structure/config/moduleLoad.test.mjs", "src/config/ui/*.config.ts"], data: ["src/config/ui/*.config.ts"] },
  cron: {
    entries: ["scripts/structure/cron/gate-check.ts", "scripts/structure/cron/check.ts", "src/app/api/cron/*/task*.ts"],
    data: ["vercel.json", "src/app/api/cron/**", "src/featureGate/rules/*.ts"],
  },
  // 値の輪の走査は src 全体のソースを読む
  cycles: { entries: ["scripts/structure/cycles/cycles.test.mjs"], data: ["src/**/*.{ts,tsx,mts,mjs,js}"] },
  // 生成の --dry-run(書く先の有無を見る)と feature-map.txt の照合
  domain: {
    entries: ["scripts/structure/domain/check.mjs", "scripts/structure/domain/index.mjs", "scripts/structure/domain/feature-map.mjs"],
    data: ["src/features/**/domain.json", "src/features/feature-map.txt", "src/app/admin/_template/**", "src/app/admin/(protected)/**/page.tsx", "src/registry/*.ts", "src/wiring/formInputs/inputs/*.ts", "src/features/core/user/roles/*.json"],
  },
  // 規則の強さは設定とパスで決まる(代表のファイルは有無だけが効く)
  eslint: {
    entries: ["scripts/structure/eslint/requiredRules.mjs", "eslint.config.mjs"],
    data: ["eslint.config*.mjs", ...REQUIRED_ESLINT_RULES.filter((r) => !r.example).flatMap((r) => r.files)],
  },
  // 拡張点の宣言・項目・スイッチ・枠は src 全体に散る
  extensions: {
    entries: ["scripts/structure/extensions/gate-check.mjs", "scripts/structure/extensions/check.mjs"],
    data: ["src/**/extensionPoints.ts", "src/**/*.default.{ts,tsx}", "src/**/*.override.ts", "src/lib/forkOwnership/intake.txt", "src/app/**/_layout/**"],
  },
  // 登録表の走査(domainEntry・pgTable・用途)と storageBindingFor の呼び出し(src 全体)
  registry: { entries: ["scripts/structure/registry/check.mjs"], data: ["src/features/**", "src/registry/*.ts", "src/**/*.{ts,tsx,mts}"] },
  role: {
    entries: ["scripts/structure/role/check.mjs"],
    data: ["src/features/core/user/roles/*", "src/features/core/user/coreRoles/*", "src/features/core/userProfile/profiles/*", "src/features/core/user/extensions/roles.ts", "src/wiring/formInputs/inputs/*.ts"],
  },
  // ルート地図: src/app のページ・Screen・loader・guard と地図そのもの
  routes: { entries: ["scripts/structure/routes/check.ts", "scripts/structure/routes/map.mjs"], data: ["src/app/**", "src/app/route-map.jsonl"] },
  // 地区の地図: 4 種の地区の木(features・lib・proxies・枠の _layout)・門の規則・上書きの有無と地図そのもの
  districtMap: {
    entries: ["scripts/structure/districtMap/check.mjs"],
    data: ["src/features/**", "src/lib/**", "src/proxies/**", "src/app/**/_layout/**", "src/featureGate/rules/*.ts", "src/config/**", "src/registry/district-map.jsonl"],
  },
  "admin-menu": { entries: ["scripts/structure/admin-menu/check.ts"], data: ["src/features/core/admin/menu/**", "src/app/route-map.jsonl"] },
};

const gates = JSON.parse(readFileSync(join(repo, "scripts/runner/gates/gates.json"), "utf8"));
const upstream = gates.upstreamFolders.structure;
const declOf = (name) => JSON.parse(readFileSync(join(repo, "scripts/structure", name, "gate.json"), "utf8"));
const shipTargets = upstream.filter((name) => existsSync(join(repo, "scripts/structure", name, "gate.json")) && (declOf(name).gates ?? []).includes("ship"));

const files = (patterns) => [...new Set(patterns.flatMap((p) => globSync(p, { cwd: repo })))].filter((f) => !f.includes("node_modules") && statSync(join(repo, f)).isFile());
const covered = (watch) => {
  const res = watch.map(globToRegExp);
  return (f) => res.some((re) => re.test(f));
};

async function reach(entries) {
  const cwd = process.cwd();
  process.chdir(repo);
  try {
    const tree = await parseDependencyTree(files(entries), {
      context: repo,
      tsconfig: "tsconfig.json",
      transform: true,
      extensions: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json"],
      js: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"],
      onProgress: () => {},
    });
    return Object.keys(tree).filter((k) => !k.includes("node_modules") && existsSync(join(repo, k)));
  } finally {
    process.chdir(cwd);
  }
}

test("門 ship に乗る上流の structure の対象は、どれも watch を持ち、読む物の表がある", () => {
  assert.ok(shipTargets.length >= 9, `対象: ${shipTargets.join(", ")}`);
  for (const name of shipTargets) {
    assert.ok(declOf(name).watch?.length, `${name}: gate.json に watch が無い`);
    assert.ok(READS[name], `${name}: watchCoverage.test.mjs の READS に読む物の表が無い`);
  }
});

for (const name of Object.keys(READS)) {
  test(`${name}: watch が入口から届くファイルと読むデータを覆う`, async () => {
    const watch = declOf(name).watch ?? [];
    const hit = covered(watch);
    const own = `scripts/structure/${name}/`;
    const reached = await reach(READS[name].entries);
    assert.ok(reached.length > 0, `${name}: 入口から何も辿れない(表の entries を確かめる)`);
    const data = files(READS[name].data);
    assert.ok(data.length > 0, `${name}: data の glob が何にも当たらない`);
    const missing = [...new Set([...reached, ...data, ...files([`${own}**`])])].filter((f) => !hit(f)).sort();
    assert.deepEqual(missing, [], `${name}: watch に当たらない読む物(gate.json の watch に足す): ${missing.slice(0, 20).join(", ")}`);
  });
}

test("関係ない変更では対象が飛び、対象の入力を変えると回る(実物の gate.json)", () => {
  const runs = (changedFiles) => shipTargets.filter((name) => changedFiles.some(covered(declOf(name).watch)));
  assert.deepEqual(runs(["docs/setup/x.md", "README.md", "servers/room/src/index.ts", "scripts/operations/db/inspect.ts"]), []);
  assert.deepEqual(runs(["src/features/core/user/roles/editor.role.json"]).sort(), ["admin-menu", "config", "cron", "cycles", "districtMap", "domain", "extensions", "registry", "role", "routes"].filter((n) => shipTargets.includes(n)).sort());
  assert.deepEqual(runs(["eslint-rules/page-authz.mjs"]), ["eslint"]);
  assert.deepEqual(runs(["scripts/structure/domain/render/index.mjs"]).sort(), ["domain", "eslint", "extensions", "registry", "role"].sort());
  assert.deepEqual(runs(["src/app/(user)/page.tsx"]).sort(), ["admin-menu", "config", "cron", "cycles", "extensions", "registry", "routes"].sort());
  for (const name of shipTargets) assert.ok(runs([`scripts/structure/${name}/gate.json`]).includes(name), `${name}: 自分のフォルダの変更で回らない`);
});

test("門 ship: md だけの変更なら全部の対象が飛び、飛ばした行を 1 つずつ出す(入口は起動しない)", () => {
  const lines = [];
  const code = run(["check", "--gate=ship"], { repo, log: (l) => lines.push(l), changed: () => ({ files: ["docs/setup/x.md"] }) });
  assert.equal(code, 0);
  const skipped = lines.filter((l) => l.includes("変更が watch に当たらないので飛ばした"));
  const ship = [...shipTargets.map((n) => `structure/${n}`), "workflow/notices", "workflow/rules"];
  for (const label of ship) assert.ok(skipped.some((l) => l.includes(`gates: ${label}:`)), `${label} が飛ばされていない: ${lines.join(" / ")}`);
  assert.ok(!lines.some((l) => l.endsWith("通る")), `起動した対象がある: ${lines.join(" / ")}`);
});
