// scripts/structure/extensions/derive/messageGuards.mjs
// 止められない連絡(required)の守り。連絡の定義 messages/<名前>.ts と隣の上書き <名前>.override.ts を字面で読み(実行しない)、
// - required の上書き: enabled: false にしない・adminEditable(書くなら)は空・throttle(書くなら)は null だけ
// - 守りに関わる値(定義の required・category・adminEditable、上書きの enabled・adminEditable、種類の kind・channels・group)はリテラルで書く
// - category(全部の定義に必須、D81): リテラルで、categories の受け口(messaging の点 categories)の項目の鍵のどれか。
//   文面(content)は種類の経路の分だけ要る(D86)。上書きでは category を変えられない(宣言の overrideOf に無い = ../overrideKeys.mjs)
// - required の定義: 種類の経路に "email" がある・adminEditable が空・throttle が無い
// - 上流(src/features/core)の functional の種類の連絡: 上書きで enabled: false にしない(D68)
// - 種類の上書き(categories/<名前>.override.ts): functional・security の種類の channels から "email" を外さない(D86)。
//   group は categoryGroups の受け口の鍵で、1 つのグループの種類は同じ種別(D82)
// 種別の性質(emailFixed・upstreamDisable)は src/lib/messaging/definition/kinds.ts の MESSAGE_KIND_TRAITS を字面で読む(表は 1 か所)。
// categories の点が宣言されていない木(messaging の無い木)では種類の検査をしない
// 上書きの鍵(宣言の overrideOf の中か)は ../overrideKeys.mjs、欄・{{鍵}} など値の検査は lib/messaging の validateMessageDefinition(実行時・生成時)。
// 点 = lib/messaging の extensionPoints.ts の messages(宣言の overrides の glob の対象)。pnpm check extensions(門 build)が回す

import { existsSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";

import ts from "typescript";

import { literalOf } from "../../../../src/lib/districtMap/declarations.mjs";
import { isOverridePath, overrideGlobOf } from "../../../../src/lib/districtMap/extensionNames.mjs";

/** 守りを当てる点(持ち主のフォルダ・点の名前) */
export const MESSAGE_POINT = { owner: "src/lib/messaging", name: "messages" };
/** 配信停止の種類の点(項目の鍵 = category に書ける値)とグループの点 */
export const CATEGORY_POINT = { owner: "src/features/core/messaging", name: "categories" };
export const CATEGORY_GROUP_POINT = { owner: "src/features/core/messaging", name: "categoryGroups" };
/** 種別の性質の表 */
const KIND_TRAITS_FILE = "src/lib/messaging/definition/kinds.ts";
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

/** 受け口の項目のファイル(<dir>/<名前>.ts(x) か <名前>/index.ts(x)、.override・.test は除く) */
function itemFiles(point, files) {
  const base = `${point.owner}/${point.spec.dir}/`;
  return files.filter((f) => {
    if (!f.startsWith(base) || /\.test\.[cm]?tsx?$/.test(f) || isOverridePath(f)) return false;
    const rest = f.slice(base.length);
    return /^[^/.]+\.tsx?$/.test(rest) || /^[^/.]+\/index\.tsx?$/.test(rest);
  });
}

/**
 * categories の受け口の項目(鍵 → { kind, channels, group, path })。字面で読む。点が宣言されていなければ null(照らさない)
 * @param {{ owner: string, name: string, spec: { dir?: string, export?: string } }[]} points
 * @param {string[]} files
 */
export function readCategories(repoRoot, points, files) {
  const point = points.find((p) => p.owner === CATEGORY_POINT.owner && p.name === CATEGORY_POINT.name);
  if (!point?.spec?.dir || !point.spec.export) return null;
  const categories = new Map();
  for (const path of itemFiles(point, files)) {
    const object = exportedObject(path, readFileSync(join(repoRoot, path), "utf8"), point.spec.export);
    if (!object) continue;
    const key = readLiteralProperty(object, "key");
    if (!key.present || typeof key.value !== "string") continue;
    const kind = readLiteralProperty(object, "kind");
    const channels = readLiteralProperty(object, "channels");
    const group = readLiteralProperty(object, "group");
    categories.set(key.value, {
      path,
      kind: typeof kind.value === "string" ? kind.value : null,
      channels: isStringArray(channels.value) ? channels.value : null,
      group: typeof group.value === "string" ? group.value : null,
    });
  }
  return categories;
}

/** categories の受け口の項目の鍵(書き出しのコマンドが使う) */
export function readCategoryKeys(repoRoot, points, files) {
  const categories = readCategories(repoRoot, points, files);
  return categories ? [...categories.keys()].sort() : null;
}

/** 種類のグループの鍵(点が無ければ空) */
function readGroupKeys(repoRoot, points, files) {
  const point = points.find((p) => p.owner === CATEGORY_GROUP_POINT.owner && p.name === CATEGORY_GROUP_POINT.name);
  if (!point?.spec?.dir || !point.spec.export) return new Set();
  const keys = new Set();
  for (const path of itemFiles(point, files)) {
    const object = exportedObject(path, readFileSync(join(repoRoot, path), "utf8"), point.spec.export);
    const key = object ? readLiteralProperty(object, "key") : { present: false };
    if (key.present && typeof key.value === "string") keys.add(key.value);
  }
  return keys;
}

/**
 * 種別の性質の表(MESSAGE_KIND_TRAITS)から、email を外せない種別と上流の物を止められない種別を字面で読む。
 * 各種別の行の `emailFixed: true` / `upstreamDisable: false`(…BASE の既定 = false / true)。表が無ければ空
 */
export function readKindTraits(repoRoot) {
  const traits = { emailFixed: new Set(), noUpstreamDisable: new Set() };
  const abs = join(repoRoot, KIND_TRAITS_FILE);
  if (!existsSync(abs)) return traits;
  const table = exportedObject(KIND_TRAITS_FILE, readFileSync(abs, "utf8"), "MESSAGE_KIND_TRAITS");
  if (!table) return traits;
  for (const row of table.properties) {
    if (!ts.isPropertyAssignment(row) || !(ts.isIdentifier(row.name) || ts.isStringLiteral(row.name))) continue;
    const value = unwrap(row.initializer);
    if (!ts.isObjectLiteralExpression(value)) continue;
    if (readLiteralProperty(value, "emailFixed").value === true) traits.emailFixed.add(row.name.text);
    if (readLiteralProperty(value, "upstreamDisable").value === false) traits.noUpstreamDisable.add(row.name.text);
  }
  return traits;
}

/** content の経路の名前(字面) */
function contentKeys(object) {
  for (const p of object.properties) {
    if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) || p.name.text !== "content") continue;
    const node = unwrap(p.initializer);
    if (!ts.isObjectLiteralExpression(node)) return null;
    return node.properties.flatMap((q) => (q.name && (ts.isIdentifier(q.name) || ts.isStringLiteral(q.name)) ? [q.name.text] : []));
  }
  return [];
}

/** 定義の category の問題(全部の連絡に必須・受け口の鍵・文面は種類の経路の分だけ) */
function categoryProblems(path, object, categories) {
  const category = readLiteralProperty(object, "category");
  if (category.problem) return [`${path}: ${category.problem}(category を categories の受け口と字面で照らすため)`];
  const list = [...categories.keys()].sort().join(" / ") || "項目なし";
  if (!category.present) return [`${path}: category(${list})を書く(全部の連絡に必須。種別と経路は種類から引く)`];
  const item = typeof category.value === "string" ? categories.get(category.value) : undefined;
  if (!item) return [`${path}: category ${JSON.stringify(category.value)} は categories の受け口に無い(${list})。先に categories/<名前>.ts を足す`];
  const keys = contentKeys(object);
  if (keys === null || !item.channels) return [];
  const missing = item.channels.filter((channel) => !keys.includes(channel));
  return missing.length > 0 ? [`${path}: 種類 ${category.value} の経路 ${missing.join(", ")} の文面(content.<経路>)が無い`] : [];
}

/** 種類の上書きの問題(email を外さない・グループ) */
function categoryOverrideProblems(repoRoot, categories, files, groupKeys, traits) {
  const problems = [];
  const groupKind = new Map();
  const effective = new Map();
  for (const [key, item] of categories) {
    const overridePath = item.path.replace(/(\/index)?\.tsx?$/, (m, index) => (index ? "/index.override.ts" : ".override.ts"));
    let channels = item.channels;
    let group = item.group;
    if (files.includes(overridePath)) {
      const override = exportedObject(overridePath, readFileSync(join(repoRoot, overridePath), "utf8"), "override");
      if (override) {
        const c = readLiteralProperty(override, "channels");
        const g = readLiteralProperty(override, "group");
        if (c.problem || g.problem) problems.push(`${overridePath}: ${c.problem ?? g.problem}(種類の経路・グループを字面で確かめるため)`);
        if (c.present && isStringArray(c.value)) {
          channels = c.value;
          if (traits.emailFixed.has(item.kind) && !c.value.includes("email")) {
            problems.push(`${overridePath}: 種別 ${item.kind} の種類 ${key} の経路から email は外せない(D86)`);
          }
          if (c.value.length === 0) problems.push(`${overridePath}: 種類 ${key} の経路を空にはできない`);
        }
        if (g.present && typeof g.value === "string") group = g.value;
      }
    }
    effective.set(key, { ...item, channels, group });
    if (!group) continue;
    if (!groupKeys.has(group)) {
      problems.push(`${item.path}: 種類 ${key} の group ${group} は categoryGroups の受け口に無い`);
      continue;
    }
    const seen = groupKind.get(group);
    if (!seen) groupKind.set(group, { kind: item.kind, key });
    else if (seen.kind !== item.kind) {
      problems.push(`${item.path}: グループ ${group} には種別 ${seen.kind} の種類 ${seen.key} があり、種別 ${item.kind} の種類 ${key} は入れられない(D82)`);
    }
  }
  return { problems, effective };
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

  const rawCategories = readCategories(repoRoot, points, files);
  const traits = readKindTraits(repoRoot);
  let categories = rawCategories;
  if (rawCategories) {
    const checked = categoryOverrideProblems(repoRoot, rawCategories, files, readGroupKeys(repoRoot, points, files), traits);
    problems.push(...checked.problems);
    categories = checked.effective;
  }

  for (const path of definitions) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const definition = exportedObject(path, text, MESSAGE_EXPORT);
    if (!definition) {
      problems.push(`${path}: 連絡の定義は export const ${MESSAGE_EXPORT} = defineMessage({ … }) の形で書く(点 ${point.name}、${point.declaredIn})`);
      continue;
    }
    if (categories) problems.push(...categoryProblems(path, definition, categories));
    const categoryItem = categories?.get(readLiteralProperty(definition, "category").value);
    const ownOverride = path.replace(/\.[A-Za-z]+$/, ".override.ts");
    const hasOverride = files.includes(ownOverride) && matchesGlob(ownOverride, overrideGlob);
    // 上流の functional の連絡は止められない(fork の自分の連絡は自由、D68)。required の連絡は下の守りが言う
    const isRequired = readLiteralProperty(definition, "required").value === true;
    if (!isRequired && hasOverride && categoryItem && traits.noUpstreamDisable.has(categoryItem.kind) && path.startsWith("src/features/core/")) {
      const object = exportedObject(ownOverride, readFileSync(join(repoRoot, ownOverride), "utf8"), overrideExport);
      const enabled = object ? readLiteralProperty(object, "enabled") : { present: false };
      if (enabled.problem) problems.push(`${ownOverride}: ${enabled.problem}(上流の ${categoryItem.kind} の連絡のため)`);
      else if (enabled.present && enabled.value !== true) {
        problems.push(`${ownOverride}: 上流の種別 ${categoryItem.kind} の連絡は止められない(enabled: false にしない。止めたいなら機能を閉じる、D68)`);
      }
    }
    const required = readLiteralProperty(definition, "required");
    const adminEditable = readLiteralProperty(definition, "adminEditable");
    for (const r of [required, adminEditable]) if (r.problem) problems.push(`${path}: ${r.problem}(required の守りを字面で確かめるため)`);
    if (required.problem || required.value !== true) continue;

    if (categoryItem?.channels && !categoryItem.channels.includes("email")) {
      problems.push(`${path}: required の連絡の種類(${categoryItem.path})の経路に "email" を含める`);
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
    const oEditable = readLiteralProperty(override, "adminEditable");
    for (const r of [enabled, oEditable]) if (r.problem) problems.push(`${overridePath}: ${r.problem}(上書きの先が required の連絡のため)`);
    if (!enabled.problem && enabled.present && enabled.value !== true) problems.push(`${overridePath}: required の連絡は止められない(enabled: false にしない)`);
    if (!oEditable.problem && oEditable.present && !(Array.isArray(oEditable.value) && oEditable.value.length === 0)) {
      problems.push(`${overridePath}: required の連絡に adminEditable は付けられない`);
    }
    const throttle = readPresence(override, "throttle");
    if (throttle.present && !throttle.isNull) problems.push(`${overridePath}: required の連絡に throttle は付けられない`);
  }
  return problems;
}
