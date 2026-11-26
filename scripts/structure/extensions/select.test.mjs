// scripts/structure/extensions/select.test.mjs
// 選ぶ点(D9・D36)の宣言・項目の読み手・生成・止める所(D14)の回帰テスト。一時ディレクトリの fixture で動かす
// (作り物の lib src/lib/kit に口 mail の選ぶ点 mailers、項目 alpha / beta、要る能力を宣言するドメイン)。
// - 宣言: select の形・選ぶ点に書けないキー・export "adapter"・持ち主(lib か常設のドメイン)・backendRequirements の形と置き場
// - 項目: declaration の D29 の鍵・billing(none の同居・usage の unit)・env・adapter の有無・知らない語・語の再定義・予約名・置き場
// - 選択表: 無い・鍵の欠け・余り・知らない値・fake・任意でない口の none・口のどれかの点に項目が無い・requires ↔ provides・開いているドメインの要る能力・
//   選んだ実装の requiresFeatures(閉・知らない・読めない → 止める、選ばれていない実装のは読まない)
// - 生成: 選んだ 1 項目の adapter だけの re-export、none は createNoneAdapter。選ぶ点が 0 個なら選択表を読まない
// - 起動時の知らせ: startup.ts の一覧に選ぶ点ごとの 1 行(持ち主の公開の入口の <点>BackendStatus を NEXT_RUNTIME が nodejs の時だけ読む、D49)
// - 選択に問題がある時: ほかの一覧は書き、選ぶ点の生成物は残し、検査は古いと数えない(写しの通しの F2・F3)
// 実行: pnpm test scripts/structure/extensions/select.test.mjs

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readBackendDeclaration, readDeclaration } from "../../../src/lib/districtMap/index.mjs";
import { headerFor, heldSelectionPaths, planExtensions, strayExtensionFiles, writeExtensions } from "./extensions.mjs";
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

test("項目の宣言: 任意の requiresFeatures は機能の名前の配列(省略 = 空)、形違い・名前違い・重なりは止める", () => {
  const decl = (extra) => `{ provides: [], requires: [], billing: [{ kind: "fixed" }], env: { required: [] }${extra} }`;
  const read = (extra) => readBackendDeclaration("x.ts", ITEM(decl(extra)));
  assert.deepEqual(read("").declaration?.requiresFeatures, [], "省略 = 空");
  const ok = read(`, requiresFeatures: ["outbox", "pairedDevice"]`);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.declaration?.requiresFeatures, ["outbox", "pairedDevice"]);
  assert.match(read(`, requiresFeatures: "outbox"`).problems.join("\n"), /requiresFeatures は機能の名前/);
  assert.match(read(`, requiresFeatures: ["out-box"]`).problems.join("\n"), /requiresFeatures は機能の名前/);
  assert.match(read(`, requiresFeatures: ["outbox", "outbox"]`).problems.join("\n"), /requiresFeatures に同じ機能が 2 回ある/);
  assert.match(read(`, features: ["outbox"]`).problems.join("\n"), /未知のキー features/);
});

test("生成: 選んだ 1 項目の adapter だけを re-export、none は組み込みの none の adapter。実際の木の選ぶ点は 0 個で何も書かない", () => {
  const ok = plan({});
  assert.deepEqual(ok.problems, []);
  const out = ok.outputs["src/lib/kit/extensions/mailers.ts"];
  assert.equal(out.split("\n")[0], headerFor("src/lib/kit/extensionPoints.ts・backend-selection.json"));
  // 持ち主の中の項目は相対(閉じた lib の単体の tsconfig は自分の @/lib/<名前> を解かない)
  assert.match(out, /^export \{ adapter \} from "\.\.\/plugs\/mailers\/alpha";$/m);
  assert.match(out, /^export const selected = "alpha" as const;$/m);
  assert.match(out, /^export const compat = \{"from":"env","name":"MAIL_PROVIDER","map":\{"sendgrid":"beta"\},"default":"alpha"\} as const;$/m);
  assert.doesNotMatch(out, /plugs\/mailers\/beta/, "選ばない実装は読まない");
  const none = plan({ "src/lib/kit/extensionPoints.ts": point(SELECT(", optional: true")), "backend-selection.json": '{ "mail": "none" }\n' });
  assert.deepEqual(none.problems, []);
  const noneOut = none.outputs["src/lib/kit/extensions/mailers.ts"];
  assert.match(noneOut, /import \{ createNoneAdapter \} from "@\/lib\/backends";/);
  assert.match(noneOut, /import type \{ MailAdapter \} from "\.\.\/points";/);
  assert.match(noneOut, /^export const selected = "none" as const;$/m);
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

/** env PHASE と env を 1 回だけ差し替えて plan を回す(元に戻す) */
function withEnv(vars, run) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
  else process.env[k] = v;
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

test("env の食い違い(段 build・ship): compat で写した名前が選択と違えば止め(値は出さない)、知らない値は default、段の無い生成では見ない", () => {
  const stop = /口 mail は "alpha" を選ぶが、env MAIL_PROVIDER は "beta" を指す\(段 (build|ship)。直す: pnpm workflow backend-selection set mail beta か、env MAIL_PROVIDER を消す\)/;
  for (const phase of ["build", "ship"]) {
    const problems = withEnv({ PHASE: phase, MAIL_PROVIDER: " sendgrid " }, () => problemsOf({}));
    assert.ok(problems.some((p) => stop.test(p)), problems.join("\n"));
    assert.ok(!problems.some((p) => p.includes("sendgrid")), "env の値は出さない");
  }
  // 知らない値 = default(alpha)= 選択と同じ → 通る / 選択が beta なら止める(値は出さない)
  assert.deepEqual(withEnv({ PHASE: "build", MAIL_PROVIDER: "smtp-x" }, () => problemsOf({})), []);
  const other = withEnv({ PHASE: "build", MAIL_PROVIDER: "smtp-x" }, () => problemsOf({ "backend-selection.json": '{ "mail": "beta" }\n' }));
  assert.match(other.join("\n"), /口 mail は "beta" を選ぶが、env MAIL_PROVIDER は "alpha" を指す/);
  assert.doesNotMatch(other.join("\n"), /smtp-x/);
  // 空・無い・同じ = 通る。段の無い生成(pnpm generate extensions・backend-selection の命令)と build:post は見ない
  assert.deepEqual(withEnv({ PHASE: "build", MAIL_PROVIDER: "  " }, () => problemsOf({})), []);
  assert.deepEqual(withEnv({ PHASE: "build", MAIL_PROVIDER: undefined }, () => problemsOf({})), []);
  assert.deepEqual(withEnv({ PHASE: "ship", MAIL_PROVIDER: "sendgrid" }, () => problemsOf({ "backend-selection.json": '{ "mail": "beta" }\n' })), []);
  for (const phase of [undefined, "-", "build:post", "forge:post"]) assert.deepEqual(withEnv({ PHASE: phase, MAIL_PROVIDER: "sendgrid" }, () => problemsOf({})), []);
  // compat が fixed の口は env を見ない
  const fixed = SELECT().replace('compat: { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "beta" }, default: "alpha" }', 'compat: { from: "fixed", value: "alpha" }');
  assert.deepEqual(withEnv({ PHASE: "build", MAIL_PROVIDER: "sendgrid" }, () => problemsOf({ "src/lib/kit/extensionPoints.ts": point(fixed) })), []);
});

test("env の欠け(段 build だけ、止めない): 選んだ実装の env.required の無い名前を 1 行、runner が外す名前(OFFLINE_ENV)と ship は見ない", () => {
  const warningsOf = (vars, files = {}) => withEnv({ MAIL_PROVIDER: undefined, ...vars }, () => plan(files)).warnings.filter((w) => w.startsWith("口 mail"));
  const line = warningsOf({ PHASE: "build", KEY: undefined });
  assert.deepEqual(line, ['口 mail の選んだ実装 "alpha"(src/lib/kit/plugs/mailers/alpha.ts)の env が無い: KEY(段 build。止めない)']);
  assert.deepEqual(warningsOf({ PHASE: "build", KEY: "x" }), []);
  assert.ok(!warningsOf({ PHASE: "build", KEY: "secret-value" }).join("").includes("secret-value"));
  assert.deepEqual(warningsOf({ PHASE: "ship", KEY: undefined }), []);
  assert.deepEqual(warningsOf({ PHASE: undefined, KEY: undefined }), []);
  // OFFLINE_ENV の名前(RESEND_*)は build で外されて見えないので数えない
  const offline = ITEM(`{ provides: ["mail.send"], requires: [], billing: [{ kind: "none" }], env: { required: ["RESEND_API_KEY", "KEY"] } }`);
  assert.deepEqual(warningsOf({ PHASE: "build", KEY: "x", RESEND_API_KEY: undefined }, { "src/lib/kit/plugs/mailers/alpha.ts": offline }), []);
  // 止めない
  assert.deepEqual(withEnv({ PHASE: "build", KEY: undefined, MAIL_PROVIDER: undefined }, () => problemsOf({})), []);
});

test("起動時の知らせ(D49): 点 startupTasks が在れば選ぶ点ごとに一覧 src/wiring/startup.ts へ 1 行(項目のファイルは作らない)、持ち主の入口が <点>BackendStatus を出さなければ止める", () => {
  const STARTUP = {
    "src/lib/startup/extensionPoints.ts": point('  startupTasks: { change: "add", plugs: true, export: "task", type: { from: "@/lib/startup/points", name: "StartupTask" }, side: "server", load: "lazy", target: "wiring" },'),
    "src/lib/startup/points.ts": "export type StartupTask = { name: string; run: () => void };\n",
    "src/lib/startup/index.ts": "export {};\n",
    "src/lib/kit/index.ts": 'export { mailersBackendStatus } from "./backendStatus";\n',
  };
  const out = withEnv({ PHASE: undefined, MAIL_PROVIDER: undefined }, () => plan(STARTUP));
  assert.deepEqual(out.problems, []);
  assert.ok(!Object.keys(out.outputs).some((p) => p.includes("plugs/startupTasks")), "項目のファイルは生成しない");
  const startup = out.outputs["src/wiring/startup.ts"];
  assert.ok(
    startup.includes(
      '{ domain: null, name: "mailersBackendStatus", requires: [], load: async () => { if (process.env.NEXT_RUNTIME === "nodejs") { const { createBackendStatusTask } = await import("@/lib/backends"); const { mailersBackendStatus } = await import("@/lib/kit"); return createBackendStatusTask(mailersBackendStatus); } return { name: "backends.mail", runtime: "nodejs", run: () => {} }; } },',
    ),
    startup,
  );
  assert.ok(!/\.then\(/.test(startup.split("\n").find((l) => l.includes("mailersBackendStatus")) ?? ""), "名前つきの dynamic import だけ(mail-send-via-messaging)");
  // 持ち主の入口は nodejs の条件の中だけで読む(edge の束に送る処理・node:* を入れない、注文 20261125-195321)
  const line = startup.split("\n").find((l) => l.includes("mailersBackendStatus")) ?? "";
  assert.ok(line.indexOf('process.env.NEXT_RUNTIME === "nodejs"') < line.indexOf('import("@/lib/kit")'), line);
  // lib が "./server" を宣言していればそちらから読む
  const server = withEnv({ PHASE: undefined, MAIL_PROVIDER: undefined }, () =>
    plan({ ...STARTUP, "src/lib/kit/index.ts": "export {};\n", "src/lib/kit/server.ts": "export const mailersBackendStatus = {};\n", "src/lib/kit/package.json": '{ "exports": { ".": "./index.ts", "./server": "./server.ts" } }\n' }),
  );
  assert.deepEqual(server.problems, []);
  assert.match(server.outputs["src/wiring/startup.ts"], /await import\("@\/lib\/kit\/server"\)/);
  // 入口が出さない → 止める
  hasProblem({ ...STARTUP, "src/lib/kit/index.ts": "export {};\n" }, /選ぶ点 mailers の持ち主の公開の入口 @\/lib\/kit\(src\/lib\/kit\/index\.ts\)が mailersBackendStatus を出さない/);
  // 選択表に問題がある間も行は変わらない(選択表に左右されない)
  const broken = withEnv({ PHASE: undefined, MAIL_PROVIDER: undefined }, () => plan({ ...STARTUP, "backend-selection.json": "{}\n" }));
  assert.ok(broken.problems.some((p) => /口 mail の鍵が無い/.test(p)));
  assert.match(broken.outputs["src/wiring/startup.ts"], /name: "mailersBackendStatus"/);
  // 点 startupTasks が無い木では足さない
  assert.ok(!Object.values(plan({}).outputs).some((text) => text.includes("BackendStatus")));
});

test("選択に問題がある時(F2・F3): 生成は選ぶ点でない一覧を書き(startup.ts にフォークの項目と起動時の知らせの行の両方)、選ぶ点の生成物は残して止まる。検査はそれを古いと数えない", () => {
  const STARTUP = {
    "src/lib/startup/extensionPoints.ts": point('  startupTasks: { change: "add", plugs: true, export: "task", type: { from: "@/lib/startup/points", name: "StartupTask" }, side: "server", load: "lazy", target: "wiring" },'),
    "src/lib/startup/points.ts": "export type StartupTask = { name: string; run: () => void };\n",
    "src/lib/startup/index.ts": "export {};\n",
    "src/lib/kit/index.ts": 'export { mailersBackendStatus } from "./backendStatus";\n',
    "src/lib/own/index.ts": "export {};\n",
    "src/lib/own/plugs/startupTasks/ownFlush.ts": "export const task = { name: \"ownFlush\", run() {} };\n",
  };
  // 正しい表で一度生成してディスクに置く(選ぶ点の生成物と一覧)
  const root = fixture(tree(STARTUP));
  const first = withEnv({ PHASE: undefined, MAIL_PROVIDER: undefined }, () => writeExtensions(root));
  assert.equal(first.code, 0, first.err.join("\n"));
  const selectionFiles = ["src/lib/kit/extensions/mailers.ts"];
  const before = selectionFiles.map((f) => readFileSync(join(root, f), "utf8"));
  // F2: 表の鍵が欠けた(取り込みの直後の {})。startup.ts を消しておき、選ぶ点でない一覧が書かれるかを見る
  writeFileSync(join(root, "backend-selection.json"), "{}\n");
  rmSync(join(root, "src/wiring/startup.ts"));
  const held = withEnv({ PHASE: undefined, MAIL_PROVIDER: undefined }, () => writeExtensions(root));
  assert.equal(held.code, 1);
  assert.match(held.err.join("\n"), /選ぶ点の生成物は書いていない[\s\S]*口 mail の鍵が無い/);
  const startup = readFileSync(join(root, "src/wiring/startup.ts"), "utf8");
  assert.match(startup, /name: "mailersBackendStatus"/);
  assert.match(startup, /name: "ownFlush"/);
  assert.deepEqual(selectionFiles.map((f) => readFileSync(join(root, f), "utf8")), before, "選ぶ点の生成物は今のまま");
  // 選ぶ点でない問題があれば何も書かない(今どおり)
  writeFileSync(join(root, "src/lib/own/plugs/startupTasks/broken.ts"), "export const nothing = 1;\n");
  rmSync(join(root, "src/wiring/startup.ts"));
  const stopped = withEnv({ PHASE: undefined }, () => writeExtensions(root));
  assert.equal(stopped.code, 1);
  assert.match(stopped.err.join("\n"), /書き出しを止めました/);
  assert.ok(!existsSync(join(root, "src/wiring/startup.ts")));
  rmSync(join(root, "src/lib/own/plugs/startupTasks/broken.ts"));
  // F3: build の段の食い違い(表 alpha、env は beta)→ 選ぶ点の生成物を古いと数えない。問題が無ければ今どおり
  writeFileSync(join(root, "backend-selection.json"), '{ "mail": "alpha" }\n');
  const mismatch = withEnv({ PHASE: "build", MAIL_PROVIDER: "sendgrid" }, () => planExtensions(root));
  assert.ok(mismatch.problems.some((p) => /env MAIL_PROVIDER は "beta" を指す/.test(p)));
  assert.deepEqual(heldSelectionPaths(mismatch), selectionFiles);
  const strays = strayExtensionFiles(root, mismatch.outputs, mismatch.points, heldSelectionPaths(mismatch)).map((s) => s.path);
  for (const f of selectionFiles) assert.ok(!strays.includes(f), `${f} を古いと数えない`);
  const clean = withEnv({ PHASE: undefined, MAIL_PROVIDER: undefined }, () => planExtensions(root));
  assert.deepEqual(heldSelectionPaths(clean), []);
});

test("選んだ実装の requiresFeatures: 開なら通り、閉・知らない名前・開閉が読めなければ直し方つきで止め、選ばれていない実装のは読まない", () => {
  const BETA_NEEDS = ITEM(`{ provides: ["mail.send", "mail.batch"], requires: [], billing: [{ kind: "none" }], env: { required: [] }, requiresFeatures: ["outbox"] }`);
  const run = (selection, states, { reads } = { reads: [] }) => {
    // 生成の全体(planExtensions)は選択表 alpha で読む(beta を選ぶと本物の機能の開閉を子プロセスで読みに行くため)、その後で選択表を差し替える
    const root = fixture(tree({ "src/lib/kit/plugs/mailers/beta.ts": BETA_NEEDS }));
    const base = planExtensions(root);
    writeFileSync(join(root, "backend-selection.json"), selection);
    return planSelection({
      repoRoot: root,
      points: base.points,
      itemsByPoint: base.itemsByPoint,
      alwaysOpen: [],
      backendRequirements: [],
      gateDomains: [],
      headerFor,
      featureStates: () => {
        reads.push(1);
        return typeof states === "string" ? { problem: states } : { states };
      },
    }).problems;
  };
  const beta = '{ "mail": "beta" }\n';
  assert.deepEqual(run(beta, { outbox: true }), []);
  const closed = run(beta, { outbox: false }).join("\n");
  assert.match(closed, /src\/lib\/kit\/plugs\/mailers\/beta\.ts: 口 mail の選んだ実装 "beta" は機能 outbox が開いていないと動かない/);
  assert.match(closed, /pnpm ops features set outbox on/);
  assert.match(closed, /pnpm workflow backend-selection set mail <alpha>/);
  assert.match(run(beta, { other: true }).join("\n"), /requiresFeatures の outbox は知らない機能/);
  assert.match(run(beta, "機能の開閉が読めない(テスト)").join("\n"), /機能の開閉が読めない\(テスト\)/);

  const reads = [];
  assert.deepEqual(run('{ "mail": "alpha" }\n', { outbox: false }, { reads }), [], "選ばれていない beta の requiresFeatures は読まない");
  assert.equal(reads.length, 0, "要る所が無ければ機能の開閉を読まない");
});
