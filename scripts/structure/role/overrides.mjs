// scripts/structure/role/overrides.mjs
// fork の上書き（JSON の隣の <JSON の名前>.override.ts。例 coreRoles/user.role.override.ts・user.profile.override.ts）を読む。
// 宣言と同じく TypeScript の構文木で字面を読み、実行しない。形:
//   import type { RoleOverride } from "../types";
//   export const override: RoleOverride = { hasProfile: true };
// 不在と空（空白とコメントだけ）は上書きなし（下の Tier が親の上書きを空にしてよい）。
// 書けるキーは宣言(user の coreRoleDefinitions / roleDefinitions・userProfile の profileDefinitions の overrideOf)。
// core ロールの enabled・表の形を変える fields は宣言に無いので書けない。上書きの正: src/features/core/user/README.md

import fs from "fs";
import path from "path";
import ts from "typescript";
import { literalOf, overrideKeysOf } from "../../../src/lib/districtMap/declarations.mjs";
import { isBlankSource } from "../extensions/overrides.mjs";

const isString = (value) => typeof value === "string";
const isStringArray = (value) => Array.isArray(value) && value.every(isString);

// 書いてよい鍵は宣言から読む(user / userProfile の extensionPoints.ts の overrides の点)。ここは鍵ごとの値の検査だけを持つ
const VALUE_CHECKS = {
  label: { check: (value) => isString(value) && value.length > 0, expected: "空でない文字列" },
  hasProfile: { check: (value) => typeof value === "boolean", expected: "true か false" },
  enabled: { check: (value) => typeof value === "boolean", expected: "true か false" },
  tags: {
    check: (value) => typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every(isStringArray),
    expected: "{ タグ名: [項目名, ...] }",
  },
  searchFields: { check: isStringArray, expected: "文字列の配列" },
  // 中身は checks の auditIssues が上書き後の値で見る
  audit: { check: (value) => typeof value === "object" && value !== null && !Array.isArray(value), expected: "{ targetType, actionPrefix, ... }" },
};

const USER_DECLARATION = "src/features/core/user/extensionPoints.ts";
const PROFILE_DECLARATION = "src/features/core/userProfile/extensionPoints.ts";

/**
 * 宣言の鍵 → { 鍵: 値の検査 }。値の検査の無い鍵を宣言が開けたら止める(検査されない値を通さない)
 * @param {string} declaredIn
 * @param {string} pointName
 */
function keysOf(declaredIn, pointName) {
  const keys = {};
  for (const key of overrideKeysOf(declaredIn, pointName)) {
    if (!Object.hasOwn(VALUE_CHECKS, key)) throw new Error(`${declaredIn} の ${pointName} の鍵 ${key} に値の検査が無い(scripts/structure/role/overrides.mjs の VALUE_CHECKS に足す)`);
    keys[key] = VALUE_CHECKS[key];
  }
  return keys;
}

/** JSON のファイル名 → 隣の上書きのファイル名 */
const overrideFileName = (jsonName) => jsonName.replace(/\.json$/, ".override.ts");

/**
 * 上書きのソースを読む
 * @param {string} fileName エラーに出す名前
 * @param {string} text
 * @param {Record<string, { check: (value: unknown) => boolean, expected: string }>} keys 書けるキー
 * @returns {{ override: object, problems: string[] }}
 */
function parseOverride(fileName, text, keys) {
  if (isBlankSource(text)) return { override: {}, problems: [] };
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const problems = [];
  let initializer = null;
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const from = statement.moduleSpecifier.text;
      if (!statement.importClause?.isTypeOnly) problems.push(`import は型だけ（import type）にしてください: ${statement.getText()}`);
      if (!from.startsWith(".")) problems.push(`import は相対パスにしてください（@/ 別名は scripts から解決できません）: ${from}`);
      continue;
    }
    const declarations = ts.isVariableStatement(statement) ? statement.declarationList.declarations : [];
    const isExportedConst =
      ts.isVariableStatement(statement) && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    if (isExportedConst && declarations.length === 1 && declarations[0].name.getText() === "override" && declarations[0].initializer) {
      initializer = declarations[0].initializer;
      continue;
    }
    problems.push(`書けるのは import type と export const override = { … } だけです: ${statement.getText()}`);
  }
  if (!initializer) problems.push("export const override = { … } がありません");
  const read = initializer ? literalOf(initializer) : { value: {} };
  if (read.problem) problems.push(read.problem);
  const override = read.problem ? {} : read.value;
  if (typeof override !== "object" || override === null || Array.isArray(override)) {
    problems.push("override は object で書いてください");
  } else {
    for (const [key, value] of Object.entries(override)) {
      if (!Object.hasOwn(keys, key)) problems.push(`知らないキー ${key}（書けるのは ${Object.keys(keys).join(" / ")}）`);
      else if (!keys[key].check(value)) problems.push(`${key} は ${keys[key].expected} で書いてください（今: ${JSON.stringify(value)}）`);
    }
  }
  return problems.length > 0 ? { override: {}, problems: problems.map((problem) => `[${fileName}] ${problem}`) } : { override, problems };
}

function readOverrideOf(dir, jsonName, keys) {
  const fileName = overrideFileName(jsonName);
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) return { override: {}, problems: [] };
  return parseOverride(fileName, fs.readFileSync(filePath, "utf8"), keys);
}

/**
 * @param {import("./rolePaths.mjs").RoleFile} file
 * @returns {{ override: object, problems: string[] }}
 */
export const readRoleOverride = ({ dir, fileName, isCore }) =>
  readOverrideOf(dir, fileName, keysOf(USER_DECLARATION, isCore ? "coreRoleDefinitions" : "roleDefinitions"));

/** @returns {{ override: object, problems: string[] }} jsonName = user.profile.json など */
export const readProfileOverride = (profilesDir, jsonName) => readOverrideOf(profilesDir, jsonName, keysOf(PROFILE_DECLARATION, "profileDefinitions"));

/** 検査の後で読む所（一覧の書き出し・操作コマンド）: 問題があれば例外にして上書きを返す */
export function requireOverride({ override, problems }) {
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return override;
}

/** 消すときに上書きも一緒に消す。消したら true */
export function removeOverride(dir, jsonName) {
  const filePath = path.join(dir, overrideFileName(jsonName));
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export { overrideFileName };
