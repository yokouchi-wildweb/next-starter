// scripts/structure/extensions/select.test.mjs
// 選ぶ点(D9・D36)の宣言・項目の読み手・生成・止める所(D14)の回帰テスト。一時ディレクトリの fixture で動かす
// (作り物の lib src/lib/kit に口 mail の選ぶ点 mailers、項目 alpha / beta、要る能力を宣言するドメイン)。
// - 宣言: select の形・選ぶ点に書けないキー・export "adapter"・持ち主(lib か常設のドメイン)・backendRequirements の形と置き場
// - 項目: declaration の D29 の鍵・billing(none の同居・usage の unit)・env・adapter の有無・知らない語・語の再定義・予約名・置き場
// - 選択表: 無い・鍵の欠け・余り・知らない値・fake・任意でない口の none・口のどれかの点に項目が無い・requires ↔ provides・開いているドメインの要る能力
// - 生成: 選んだ 1 項目の adapter だけの re-export、none は createNoneAdapter。選ぶ点が 0 個なら選択表を読まない
// 実行: pnpm test scripts/structure/extensions/select.test.mjs

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readBackendDeclaration, readDeclaration } from "../../../src/lib/districtMap/index.mjs";
import { headerFor, planExtensions } from "./extensions.mjs";
import { planSelection } from "./select.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const RESERVED = readFileSync(join(repoRoot, "src/lib/backends/reserved.ts"), "utf8");

/** fork(acme)の一時リポ。予約名の正 src/lib/backends/reserved.ts は本物を写す */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "select-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("repo.json", '{"repo_id": "acme", "tier": "leaf"}\n');
  put(".notices/applied/parent.md", "");
  put("src/lib/CATALOG.md", "## next-starter\n\n## parent\n\n## acme\n");
  put("src/lib/backends/reserved.ts", RESERVED);
  put("src/lib/backends/index.ts", "export {};\n");
  put("src/lib/kit/index.ts", "export {};\n");
  for (const [path, text] of Object.entries(files)) if (text !== null) put(path, text);
  return root;
}

const point = (body) => `export const extensionPoints = {\n${body}\n};\n`;
const SELECT = (extra = "") =>
  `  mailers: { change: "add", plugs: true, export: "adapter", type: { from: "@/lib/kit/points", name: "MailAdapter" }, side: "server", select: { port: "mail", words: ["send", "batch"], compat: { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "beta" }, default: "alpha" }${extra} } },`;
const ITEM = (declaration = `{ provides: ["mail.send"], requires: [], billing: [{ kind: "usage", unit: "message" }], env: { required: ["KEY"] } }`, adapter = true) =>
  `export const declaration = ${declaration};\n${adapter ? "export const adapter = { isConfigured: () => ({ configured: true }) };\n" : ""}`;

/** 基本の木(上書きは files で。null = 置かない) */
const tree = (files = {}) => ({
  "src/lib/kit/extensionPoints.ts": point(SELECT()),
  "src/lib/kit/plugs/mailers/alpha.ts": ITEM(),
  "src/lib/kit/plugs/mailers/beta.ts": ITEM(`{ provides: ["mail.send", "mail.batch"], requires: [], billing: [{ kind: "none" }], env: { required: [] } }`),
  "backend-selection.json": '{ "mail": "alpha" }\n',
  ...files,
});
const plan = (files) => planExtensions(fixture(tree(files)));
const problemsOf = (files) => plan(files).problems;
const hasProblem = (files, pattern) => {
  const problems = problemsOf(files);
  assert.ok(problems.some((p) => pattern.test(p)), `${pattern} が無い:\n${problems.join("\n")}`);
};

test("宣言: select の形・選ぶ点に書けないキー・export は adapter", () => {
  const bad = (body) => readDeclaration("src/lib/kit/extensionPoints.ts", point(body)).problems;
  assert.deepEqual(bad(SELECT()), []);
  assert.match(bad(SELECT(", extra: 1")).join("\n"), /select の未知のキー extra/);
  assert.match(bad(SELECT().replace('words: ["send", "batch"]', "words: []")).join("\n"), /select\.words は能力の語/);
  assert.match(bad(SELECT().replace('words: ["send", "batch"]', 'words: ["send", "send"]')).join("\n"), /同じ語が 2 回/);
  assert.match(bad(SELECT().replace('port: "mail"', 'port: "Mail"')).join("\n"), /select\.port は口の名前/);
  assert.match(bad(SELECT(", optional: 1")).join("\n"), /select\.optional は真偽/);
  assert.match(bad(SELECT().replace('compat: { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "beta" }, default: "alpha" }', 'compat: { from: "env", name: "X" }')).join("\n"), /select\.compat は/);
  assert.deepEqual(bad(SELECT().replace('compat: { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "beta" }, default: "alpha" }', 'compat: { from: "fixed", value: "alpha" }')), []);
  assert.match(bad(SELECT().replace('side: "server",', 'side: "server", target: "wiring",')).join("\n"), /選ぶ点に target は書けない/);
  assert.match(bad(SELECT().replace('export: "adapter"', 'export: "plug"')).join("\n"), /選ぶ点の export は "adapter"/);
  assert.match(bad(SELECT().replace("plugs: true, ", 'dir: "m", ')).join("\n"), /select は plugs の点だけ/);
});

test("宣言: 選ぶ点の持ち主は lib か常設のドメインだけ、backendRequirements はドメインだけで能力の名前の字面", () => {
  hasProblem({ "src/domains/shop/extensionPoints.ts": point(SELECT().replace('"@/lib/kit/points"', '"@/domains/shop/x"').replace("mailers:", "shopMailers:")) }, /選ぶ点 shopMailers を宣言できるのは lib か常設のドメイン/);
  const standing = problemsOf({
    "src/lib/kit/extensionPoints.ts": null,
    "src/lib/kit/plugs/mailers/alpha.ts": null,
    "src/lib/kit/plugs/mailers/beta.ts": null,
    "src/domains/core/auth/extensionPoints.ts": `export const alwaysOpen = true;\n${point(SELECT().replace('"@/lib/kit/points"', '"@/domains/core/auth/x"'))}`,
    "src/domains/core/auth/plugs/mailers/alpha.ts": ITEM(),
  });
  assert.deepEqual(standing, []);
  hasProblem({ "src/lib/other/extensionPoints.ts": 'export const backendRequirements = ["mail.send"];\n', "src/lib/other/index.ts": "export {};\n" }, /backendRequirements\(要る能力\)を宣言できるのはドメインだけ/);
  const read = (text) => readDeclaration("src/domains/shop/extensionPoints.ts", text);
  assert.deepEqual(read('export const backendRequirements = ["mail.send"];\n'), { points: {}, problems: [], backendRequirements: ["mail.send"] });
  assert.match(read('export const backendRequirements = ["mail"];\n').problems[0], /能力の名前 "<口>\.<語>" の文字列の配列/);
  assert.match(read("export const backendRequirements = [WORD];\n").problems[0], /リテラルでない値/);
});

test("項目の宣言: D29 の鍵だけ・全部要る・billing の none は単独・usage は unit・env の形・adapter が要る(読むだけで実行しない)", () => {
  const read = (declaration, adapter = true) => readBackendDeclaration("x.ts", ITEM(declaration, adapter)).problems.join("\n");
  assert.equal(read(`{ provides: ["mail.send"], requires: ["db.read"], billing: [{ kind: "fixed", priceKey: "p" }, { kind: "usage", unit: "message" }], env: { required: ["A"], optional: ["B"] } }`), "");
  assert.match(read(`{ provides: [], requires: [], billing: [{ kind: "fixed" }], env: { required: [] }, version: 1 }`), /未知のキー version/);
  assert.match(read(`{ provides: [], requires: [], env: { required: [] } }`), /billing が無い/);
  assert.match(read(`{ provides: [], requires: [], billing: [{ kind: "none" }, { kind: "fixed" }], env: { required: [] } }`), /"none" は単独だけ/);
  assert.match(read(`{ provides: [], requires: [], billing: [{ kind: "usage" }], env: { required: [] } }`), /"usage" は unit が要る/);
  assert.match(read(`{ provides: [], requires: [], billing: [{ kind: "perSeat" }], env: { required: [] } }`), /kind は none \| fixed/);
  assert.match(read(`{ provides: [], requires: [], billing: [{ kind: "fixed" }], env: { required: "A" } }`), /env は \{ required/);
  assert.match(read(`{ provides: ["send"], requires: [], billing: [{ kind: "fixed" }], env: { required: [] } }`), /provides は能力の名前/);
  assert.match(read(`{ provides: [], requires: [], billing: [{ kind: "fixed" }], env: { required: [] } }`, false), /export const adapter が無い/);
  assert.match(readBackendDeclaration("x.ts", "export const declaration = make();\nexport const adapter = 1;\n").problems[0], /リテラルでない値/);
});

test("生成: 選んだ 1 項目の adapter だけを re-export、none は組み込みの none の adapter。実際の木の選ぶ点は 0 個で何も書かない", () => {
  const ok = plan({});
  assert.deepEqual(ok.problems, []);
  const out = ok.outputs["src/lib/kit/extensions/mailers.ts"];
  assert.equal(out.split("\n")[0], headerFor("src/lib/kit/extensionPoints.ts・backend-selection.json"));
  assert.match(out, /^export \{ adapter \} from "@\/lib\/kit\/plugs\/mailers\/alpha";$/m);
  assert.doesNotMatch(out, /beta/);
  const none = plan({ "src/lib/kit/extensionPoints.ts": point(SELECT(", optional: true")), "backend-selection.json": '{ "mail": "none" }\n' });
  assert.deepEqual(none.problems, []);
  const noneOut = none.outputs["src/lib/kit/extensions/mailers.ts"];
  assert.match(noneOut, /import \{ createNoneAdapter \} from "@\/lib\/backends";/);
  assert.match(noneOut, /import type \{ MailAdapter \} from "@\/lib\/kit\/points";/);
  assert.match(noneOut, /export const adapter = createNoneAdapter<MailAdapter>\("mail"\);/);
  // 選ぶ点が 0 個: 選択表が無くても止めず、何も書かない
  const empty = planExtensions(fixture({}));
  assert.deepEqual(empty.problems, []);
  assert.ok(!Object.keys(empty.outputs).some((p) => p.includes("mailers")));
});

test("止める: 選択表が無い・鍵の欠け・余り・知らない値・fake・任意でない口の none(直し方の命令を示す)", () => {
  hasProblem({ "backend-selection.json": null }, /backend-selection\.json が無い.*pnpm workflow backend-selection fill/);
  hasProblem({ "backend-selection.json": "{}\n" }, /口 mail の鍵が無い.*pnpm workflow backend-selection fill/);
  hasProblem({ "backend-selection.json": '{ "mail": "alpha", "sms": "x" }\n' }, /鍵 sms は知らない口/);
  hasProblem({ "backend-selection.json": '{ "mail": "gamma" }\n' }, /"gamma" は知らない実装\(在る名前: alpha, beta.*pnpm workflow backend-selection set/);
  hasProblem({ "backend-selection.json": '{ "mail": "fake" }\n' }, /"fake" は選べない/);
  hasProblem({ "backend-selection.json": '{ "mail": "none" }\n' }, /口 mail は任意でない.*"none" は選べない/);
  hasProblem({ "backend-selection.json": '{ "mail": 1 }\n' }, /口 mail の値は実装の名前の文字列/);
  hasProblem({ "backend-selection.json": "{ mail\n" }, /JSON として読めない/);
});

test("止める: 口のどれかの点に項目が無い・点の optional が揃わない", () => {
  const second = `  mailHooks: { change: "add", plugs: true, export: "adapter", type: { from: "@/lib/kit2/points", name: "H" }, side: "server", select: { port: "mail", words: ["hook"], compat: { from: "fixed", value: "alpha" }, optional: true } },`;
  const problems = problemsOf({ "src/lib/kit2/extensionPoints.ts": point(second), "src/lib/kit2/index.ts": "export {};\n", "src/lib/kit2/plugs/mailHooks/beta.ts": ITEM() });
  assert.ok(problems.some((p) => /口 mail の点 mailHooks に項目 "alpha" が無い/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => /select\.optional が揃っていない/.test(p)), problems.join("\n"));
});

test("止める: 知らない語・ほかの口の provides・語の再定義・予約名の項目・置き場・.default / .replace", () => {
  hasProblem({ "src/lib/kit/plugs/mailers/alpha.ts": ITEM(`{ provides: ["mail.fax"], requires: [], billing: [{ kind: "fixed" }], env: { required: [] } }`) }, /provides の mail\.fax は知らない語/);
  hasProblem({ "src/lib/kit/plugs/mailers/alpha.ts": ITEM(`{ provides: ["sms.send"], requires: [], billing: [{ kind: "fixed" }], env: { required: [] } }`) }, /provides の sms\.send は口 mail の能力でない/);
  hasProblem({ "src/lib/kit/plugs/mailers/alpha.ts": ITEM(`{ provides: ["mail.send"], requires: ["db.read"], billing: [{ kind: "fixed" }], env: { required: [] } }`) }, /requires の db\.read は知らない能力/);
  const caps = `  backendCapabilities: { change: "add", plugs: true, export: "capabilities", type: { from: "@/lib/backends/points", name: "BackendCapabilityItem" }, side: "server", pureImports: true, target: "wiring" },`;
  // fork の語を足すと provides に書ける / 既にある語は再定義で止まる / 在らない口は止まる
  const withWord = plan({
    "src/lib/backends/extensionPoints.ts": point(caps),
    "src/lib/mine/index.ts": "export {};\n",
    "src/lib/mine/plugs/backendCapabilities/fax.ts": 'export const capabilities = { port: "mail", words: ["fax"] };\n',
    "src/lib/kit/plugs/mailers/alpha.ts": ITEM(`{ provides: ["mail.fax"], requires: [], billing: [{ kind: "fixed" }], env: { required: [] } }`),
  });
  assert.deepEqual(withWord.problems, []);
  hasProblem({ "src/lib/backends/extensionPoints.ts": point(caps), "src/lib/mine/index.ts": "export {};\n", "src/lib/mine/plugs/backendCapabilities/again.ts": 'export const capabilities = { port: "mail", words: ["send"] };\n' }, /能力の語 mail\.send は 選ぶ点 mail で定まっている/);
  hasProblem({ "src/lib/backends/extensionPoints.ts": point(caps), "src/lib/mine/index.ts": "export {};\n", "src/lib/mine/plugs/backendCapabilities/sms.ts": 'export const capabilities = { port: "sms", words: ["send"] };\n' }, /口 sms は選ぶ点に無い/);
  hasProblem({ "src/lib/kit/plugs/mailers/fake.ts": ITEM() }, /項目の名前 fake は予約/);
  hasProblem({ "src/lib/kit/plugs/mailers/none.ts": ITEM() }, /項目の名前 none は予約/);
  hasProblem({ "src/domains/shop/plugs/mailers/gamma.ts": ITEM() }, /項目は lib にだけ置ける/);
  hasProblem({ "src/lib/kit/extensions/mailers.replace.ts": "export {};\n" }, /選ぶ点 mailers に \.replace は置けない/);
  hasProblem({ "src/lib/kit/plugs/mailers/alpha.ts": ITEM(undefined, false) }, /export const adapter が無い/);
});

test("止める: 選んだ実装の requires を選択表のどの実装も出さない", () => {
  const other = `  stores: { change: "add", plugs: true, export: "adapter", type: { from: "@/lib/kit3/points", name: "S" }, side: "server", select: { port: "store", words: ["read"], compat: { from: "fixed", value: "disk" }, optional: true } },`;
  const files = {
    "src/lib/kit3/extensionPoints.ts": point(other),
    "src/lib/kit3/index.ts": "export {};\n",
    "src/lib/kit3/plugs/stores/disk.ts": ITEM(`{ provides: ["store.read"], requires: [], billing: [{ kind: "fixed" }], env: { required: [] } }`),
    "src/lib/kit/plugs/mailers/alpha.ts": ITEM(`{ provides: ["mail.send"], requires: ["store.read"], billing: [{ kind: "fixed" }], env: { required: [] } }`),
  };
  assert.deepEqual(problemsOf({ ...files, "backend-selection.json": '{ "mail": "alpha", "store": "disk" }\n' }), []);
  hasProblem({ ...files, "backend-selection.json": '{ "mail": "alpha", "store": "none" }\n' }, /requires の store\.read を選択表のどの実装も出さない/);
});

test("開いているドメインの backendRequirements: 常設・開いた規則に載るドメインだけ数え、どの規則にも載らない常設でないドメインと閉じた規則のドメインは数えない", () => {
  const root = fixture(tree());
  const base = planExtensions(root);
  const kit = base.points.find((p) => p.name === "mailers");
  const run = (requirements, { alwaysOpen = [], gateDomains = [], states = {} } = {}) =>
    planSelection({
      repoRoot: root,
      points: base.points,
      itemsByPoint: base.itemsByPoint,
      alwaysOpen,
      backendRequirements: requirements,
      gateDomains,
      headerFor,
      featureStates: () => ({ states }),
    }).problems;
  const needs = (domain) => [{ domain, declaredIn: `${domain}/extensionPoints.ts`, requires: ["mail.batch"] }];
  assert.ok(kit);
  // alpha は mail.batch を出さない
  assert.match(run(needs("src/domains/core/auth"), { alwaysOpen: ["src/domains/core/auth"] }).join("\n"), /開いているドメインが要る mail\.batch/);
  assert.match(run(needs("src/domains/shop"), { gateDomains: [{ folder: "shop", features: ["shop"] }], states: { shop: true } }).join("\n"), /開いているドメインが要る mail\.batch/);
  assert.deepEqual(run(needs("src/domains/shop"), { gateDomains: [{ folder: "shop", features: ["shop"] }], states: { shop: false } }), []);
  assert.deepEqual(run(needs("src/domains/shop")), [], "どの規則にも載らず常設でもないドメインは閉");
  // 開閉が読めなければ止める
  const unreadable = planSelection({ repoRoot: root, points: base.points, itemsByPoint: base.itemsByPoint, alwaysOpen: [], backendRequirements: needs("src/domains/shop"), gateDomains: [{ folder: "shop", features: ["shop"] }], headerFor, featureStates: () => ({ problem: "機能の開閉が読めない" }) });
  assert.match(unreadable.problems.join("\n"), /機能の開閉が読めない/);
  // 知らない能力は開閉に関わらず止める
  assert.match(run([{ domain: "src/domains/shop", declaredIn: "src/domains/shop/extensionPoints.ts", requires: ["mail.fax"] }]).join("\n"), /backendRequirements の mail\.fax は知らない能力/);
});
