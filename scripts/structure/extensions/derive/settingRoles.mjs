// scripts/structure/extensions/derive/settingRoles.mjs
// setting の上書きは権限を絞るだけ(広げない)。管理メニューの上書きと同じ決まり(scripts/structure/admin-menu/inspect.ts の widens)。
// キーの実効の権限 = キーの allowRoles → 所属セクション(ui.section)の allowRoles → どちらも無ければ管理カテゴリ全員
// (src/features/core/setting/services/server/access.ts と同じ解決)。上書きを重ねる前(項目のファイルの値)と後
// ({ ...項目, ...上書き } と同じ重ね方)で実効の権限を比べ、上書きの前に絞りがあったのに外のロールが入る・空になる・
// 絞りが消える(allowRoles を外す・絞りの無いセクションへ移す)と止める。セクションの上書きそのものの allowRoles も同じ。
// groups は画面の中の並びだけで、権限の解決(ui.section)に入らないので見ない。
// 値は字面で読む(生成器は読み込まない): 権限に関わる allowRoles・ui.section は文字列リテラル(の配列)で書く。
// 上書きの前に絞りがある所で読めない書き方をすると、確かめられないので止める。

import ts from "typescript";

const UNREADABLE = Symbol("unreadable");

/** export const <name> = { … } のオブジェクトのリテラル(無ければ null) */
function exportedObject(path, text, name) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
      let node = d.initializer;
      while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
      return ts.isObjectLiteralExpression(node) ? node : null;
    }
  }
  return null;
}

/** オブジェクトのリテラルの属性(無ければ undefined) */
function property(object, key) {
  for (const p of object.properties) {
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === key) return p;
  }
  return undefined;
}

const unwrap = (node) => {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
};
const isUndefined = (node) => ts.isIdentifier(node) && node.text === "undefined";

/** allowRoles の値: 書いていない = { present: false }、文字列の配列 / undefined = { present: true, roles }、それ以外 = UNREADABLE */
function readRoles(object) {
  const p = property(object, "allowRoles");
  if (p === undefined) return { present: false };
  if (!ts.isPropertyAssignment(p)) return UNREADABLE;
  const node = unwrap(p.initializer);
  if (isUndefined(node)) return { present: true, roles: undefined };
  if (!ts.isArrayLiteralExpression(node)) return UNREADABLE;
  const roles = [];
  for (const e of node.elements) {
    const v = unwrap(e);
    if (!ts.isStringLiteral(v) && !ts.isNoSubstitutionTemplateLiteral(v)) return UNREADABLE;
    roles.push(v.text);
  }
  return { present: true, roles };
}

/** ui.section の値: ui を書いていない = { present: false }、ui のセクション名 = { present: true, section }、読めない = UNREADABLE */
function readSection(object) {
  const p = property(object, "ui");
  if (p === undefined) return { present: false };
  if (!ts.isPropertyAssignment(p)) return UNREADABLE;
  const ui = unwrap(p.initializer);
  if (isUndefined(ui)) return { present: true, section: undefined };
  if (!ts.isObjectLiteralExpression(ui)) return UNREADABLE;
  const s = property(ui, "section");
  if (s === undefined) return { present: true, section: undefined };
  if (!ts.isPropertyAssignment(s)) return UNREADABLE;
  const v = unwrap(s.initializer);
  if (!ts.isStringLiteral(v) && !ts.isNoSubstitutionTemplateLiteral(v)) return UNREADABLE;
  return { present: true, section: v.text };
}

/** 広げているか(admin-menu の widens と同じ): 前に絞りがあり、後が絞り無し・空・外のロールを含む */
export const widensRoles = (before, after) => {
  if (!before || before.length === 0) return false;
  if (!after) return true;
  return after.length === 0 || after.some((role) => !before.includes(role));
};

const show = (roles) => (roles ? `[${roles.join(", ")}]` : "絞り無し(管理カテゴリ全員)");

/**
 * setting の上書きの権限の検査
 * @param {{ path: string, text: string, override?: string, overrideText?: string }[]} fieldItems fields の項目(override = 隣の上書きのパス)
 * @param {{ path: string, text: string, override?: string, overrideText?: string }[]} sectionItems sections の項目
 * @returns {string[]} 問題(1 件 1 行)
 */
export function checkSettingRoles(fieldItems, sectionItems) {
  const problems = [];
  const keyOf = (object) => {
    const p = object && property(object, "key");
    const v = p && ts.isPropertyAssignment(p) ? unwrap(p.initializer) : null;
    return v && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) ? v.text : null;
  };
  // セクションの前と後の権限(key → roles。UNREADABLE は読めない)
  const before = new Map();
  const after = new Map();
  for (const item of sectionItems) {
    const object = exportedObject(item.path, item.text, "section");
    const key = keyOf(object);
    if (!object || !key) continue;
    const base = readRoles(object);
    const baseRoles = base === UNREADABLE ? UNREADABLE : base.present ? base.roles : undefined;
    before.set(key, baseRoles);
    after.set(key, baseRoles);
    if (!item.override) continue;
    const over = exportedObject(item.override, item.overrideText ?? "", "override");
    if (!over) continue;
    const o = readRoles(over);
    if (o !== UNREADABLE && !o.present) continue;
    if (baseRoles === UNREADABLE) continue; // 上流の書き方が読めない所は比べない(上流の項目の問題は別)
    if (o === UNREADABLE) {
      if (baseRoles && baseRoles.length > 0) problems.push(`${item.override}: allowRoles を確かめられない(上流 ${show(baseRoles)} の中だけに絞る。文字列リテラルの配列で書く)`);
      after.set(key, UNREADABLE);
      continue;
    }
    after.set(key, o.roles);
    if (widensRoles(baseRoles, o.roles)) problems.push(`${item.override}: セクション "${key}" の allowRoles を広げている(上流 ${show(baseRoles)} の中だけに絞る)`);
  }
  const sectionRoles = (map, section) => (section === undefined ? undefined : map.get(section));
  for (const item of fieldItems) {
    if (!item.override) continue;
    const object = exportedObject(item.path, item.text, "field");
    const over = exportedObject(item.override, item.overrideText ?? "", "override");
    if (!object || !over) continue;
    const baseRoles = readRoles(object);
    const baseSection = readSection(object);
    if (baseRoles === UNREADABLE || baseSection === UNREADABLE) continue;
    const beforeRoles = baseRoles.present && baseRoles.roles !== undefined ? baseRoles.roles : sectionRoles(before, baseSection.present ? baseSection.section : undefined);
    if (beforeRoles === UNREADABLE || !beforeRoles || beforeRoles.length === 0) continue; // 前に絞りが無い = 広げようがない
    const oRoles = readRoles(over);
    const oSection = readSection(over);
    if (oRoles === UNREADABLE || oSection === UNREADABLE) {
      problems.push(`${item.override}: キーの権限を確かめられない(上流の実効 ${show(beforeRoles)} の中だけに絞る。allowRoles・ui.section は文字列リテラルで書く)`);
      continue;
    }
    const roles = oRoles.present ? oRoles.roles : baseRoles.present ? baseRoles.roles : undefined;
    const section = oSection.present ? oSection.section : baseSection.present ? baseSection.section : undefined;
    const afterRoles = roles !== undefined ? roles : sectionRoles(after, section);
    if (afterRoles === UNREADABLE) {
      problems.push(`${item.override}: 移した先のセクション "${section}" の権限を確かめられない(上流の実効 ${show(beforeRoles)} の中だけに絞る)`);
      continue;
    }
    if (widensRoles(beforeRoles, afterRoles)) {
      const how = oRoles.present ? "allowRoles" : `セクション "${section}" へ移して`;
      problems.push(`${item.override}: キーの権限を広げている(${how} ${show(beforeRoles)} → ${show(afterRoles)}。上流の実効の中だけに絞る)`);
    }
  }
  return problems;
}
