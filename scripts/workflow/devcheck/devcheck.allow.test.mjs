// scripts/workflow/devcheck/devcheck.allow.test.mjs — 1 回分の許可(devcheck allow / danger、記録の寿命)。一時のフォルダだけに書く
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { PERMIT_FILE, clearPermit, consumePermit, readPermit, runAllow, runDanger, writePermit } from "./lib.allow.mjs";
import { DANGER_NAMES, SWITCHES, agentPolicyOf, offLine, policyKeyOf, switchOf } from "./lib.kinds.mjs";

const made = [];
after(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = () => {
  const d = mkdtempSync(path.join(os.tmpdir(), "devcheck-allow-"));
  made.push(d);
  return d;
};
const KINDS_API = { SWITCHES, DANGER_NAMES, offLine, policyKeyOf };

test("スイッチ名: 種類ごとに 1 つ、危険な 3 つは dbp・evp・dep", () => {
  assert.deepEqual(Object.keys(SWITCHES), ["sv", "br", "lg", "dw", "dd", "ea", "ts", "ck", "pr", "dbp", "evp", "dep"]);
  assert.equal(switchOf("db-write"), "dw");
  assert.equal(switchOf("deploy"), "dep");
  assert.equal(new Set(Object.values(SWITCHES)).size, Object.keys(SWITCHES).length);
});

test("記録: 書く・足す・使ったスイッチだけ消す・全部消す", () => {
  const root = tmp();
  assert.equal(readPermit(root), null);
  writePermit(root, ["dbp"], "DB への反映を許可");
  writePermit(root, ["dw", "dbp"], "");
  assert.deepEqual(readPermit(root).switches, ["dbp", "dw"]);
  assert.equal(readPermit(root).words, "DB への反映を許可");
  consumePermit(root, "dbp");
  assert.deepEqual(readPermit(root).switches, ["dw"]);
  consumePermit(root, "dw");
  assert.equal(existsSync(path.join(root, PERMIT_FILE)), false);
  writePermit(root, ["dep"], "");
  clearPermit(root);
  assert.equal(readPermit(root), null);
});

test("allow: manual だけ書く。off は人に頼む 1 行、auto は要らない、知らない名前は止める", () => {
  const root = tmp();
  const agent = agentPolicyOf({ "agent.db_push": "manual", "agent.db_write": "manual", "agent.env_add": "off" });
  const ok = runAllow(root, ["dbp", "dw"], "反映していい", agent, KINDS_API);
  assert.equal(ok.code, 0);
  assert.match(ok.lines[0], /1 回分の許可: dbp dw/);
  assert.deepEqual(readPermit(root).switches, ["dbp", "dw"]);
  const off = runAllow(tmp(), ["ea"], "", agent, KINDS_API);
  assert.equal(off.code, 4);
  assert.match(off.lines[0], /env-add は方針で off: 人が打つなら .+、任せるなら \/repo-policy で agent\.env_add を manual に/);
  const offDanger = runAllow(tmp(), ["dep"], "", agent, KINDS_API);
  assert.match(offDanger.lines[0], /deploy は方針で off: 人が打つなら pnpm live\(本番の DB の反映が要るなら先に pnpm db:push -- --env production\)/);
  const auto = runAllow(tmp(), ["ts"], "", agent, KINDS_API);
  assert.equal(auto.code, 4);
  assert.match(auto.lines[0], /auto: 許可は要らない/);
  assert.equal(runAllow(tmp(), ["xx"], "", agent, KINDS_API).code, 2);
  assert.equal(runAllow(tmp(), [], "", agent, KINDS_API).code, 2);
  // 一部だけ書けた = 4(断った行も出す)
  const mixed = runAllow(tmp(), ["dbp", "ea"], "", agent, KINDS_API);
  assert.equal(mixed.code, 4);
  assert.equal(mixed.lines.length, 2);
});

test("danger: off の 1 行 / 許可なしは /allow が要る / 許可ありは打つ命令 / 上流の入口なし", () => {
  const root = tmp();
  const off = runDanger(root, "dbp", agentPolicyOf({}), KINDS_API);
  assert.equal(off.code, 4);
  assert.match(off.lines[0], /db_push は方針で off: 人が打つなら pnpm db:push/);
  const manual = agentPolicyOf({ "agent.db_push": "manual", "agent.deploy": "manual", "agent.env_production": "manual" });
  assert.match(runDanger(root, "dbp", manual, KINDS_API).lines[0], /\/allow dbp/);
  writePermit(root, ["dbp", "dep", "evp"], "");
  assert.deepEqual(runDanger(root, "dbp", manual, KINDS_API), { code: 0, lines: ["db_push: 1 回分の許可あり。打つ命令(この順、1 回だけ):", "  pnpm db:push"] });
  const dep = runDanger(root, "dep", manual, KINDS_API);
  assert.equal(dep.code, 0);
  assert.match(dep.lines.join("\n"), /pnpm db:push -- --env production --confirm=production\n {2}pnpm live -- --confirm=production$/);
  const evp = runDanger(root, "evp", manual, KINDS_API);
  assert.equal(evp.code, 4);
  assert.match(evp.lines[0], /上流の入口なし/);
  assert.equal(runDanger(root, "dw", manual, KINDS_API).code, 2);
  // 読むだけ: 許可は消えない
  assert.deepEqual(readPermit(root).switches, ["dbp", "dep", "evp"]);
  assert.ok(readFileSync(path.join(root, PERMIT_FILE), "utf8").includes('"v":1'));
});
