// 上書きの型(RoleOverride・CoreRoleOverride・ProfileOverride・CronTaskOverride・DomainEntryOverrides)の鍵は宣言の overrideOf と同じ(L1.38)。
// TypeScript のコンパイラで見本のファイルを型検査し、宣言を書き換えた見え方(メモリの中だけ)では型が宣言に付いてくることも見る
// 実行: pnpm test scripts/structure/extensions/overrideTypes.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PROBE = join(repoRoot, "src/__overrideTypesProbe__.ts");

const config = ts.parseJsonConfigFileContent(ts.readConfigFile(join(repoRoot, "tsconfig.json"), ts.sys.readFile).config, ts.sys, repoRoot);

/**
 * 見本を型検査して、1 つのファイル(既定 = 見本)の診断の文を返す
 * @param {string} probe 見本の中身
 * @param {Record<string, string>} edits リポジトリ直下からの相対パス → 差し替える中身(宣言の書き換え)
 * @param {string} [of] 診断を見るファイル(リポジトリ直下からの相対。宣言の誤りは型の側に出る)
 */
function diagnose(probe, edits = {}, of = null) {
  const overlay = new Map(Object.entries(edits).map(([path, text]) => [join(repoRoot, path), text]));
  overlay.set(PROBE, probe);
  const host = ts.createCompilerHost(config.options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (file) => overlay.get(file) ?? readFile(file);
  host.fileExists = (file) => overlay.has(file) || fileExists(file);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, onError, create) =>
    overlay.has(file) ? ts.createSourceFile(file, overlay.get(file), language, true) : getSourceFile(file, language, onError, create);
  const program = ts.createProgram([PROBE], { ...config.options, noEmit: true, incremental: false }, host);
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(of ? join(repoRoot, of) : PROBE)).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

const HEAD = `type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
import type { CoreRoleOverride, RoleOverride } from "@/features/core/user/types/role";
import type { ProfileOverride } from "@/features/core/userProfile/types";
import type { CronTaskOverride } from "@/lib/cron";
import type { DomainEntryOverrides } from "@/lib/domain/types";
import type { DomainApiAccessConfig } from "@/lib/domain/types/apiAccess";
`;

test("今の型の鍵 = 宣言の鍵(core ロールに enabled・プロフィールに fields は無い)。domainEntry の値は access の型", () => {
  const probe = `${HEAD}
export const role: Eq<keyof RoleOverride, "label" | "hasProfile" | "enabled"> = true;
export const coreRole: Eq<keyof CoreRoleOverride, "label" | "hasProfile"> = true;
export const profile: Eq<keyof ProfileOverride, "tags" | "searchFields" | "audit"> = true;
export const cron: Eq<keyof CronTaskOverride, "schedule" | "disabled"> = true;
export const entry: Eq<DomainEntryOverrides[string], DomainApiAccessConfig> = true;
`;
  assert.deepEqual(diagnose(probe), []);
});

const USER = "src/features/core/user/extensionPoints.ts";
const CRON = "src/lib/cron/extensionPoints.ts";
const edit = (path, from, to) => {
  const text = readFileSync(join(repoRoot, path), "utf8");
  assert.ok(text.includes(from), `${path} に ${from} が無い(テストの前提)`);
  return { [path]: text.replace(from, to) };
};

test("宣言の鍵を引く・足すと型が付いてくる(core ロールから hasProfile を外す・description を足す)", () => {
  const removed = edit(USER, 'overrideOf: ["label", "hasProfile"],', 'overrideOf: ["label"],');
  assert.deepEqual(diagnose(`${HEAD}\nexport const x: Eq<keyof CoreRoleOverride, "label"> = true;\n`, removed), []);
  assert.ok(diagnose(`${HEAD}\nexport const x: CoreRoleOverride = { hasProfile: true };\n`, removed).some((m) => m.includes("hasProfile")), "外した鍵は書けない");
  const added = edit(USER, 'overrideOf: ["label", "hasProfile"],', 'overrideOf: ["label", "hasProfile", "description"],');
  assert.deepEqual(diagnose(`${HEAD}\nexport const x: Eq<keyof CoreRoleOverride, "label" | "hasProfile" | "description"> = true;\n`, added), []);
});

test("cron: 値の型(CronTaskOverrideValues)に無い鍵を宣言に足すと型の側で型エラー(検査されない鍵を開けない)", () => {
  const probe = `${HEAD}\nexport const x: CronTaskOverride = {};\n`;
  assert.deepEqual(diagnose(probe, {}, "src/lib/cron/types.ts"), []);
  const added = edit(CRON, 'overrideOf: ["schedule", "disabled"],', 'overrideOf: ["schedule", "disabled", "timeout"],');
  assert.ok(diagnose(probe, added, "src/lib/cron/types.ts").some((m) => m.includes("timeout")), "宣言にあって値の型に無い鍵は型エラー");
});
