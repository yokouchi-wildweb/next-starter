// src/featureGate/checks/integrity.test.ts
// 機能とドメインの組み合わせの検査(./integrity.mjs、D24・D27・D34 K5・設定 D56)と、規則を閉じれば閉じる住所(ruleList.ts の coveredPatternsOf)の単体テスト。
// 実物の検査(上流 0 件)は scripts/structure/proxies/featureGate.test.mjs。実行: pnpm test src/featureGate/checks/integrity.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { describeFeatures } from "@/featureGate/node";
import { coveredPatternsOf } from "@/featureGate/ruleList";
import type { GatedFeatureRule } from "@/featureGate";

import { checkBaseRequires, checkForeignKeys, checkRequiredClosed, sharedDomainsOpen } from "./integrity.mjs";

const rule = (name: string, features: string[] = [], dependsOn: string[] = []) => ({ name, features, dependsOn });
const domain = (folder: string, requires: string[] = [], tables: string[] = [`${folder.split("/").pop()}s`]) => ({ folder, name: folder.split("/").pop()!, requires, tables });
const fk = (from: string, to: string) => ({ from, to });

test("外部キー: 機能をまたぐ外部キーは requires と dependsOn の両方で覆う(どちらかが欠ければ止める)", () => {
  const domains = [domain("core/wallet"), domain("core/purchase", ["wallet"])];
  const foreignKeys = [fk("purchases", "wallets")];
  const ok = checkForeignKeys({ list: [rule("wallet", ["core/wallet"]), rule("payment", ["core/purchase"], ["wallet"])], domains, foreignKeys });
  assert.deepEqual(ok, []);
  const noDep = checkForeignKeys({ list: [rule("wallet", ["core/wallet"]), rule("payment", ["core/purchase"])], domains, foreignKeys });
  assert.match(noDep[0], /外部キー purchases→wallets\(core\/purchase → core\/wallet\): 機能 payment が wallet に dependsOn していない/);
  const noRequires = checkForeignKeys({ list: [rule("wallet", ["core/wallet"]), rule("payment", ["core/purchase"], ["wallet"])], domains: [domain("core/wallet"), domain("core/purchase")], foreignKeys });
  assert.match(noRequires[0], /core\/purchase の requires に wallet が無い/);
  // 推移的な依存で可
  const transitive = checkForeignKeys({ list: [rule("wallet", ["core/wallet"]), rule("pay", [], ["wallet"]), rule("payment", ["core/purchase"], ["pay"])], domains, foreignKeys });
  assert.deepEqual(transitive, []);
});

test("外部キー: 規則の中(一緒に閉じる)・参照先が基盤は対象外、参照元が基盤は止める。例外の表と当たらない行", () => {
  const domains = [domain("sample"), domain("sampleImage"), domain("core/user"), domain("core/log")];
  const inRule = [rule("sampleDomain", ["sample", "sampleImage"])];
  assert.deepEqual(checkForeignKeys({ list: inRule, domains, foreignKeys: [fk("sampleImages", "samples")] }), [], "同じ機能の中");
  assert.deepEqual(checkForeignKeys({ list: inRule, domains, foreignKeys: [fk("samples", "users")] }), [], "参照先は基盤(常に開)");
  const fromBase = checkForeignKeys({ list: inRule, domains: [...domains.slice(0, 2), domain("core/log", ["sample"])], foreignKeys: [fk("logs", "samples")] });
  assert.match(fromBase[0], /core\/log はどの機能にも載らない基盤\(常に開\)/);
  const key = "logs→samples";
  assert.deepEqual(checkForeignKeys({ list: inRule, domains: [...domains.slice(0, 2), domain("core/log", ["sample"])], foreignKeys: [fk("logs", "samples")], exceptions: { [key]: "理由" } }), []);
  assert.match(checkForeignKeys({ list: inRule, domains, foreignKeys: [], exceptions: { [key]: "理由" } })[0], /外部キーの例外 logs→samples はもう当たらない/);
});

test("基盤の requires: どの機能にも載らないドメインが閉じうるドメインを requires すれば止める(基盤どうし・機能に載るドメインは通る)", () => {
  const domains = [domain("core/wallet"), domain("core/report", ["wallet"]), domain("core/audit"), domain("core/log", ["audit"])];
  const problems = checkBaseRequires({ list: [rule("wallet", ["core/wallet"])], domains });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /core\/report はどの機能にも載らない基盤\(常に開\)なのに、閉じうる wallet\(core\/wallet、機能 wallet\)を requires する/);
  assert.deepEqual(checkBaseRequires({ list: [rule("wallet", ["core/wallet", "core/report"])], domains }), []);
});

test("required/ の実効の閉: 必須の機能が規則の値で閉なら止め、閉じた依存先を出す", () => {
  const list = [rule("wallet"), rule("referral", [], ["wallet"]), rule("coupon")];
  const closed = new Set(["wallet", "referral"]);
  const problems = checkRequiredClosed({ list, required: { referral: "中心", coupon: "中心" }, isOpen: (name) => !closed.has(name) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /必須の機能 referral\(src\/featureGate\/required\/referral\.ts\)が規則の値で閉\(閉じた依存先: wallet\)/);
});

test("共有のドメイン: 持つ機能の一部が閉で別の機能で開いたままなら返す(1 つの機能だけのドメイン・全部閉・全部開は返さない)", () => {
  const list = [rule("users", ["core/userTag"]), rule("demoUsers", ["core/userTag"]), rule("wallet", ["core/wallet"])];
  const open = (names: string[]) => (name: string) => names.includes(name);
  assert.deepEqual(sharedDomainsOpen(list, ["core/userTag", "core/wallet"], open(["users"])), [{ folder: "core/userTag", closed: ["demoUsers"], open: ["users"] }]);
  assert.deepEqual(sharedDomainsOpen(list, ["core/userTag"], open([])), []);
  assert.deepEqual(sharedDomainsOpen(list, ["core/userTag"], open(["users", "demoUsers"])), []);
  // features list の説明: 閉じた機能の行に「別の機能で開いたまま」
  const asRule = (name: string, features: string[], enabled: boolean) =>
    ({ name, features, dependsOn: [], pathPatterns: [], tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], enabled: () => enabled }) as unknown as GatedFeatureRule;
  const [users, demoUsers] = describeFeatures([asRule("users", ["core/userTag"], true), asRule("demoUsers", ["core/userTag"], false)], { dependencies: [], callSites: {}, required: {} });
  assert.deepEqual(users.sharedDomainsOpen, []);
  assert.deepEqual(demoUsers.sharedDomainsOpen, [{ folder: "core/userTag", openBy: ["users"] }]);
});

test("規則を閉じれば閉じる住所(評価そのもの): 自分の住所・ドメインの導出の住所・依存元の住所。生成一覧に無い規則は手書きだけ", async () => {
  const { rules } = await import("@/featureGate/node");
  const wallet = rules.find((r) => r.name === "wallet")!;
  const covered = coveredPatternsOf(wallet);
  for (const pattern of ["/wallet", "/api/wallet", "/api/cron/wallet-lots-prune", "/admin/bank-transfer-reviews", "/api/me/coupon-attribution-rewards", "/api/admin/analytics/wallet"]) {
    assert.ok(covered.includes(pattern), `wallet を閉じれば ${pattern} も閉じる`);
  }
  assert.ok(!covered.includes("/admin/coupons"), "依存しない機能の住所は入らない");
  assert.deepEqual(coveredPatternsOf({ name: "noSuch" as never, pathPatterns: ["/x"], features: ["core/wallet"] }), ["/x"]);
});
