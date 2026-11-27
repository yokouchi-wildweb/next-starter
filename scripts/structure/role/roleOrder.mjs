// scripts/structure/role/roleOrder.mjs
// ロールの一覧(user/extensions/roles.ts = DB の enum user_role の値の並び)の並び方。並びの元 = fork の設定の値 user の roleOrder
// (src/config/domains/user.config.ts、D490 (3))。上流は並びの値を持たない(既定 [])。
// 生成物の roles.ts を並びの元にしない: 取り込みで上流の roles.ts を取ると作り直しが上流の並びを固め、enum の値が動いて
// drizzle-kit が DROP TYPE と users などの列の書き直し(本番の表の書き直し)を計画する。
// 並び = 設定の並び → 設定に無く今の一覧にあるロールはその並び(設定が空の fork は今のまま)→ どちらにも無いロールは末尾(コア先・ID 順)
import fs from "fs";
import path from "path";
import ts from "typescript";
import { literalOf } from "../../../src/lib/districtMap/index.mjs";

export const USER_CONFIG_VALUES = "src/config/domains/user.config.ts";

/**
 * 設定の値のファイルの default export から roleOrder を読む(構文木で: 生成器は素の node で走り TS を import できない)
 * @param {string} text user.config.ts の中身
 * @returns {{ order: string[], problem?: undefined } | { problem: string, order?: undefined }}
 */
export function parseRoleOrderSetting(text) {
  const source = ts.createSourceFile(USER_CONFIG_VALUES, text, ts.ScriptTarget.Latest, true);
  const exported = source.statements.find(ts.isExportAssignment);
  if (!exported) return { order: [] };
  let node = exported.expression;
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  if (!ts.isObjectLiteralExpression(node)) return { problem: `${USER_CONFIG_VALUES}: default export が object のリテラルでない` };
  const property = node.properties.find((p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "roleOrder");
  if (!property) return { order: [] };
  const read = literalOf(/** @type {ts.PropertyAssignment} */ (property).initializer);
  if (read.problem !== undefined) return { problem: `${USER_CONFIG_VALUES} の roleOrder: ${read.problem}` };
  if (!Array.isArray(read.value) || read.value.some((id) => typeof id !== "string")) return { problem: `${USER_CONFIG_VALUES} の roleOrder は ID の文字列の配列で書く` };
  return { order: /** @type {string[]} */ (read.value) };
}

/** @param {string} root リポの根 */
export function readRoleOrderSetting(root) {
  const file = path.join(root, USER_CONFIG_VALUES);
  return fs.existsSync(file) ? parseRoleOrderSetting(fs.readFileSync(file, "utf8")) : { order: [] };
}

/**
 * 一覧の並びを決める(何も書かない)
 * @param {{ setting: string[], listed: string[], ids: string[], isCore: (id: string) => boolean }} input
 *   setting = 設定の roleOrder / listed = 今の roles.ts の並び / ids = 一覧に載せるロール(ディスクの *.role.json)
 * @returns {{ order: string[], problems: string[], skipped: string[] }} problems があれば並びは使わない。skipped = 設定にあってロールの無い ID
 */
export function orderRoles({ setting, listed, ids, isCore }) {
  const duplicated = [...new Set(setting.filter((id, index) => setting.indexOf(id) !== index))];
  const problems = duplicated.length ? [`${USER_CONFIG_VALUES} の roleOrder に 2 回以上ある ID: ${duplicated.join(", ")}`] : [];
  const present = new Set(ids);
  const skipped = setting.filter((id) => !present.has(id));
  const fromSetting = [...new Set(setting.filter((id) => present.has(id)))];
  const placed = new Set(fromSetting);
  const fromList = listed.filter((id) => present.has(id) && !placed.has(id));
  for (const id of fromList) placed.add(id);
  const rest = ids.filter((id) => !placed.has(id)).sort((a, b) => Number(!isCore(a)) - Number(!isCore(b)) || a.localeCompare(b));
  return { order: [...fromSetting, ...fromList, ...rest], problems, skipped };
}
