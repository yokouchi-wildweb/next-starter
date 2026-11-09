// scripts/structure/district-map/districtMap.test.mjs — 地区の地図を今の木の正本と突き合わせる + 生成器・検査器の振る舞い
// 実行: pnpm test scripts/structure/district-map
// 正本: ドメインの一覧と domainEntry のキー = scripts/structure/registry/serviceRegistry/discover.mjs、表 = tableScan.mjs(schemaRegistry の元)、
// 門の features = @/featureGate/node の configRules、受け口 = forkOwnership の collectPoints、lib = src/lib 直下のフォルダ
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { configRules } from "../../../src/featureGate/node.ts";
import { DISTRICT_MAP_FILE } from "../../../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { collectPoints } from "../../../src/lib/districtMap/declarations.mjs";
import { scanFeatureTables } from "../registry/tableScan.mjs";
import { ENTRIES_EXPORT, listDomainDirs, readObjectKeys } from "../registry/serviceRegistry/discover.mjs";
import { buildDistrictMap, checkDistrictMap, generateDistrictMap, repoRoot } from "./map.mjs";

const { districts, problems } = readDistrictMapAt(repoRoot);
const features = districts.filter((d) => d.kind === "features");
const folderOf = (d) => d.dir.slice("src/features/".length);

test("今の木に問題が無い", () => {
  assert.deepEqual(problems, []);
});

test("features = src/features と core の直下の _ でないフォルダ(登録表の走査と同じ集合)、lib = src/lib 直下、proxies = テーマのフォルダ(上流は demo)、枠 = frame: の宣言", () => {
  assert.deepEqual(features.map(folderOf).sort(), listDomainDirs(repoRoot));
  assert.ok(!features.some((d) => d.name.startsWith("_")));
  const libs = readdirSync(join(repoRoot, "src/lib"), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort();
  assert.deepEqual(districts.filter((d) => d.kind === "lib").map((d) => d.name), libs);
  assert.deepEqual(districts.filter((d) => d.kind === "proxies").map((d) => d.dir), ["src/proxies/demo"]);
  // 枠の宣言(_layout/config.ts の frame:)。今は root だけ(user・admin の枠は地区のクエストで書く、L1.13)
  assert.deepEqual(districts.filter((d) => d.kind === "frame").map((d) => [d.name, d.dir]), [["root", "src/app/_layout"]]);
});

test("apiKeys = 各ドメインの domainEntry.ts のキー(登録表の生成と同じ読み方)", () => {
  for (const d of features) {
    let text = null;
    try {
      text = readFileSync(join(repoRoot, d.dir, "services/server/domainEntry.ts"), "utf8");
    } catch {
      assert.deepEqual(d.apiKeys, [], d.dir);
      continue;
    }
    assert.deepEqual(d.apiKeys, readObjectKeys(text, ENTRIES_EXPORT).keys, d.dir);
  }
});

test("tables = schemaRegistry の元の表の全部を features の地区に 1 回ずつ割り振る(雛形 _template の外に漏れなし・二重なし)", () => {
  const { tables } = scanFeatureTables(repoRoot);
  const expected = tables.filter((t) => !t.file.startsWith("src/features/_")).map((t) => t.name).sort();
  const mapped = features.flatMap((d) => d.tables).sort();
  assert.deepEqual(mapped, expected);
  assert.equal(new Set(mapped).size, mapped.length);
});

test("requires = domainEntry の requires(今の上流は 5 ドメイン)", () => {
  assert.deepEqual(
    features.filter((d) => d.requires.length > 0).map((d) => `${d.name}:${d.requires.join(",")}`),
    ["couponAttributionReward:wallet", "fingerprintChallenge:deviceFingerprint", "notification:notificationTemplate", "purchaseRequest:wallet,walletHistory", "referral:coupon"],
  );
});

test("gates = 門の規則の features の逆引き", () => {
  const expected = new Map();
  for (const rule of configRules) for (const folder of rule.features ?? []) expected.set(folder, [...(expected.get(folder) ?? []), rule.name].sort());
  for (const d of features) assert.deepEqual(d.gates, expected.get(folderOf(d)) ?? [], d.dir);
  assert.equal(features.flatMap((d) => d.gates).length, [...expected.values()].flat().length);
});

test("receptacles = 地区の中の extensionPoints.ts の点(地区の外の宣言は載らない)", () => {
  const { points } = collectPoints(repoRoot);
  for (const d of districts) {
    const inside = points.filter((p) => p.owner === d.dir || p.owner.startsWith(`${d.dir}/`)).map((p) => p.name).sort();
    assert.deepEqual(d.receptacles, inside, d.dir);
  }
  const outside = points.filter((p) => !districts.some((d) => p.owner === d.dir || p.owner.startsWith(`${d.dir}/`))).map((p) => p.owner);
  // src/proxies = 枠(handlers・decorators・redirects)の受け口。proxies の地区はテーマのフォルダ(src/proxies/<テーマ>/、設定 D93)なので枠の直下は地区の外
  assert.deepEqual([...new Set(outside)].sort(), ["src/app/(user)/demo", "src/featureGate", "src/proxies", "src/wiring/dbAgent", "src/wiring/formInputs"]);
});

test("domainJson・generate = 各ドメインの domain.json の有無と generate(省略 = true)。生成器が書き直さないドメインが地図で分かる(L1.15)", () => {
  for (const d of features) {
    let config = null;
    try {
      config = JSON.parse(readFileSync(join(repoRoot, d.dir, "domain.json"), "utf8"));
    } catch {
      config = null;
    }
    assert.equal(d.domainJson, config !== null, d.dir);
    assert.equal(d.generate, config === null ? null : config.generate !== false, d.dir);
  }
  assert.ok(features.some((d) => d.generate === false) && features.some((d) => d.generate === true) && features.some((d) => d.generate === null));
});

test("config・上書き: 欄の有無は木のファイルの有無と同じ(対の揃い方は pnpm check config-overrides)", () => {
  for (const d of districts) {
    for (const slot of [d.config, d.override, d.uiConfig, d.uiOverride]) assert.equal(slot.exists, existsSync(join(repoRoot, slot.path)), slot.path);
  }
  assert.ok(districts.some((d) => d.kind === "lib" && d.config.exists && d.override.exists), "閉じた lib(toast など)の config と上書きが載る");
});

test("district-map.jsonl は今の木と一致(pnpm check district-map)", () => {
  assert.equal(readFileSync(join(repoRoot, DISTRICT_MAP_FILE), "utf8"), buildDistrictMap(repoRoot).text);
  assert.equal(checkDistrictMap(repoRoot).ok, true);
});

test("生成器と検査器: 作る → 一致、手で直す・無い → 失敗、問題があれば書かない", () => {
  const root = mkdtempSync(join(tmpdir(), "district-map-"));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  try {
    put("src/features/core/wallet/index.ts", "");
    put("src/lib/crud/index.ts", "");
    mkdirSync(join(root, "src/registry"), { recursive: true });
    assert.equal(checkDistrictMap(root).ok, false); // 無い
    assert.equal(generateDistrictMap(root).ok, true);
    assert.equal(checkDistrictMap(root).ok, true);
    const path = join(root, DISTRICT_MAP_FILE);
    writeFileSync(path, readFileSync(path, "utf8").replace('"wallet"', '"walletX"'));
    const stale = checkDistrictMap(root);
    assert.equal(stale.ok, false);
    assert.match(stale.lines[0], /pnpm generate district-map/);
    put("src/features/wallet/index.ts", ""); // core と業務の同名
    writeFileSync(path, "keep\n");
    assert.equal(generateDistrictMap(root).ok, false);
    assert.equal(readFileSync(path, "utf8"), "keep\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
