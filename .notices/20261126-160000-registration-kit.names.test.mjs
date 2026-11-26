// .notices/20261126-160000-registration-kit.names.mjs の検査(土台の分け方と読み手の書き換え。ファイルの中身だけで確かめる)。
// 実行: pnpm test .notices/20261126-160000-registration-kit.names.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { planBaseFile, planReaders } from "./20261126-160000-registration-kit.names.mjs";

const declaration = (name, registrations) => ({ name, registrations: registrations.map((registration) => ({ name: registration })) });

test("土台が 1 つ: export base は第 1 引数の表の登録の <登録名>Base に、ファイルは丸ごと", () => {
  const text = 'import { createCrudService } from "@/lib/crud/server";\nexport const baseOptions = {};\nexport const base = createCrudService(InteractionEventTable, baseOptions);\n';
  const { files, stops } = planBaseFile(text, "src/domains/core/tracking/services/server/drizzleBase.ts", declaration("tracking", ["interactionCounter", "interactionEvent"]));
  assert.deepEqual(stops, []);
  assert.equal(files.length, 1);
  assert.equal(files[0].registration, "interactionEvent");
  assert.deepEqual(files[0].renames, { base: "interactionEventBase" });
  assert.deepEqual(files[0].names.sort(), ["base", "baseOptions"]);
});

test("土台が複数: 登録ごとのファイルに分け、文と import はそれを使う土台へ", () => {
  const text = [
    "// src/domains/core/log/services/server/drizzleBase.ts",
    "",
    'import { LogTable, LogFailedTable } from "@/domains/core/log/entities/drizzle";',
    'import { createCrudService } from "@/lib/crud/server";',
    "",
    "const logOptions = { idType: \"uuid\" };",
    "export const logBase = createCrudService(LogTable, logOptions);",
    "const logFailedOptions = { idType: \"uuid\" };",
    "export const logFailedBase = createCrudService(LogFailedTable, logFailedOptions);",
    "",
  ].join("\n");
  const { files, stops } = planBaseFile(text, "src/domains/core/log/services/server/drizzleBase.ts", declaration("log", ["log", "logFailed"]));
  assert.deepEqual(stops, []);
  const byRegistration = Object.fromEntries(files.map((file) => [file.registration, file]));
  assert.match(byRegistration.logFailed.text, /import \{ LogFailedTable \} from "@\/domains\/core\/log\/entities\/drizzle";/);
  assert.doesNotMatch(byRegistration.logFailed.text, /logOptions|LogTable\b/);
  assert.match(byRegistration.log.text, /const logOptions/);
  assert.deepEqual(byRegistration.log.names, ["logBase"]);
});

test("2 つの土台が使う文・登録を決められない土台は止める", () => {
  const shared = 'const options = {};\nexport const aBase = createCrudService(ATable, options);\nexport const bBase = createCrudService(BTable, options);\n';
  assert.match(planBaseFile(shared, "x/drizzleBase.ts", declaration("x", ["a", "b"])).stops.join("\n"), /2 つの土台/);
  const unknown = "export const base = createCrudService(otherTable());\n";
  assert.match(planBaseFile(unknown, "x/drizzleBase.ts", declaration("x", ["a", "b"])).stops.join("\n"), /登録を決められない/);
});

test("読み手: 道を直し、名前の変わる import は参照も変える(別の束縛・プロパティ名は触らない)、分けたファイルは import を分ける", () => {
  const plan = {
    writes: {},
    removes: [],
    moves: new Map([
      ["src/domains/x/services/server/drizzleBase", { whole: "src/domains/x/services/server/xBase", names: new Map([["base", { stem: "src/domains/x/services/server/xBase", name: "xBase" }], ["baseOptions", { stem: "src/domains/x/services/server/xBase", name: "baseOptions" }]]) }],
      ["src/domains/x/presenters", { whole: "src/domains/x/xPresenters", names: new Map() }],
      ["src/domains/log/services/server/drizzleBase", { whole: null, names: new Map([["logBase", { stem: "src/domains/log/services/server/logBase", name: "logBase" }], ["logFailedBase", { stem: "src/domains/log/services/server/logFailedBase", name: "logFailedBase" }]]) }],
    ]),
  };
  const readers = {
    "src/domains/x/services/server/xService.ts": [
      'import { base, baseOptions } from "./drizzleBase";',
      'import presenters from "../../presenters";',
      "export const xService = { ...base, get: (id: string) => base.get(id), other: { base: 1 }.base, options: baseOptions };",
      "function shadow(base: number) { return base + 1; }",
      "",
    ].join("\n"),
    "src/domains/log/services/server/index.ts": 'export { logBase, logFailedBase } from "./drizzleBase";\n',
    "src/domains/x/types/t.ts": 'type O = typeof import("../services/server/drizzleBase").baseOptions;\n',
  };
  const { writes, stops } = planReaders("/nowhere", plan, readers);
  assert.deepEqual(stops, []);
  const service = writes["src/domains/x/services/server/xService.ts"];
  assert.match(service, /^import \{ xBase, baseOptions \} from "\.\/xBase";$/m);
  assert.match(service, /^import presenters from "\.\.\/\.\.\/xPresenters";$/m);
  assert.match(service, /\{ \.\.\.xBase, get: \(id: string\) => xBase\.get\(id\), other: \{ base: 1 \}\.base, options: baseOptions \}/);
  assert.match(service, /function shadow\(base: number\) \{ return base \+ 1; \}/, "別の束縛はそのまま");
  assert.equal(writes["src/domains/log/services/server/index.ts"], 'export { logBase } from "./logBase";\nexport { logFailedBase } from "./logFailedBase";\n');
  assert.match(writes["src/domains/x/types/t.ts"], /import\("\.\.\/services\/server\/xBase"\)\.baseOptions/);
});

test("読み手: 名前の変わる export を export from で外へ出す・新しい名前が既にあるは止める", () => {
  const plan = {
    writes: {},
    removes: [],
    moves: new Map([["src/domains/x/services/server/drizzleBase", { whole: "src/domains/x/services/server/xBase", names: new Map([["base", { stem: "src/domains/x/services/server/xBase", name: "xBase" }]]) }]]),
  };
  const { stops } = planReaders("/nowhere", plan, {
    "src/domains/x/index.ts": 'export { base } from "./services/server/drizzleBase";\n',
    "src/domains/x/a.ts": 'import { base } from "./services/server/drizzleBase";\nconst xBase = 1;\nexport const y = base;\n',
  });
  assert.match(stops.join("\n"), /export \{ base \} from .*名前が xBase に変わる/);
  assert.match(stops.join("\n"), /新しい名前 xBase が既にある/);
});
