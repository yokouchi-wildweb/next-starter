// scripts/operations/vercel/lib.vercel.test.mjs — pnpm test scripts/operations/vercel
// Vercel の口の env の決まり(D462): 方針と許可は守りだけが見る(前半は前提まで)・env-add の本番は .env.production にも同じ値・デプロイの前の揃え
// (syncProductionEnv)は Vercel の本番に無い名だけを足す。本物の vercel は呼ばない(偽の vercel を PATH の先頭に置く・run を差し替える)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseEnvFile } from "../../workflow/backend-selection/lib.mjs";
import { ACTIONS, envValueText, executeVercel, planOf, prepareVercel, syncProductionEnv, vercelEnvNames, writeEnvValue } from "./lib.vercel.mjs";

/** 一時のチェックアウト(git の木 + リンク)と、呼ばれた引数と標準入力を記録する偽の vercel */
function checkout(t) {
  const root = mkdtempSync(path.join(tmpdir(), "vercel-co-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  mkdirSync(path.join(root, ".vercel"));
  writeFileSync(path.join(root, ".vercel", "project.json"), "{}\n");
  const bin = path.join(root, ".bin");
  mkdirSync(bin);
  const log = path.join(bin, "calls.log");
  writeFileSync(path.join(bin, "vercel"), `#!/bin/sh\necho "$@ <$(cat 2>/dev/null)>" >> "${log}"\nexit 0\n`);
  chmodSync(path.join(bin, "vercel"), 0o755);
  return { root, log, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } };
}

test("前半は本番でも方針と許可を読まない(確かめは守り guardDeploy の 1 か所): 本番も許可なしで準備ができ、前提(CLI・ログイン・リンク)が無ければ守りの前に 3", async (t) => {
  const { root, env } = checkout(t);
  const quiet = () => {};
  for (const environment of ["development", "preview", "production"]) {
    const r = await prepareVercel("env-add", ["FOO", environment], { cwd: root, print: quiet, stdin: () => "v\n", env });
    assert.equal(r.prepared?.production, environment === "production", environment);
  }
  const rm = await prepareVercel("env-rm", ["FOO", "production"], { cwd: root, print: quiet, env });
  assert.ok(rm.prepared, "env-rm の本番も前半は方針を見ない");
  const lines = [];
  const noCli = await prepareVercel("env-add", ["FOO", "production"], { cwd: root, print: (l) => lines.push(l), stdin: () => "v\n", env: { ...env, PATH: "/nonexistent" } });
  assert.equal(noCli.code, 3);
  assert.match(lines[0], /vercel CLI がありません/);
  rmSync(path.join(root, ".vercel"), { recursive: true });
  assert.equal((await prepareVercel("env-rm", ["FOO", "preview"], { cwd: root, print: quiet, env })).code, 3, "リンクが無ければ 3");
});

test("env-add の本番: vercel に足せた後、.env.production の同じ名の行を同じ値で置き換える(無い名は末尾に)。development は .env.production に触らない", (t) => {
  const { root, log, env } = checkout(t);
  writeFileSync(path.join(root, ".env.production"), "# c\nAPP_ENV=production\nFOO=old\n");
  const quiet = () => {};
  const add = (name, environment, value) =>
    executeVercel({ action: "env-add", spec: ACTIONS["env-add"], plan: planOf("env-add", [name, environment]), root, value, production: environment === "production" }, { print: quiet, env });
  assert.equal(add("FOO", "production", "new value"), 0);
  assert.equal(add("BAR", "production", "b"), 0);
  assert.equal(add("DEV_ONLY", "development", "d"), 0);
  assert.equal(readFileSync(path.join(root, ".env.production"), "utf8"), '# c\nAPP_ENV=production\nFOO="new value"\nBAR=b\n');
  assert.match(readFileSync(log, "utf8"), /env add FOO production <new value>/);
});

test("envValueText・writeEnvValue: 読み手 parseEnvFile で同じ値に戻る(空白・# ・引用符)。ファイルが無ければ作る", (t) => {
  const { root } = checkout(t);
  const file = path.join(root, ".env.production");
  const values = { A: "plain", B: "with space", C: "a#b", D: 'say "hi"', E: "x=y" };
  for (const [k, v] of Object.entries(values)) writeEnvValue(file, k, v);
  const back = parseEnvFile(readFileSync(file, "utf8"));
  for (const [k, v] of Object.entries(values)) assert.equal(back.get(k), v, k);
  assert.equal(envValueText("a\nb"), '"a\\nb"');
});

test("syncProductionEnv: .env.production の空でない鍵のうち Vercel の本番に無い名だけを足す(VERCEL_ は除く)。足すのに失敗したら ok: false", (t) => {
  const { root } = checkout(t);
  writeFileSync(path.join(root, ".env.production"), "APP_ENV=production\nON_VERCEL=1\nMISSING=secret value\nEMPTY=\nVERCEL_URL=x\n");
  const table = "Vercel CLI 39.1.0\n> Environment Variables found for t/p\n\n name        value      environments   created\n APP_ENV     Encrypted  Production     2d ago\n ON_VERCEL   Encrypted  Production     2d ago\n";
  const calls = [];
  const run = (fail) => (argv, opts = {}) => {
    calls.push([argv.join(" "), opts.input]);
    if (argv[1] === "ls") return { status: 0, stdout: table, stderr: "" };
    return { status: fail ? 1 : 0 };
  };
  const quiet = () => {};
  assert.deepEqual(syncProductionEnv({ root, run: run(false), print: quiet }), { ok: true, added: ["MISSING"] });
  assert.deepEqual(calls.slice(1), [["env add MISSING production", "secret value"]], "値は標準入力で渡す");
  assert.equal(syncProductionEnv({ root, run: run(true), print: quiet }).ok, false);
  assert.equal(syncProductionEnv({ root, run: () => ({ status: 1 }), print: quiet }).ok, false, "名前が読めなければ止める");
  assert.deepEqual([...vercelEnvNames(table)].sort(), ["APP_ENV", "ON_VERCEL"]);
  rmSync(path.join(root, ".env.production"));
  assert.deepEqual(syncProductionEnv({ root, run: run(false), print: quiet }), { ok: true, added: [] });
});
