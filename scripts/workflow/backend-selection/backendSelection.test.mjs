// scripts/workflow/backend-selection/backendSelection.test.mjs — pnpm workflow backend-selection(fill / set / show)。一時のフォルダだけに書く
// 作り物の lib src/lib/kit に口 mail の選ぶ点(compat = env MAIL_PROVIDER、map { sendgrid: "beta" }、default "alpha")、項目 alpha / beta。
// 生成(pnpm generate extensions)は差し替えて呼ばれた回数だけ数える
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { BackendSelectionError, fill, nameFromCompat, parseEnvFile, productionLine, setSelection, show } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESERVED = readFileSync(path.join(HERE, "../../../src/lib/backends/reserved.ts"), "utf8");
const made = [];
after(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

const SELECT = (extra = "") =>
  `export const extensionPoints = {\n  mailers: { change: "add", plugs: true, export: "adapter", type: { from: "@/lib/kit/points", name: "MailAdapter" }, side: "server", select: { port: "mail", words: ["send"], compat: { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "beta", resend: "alpha" }, default: "alpha" }${extra} } },\n};\n`;
const ITEM = (env) => `export const declaration = { provides: ["mail.send"], requires: [], billing: [{ kind: "fixed" }], env: { required: ${JSON.stringify(env)} } };\nexport const adapter = { isConfigured: () => ({ configured: true }) };\n`;

/** 台帳の行(.notices/applied/<repo_id>.md の形) */
const LEDGER_LINE = (id) => `- id:${id} | date:2026-11-24T00:00:00Z | commit:- | notes:-\n`;
const LEDGER = `# APPLIED LEDGER fork:acme\n${LEDGER_LINE("20261122-180722-district-stage1")}${LEDGER_LINE("20261124-033209-flux-rebuild")}`;

/** 一時のリポ(fork acme の台帳)。files の null = 置かない */
function repo(files = {}, { tier = "leaf", ledger = LEDGER } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "backend-selection-"));
  made.push(root);
  const put = (p, text) => {
    mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    writeFileSync(path.join(root, p), text);
  };
  const base = {
    "repo.json": tier === "root" ? '{"repo_id": "next-starter", "tier": "root"}\n' : '{"repo_id": "acme", "tier": "leaf"}\n',
    "src/lib/CATALOG.md": tier === "root" ? "## next-starter\n" : "## next-starter\n\n## acme\n",
    "src/domains/README.md": "x\n",
    "src/lib/backends/reserved.ts": RESERVED,
    "src/lib/backends/index.ts": "export {};\n",
    "src/lib/kit/index.ts": "export {};\n",
    "src/lib/kit/extensionPoints.ts": SELECT(),
    "src/lib/kit/plugs/mailers/alpha.ts": ITEM(["RESEND_API_KEY"]),
    "src/lib/kit/plugs/mailers/beta.ts": ITEM(["SENDGRID_API_KEY"]),
    ...(tier === "root" ? {} : { ".notices/applied/acme.md": ledger }),
    ...files,
  };
  for (const [p, text] of Object.entries(base)) if (text !== null) put(p, text);
  return root;
}
const table = (root) => JSON.parse(readFileSync(path.join(root, "backend-selection.json"), "utf8"));
const run = (root, fn) => {
  const lines = [];
  let generated = 0;
  const result = fn({ generate: () => generated++, log: (l) => lines.push(l) });
  return { result, lines, generated, out: lines.join("\n") };
};

test("env のファイルの読み方: 注記・空行・export・引用符", () => {
  const values = parseEnvFile('# c\n\nexport A=1\nB="two words"\nC=\'x\'\nD=v # note\n');
  assert.deepEqual([...values.entries()], [["A", "1"], ["B", "two words"], ["C", "x"], ["D", "v"]]);
});

test("compat: map の鍵 → 名前、未設定 → default、map に無い値は止める(default に落とさない)、ファイルの間で名前が違えば止める、fixed は値", () => {
  const compat = { from: "env", name: "MAIL_PROVIDER", map: { sendgrid: "beta", resend: "alpha" }, default: "alpha" };
  const files = (...vs) => vs.map((v, i) => ({ file: `f${i}`, values: new Map(v === null ? [] : [["MAIL_PROVIDER", v]]) }));
  assert.deepEqual(nameFromCompat(compat, files("sendgrid", "sendgrid")), { name: "beta" });
  assert.deepEqual(nameFromCompat(compat, files(null, "resend")), { name: "alpha" }, "未設定(default)と resend は同じ名前なので通る");
  assert.deepEqual(nameFromCompat(compat, []), { name: "alpha" });
  assert.match(nameFromCompat(compat, files("smtp")).problem, /f0 の MAIL_PROVIDER の値が compat\.map\(sendgrid, resend\)のどれでもない/);
  assert.doesNotMatch(nameFromCompat(compat, files("smtp")).problem, /smtp/, "env の値は出さない");
  assert.match(nameFromCompat(compat, files("sendgrid", null)).problem, /ファイルの間で違う\(f0 → beta \/ f1 → alpha\)/);
  assert.deepEqual(nameFromCompat({ from: "fixed", value: "alpha" }, files("sendgrid")), { name: "alpha" });
  assert.equal(productionLine(compat, "alpha"), "本番(Vercel)の MAIL_PROVIDER が resend か 未設定 か確かめる(違えば build が止まる)");
  assert.equal(productionLine(compat, "beta"), "本番(Vercel)の MAIL_PROVIDER が sendgrid か確かめる(違えば build が止まる)");
});

test("fill: 表が無ければ作り、足りない鍵を compat で書いて生成し、本番の確かめの行を出す。2 回目は何も書かず生成もしない", () => {
  const root = repo({ ".env.development": "MAIL_PROVIDER=sendgrid\nSENDGRID_API_KEY=secret-value\n", ".env.production": "MAIL_PROVIDER=sendgrid\n" });
  const first = run(root, (o) => fill(root, o));
  assert.deepEqual(table(root), { mail: "beta" });
  assert.equal(first.generated, 1);
  assert.match(first.out, /backend-selection\.json: mail = beta/);
  assert.match(first.out, /本番\(Vercel\)の MAIL_PROVIDER が sendgrid か確かめる/);
  assert.doesNotMatch(first.out, /secret-value/);
  const text = readFileSync(path.join(root, "backend-selection.json"), "utf8");
  const second = run(root, (o) => fill(root, o));
  assert.equal(second.generated, 0);
  assert.equal(readFileSync(path.join(root, "backend-selection.json"), "utf8"), text);
  assert.match(second.out, /足りない鍵は無い/);
});

test("fill: 選ぶ点が 0 個なら {} を作るだけ。決められない口は書かずに聞く文と set の命令", () => {
  const empty = repo({ "src/lib/kit/extensionPoints.ts": null, "src/lib/kit/plugs/mailers/alpha.ts": null, "src/lib/kit/plugs/mailers/beta.ts": null });
  run(empty, (o) => fill(empty, o));
  assert.deepEqual(table(empty), {});
  const torn = repo({ ".env": "MAIL_PROVIDER=sendgrid\n", ".env.production": "MAIL_PROVIDER=resend\n", "backend-selection.json": "{}\n" });
  const r = run(torn, (o) => fill(torn, o));
  assert.equal(r.result.questions.length, 1);
  assert.match(r.out, /口 mail: MAIL_PROVIDER から読む実装がファイルの間で違う.*pnpm workflow backend-selection set mail <名前>\(選べる名前: alpha, beta\)/);
  assert.deepEqual(table(torn), {});
  assert.equal(r.generated, 0);
});

test("fill の前提: 台帳に改名の区切り・棚 05 S2 の notice の行が無ければ足りない最初の区切りを名指して止める、Tier1 は台帳を見ない", () => {
  const quiet = { generate: () => {}, log: () => {} };
  const stop = (ledger) => () => fill(repo({}, { ledger }), quiet);
  assert.throws(stop(LEDGER_LINE("20261124-033209-flux-rebuild")), (e) => e instanceof BackendSelectionError && /台帳 \.notices\/applied\/acme\.md に 20261122-180722-district-stage1 が無い。先に区切り district-stage1/.test(e.message));
  assert.throws(stop(LEDGER_LINE("20261122-180722-district-stage1")), /20261124-033209-flux-rebuild が無い。先に区切り flux-rebuild/);
  // 後追いの notice(別の id)だけでは足りない。台帳が無ければ最初の区切り
  assert.throws(stop(`${LEDGER_LINE("20261122-211722-district-stage1-base-arg")}${LEDGER_LINE("20261124-033209-flux-rebuild")}`), /区切り district-stage1/);
  assert.throws(() => fill(repo({ ".notices/applied/acme.md": null }), quiet), /区切り district-stage1/);
  const ok = repo();
  run(ok, (o) => fill(ok, o));
  assert.deepEqual(table(ok), { mail: "alpha" });
  const tier1 = repo({}, { tier: "root" });
  run(tier1, (o) => fill(tier1, o));
  assert.deepEqual(table(tier1), { mail: "alpha" });
});

test("set: 書いて生成する。知らない口・知らない名前・fake・任意でない口の none は生成器の検査で止まり、表は元のまま", () => {
  const root = repo({ "backend-selection.json": '{\n  "mail": "alpha"\n}\n' });
  const ok = run(root, (o) => setSelection(root, "mail", "beta", o));
  assert.equal(ok.generated, 1);
  assert.deepEqual(table(root), { mail: "beta" });
  for (const [port, name, pattern] of [
    ["sms", "x", /鍵 sms は知らない口/],
    ["mail", "gamma", /"gamma" は知らない実装/],
    ["mail", "fake", /"fake" は選べない/],
    ["mail", "none", /任意でない/],
  ]) {
    assert.throws(() => setSelection(root, port, name, { generate: () => assert.fail("生成しない"), log: () => {} }), (e) => e instanceof BackendSelectionError && /戻した/.test(e.message) && pattern.test(e.message));
    assert.deepEqual(table(root), { mail: "beta" });
  }
  const optional = repo({ "src/lib/kit/extensionPoints.ts": SELECT(", optional: true"), "backend-selection.json": '{ "mail": "alpha" }\n' });
  run(optional, (o) => setSelection(optional, "mail", "none", o));
  assert.deepEqual(table(optional), { mail: "none" });
  // 表が無いところへの set で止まったら表を作らない
  const bare = repo();
  assert.throws(() => setSelection(bare, "mail", "gamma", { generate: () => {}, log: () => {} }), BackendSelectionError);
  assert.equal(existsSync(path.join(bare, "backend-selection.json")), false);
});

test("show: 表・選べる名前・選んだ実装の足りない env の名前(値は出さない)", () => {
  const root = repo({ "backend-selection.json": '{ "mail": "beta" }\n', ".env.development": "SENDGRID_API_KEY=\nOTHER=secret-value\n" });
  const out = show(root).join("\n");
  assert.match(out, /backend-selection\.json: \{"mail":"beta"\}/);
  assert.match(out, /- mail: 選んだ実装 beta \| 選べる名前 alpha, beta/);
  assert.match(out, /足りない env\(手元の \.env・\.env\.development・\.env\.production のどれでも空\): SENDGRID_API_KEY/);
  assert.doesNotMatch(out, /secret-value/);
  const filled = repo({ "backend-selection.json": '{ "mail": "beta" }\n', ".env.production": "SENDGRID_API_KEY=k\n" });
  assert.match(show(filled).join("\n"), /のどれでも空\): なし/);
  assert.match(show(repo()).join("\n"), /backend-selection\.json: 無い\(pnpm workflow backend-selection fill で作る\)/);
});
