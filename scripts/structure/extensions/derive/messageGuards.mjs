// scripts/structure/extensions/derive/messageGuards.mjs
// 止められない連絡(required)の守り。連絡の定義 messages/<名前>.ts と隣の上書き <名前>.override.ts を字面で読み(実行しない)、
// - required: true の定義: defaultChannels に "email" がある・adminEditable が空・throttle が無い
// - その上書き: enabled: false にしない・defaultChannels(書くなら)に "email" がある・adminEditable(書くなら)は空・throttle(書くなら)は null だけ
// - 守りに関わる値(定義の required・defaultChannels・adminEditable、上書きの enabled・defaultChannels・adminEditable)はリテラルで書く
// - category(全部の定義と上書き): 書くならリテラルで、categories の受け口(messaging の点 categories)の項目の鍵のどれか。
//   定義で省けるのは kind "transactional" だけ(好みと配信停止の単位が黙って効かなくなるのを防ぐ、D35)。
//   categories の点が宣言されていない木(messaging の無い木)では照らさない
// 上書きの鍵(宣言の overrideOf の中か)は ../overrideKeys.mjs、欄・{{鍵}} など値の検査は lib/messaging の validateMessageDefinition(実行時・生成時)。
// 点 = lib/messaging の extensionPoints.ts の messages(宣言の overrides の glob の対象)。pnpm check extensions(門 build)が回す

import { readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";

import ts from "typescript";

import { literalOf } from "../../../../src/lib/districtMap/declarations.mjs";
import { isOverridePath, overrideGlobOf } from "../../../../src/lib/districtMap/extensionNames.mjs";

/** 守りを当てる点(持ち主のフォルダ・点の名前) */
export const MESSAGE_POINT = { owner: "src/lib/messaging", name: "messages" };
/** 配信停止の種類の点(項目の鍵 = category に書ける値) */
export const CATEGORY_POINT = { owner: "src/features/core/messaging", name: "categories" };
/** 定義の export の名前(export const message = defineMessage({ … })) */
export const MESSAGE_EXPORT = "message";

const unwrap = (node) => {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
};

/**
 * export const <name> = { … } か <関数>({ … }) の object のリテラル。export が無ければ undefined、形が違えば null。
 * 連絡の生成の一覧(scripts/structure/registry/alpha/messageRegistry.mjs)も定義の key をこれで読む
 */
export function exportedObject(path, text, name) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
      let node = unwrap(d.initializer);
      if (ts.isCallExpression(node) && node.arguments.length === 1) node = unwrap(node.arguments[0]);
      return ts.isObjectLiteralExpression(node) ? node : null;
    }
  }
  return undefined;
}

/** 属性の値: 書いていない = { present: false }、リテラル = { present: true, value }、null = { present: true, value: null }、それ以外 = { present: true, problem } */
export function readLiteralProperty(object, key) {
  for (const p of object.properties) {
    if (!(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))) continue;
    if (!(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) || p.name.text !== key) continue;
    if (!ts.isPropertyAssignment(p)) return { present: true, problem: `${key} はリテラルで書く(${p.getText()})` };
    const node = unwrap(p.initializer);
    if (node.kind === ts.SyntaxKind.NullKeyword) return { present: true, value: null };
    const lit = literalOf(node);
    return lit.problem ? { present: true, problem: `${key} はリテラルで書く(${node.getText()})` } : { present: true, value: lit.value };
  }
  return { present: false };
}

/** throttle は中身を問わず有無だけを見る(null = 外す) */
function readPresence(object, key) {
  for (const p of object.properties) {
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key) {
      const node = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : null;
      return { present: true, isNull: node?.kind === ts.SyntaxKind.NullKeyword };
    }
  }
  return { present: false, isNull: false };
}

const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * categories の受け口の項目の鍵(項目 = <dir>/<名前>.ts(x) か <名前>/index.ts(x) の export const <export> = { key: "…" } を字面で読む)。
 * 点が宣言されていなければ null(照らさない)
 * @param {{ owner: string, name: string, spec: { dir?: string, export?: string } }[]} points
 * @param {string[]} files
 */
export function readCategoryKeys(repoRoot, points, files) {
  const point = points.find((p) => p.owner === CATEGORY_POINT.owner && p.name === CATEGORY_POINT.name);
  if (!point?.spec?.dir || !point.spec.export) return null;
  const base = `${point.owner}/${point.spec.dir}/`;
  const items = files.filter((f) => {
    if (!f.startsWith(base) || /\.test\.[cm]?tsx?$/.test(f)) return false;
    const rest = f.slice(base.length);
    return /^[^/.]+\.tsx?$/.test(rest) || /^[^/.]+\/index\.tsx?$/.test(rest);
  });
  const keys = [];
  for (const path of items) {
    const object = exportedObject(path, readFileSync(join(repoRoot, path), "utf8"), point.spec.export);
    const key = object ? readLiteralProperty(object, "key") : { present: false };
    if (key.present && typeof key.value === "string") keys.push(key.value);
  }
  return keys.sort();
}

/** category の問題(定義は kind と合わせて、上書きは書いた時だけ) */
function categoryProblems(path, object, keys, { isOverride }) {
  const category = readLiteralProperty(object, "category");
  if (category.problem) return [`${path}: ${category.problem}(category を categories の受け口と字面で照らすため)`];
  const list = keys.join(" / ") || "項目なし";
  if (category.present) {
    return typeof category.value === "string" && keys.includes(category.value)
      ? []
      : [`${path}: category ${JSON.stringify(category.value)} は categories の受け口に無い(${list})。項目を足すか、取引の連絡なら外す`];
  }
  if (isOverride) return [];
  const kind = readLiteralProperty(object, "kind");
  if (kind.problem) return [`${path}: ${kind.problem}(category を省けるのは取引だけなので kind を字面で読む)`];
  return kind.value === "transactional" ? [] : [`${path}: ${String(kind.value)} の連絡は category(${list})を書く(省けるのは取引だけ)`];
}

/**
 * @param {string} repoRoot
 * @param {{ owner: string, name: string, declaredIn: string, spec: { overrides: string, export: string } }[]} points 宣言の点(全部。messages の点だけを見る)
 * @param {string[]} files src の下の全ファイル(リポジトリ直下からのパス)
 * @returns {string[]} 問題
 */
export function checkMessageGuards(repoRoot, points, files) {
  const point = points.find((p) => p.owner === MESSAGE_POINT.owner && p.name === MESSAGE_POINT.name && p.spec.overrides);
  if (!point) return [];
  const problems = [];
  const overrideExport = point.spec.export;
  const overrideGlob = overrideGlobOf(point.spec.overrides);
  const definitions = files.filter((f) => matchesGlob(f, point.spec.overrides) && !isOverridePath(f) && !/\.test\.[cm]?tsx?$/.test(f));

  const categoryKeys = readCategoryKeys(repoRoot, points, files);

  for (const path of definitions) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const definition = exportedObject(path, text, MESSAGE_EXPORT);
    if (!definition) {
      problems.push(`${path}: 連絡の定義は export const ${MESSAGE_EXPORT} = defineMessage({ … }) の形で書く(点 ${point.name}、${point.declaredIn})`);
      continue;
    }
    if (categoryKeys) {
      problems.push(...categoryProblems(path, definition, categoryKeys, { isOverride: false }));
      const ownOverride = path.replace(/\.[A-Za-z]+$/, ".override.ts");
      if (files.includes(ownOverride) && matchesGlob(ownOverride, overrideGlob)) {
        const object = exportedObject(ownOverride, readFileSync(join(repoRoot, ownOverride), "utf8"), overrideExport);
        if (object) problems.push(...categoryProblems(ownOverride, object, categoryKeys, { isOverride: true }));
      }
    }
    const required = readLiteralProperty(definition, "required");
    const defaultChannels = readLiteralProperty(definition, "defaultChannels");
    const adminEditable = readLiteralProperty(definition, "adminEditable");
    for (const r of [required, defaultChannels, adminEditable]) if (r.problem) problems.push(`${path}: ${r.problem}(required の守りを字面で確かめるため)`);
    if (required.problem || required.value !== true) continue;

    if (!defaultChannels.problem && !(isStringArray(defaultChannels.value) && defaultChannels.value.includes("email"))) {
      problems.push(`${path}: required の連絡は defaultChannels に "email" を含める`);
    }
    if (!adminEditable.problem && adminEditable.present && !(Array.isArray(adminEditable.value) && adminEditable.value.length === 0)) {
      problems.push(`${path}: required の連絡に adminEditable は付けられない`);
    }
    if (readPresence(definition, "throttle").present) problems.push(`${path}: required の連絡に throttle は付けられない`);

    const overridePath = path.replace(/\.[A-Za-z]+$/, ".override.ts");
    if (!files.includes(overridePath) || !matchesGlob(overridePath, overrideGlob)) continue;
    const override = exportedObject(overridePath, readFileSync(join(repoRoot, overridePath), "utf8"), overrideExport);
    if (!override) continue; // 形の違い・空は ../overrideKeys.mjs と ../orphans.mjs が言う
    const enabled = readLiteralProperty(override, "enabled");
    const oChannels = readLiteralProperty(override, "defaultChannels");
    const oEditable = readLiteralProperty(override, "adminEditable");
    for (const r of [enabled, oChannels, oEditable]) if (r.problem) problems.push(`${overridePath}: ${r.problem}(上書きの先が required の連絡のため)`);
    if (!enabled.problem && enabled.present && enabled.value !== true) problems.push(`${overridePath}: required の連絡は止められない(enabled: false にしない)`);
    if (!oChannels.problem && oChannels.present && !(isStringArray(oChannels.value) && oChannels.value.includes("email"))) {
      problems.push(`${overridePath}: required の連絡から email は外せない(defaultChannels に "email" を含める)`);
    }
    if (!oEditable.problem && oEditable.present && !(Array.isArray(oEditable.value) && oEditable.value.length === 0)) {
      problems.push(`${overridePath}: required の連絡に adminEditable は付けられない`);
    }
    const throttle = readPresence(override, "throttle");
    if (throttle.present && !throttle.isNull) problems.push(`${overridePath}: required の連絡に throttle は付けられない`);
  }
  return problems;
}
